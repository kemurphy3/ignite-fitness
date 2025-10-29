const fetch = require('node-fetch');
const SafeLogger = require('./utils/safe-logging');

// Create safe logger for this context
const logger = SafeLogger.create({
    enableMasking: true,
    visibleChars: 4,
    maskChar: '*'
});

const okJson = (data) => ({
    statusCode: 200,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: JSON.stringify(data)
});

const badReq = (message) => ({
    statusCode: 400,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: message })
});

const methodNotAllowed = () => ({
    statusCode: 405,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: 'Method not allowed' })
});

const okPreflight = () => ({
    statusCode: 200,
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: ''
});

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return okPreflight();
    if (event.httpMethod !== 'POST') return methodNotAllowed();

    try {
        const { code, state } = JSON.parse(event.body || '{}');
        
        if (!code) {
            return badReq('Missing authorization code');
        }

        const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
        const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
        
        if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Strava credentials not configured' })
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
                code: code,
                grant_type: 'authorization_code'
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            logger.error('Strava token exchange failed', { 
                status: tokenResponse.status,
                error_data: errorData
            });
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Failed to exchange authorization code for access token',
                    details: errorData
                })
            };
        }

        const tokenData = await tokenResponse.json();
        
        // Log token data safely (tokens will be masked)
        logger.info('Strava token exchange successful', {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: tokenData.expires_at,
            athlete_id: tokenData.athlete?.id
        });
        
        // Get athlete details
        const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
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
            athlete: athlete,
            message: 'Strava authorization successful'
        });

    } catch (error) {
        logger.error('Strava OAuth failed', {
            error_type: error.name,
            error_message: error.message
        });
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: false, 
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};
