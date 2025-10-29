/**
 * Security Headers Middleware
 * Implements defense-in-depth security headers
 */

const SafeLogger = require('./safe-logging');

const logger = SafeLogger.create({ enableMasking: true });

// Security headers configuration
const SECURITY_HEADERS = {
    // Content Security Policy
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://api.strava.com https://*.supabase.co",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ].join('; '),

    // HTTP Strict Transport Security
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

    // X-Frame-Options
    'X-Frame-Options': 'DENY',

    // X-Content-Type-Options
    'X-Content-Type-Options': 'nosniff',

    // X-XSS-Protection
    'X-XSS-Protection': '1; mode=block',

    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions Policy
    'Permissions-Policy': [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()'
    ].join(', '),

    // Cross-Origin Policies
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
};

/**
 * Add security headers to response
 * @param {Object} response - Response object
 * @param {Object} options - Header options
 * @returns {Object} Response with security headers
 */
function addSecurityHeaders(response, options = {}) {
    const config = {
        enableCSP: process.env.CSP_ENABLED !== 'false',
        enableHSTS: process.env.HSTS_ENABLED !== 'false',
        enableFrameOptions: process.env.X_FRAME_OPTIONS !== 'false',
        enableContentTypeOptions: process.env.X_CONTENT_TYPE_OPTIONS !== 'false',
        enableXSSProtection: true,
        enableReferrerPolicy: true,
        enablePermissionsPolicy: true,
        enableCORP: true,
        ...options
    };

    if (!response.headers) {
        response.headers = {};
    }

    // Add security headers based on configuration
    if (config.enableCSP) {
        response.headers['Content-Security-Policy'] = SECURITY_HEADERS['Content-Security-Policy'];
        response.headers['Content-Security-Policy-Report-Only'] = SECURITY_HEADERS['Content-Security-Policy'];
    }

    if (config.enableHSTS && process.env.NODE_ENV === 'production') {
        response.headers['Strict-Transport-Security'] = SECURITY_HEADERS['Strict-Transport-Security'];
    }

    if (config.enableFrameOptions) {
        response.headers['X-Frame-Options'] = SECURITY_HEADERS['X-Frame-Options'];
    }

    if (config.enableContentTypeOptions) {
        response.headers['X-Content-Type-Options'] = SECURITY_HEADERS['X-Content-Type-Options'];
    }

    if (config.enableXSSProtection) {
        response.headers['X-XSS-Protection'] = SECURITY_HEADERS['X-XSS-Protection'];
    }

    if (config.enableReferrerPolicy) {
        response.headers['Referrer-Policy'] = SECURITY_HEADERS['Referrer-Policy'];
    }

    if (config.enablePermissionsPolicy) {
        response.headers['Permissions-Policy'] = SECURITY_HEADERS['Permissions-Policy'];
    }

    if (config.enableCORP) {
        response.headers['Cross-Origin-Embedder-Policy'] = SECURITY_HEADERS['Cross-Origin-Embedder-Policy'];
        response.headers['Cross-Origin-Opener-Policy'] = SECURITY_HEADERS['Cross-Origin-Opener-Policy'];
        response.headers['Cross-Origin-Resource-Policy'] = SECURITY_HEADERS['Cross-Origin-Resource-Policy'];
    }

    return response;
}

/**
 * Security headers middleware for Netlify functions
 * @param {Function} handler - Function handler
 * @param {Object} options - Header options
 * @returns {Function} Wrapped handler with security headers
 */
function withSecurityHeaders(handler, options = {}) {
    return async (event, context) => {
        try {
            const response = await handler(event, context);
            return addSecurityHeaders(response, options);
        } catch (error) {
            logger.error('Security headers middleware error', {
                error: error.message
            });

            const errorResponse = {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Internal server error'
                })
            };

            return addSecurityHeaders(errorResponse, options);
        }
    };
}

/**
 * CSP violation reporting endpoint
 */
exports.cspReport = async (event) => {
    if (event.httpMethod !== 'POST') {
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
        const report = JSON.parse(event.body || '{}');
        
        logger.warn('CSP violation detected', {
            violation: report,
            user_agent: event.headers['user-agent'],
            ip: event.headers['x-forwarded-for'] || 'unknown'
        });

        // Store violation in database for analysis
        // Implementation depends on your database setup

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        logger.error('CSP report processing failed', {
            error: error.message
        });

        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Invalid CSP report' })
        };
    }
};

/**
 * Security headers test endpoint
 */
exports.securityTest = async (event) => {
    const response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            message: 'Security headers test',
            timestamp: new Date().toISOString(),
            headers: SECURITY_HEADERS
        })
    };

    return addSecurityHeaders(response);
};

module.exports = {
    addSecurityHeaders,
    withSecurityHeaders,
    SECURITY_HEADERS
};
