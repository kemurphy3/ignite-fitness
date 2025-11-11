// Strava OAuth Exchange with Enhanced Security
const { getDB, withTransaction } = require('./utils/database');
const { TokenEncryption } = require('./utils/encryption');
const { stravaOAuthCircuit } = require('./utils/circuit-breaker');
const { auditLog } = require('./utils/audit');
const { checkEndpointRateLimit, getRateLimitHeaders } = require('./utils/rate-limiter');
const { createLogger } = require('./utils/safe-logging');

// Create safe logger for this context
const logger = createLogger('strava-oauth-exchange');

exports.handler = async event => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const sql = getDB();
  const encryption = new TokenEncryption();

  try {
    const { code, userId } = JSON.parse(event.body || '{}');

    // Input validation
    if (!code || !userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required parameters',
          details: { code: !!code, userId: !!userId },
        }),
      };
    }

    // Check rate limit
    const rateLimitResult = await checkEndpointRateLimit(sql, userId, '/strava-oauth-exchange');
    if (!rateLimitResult.allowed) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          ...getRateLimitHeaders(rateLimitResult),
        },
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          reason: rateLimitResult.reason,
          retryAfter: rateLimitResult.retryAfter,
        }),
      };
    }

    // Exchange code for tokens using circuit breaker
    const tokens = await stravaOAuthCircuit.execute(async () => {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Strava API error: ${response.status} - ${errorText}`);
      }

      return response.json();
    });

    // Validate token immediately
    const isValid = await validateStravaToken(tokens.access_token);
    if (!isValid) {
      throw new Error('Token validation failed');
    }

    if (!tokens.scope || !String(tokens.scope).includes('activity:read')) {
      throw new Error('Insufficient Strava scope: activity:read required');
    }

    // Encrypt tokens
    const { encrypted: encryptedAccess, keyVersion } = await encryption.encrypt(
      tokens.access_token
    );
    const { encrypted: encryptedRefresh } = await encryption.encrypt(
      tokens.refresh_token,
      keyVersion
    );

    // Store with transaction
    await withTransaction(sql, async tx => {
      await tx`
        INSERT INTO strava_tokens (
          user_id, encrypted_access_token, encrypted_refresh_token,
          expires_at, scope, athlete_id, encryption_key_version,
          last_validated_at
        ) VALUES (
          ${userId}, ${encryptedAccess}, ${encryptedRefresh},
          ${new Date(Date.now() + tokens.expires_in * 1000)},
          ${tokens.scope}, ${tokens.athlete?.id}, ${keyVersion},
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          encrypted_access_token = EXCLUDED.encrypted_access_token,
          encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
          expires_at = EXCLUDED.expires_at,
          scope = EXCLUDED.scope,
          athlete_id = EXCLUDED.athlete_id,
          encryption_key_version = EXCLUDED.encryption_key_version,
          last_validated_at = NOW(),
          updated_at = NOW()
      `;

      try {
        await tx`
          UPDATE users
          SET strava_connected = true,
              strava_scope = ${tokens.scope},
              strava_athlete_id = ${tokens.athlete?.id || null},
              updated_at = NOW()
          WHERE id = ${userId}
        `;
      } catch (updateError) {
        logger.warn('Failed to persist Strava connection status on users table', {
          error: updateError.message,
        });
      }

      await auditLog(tx, {
        user_id: userId,
        action: 'OAUTH_EXCHANGE',
        status: 'SUCCESS',
        ip_address: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
        user_agent: event.headers['user-agent'],
        metadata: {
          athlete_id: tokens.athlete?.id,
          scope: tokens.scope,
          expires_in: tokens.expires_in,
        },
      });
    });

    // Log successful OAuth exchange with safe metadata
    logger.oauthExchange({
      userId,
      athleteId: tokens.athlete?.id,
      scope: tokens.scope,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Circuit-Breaker-State': stravaOAuthCircuit.getStatus().state,
        ...getRateLimitHeaders(rateLimitResult),
      },
      body: JSON.stringify({
        success: true,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        athlete_id: tokens.athlete?.id,
        scope: tokens.scope,
      }),
    };
  } catch (error) {
    // Log error with sanitized data
    logger.error('OAuth exchange failed', {
      error_type: error.constructor.name,
      error_message: error.message,
      circuit_breaker_state: stravaOAuthCircuit.getStatus().state,
    });

    // Log the error
    try {
      const { userId } = JSON.parse(event.body || '{}');
      await auditLog(sql, {
        user_id: userId,
        action: 'OAUTH_EXCHANGE',
        status: 'FAILURE',
        error_message: error.message,
        ip_address: event.headers['x-forwarded-for'] || event.headers['x-real-ip'],
        user_agent: event.headers['user-agent'],
        metadata: {
          circuit_breaker_state: stravaOAuthCircuit.getStatus().state,
          error_type: error.constructor.name,
        },
      });
    } catch (auditError) {
      logger.error('Failed to log audit', { error: auditError.message });
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Token exchange failed',
        retry: stravaOAuthCircuit.getStatus().state !== 'OPEN',
        circuit_state: stravaOAuthCircuit.getStatus().state,
      }),
    };
  }
};

async function validateStravaToken(accessToken) {
  try {
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  } catch (error) {
    logger.error('Token validation failed', { error: error.message });
    return false;
  }
}
