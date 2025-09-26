/**
 * Error Handler Utility
 * 
 * Provides secure error handling that:
 * - Strips sensitive data from errors
 * - Generates unique error IDs for debugging
 * - Logs detailed errors server-side only
 * - Returns safe error responses to clients
 */

const crypto = require('crypto');

// Sensitive patterns to remove from error messages
const SENSITIVE_PATTERNS = [
    /JWT_SECRET/gi,
    /password/gi,
    /secret/gi,
    /token/gi,
    /key/gi,
    /credential/gi,
    /auth/gi,
    /database/gi,
    /connection/gi,
    /url/gi,
    /host/gi,
    /port/gi,
    /user/gi,
    /pass/gi,
    /pwd/gi,
    /api_key/gi,
    /access_token/gi,
    /refresh_token/gi,
    /client_secret/gi,
    /client_id/gi,
    /private/gi,
    /internal/gi,
    /system/gi,
    /server/gi,
    /config/gi,
    /env/gi,
    /process\.env/gi
];

// Error types that should be sanitized
const SANITIZE_ERROR_TYPES = [
    'Error',
    'TypeError',
    'ReferenceError',
    'SyntaxError',
    'EvalError',
    'RangeError',
    'URIError'
];

/**
 * Generate a unique error ID for tracking
 * @returns {string} Unique error ID
 */
function generateErrorId() {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Sanitize error message by removing sensitive information
 * @param {string} message - Error message to sanitize
 * @returns {string} Sanitized error message
 */
function sanitizeErrorMessage(message) {
    if (!message || typeof message !== 'string') {
        return 'An error occurred';
    }
    
    let sanitized = message;
    
    // Remove sensitive patterns
    SENSITIVE_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    
    // Remove stack traces
    sanitized = sanitized.replace(/\s+at\s+.*$/gm, '');
    
    // Remove file paths
    sanitized = sanitized.replace(/\/[^\s]+/g, '[PATH]');
    
    // Remove line numbers
    sanitized = sanitized.replace(/:\d+:\d+/g, ':[LINE]');
    
    // Truncate if too long
    if (sanitized.length > 200) {
        sanitized = sanitized.substring(0, 200) + '...';
    }
    
    return sanitized || 'An error occurred';
}

/**
 * Determine if an error should be sanitized
 * @param {Error} error - Error object
 * @returns {boolean} Whether to sanitize
 */
function shouldSanitizeError(error) {
    if (!error || typeof error !== 'object') {
        return true;
    }
    
    // Always sanitize generic errors
    if (SANITIZE_ERROR_TYPES.includes(error.constructor.name)) {
        return true;
    }
    
    // Sanitize if message contains sensitive patterns
    if (error.message) {
        return SENSITIVE_PATTERNS.some(pattern => pattern.test(error.message));
    }
    
    return true;
}

/**
 * Create a safe error response for clients
 * @param {Error} error - Original error
 * @param {string} errorId - Unique error ID
 * @param {number} statusCode - HTTP status code
 * @param {string} customMessage - Custom error message (optional)
 * @returns {Object} Safe error response
 */
function createSafeErrorResponse(error, errorId, statusCode = 500, customMessage = null) {
    const safeMessage = customMessage || sanitizeErrorMessage(error.message);
    
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'X-Error-ID': errorId
        },
        body: JSON.stringify({
            error: 'Internal server error',
            message: safeMessage,
            id: errorId,
            timestamp: new Date().toISOString()
        })
    };
}

/**
 * Log detailed error information server-side only
 * @param {Error} error - Original error
 * @param {string} errorId - Unique error ID
 * @param {Object} context - Additional context information
 */
function logDetailedError(error, errorId, context = {}) {
    const logData = {
        errorId,
        timestamp: new Date().toISOString(),
        type: error.constructor.name,
        message: error.message,
        stack: error.stack,
        context: {
            ...context,
            // Add environment info (but not sensitive values)
            nodeEnv: process.env.NODE_ENV,
            functionName: context.functionName || 'unknown'
        }
    };
    
    console.error('Detailed Error Log:', JSON.stringify(logData, null, 2));
}

/**
 * Handle and process errors safely
 * @param {Error} error - Original error
 * @param {Object} options - Error handling options
 * @returns {Object} Safe error response
 */
function handleError(error, options = {}) {
    const {
        statusCode = 500,
        customMessage = null,
        context = {},
        functionName = 'unknown'
    } = options;
    
    // Generate unique error ID
    const errorId = generateErrorId();
    
    // Log detailed error server-side
    logDetailedError(error, errorId, {
        ...context,
        functionName
    });
    
    // Create safe response for client
    return createSafeErrorResponse(error, errorId, statusCode, customMessage);
}

/**
 * Wrap async functions with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Error handling options
 * @returns {Function} Wrapped function
 */
function withErrorHandling(fn, options = {}) {
    return async (event, context) => {
        try {
            return await fn(event, context);
        } catch (error) {
            return handleError(error, {
                ...options,
                functionName: fn.name || 'anonymous',
                context: {
                    httpMethod: event.httpMethod,
                    path: event.path,
                    queryStringParameters: event.queryStringParameters
                }
            });
        }
    };
}

/**
 * Create specific error responses for common scenarios
 */
const ErrorResponses = {
    // Authentication errors
    unauthorized: (errorId) => createSafeErrorResponse(
        new Error('Unauthorized'), 
        errorId, 
        401, 
        'Authentication required'
    ),
    
    forbidden: (errorId) => createSafeErrorResponse(
        new Error('Forbidden'), 
        errorId, 
        403, 
        'Access denied'
    ),
    
    notFound: (errorId) => createSafeErrorResponse(
        new Error('Not Found'), 
        errorId, 
        404, 
        'Resource not found'
    ),
    
    validationError: (errorId, message = 'Invalid input') => createSafeErrorResponse(
        new Error('Validation Error'), 
        errorId, 
        400, 
        message
    ),
    
    serviceUnavailable: (errorId) => createSafeErrorResponse(
        new Error('Service Unavailable'), 
        errorId, 
        503, 
        'Service temporarily unavailable'
    ),
    
    rateLimited: (errorId) => createSafeErrorResponse(
        new Error('Rate Limited'), 
        errorId, 
        429, 
        'Too many requests'
    )
};

/**
 * Validate error response before sending
 * @param {Object} response - Error response to validate
 * @returns {Object} Validated response
 */
function validateErrorResponse(response) {
    // Ensure no sensitive data in response
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    
    // Check for sensitive patterns in response
    const bodyStr = JSON.stringify(body);
    const hasSensitiveData = SENSITIVE_PATTERNS.some(pattern => pattern.test(bodyStr));
    
    if (hasSensitiveData) {
        console.warn('Sensitive data detected in error response, sanitizing...');
        return createSafeErrorResponse(
            new Error('Internal server error'),
            generateErrorId(),
            response.statusCode || 500
        );
    }
    
    return response;
}

module.exports = {
    generateErrorId,
    sanitizeErrorMessage,
    shouldSanitizeError,
    createSafeErrorResponse,
    logDetailedError,
    handleError,
    withErrorHandling,
    ErrorResponses,
    validateErrorResponse
};
