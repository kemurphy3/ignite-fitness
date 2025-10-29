/**
 * CSRF Protection Utility
 * Provides Cross-Site Request Forgery protection for all state-changing endpoints
 */

const crypto = require('crypto');
const SafeLogger = require('./safe-logging');

// Create safe logger for CSRF
const logger = SafeLogger.create({
    enableMasking: true,
    visibleChars: 4,
    maskChar: '*'
});

// CSRF token storage (in production, use Redis or database)
const csrfTokens = new Map();

// Configuration
const CSRF_CONFIG = {
    tokenLength: 32,
    tokenExpiry: 30 * 60 * 1000, // 30 minutes
    cookieName: 'csrf-token',
    headerName: 'x-csrf-token',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
};

/**
 * Generate CSRF token
 * @param {string} sessionId - Session ID
 * @returns {string} CSRF token
 */
function generateCSRFToken(sessionId) {
    const token = crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
    const expiresAt = Date.now() + CSRF_CONFIG.tokenExpiry;
    
    // Store token with session mapping
    csrfTokens.set(token, {
        sessionId,
        expiresAt,
        createdAt: Date.now()
    });
    
    // Clean up expired tokens
    cleanupExpiredTokens();
    
    logger.debug('CSRF token generated', {
        session_id: sessionId,
        token: token,
        expires_at: new Date(expiresAt).toISOString()
    });
    
    return token;
}

/**
 * Validate CSRF token
 * @param {string} token - CSRF token
 * @param {string} sessionId - Session ID
 * @returns {boolean} Token validity
 */
function validateCSRFToken(token, sessionId) {
    if (!token || !sessionId) {
        logger.warn('CSRF validation failed: missing token or session', {
            has_token: !!token,
            has_session: !!sessionId
        });
        return false;
    }
    
    const tokenData = csrfTokens.get(token);
    
    if (!tokenData) {
        logger.warn('CSRF validation failed: token not found', {
            token: token
        });
        return false;
    }
    
    // Check expiration
    if (Date.now() > tokenData.expiresAt) {
        csrfTokens.delete(token);
        logger.warn('CSRF validation failed: token expired', {
            token: token,
            expires_at: new Date(tokenData.expiresAt).toISOString()
        });
        return false;
    }
    
    // Check session match
    if (tokenData.sessionId !== sessionId) {
        logger.warn('CSRF validation failed: session mismatch', {
            token: token,
            expected_session: sessionId,
            actual_session: tokenData.sessionId
        });
        return false;
    }
    
    logger.debug('CSRF token validated successfully', {
        token: token,
        session_id: sessionId
    });
    
    return true;
}

/**
 * Revoke CSRF token
 * @param {string} token - CSRF token to revoke
 */
function revokeCSRFToken(token) {
    if (csrfTokens.has(token)) {
        csrfTokens.delete(token);
        logger.info('CSRF token revoked', {
            token: token
        });
    }
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [token, data] of csrfTokens.entries()) {
        if (now > data.expiresAt) {
            csrfTokens.delete(token);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        logger.debug('Cleaned up expired CSRF tokens', {
            count: cleanedCount,
            remaining: csrfTokens.size
        });
    }
}

/**
 * Get CSRF token for session
 * @param {string} sessionId - Session ID
 * @returns {string} CSRF token
 */
function getCSRFToken(sessionId) {
    // Check if session already has a valid token
    for (const [token, data] of csrfTokens.entries()) {
        if (data.sessionId === sessionId && Date.now() < data.expiresAt) {
            return token;
        }
    }
    
    // Generate new token
    return generateCSRFToken(sessionId);
}

/**
 * Create CSRF cookie
 * @param {string} token - CSRF token
 * @returns {string} Cookie string
 */
function createCSRFCookie(token) {
    const cookieParts = [
        `${CSRF_CONFIG.cookieName}=${token}`,
        'Path=/',
        `SameSite=${CSRF_CONFIG.sameSite}`,
        'Max-Age=1800' // 30 minutes
    ];
    
    if (CSRF_CONFIG.secure) {
        cookieParts.push('Secure');
    }
    
    if (CSRF_CONFIG.httpOnly) {
        cookieParts.push('HttpOnly');
    }
    
    return cookieParts.join('; ');
}

/**
 * Extract session ID from request
 * @param {Object} event - Netlify function event
 * @returns {string} Session ID
 */
