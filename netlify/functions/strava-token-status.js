// Strava Token Status Check with Caching
const { getDB } = require('./utils/database');
const { stravaCircuit } = require('./utils/circuit-breaker');
const { checkEndpointRateLimit, getRateLimitHeaders } = require('./utils/rate-limiter');

// Simple in-memory cache for development (use Redis in production)
const statusCache = new Map();

exports.handler = async (event) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const sql = getDB();

  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }

    // Check rate limit
    const rateLimitResult = await checkEndpointRateLimit(sql, userId, '/strava-token-status');
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
    const cached = statusCache.get(`status_${userId}`);
    if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Cache-Age': Math.floor((Date.now() - cached.timestamp) / 1000)
        },
        body: JSON.stringify({
          ...cached.data,
          cached: true,
          cache_age: Math.floor((Date.now() - cached.timestamp) / 1000)
        })
      };
    }

    const result = await sql`
      SELECT 
        expires_at,
        last_refresh_at,
        last_validated_at,
        refresh_count,
        encryption_key_version,
        athlete_id,
        scope,
        CASE 
          WHEN expires_at > NOW() + INTERVAL '5 minutes' THEN 'valid'
          WHEN expires_at > NOW() THEN 'expiring_soon'
          ELSE 'expired'
        END as status,
        EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry
      FROM strava_tokens
      WHERE user_id = ${userId}
    `;

    if (!result.length) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'No token found for user',
          status: 'not_found'
        })
      };
    }

    const tokenData = result[0];
    const status = {
      user_id: userId,
      status: tokenData.status,
      expires_at: tokenData.expires_at,
      seconds_until_expiry: Math.max(0, Math.floor(tokenData.seconds_until_expiry)),
      last_refresh_at: tokenData.last_refresh_at,
      last_validated_at: tokenData.last_validated_at,
      refresh_count: tokenData.refresh_count,
      encryption_key_version: tokenData.encryption_key_version,
      athlete_id: tokenData.athlete_id,
      scope: tokenData.scope,
      circuit_breaker_status: stravaCircuit.getStatus(),
      needs_refresh: tokenData.status === 'expiring_soon' || tokenData.status === 'expired',
      timestamp: new Date().toISOString()
    };

    // Cache for 30 seconds
    statusCache.set(`status_${userId}`, {
      data: status,
      timestamp: Date.now()
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-Circuit-Breaker-State': stravaCircuit.getStatus().state
      },
      body: JSON.stringify(status)
    };

  } catch (error) {
    console.error('Status check error:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Status check failed',
        circuit_state: stravaCircuit.getStatus().state
      })
    };
  }
};
