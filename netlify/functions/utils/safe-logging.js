/**
 * Safe Logging Utility for Strava Tokens
 * 
 * Provides secure logging functions that:
 * - Mask sensitive token values
 * - Log only safe metadata
 * - Support debug mode with encrypted logging
 * - Prevent token exposure in logs
 */

const crypto = require('crypto');

// Sensitive fields that should be masked
const SENSITIVE_FIELDS = [
    'access_token',
    'refresh_token',
    'encrypted_access_token',
    'encrypted_refresh_token',
    'client_secret',
    'client_id',
    'authorization',
    'bearer',
    'token',
    'secret',
    'key',
    'password',
    'credential'
];

// Debug mode - set to true only in development
const DEBUG_MODE = process.env.NODE_ENV === 'development' && process.env.DEBUG_TOKENS === 'true';

/**
 * Mask a token value showing only last 4 characters
 * @param {string} token - Token to mask
 * @returns {string} Masked token (e.g., "****abc1")
 */
function maskToken(token) {
    if (!token || typeof token !== 'string') {
        return '****';
    }
    
    if (token.length <= 4) {
        return '****';
    }
    
    return '****' + token.slice(-4);
}

/**
 * Mask all sensitive fields in an object
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function maskSensitiveFields(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    
    const sanitized = { ...obj };
    
    for (const key in sanitized) {
        if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
            if (typeof sanitized[key] === 'string') {
                sanitized[key] = maskToken(sanitized[key]);
            } else {
                sanitized[key] = '[REDACTED]';
            }
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = maskSensitiveFields(sanitized[key]);
        }
    }
    
    return sanitized;
}

/**
 * Log token refresh success with safe metadata
 * @param {Object} params - Refresh parameters
 * @param {string} params.userId - User ID
 * @param {Date} params.expiresAt - Token expiry time
 * @param {string} params.scope - Token scope
 */
function logTokenRefreshSuccess({ userId, expiresAt, scope }) {
    console.log('Token refreshed successfully:', {
        user_id: userId,
        expires_at: expiresAt,
        scope: scope,
        timestamp: new Date().toISOString()
    });
}

/**
 * Log OAuth exchange success with safe metadata
 * @param {Object} params - OAuth parameters
 * @param {string} params.userId - User ID
 * @param {string} params.athleteId - Strava athlete ID
 * @param {string} params.scope - Token scope
 */
function logOAuthExchangeSuccess({ userId, athleteId, scope }) {
    console.log('OAuth exchange successful:', {
        user_id: userId,
        athlete_id: athleteId,
        scope: scope,
        timestamp: new Date().toISOString()
    });
}

/**
 * Log import process with safe metadata
 * @param {Object} params - Import parameters
 * @param {string} params.userId - User ID
 * @param {number} params.imported - Number of activities imported
 * @param {number} params.failed - Number of activities that failed
 * @param {string} params.status - Import status
 */
function logImportProcess({ userId, imported, failed, status }) {
    console.log('Strava import process:', {
        user_id: userId,
        imported: imported,
        failed: failed,
        status: status,
        timestamp: new Date().toISOString()
    });
}

/**
 * Log API request with masked headers
 * @param {Object} params - Request parameters
 * @param {string} params.url - Request URL
 * @param {string} params.method - HTTP method
 * @param {Object} params.headers - Request headers (will be masked)
 * @param {number} params.statusCode - Response status code
 */
function logAPIRequest({ url, method, headers, statusCode }) {
    const maskedHeaders = maskSensitiveFields(headers || {});
    
    console.log('API request:', {
        url: url,
        method: method,
        headers: maskedHeaders,
        status_code: statusCode,
        timestamp: new Date().toISOString()
    });
}

/**
 * Log error with sanitized data
 * @param {string} message - Error message
 * @param {Object} data - Error data (will be sanitized)
 * @param {string} context - Error context
 */
function logError(message, data = {}, context = '') {
    const sanitizedData = maskSensitiveFields(data);
    
    console.error(`${context ? `[${context}] ` : ''}${message}:`, sanitizedData);
}

/**
 * Debug logging (only in debug mode)
 * @param {string} message - Debug message
 * @param {Object} data - Debug data
 */
function debugLog(message, data = {}) {
    if (DEBUG_MODE) {
        // In debug mode, we can log more details but still mask tokens
        const sanitizedData = maskSensitiveFields(data);
        console.debug(`[DEBUG] ${message}:`, sanitizedData);
    }
}

/**
 * Log token expiry information
 * @param {Object} params - Token expiry parameters
 * @param {string} params.userId - User ID
 * @param {Date} params.expiresAt - Token expiry time
 * @param {boolean} params.isExpiringSoon - Whether token expires soon
 */
function logTokenExpiry({ userId, expiresAt, isExpiringSoon }) {
    const timeUntilExpiry = expiresAt ? Math.max(0, expiresAt.getTime() - Date.now()) : 0;
    const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
    
    console.log('Token expiry info:', {
        user_id: userId,
        expires_at: expiresAt,
        hours_until_expiry: hoursUntilExpiry,
        is_expiring_soon: isExpiringSoon,
        timestamp: new Date().toISOString()
    });
}

/**
 * Log rate limit information
 * @param {Object} params - Rate limit parameters
 * @param {string} params.userId - User ID
 * @param {number} params.remaining - Remaining requests
 * @param {number} params.limit - Request limit
 * @param {Date} params.resetTime - Reset time
 */
function logRateLimit({ userId, remaining, limit, resetTime }) {
    console.log('Rate limit info:', {
        user_id: userId,
        remaining: remaining,
        limit: limit,
        reset_time: resetTime,
        timestamp: new Date().toISOString()
    });
}

/**
 * Create a safe logger for a specific context
 * @param {string} context - Logger context
 * @returns {Object} Logger instance
 */
function createLogger(context) {
    return {
        info: (message, data = {}) => {
            console.log(`[${context}] ${message}:`, maskSensitiveFields(data));
        },
        error: (message, data = {}) => {
            console.error(`[${context}] ${message}:`, maskSensitiveFields(data));
        },
        debug: (message, data = {}) => {
            debugLog(`[${context}] ${message}`, data);
        },
        tokenRefresh: (params) => logTokenRefreshSuccess(params),
        oauthExchange: (params) => logOAuthExchangeSuccess(params),
        importProcess: (params) => logImportProcess(params),
        apiRequest: (params) => logAPIRequest(params),
        tokenExpiry: (params) => logTokenExpiry(params),
        rateLimit: (params) => logRateLimit(params)
    };
}

module.exports = {
    maskToken,
    maskSensitiveFields,
    logTokenRefreshSuccess,
    logOAuthExchangeSuccess,
    logImportProcess,
    logAPIRequest,
    logError,
    debugLog,
    logTokenExpiry,
    logRateLimit,
    createLogger
};
