const fetch = require('node-fetch');
const SafeLogger = require('./utils/safe-logging');

// Create safe logger for this context
const logger = SafeLogger.create({
  enableMasking: true,
  visibleChars: 4,
  maskChar: '*',
});

const okJson = data => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  },
  body: JSON.stringify(data),
});

const badReq = message => ({
  statusCode: 400,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify({ error: message }),
});

const methodNotAllowed = () => ({
  statusCode: 405,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify({ error: 'Method not allowed' }),
});

const okPreflight = () => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  },
  body: '',
});

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') {
    return okPreflight();
  }
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
  try {
    const crypto = require('crypto');
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

    const userId = decodedPayload.userId || decodedPayload.sub;
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

  try {
    const { code, state: _state } = JSON.parse(event.body || '{}');

    if (!code) {
      return badReq('Missing authorization code');
    }

    const { STRAVA_CLIENT_ID } = process.env;
    const { STRAVA_CLIENT_SECRET } = process.env;

    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Strava credentials not configured' }),
      };
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      logger.error('Strava token exchange failed', {
        status: tokenResponse.status,
        error_data: errorData,
      });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Failed to exchange authorization code for access token',
          details: errorData,
        }),
      };
    }

    const tokenData = await tokenResponse.json();

    // Log token data safely (tokens will be masked)
    logger.info('Strava token exchange successful', {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete_id: tokenData.athlete?.id,
    });

    // Get athlete details
    const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    let athlete = null;
    if (athleteResponse.ok) {
      athlete = await athleteResponse.json();
    }

    return okJson({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete,
      message: 'Strava authorization successful',
    });
  } catch (error) {
    logger.error('Strava OAuth failed', {
      error_type: error.name,
      error_message: error.message,
    });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message,
      }),
    };
  }
};
