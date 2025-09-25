const { STRAVA_TOKENS } = require('../../config.js');

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const { action, accessToken, refreshToken, data } = JSON.parse(event.body || '{}');
        
        if (!action) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Action is required' })
            };
        }

        let response;
        let responseData;

        switch (action) {
            case 'refresh_token':
                if (!refreshToken) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Refresh token required' })
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
                        headers,
                        body: JSON.stringify({ error: 'Access token required' })
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
                        headers,
                        body: JSON.stringify({ error: 'Access token and activity ID required' })
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
                        headers,
                        body: JSON.stringify({ error: 'Access token required' })
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
                    headers,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }

        responseData = await response.json();
        
        return {
            statusCode: response.status,
            headers,
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error('Strava Proxy Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
