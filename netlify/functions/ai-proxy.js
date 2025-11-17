// API configuration - using environment variables directly
const _STRAVA_TOKENS = {
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
};

const API_CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
};
const crypto = require('crypto');

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

// Rate Limiting (In-Memory for MVP, Redis for production)
const rateLimitStore = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const window = 60 * 1000; // 1 minute
  const maxRequests = 10; // 10 requests per minute

  const userKey = `${userId}_${Math.floor(now / window)}`;
  const currentCount = rateLimitStore.get(userKey) || 0;

  if (currentCount >= maxRequests) {
    return false;
  }

  rateLimitStore.set(userKey, currentCount + 1);

  // Cleanup old entries
  for (const [key] of rateLimitStore.entries()) {
    const keyTime = parseInt(key.split('_')[1]);
    if (now - keyTime * window > window * 2) {
      rateLimitStore.delete(key);
    }
  }

  return true;
}

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
        message: 'AI proxy requires user authentication',
      }),
    };
  }

  const token = authHeader.substring(7);
  const { JWT_SECRET } = process.env;

  // Simple user token validation
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) {
      throw new Error('Invalid token format');
    }

    // Verify signature
    if (JWT_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64');
      if (signature !== expectedSignature) {
        throw new Error('Invalid token signature');
      }
    }

    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());

    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    // Extract user ID for rate limiting
    const userId = decodedPayload.userId || decodedPayload.sub;
    if (!userId) {
      throw new Error('Invalid user token');
    }

    // Store userId for rate limiting
    event.userId = userId;
  } catch (error) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Access denied',
        message: 'Invalid or expired user token',
      }),
    };
  }

  // Apply rate limiting
  if (!checkRateLimit(event.userId)) {
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
    const { method, endpoint, data } = JSON.parse(event.body || '{}');

    // Validate request
    if (!method || !endpoint) {
      return {
        statusCode: 400,
        headers: securityHeaders,
        body: JSON.stringify({
          error: 'BAD_REQUEST',
          message: 'Method and endpoint are required',
          code: 'MISSING_PARAMETERS',
        }),
      };
    }

    let response;
    let apiKey;

    // Route to appropriate API based on endpoint
    if (endpoint.includes('openai') || endpoint.includes('gpt')) {
      const { apiKey: openaiApiKey } = API_CONFIG.openai;
      apiKey = openaiApiKey;
      if (!apiKey) {
        return {
          statusCode: 500,
          headers: securityHeaders,
          body: JSON.stringify({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'OpenAI API key not configured',
            code: 'CONFIGURATION_ERROR',
          }),
        };
      }

      // Ensure proper OpenAI API format
      const openaiData = {
        model: data.model || 'gpt-3.5-turbo',
        messages: data.messages || [
          { role: 'user', content: data.content || data.prompt || 'Hello' },
        ],
        max_tokens: data.max_tokens || 500,
        temperature: data.temperature || 0.7,
        ...data,
      };

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(openaiData),
      });
    } else if (endpoint.includes('strava')) {
      // Handle Strava API calls
      const { accessToken } = data;
      if (!accessToken) {
        return {
          statusCode: 400,
          headers: securityHeaders,
          body: JSON.stringify({
            error: 'BAD_REQUEST',
            message: 'Strava access token required',
            code: 'MISSING_ACCESS_TOKEN',
          }),
        };
      }

      response = await fetch(`https://www.strava.com/api/v3${endpoint.replace('/strava', '')}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: data.body ? JSON.stringify(data.body) : undefined,
      });
    } else {
      return {
        statusCode: 400,
        headers: securityHeaders,
        body: JSON.stringify({
          error: 'BAD_REQUEST',
          message: 'Unsupported API endpoint',
          code: 'UNSUPPORTED_ENDPOINT',
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
    console.error('AI Proxy Error:', {
      type: error.name,
      message: error.message,
      timestamp: new Date().toISOString(),
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