function extractSessionId(event) {
    // Try to get session ID from various sources
    const sources = [
        event.headers.cookie,
        event.headers.Cookie,
        event.headers.authorization,
        event.headers.Authorization,
        event.headers['x-session-id'],
        event.headers['X-Session-Id']
    ];
    
    for (const source of sources) {
        if (source) {
            // Extract from cookie
            if (source.includes('session-id=')) {
                const match = source.match(/session-id=([^;]+)/);
                if (match) return match[1];
            }
            
            // Extract from JWT token
            if (source.startsWith('Bearer ')) {
                const token = source.substring(7);
                try {
                    // In production, properly decode JWT to get session ID
                    // For now, use token as session ID
                    return token.substring(0, 16);
                } catch (error) {
                    logger.warn('Failed to extract session from JWT', {
                        error: error.message
                    });
                }
            }
            
            // Direct session ID
            if (source.length > 8 && source.length < 64) {
                return source;
            }
        }
    }
    
    // Generate fallback session ID
    return crypto.randomBytes(16).toString('hex');
}

/**
 * CSRF middleware for Netlify functions
 * @param {Function} handler - Function handler
 * @returns {Function} Wrapped handler with CSRF protection
 */
function withCSRFProtection(handler) {
    return async (event, context) => {
        // Skip CSRF for GET requests and OPTIONS
        if (event.httpMethod === 'GET' || event.httpMethod === 'OPTIONS') {
            return handler(event, context);
        }
        
        // Skip CSRF for public endpoints
        const publicEndpoints = [
            '/auth/login',
            '/auth/register',
            '/auth/strava-oauth',
            '/auth/strava-callback'
        ];
        
        if (publicEndpoints.some(endpoint => event.path.includes(endpoint))) {
            return handler(event, context);
        }
        
        try {
            const sessionId = extractSessionId(event);
            
            // Get CSRF token from header
            const csrfToken = event.headers[CSRF_CONFIG.headerName] || 
                            event.headers[CSRF_CONFIG.headerName.toLowerCase()];
            
            // Validate CSRF token
            if (!validateCSRFToken(csrfToken, sessionId)) {
                logger.warn('CSRF validation failed', {
                    path: event.path,
                    method: event.httpMethod,
                    session_id: sessionId,
                    csrf_token: csrfToken
                });
                
                return {
                    statusCode: 403,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'CSRF token validation failed',
                        code: 'CSRF_INVALID'
                    })
                };
            }
            
            // Add CSRF token to response headers for subsequent requests
            const response = await handler(event, context);
            
            if (response && response.headers) {
                const newToken = getCSRFToken(sessionId);
                response.headers['Set-Cookie'] = createCSRFCookie(newToken);
            }
            
            return response;
            
        } catch (error) {
            logger.error('CSRF middleware error', {
                error: error.message,
                stack: error.stack
            });
            
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Internal server error',
                    code: 'CSRF_ERROR'
                })
            };
        }
    };
}

/**
 * Generate CSRF token endpoint
 */
exports.generateCSRF = async (event) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const sessionId = extractSessionId(event);
        const token = getCSRFToken(sessionId);
        
        logger.info('CSRF token generated for session', {
            session_id: sessionId,
            token: token
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Set-Cookie': createCSRFCookie(token)
            },
            body: JSON.stringify({
                csrf_token: token,
                expires_in: CSRF_CONFIG.tokenExpiry / 1000
            })
        };
        
    } catch (error) {
        logger.error('CSRF token generation failed', {
            error: error.message
        });
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Failed to generate CSRF token' })
        };
    }
};

/**
 * Get CSRF statistics
 * @returns {Object} CSRF statistics
 */
function getCSRFStats() {
    const now = Date.now();
    let activeTokens = 0;
    let expiredTokens = 0;
    
    for (const [token, data] of csrfTokens.entries()) {
        if (now < data.expiresAt) {
            activeTokens++;
        } else {
            expiredTokens++;
        }
    }
    
    return {
        active_tokens: activeTokens,
        expired_tokens: expiredTokens,
        total_tokens: csrfTokens.size,
        config: CSRF_CONFIG
    };
}

// Export functions
module.exports = {
    generateCSRFToken,
    validateCSRFToken,
    revokeCSRFToken,
    getCSRFToken,
    createCSRFCookie,
    extractSessionId,
    withCSRFProtection,
    getCSRFStats,
    CSRF_CONFIG
};
