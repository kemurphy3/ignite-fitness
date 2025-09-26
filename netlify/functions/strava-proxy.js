const { STRAVA_TOKENS } = require('../../config.js');
const jwt = require('jsonwebtoken');

// Security headers for all responses
const securityHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
};

// JWT verification function
function verifyJWT(headers) {
    const authHeader = headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'MISSING_TOKEN', statusCode: 401 };
    }
    
    const token = authHeader.substring(7);
    
    try {
        const jwtSecret = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-at-least-32-characters';
        const decoded = jwt.verify(token, jwtSecret, {
            algorithms: ['HS256'],
            maxAge: '24h',
            clockTolerance: 30
        });
        
        if (!decoded.sub || typeof decoded.sub !== 'string') {
            return { error: 'INVALID_SUBJECT', statusCode: 401 };
        }
        
        if (!decoded.exp || typeof decoded.exp !== 'number') {
            return { error: 'INVALID_EXPIRATION', statusCode: 401 };
        }
        
        return { 
            success: true, 
            userId: decoded.sub 
        };
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { error: 'TOKEN_EXPIRED', statusCode: 401 };
        } else if (error.name === 'JsonWebTokenError') {
            return { error: 'INVALID_TOKEN', statusCode: 401 };
        } else {
            console.error('JWT verification error:', {
                type: error.name,
                message: error.message,
                timestamp: new Date().toISOString()
            });
            return { error: 'TOKEN_VERIFICATION_FAILED', statusCode: 401 };
        }
    }
}

// Response helpers
const unauthorized = (message = 'Unauthorized - Valid JWT token required') => ({
    statusCode: 401,
    headers: securityHeaders,
    body: JSON.stringify({ 
        error: 'UNAUTHORIZED',
        message,
        code: 'AUTH_REQUIRED'
    })
});

const methodNotAllowed = () => ({
    statusCode: 405,
    headers: securityHeaders,
    body: JSON.stringify({ 
        error: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed',
        code: 'INVALID_METHOD'
    })
});

const okPreflight = () => ({
    statusCode: 200,
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: ''
});

exports.handler = async (event, context) => {
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return okPreflight();
    }
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return methodNotAllowed();
    }

    try {
        // Verify JWT authentication
        const authResult = verifyJWT(event.headers);
        if (!authResult.success) {
            return unauthorized(authResult.error);
        }
        const { action, accessToken, refreshToken, data } = JSON.parse(event.body || '{}');
        
        if (!action) {
            return {
                statusCode: 400,
                headers: securityHeaders,
                body: JSON.stringify({ 
                    error: 'BAD_REQUEST',
                    message: 'Action is required',
                    code: 'MISSING_ACTION'
                })
            };
        }

        let response;
        let responseData;

        switch (action) {
            case 'refresh_token':
                if (!refreshToken) {
                    return {
                        statusCode: 400,
                        headers: securityHeaders,
                        body: JSON.stringify({ 
                            error: 'BAD_REQUEST',
                            message: 'Refresh token required',
                            code: 'MISSING_REFRESH_TOKEN'
                        })
                    };
                }
                
                response = await fetch('https://www.strava.com/oauth/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        client_id: STRAVA_TOKENS.clientId,
                        client_secret: STRAVA_TOKENS.clientSecret,
                        refresh_token: refreshToken,
                        grant_type: 'refresh_token'
                    })
                });
                break;

            case 'get_activities':
                if (!accessToken) {
                    return {
                        statusCode: 400,
                        headers: securityHeaders,
                        body: JSON.stringify({ 
                            error: 'BAD_REQUEST',
                            message: 'Access token required',
                            code: 'MISSING_ACCESS_TOKEN'
                        })
                    };
                }
                
                const page = data?.page || 1;
                const perPage = data?.per_page || 30;
                
                response = await fetch(`https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                break;

            case 'get_activity':
                if (!accessToken || !data?.activityId) {
                    return {
                        statusCode: 400,
                        headers: securityHeaders,
                        body: JSON.stringify({ 
                            error: 'BAD_REQUEST',
                            message: 'Access token and activity ID required',
                            code: 'MISSING_ACCESS_TOKEN_OR_ACTIVITY_ID'
                        })
                    };
                }
                
                response = await fetch(`https://www.strava.com/api/v3/activities/${data.activityId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                break;

            case 'get_athlete':
                if (!accessToken) {
                    return {
                        statusCode: 400,
                        headers: securityHeaders,
                        body: JSON.stringify({ 
                            error: 'BAD_REQUEST',
                            message: 'Access token required',
                            code: 'MISSING_ACCESS_TOKEN'
                        })
                    };
                }
                
                response = await fetch('https://www.strava.com/api/v3/athlete', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                break;

            default:
                return {
                    statusCode: 400,
                    headers: securityHeaders,
                    body: JSON.stringify({ 
                        error: 'BAD_REQUEST',
                        message: 'Invalid action',
                        code: 'INVALID_ACTION'
                    })
                };
        }

        responseData = await response.json();
        
        return {
            statusCode: response.status,
            headers: securityHeaders,
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error('Strava Proxy Error:', {
            type: error.name,
            message: error.message,
            timestamp: new Date().toISOString()
        });
        return {
            statusCode: 500,
            headers: securityHeaders,
            body: JSON.stringify({ 
                error: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
                code: 'SERVER_ERROR'
            })
        };
    }
};
