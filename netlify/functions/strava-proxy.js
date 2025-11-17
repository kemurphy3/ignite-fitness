// Strava API configuration - using environment variables directly
const STRAVA_TOKENS = {
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
};
if (!STRAVA_TOKENS.clientId || !STRAVA_TOKENS.clientSecret) {
  throw new Error(
    'Strava client configuration not provided. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.'
  );
}

const crypto = require('crypto');
const { createLogger } = require('./utils/safe-logging');
const RateLimiter = require('./utils/rate-limiter');

// Create safe logger for this context
const logger = createLogger('strava-proxy');

// Initialize rate limiter for Strava API
const rateLimiter = new RateLimiter({
  maxRequests: 600, // Strava limit: 600 requests per 15 minutes
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRetries: 3,
  baseDelayMs: 1000,
  logger,
});

// Rate Limiting (In-Memory for MVP, Redis for production) - User-level rate limiting
const userRateLimitStore = new Map();

function checkUserRateLimit(userId) {
  const now = Date.now();
  const window = 60 * 1000; // 1 minute
  const maxRequests = 10; // 10 requests per minute

  const userKey = `${userId}_${Math.floor(now / window)}`;
  const currentCount = userRateLimitStore.get(userKey) || 0;

  if (currentCount >= maxRequests) {
    return false;
  }

  userRateLimitStore.set(userKey, currentCount + 1);

  // Cleanup old entries
  for (const [key] of userRateLimitStore.entries()) {
    const keyTime = parseInt(key.split('_')[1]);
    if (now - keyTime * window > window * 2) {
      userRateLimitStore.delete(key);
    }
  }

  return true;
}

// Security headers for all responses
const securityHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
};

// Response helpers
const methodNotAllowed = () => ({
  statusCode: 405,
  headers: securityHeaders,
  body: JSON.stringify({
    error: 'METHOD_NOT_ALLOWED',
    message: 'Only POST requests are allowed',
    code: 'INVALID_METHOD',
  }),
});

const okPreflight = () => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: '',
});

exports.handler = async (event, _context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return okPreflight();
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return methodNotAllowed();
  }

  // User Authentication Check
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Authentication required',
        message: 'Strava integration requires user authentication',
      }),
    };
  }

  // Validate user token (same validation code as AI proxy)
  let userId = null;
  try {
    const token = authHeader.substring(7);
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());

    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    // Verify signature
    const { JWT_SECRET } = process.env;
    if (JWT_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64');
      if (signature !== expectedSignature) {
        throw new Error('Invalid token signature');
      }
    }

    userId = decodedPayload.userId || decodedPayload.sub;
    if (!userId) {
      throw new Error('Invalid user token');
    }
  } catch (error) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid user token' }),
    };
  }

  // Apply user-level rate limiting
  if (!checkUserRateLimit(userId)) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Maximum 10 requests per minute exceeded',
      }),
    };
  }

  try {
    const { action, accessToken, refreshToken, data } = JSON.parse(event.body || '{}');

    if (!action) {
      return {
        statusCode: 400,
        headers: securityHeaders,
        body: JSON.stringify({
          error: 'BAD_REQUEST',
          message: 'Action is required',
          code: 'MISSING_ACTION',
        }),
      };
    }

    let response;

    switch (action) {
      case 'refresh_token':
        if (!refreshToken) {
          return {
            statusCode: 400,
            headers: securityHeaders,
            body: JSON.stringify({
              error: 'BAD_REQUEST',
              message: 'Refresh token required',
              code: 'MISSING_REFRESH_TOKEN',
            }),
          };
        }

        response = await rateLimiter.executeRequest(async () => {
          return await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: STRAVA_TOKENS.clientId,
              client_secret: STRAVA_TOKENS.clientSecret,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }),
          });
        });
        break;

      case 'get_activities': {
        if (!accessToken) {
          return {
            statusCode: 400,
            headers: securityHeaders,
            body: JSON.stringify({
              error: 'BAD_REQUEST',
              message: 'Access token required',
              code: 'MISSING_ACCESS_TOKEN',
            }),
          };
        }

        const page = data?.page || 1;
        const perPage = data?.per_page || 30;

        response = await rateLimiter.executeRequest(async () => {
          return await fetch(
            `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
        });
        break;
      }

      case 'get_activity': {
        if (!accessToken || !data?.activityId) {
          return {
            statusCode: 400,
            headers: securityHeaders,
            body: JSON.stringify({
              error: 'BAD_REQUEST',
              message: 'Access token and activity ID required',
              code: 'MISSING_ACCESS_TOKEN_OR_ACTIVITY_ID',
            }),
          };
        }

        response = await rateLimiter.executeRequest(async () => {
          return await fetch(`https://www.strava.com/api/v3/activities/${data.activityId}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
        });
        break;
      }

      case 'get_athlete': {
        if (!accessToken) {
          return {
            statusCode: 400,
            headers: securityHeaders,
            body: JSON.stringify({
              error: 'BAD_REQUEST',
              message: 'Access token required',
              code: 'MISSING_ACCESS_TOKEN',
            }),
          };
        }

        response = await rateLimiter.executeRequest(async () => {
          return await fetch('https://www.strava.com/api/v3/athlete', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
        });
        break;
      }

      case 'get_rate_limit_status': {
        // Return current rate limiter status
        const status = rateLimiter.getStatus();
        return {
          statusCode: 200,
          headers: securityHeaders,
          body: JSON.stringify({
            success: true,
            rateLimitStatus: status,
          }),
        };
      }

      default:
        return {
          statusCode: 400,
          headers: securityHeaders,
          body: JSON.stringify({
            error: 'BAD_REQUEST',
            message: 'Invalid action',
            code: 'INVALID_ACTION',
          }),
        };
    }

    const responseData = await response.json();

    return {
      statusCode: response.status,
      headers: securityHeaders,
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    // Handle rate limiting errors specifically
    if (
      error.message.includes('Rate limit exceeded') ||
      error.message.includes('Circuit breaker')
    ) {
      logger.warn('Rate limit error', {
        error_message: error.message,
        user_id: userId || 'unknown',
      });

      return {
        statusCode: 429,
        headers: {
          ...securityHeaders,
          'Retry-After': '60', // Suggest retry after 60 seconds
        },
        body: JSON.stringify({
          error: 'RATE_LIMIT_EXCEEDED',
          message: error.message,
          code: 'RATE_LIMITED',
          retryAfter: 60,
        }),
      };
    }

    logger.error('Strava proxy failed', {
      error_type: error.name,
      error_message: error.message,
      user_id: userId || 'unknown',
    });

    return {
      statusCode: 500,
      headers: securityHeaders,
      body: JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        code: 'SERVER_ERROR',
      }),
    };
  }
};
