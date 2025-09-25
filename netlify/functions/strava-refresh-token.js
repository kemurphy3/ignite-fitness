// Strava Token Refresh with Race Condition Prevention
const { getDB } = require('./utils/database');
const { TokenEncryption } = require('./utils/encryption');
const { stravaCircuit } = require('./utils/circuit-breaker');
const { acquireRefreshLock, releaseLock } = require('./utils/distributed-lock');
const { auditLog } = require('./utils/audit');
const { checkEndpointRateLimit, getRateLimitHeaders } = require('./utils/rate-limiter');

// Simple in-memory cache for development (use Redis in production)
const tokenCache = new Map();

exports.handler = async (event) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const sql = getDB();
  const encryption = new TokenEncryption();
  let lock = null;
  
  try {
    const { userId } = JSON.parse(event.body || '{}');
    
    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }

    // Check rate limit
    const rateLimitResult = await checkEndpointRateLimit(sql, userId, '/strava-refresh-token');
    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          ...getRateLimitHeaders(rateLimitResult)
        },
        body: JSON.stringify({ 
          error: 'Rate limit exceeded',
          reason: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter
        })
      };
    }
    
    // Check cache first
    const cachedToken = tokenCache.get(`token_${userId}`);
    if (cachedToken && new Date(cachedToken.expires_at) > new Date(Date.now() + 60000)) {
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        },
        body: JSON.stringify({ 
          success: true, 
          cached: true,
          expires_at: cachedToken.expires_at
        })
      };
    }
    
    // Acquire distributed lock
    lock = await acquireRefreshLock(sql, userId);
    if (!lock.acquired) {
      return {
        statusCode: 423, // Locked
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': '5'
        },
        body: JSON.stringify({ 
          error: 'Token refresh in progress',
          retryAfter: lock.retryAfter,
          reason: lock.reason
        })
      };
    }
    
    // Get current token
    const result = await sql`
      SELECT * FROM strava_tokens 
      WHERE user_id = ${userId}
    `;
    
    if (!result.length) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No token found for user' })
      };
    }
    
    const token = result[0];
    
    // Check if refresh is actually needed
    if (new Date(token.expires_at) > new Date(Date.now() + 300000)) { // 5 minutes buffer
      // Update cache
      tokenCache.set(`token_${userId}`, {
        expires_at: token.expires_at
      });
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: true, 
          refresh_not_needed: true,
          expires_at: token.expires_at
        })
      };
    }
    
    // Decrypt refresh token
    const refreshToken = await encryption.decrypt(token.encrypted_refresh_token);
    
    // Refresh using circuit breaker
    const newTokens = await stravaCircuit.execute(async () => {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Strava refresh failed: ${response.status} - ${error}`);
      }
      
      return response.json();
    });
    
    // Validate new token
    const isValid = await validateStravaToken(newTokens.access_token);
    if (!isValid) {
      throw new Error('New token validation failed');
    }
    
    // Encrypt and update
    const { encrypted: encryptedAccess, keyVersion } = await encryption.encrypt(newTokens.access_token);
    const { encrypted: encryptedRefresh } = await encryption.encrypt(newTokens.refresh_token, keyVersion);
    
    const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
    
    await sql`
      UPDATE strava_tokens SET
        encrypted_access_token = ${encryptedAccess},
        encrypted_refresh_token = ${encryptedRefresh},
        expires_at = ${newExpiresAt},
        encryption_key_version = ${keyVersion},
        last_refresh_at = NOW(),
        last_validated_at = NOW(),
        refresh_count = refresh_count + 1,
        updated_at = NOW()
      WHERE user_id = ${userId}
    `;
    
    // Update cache
    tokenCache.set(`token_${userId}`, {
      expires_at: newExpiresAt
    });
    
    await auditLog(sql, {
      user_id: userId,
      action: 'TOKEN_REFRESH',
      status: 'SUCCESS',
      metadata: {
        old_expires_at: token.expires_at,
        new_expires_at: newExpiresAt,
        refresh_count: token.refresh_count + 1
      }
    });
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-Circuit-Breaker-State': stravaCircuit.getStatus().state
      },
      body: JSON.stringify({
        success: true,
        expires_at: newExpiresAt.toISOString(),
        refresh_count: token.refresh_count + 1
      })
    };
    
  } catch (error) {
    console.error('Token refresh error:', error);
    
    // Log the error
    try {
      const { userId } = JSON.parse(event.body || '{}');
      await auditLog(sql, {
        user_id: userId,
        action: 'TOKEN_REFRESH',
        status: 'FAILURE',
        error_message: error.message,
        metadata: {
          circuit_breaker_state: stravaCircuit.getStatus().state,
          error_type: error.constructor.name
        }
      });
    } catch (auditError) {
      console.error('Failed to log audit:', auditError);
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Token refresh failed',
        circuit_state: stravaCircuit.getStatus().state,
        retry: stravaCircuit.getStatus().state !== 'OPEN'
      })
    };
    
  } finally {
    if (lock?.acquired) {
      await releaseLock(sql, lock.lockId, JSON.parse(event.body || '{}').userId);
    }
  }
};

async function validateStravaToken(accessToken) {
  try {
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.ok;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
}
