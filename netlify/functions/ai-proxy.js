const { STRAVA_TOKENS, API_CONFIG } = require('../../config.js');
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

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map();

// Rate limiting configuration
const RATE_LIMIT = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute per user
    cleanupInterval: 5 * 60 * 1000 // Clean up every 5 minutes
};

// Clean up old rate limit entries
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.firstRequest > RATE_LIMIT.windowMs) {
            rateLimitStore.delete(key);
        }
    }
}, RATE_LIMIT.cleanupInterval);

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

// Rate limiting function
function checkRateLimit(userId) {
    const now = Date.now();
    const key = `ai-proxy:${userId}`;
    const userData = rateLimitStore.get(key);
    
    if (!userData) {
        rateLimitStore.set(key, {
            firstRequest: now,
            requestCount: 1
        });
        return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
    }
    
    // Reset window if expired
    if (now - userData.firstRequest > RATE_LIMIT.windowMs) {
        rateLimitStore.set(key, {
            firstRequest: now,
            requestCount: 1
        });
        return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
    }
    
    // Check if limit exceeded
    if (userData.requestCount >= RATE_LIMIT.maxRequests) {
        return { 
            allowed: false, 
            remaining: 0,
            resetTime: userData.firstRequest + RATE_LIMIT.windowMs
        };
    }
    
    // Increment counter
    userData.requestCount++;
    rateLimitStore.set(key, userData);
    
    return { 
        allowed: true, 
        remaining: RATE_LIMIT.maxRequests - userData.requestCount 
    };
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

const tooManyRequests = (resetTime) => ({
    statusCode: 429,
    headers: {
        ...securityHeaders,
        'Retry-After': Math.ceil((resetTime - Date.now()) / 1000)
    },
    body: JSON.stringify({ 
        error: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
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
        
        // Check rate limiting
        const rateLimitResult = checkRateLimit(authResult.userId);
        if (!rateLimitResult.allowed) {
            return tooManyRequests(rateLimitResult.resetTime);
        }

        const { method, endpoint, data } = JSON.parse(event.body || '{}');
        
        // Validate request
        if (!method || !endpoint) {
            return {
                statusCode: 400,
                headers: {
                    ...securityHeaders,
                    'X-RateLimit-Remaining': rateLimitResult.remaining,
                    'X-RateLimit-Reset': new Date(rateLimitResult.resetTime || Date.now() + RATE_LIMIT.windowMs).toISOString()
                },
                body: JSON.stringify({ 
                    error: 'BAD_REQUEST',
                    message: 'Method and endpoint are required',
                    code: 'MISSING_PARAMETERS'
                })
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
                    headers: {
                        ...securityHeaders,
                        'X-RateLimit-Remaining': rateLimitResult.remaining,
                        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime || Date.now() + RATE_LIMIT.windowMs).toISOString()
                    },
                    body: JSON.stringify({ 
                        error: 'INTERNAL_SERVER_ERROR',
                        message: 'OpenAI API key not configured',
                        code: 'CONFIGURATION_ERROR'
                    })
                };
            }
            
            // Ensure proper OpenAI API format
            const openaiData = {
                model: data.model || 'gpt-3.5-turbo',
                messages: data.messages || [{ role: 'user', content: data.content || data.prompt || 'Hello' }],
                max_tokens: data.max_tokens || 500,
                temperature: data.temperature || 0.7,
                ...data
            };
            
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(openaiData)
            });
        } else if (endpoint.includes('strava')) {
            // Handle Strava API calls
            const accessToken = data.accessToken;
            if (!accessToken) {
                return {
                    statusCode: 400,
                    headers: {
                        ...securityHeaders,
                        'X-RateLimit-Remaining': rateLimitResult.remaining,
                        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime || Date.now() + RATE_LIMIT.windowMs).toISOString()
                    },
                    body: JSON.stringify({ 
                        error: 'BAD_REQUEST',
                        message: 'Strava access token required',
                        code: 'MISSING_ACCESS_TOKEN'
                    })
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
                headers: {
                    ...securityHeaders,
                    'X-RateLimit-Remaining': rateLimitResult.remaining,
                    'X-RateLimit-Reset': new Date(rateLimitResult.resetTime || Date.now() + RATE_LIMIT.windowMs).toISOString()
                },
                body: JSON.stringify({ 
                    error: 'BAD_REQUEST',
                    message: 'Unsupported API endpoint',
                    code: 'UNSUPPORTED_ENDPOINT'
                })
            };
        }

        const responseData = await response.json();
        
        return {
            statusCode: response.status,
            headers: {
                ...securityHeaders,
                'X-RateLimit-Remaining': rateLimitResult.remaining,
                'X-RateLimit-Reset': new Date(rateLimitResult.resetTime || Date.now() + RATE_LIMIT.windowMs).toISOString()
            },
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error('AI Proxy Error:', {
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
