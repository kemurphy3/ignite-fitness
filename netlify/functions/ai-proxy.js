const { STRAVA_TOKENS, API_CONFIG } = require('../../config.js');

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
        const { method, endpoint, data } = JSON.parse(event.body || '{}');
        
        // Validate request
        if (!method || !endpoint) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Method and endpoint are required' })
            };
        }

        let response;
        let apiKey;

        // Route to appropriate API based on endpoint
        if (endpoint.includes('openai') || endpoint.includes('gpt')) {
            apiKey = API_CONFIG.openai.apiKey;
            if (!apiKey) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'OpenAI API key not configured' })
                };
            }
            
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } else if (endpoint.includes('strava')) {
            // Handle Strava API calls
            const accessToken = data.accessToken;
            if (!accessToken) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Strava access token required' })
                };
            }
            
            response = await fetch(`https://www.strava.com/api/v3${endpoint.replace('/strava', '')}`, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: data.body ? JSON.stringify(data.body) : undefined
            });
        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Unsupported API endpoint' })
            };
        }

        const responseData = await response.json();
        
        return {
            statusCode: response.status,
            headers,
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error('AI Proxy Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
