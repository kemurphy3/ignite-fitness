// Security Utilities for User Profiles
const crypto = require('crypto');

function sanitizeForLog(value) {
    if (typeof value === 'string') {
        // Remove potential PII patterns
        return value
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
            .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
            .replace(/Bearer [A-Za-z0-9\-._~\+\/]+=*/g, '[TOKEN]')
            .replace(/\b\d{10,}\b/g, '[PHONE]')
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
            .substring(0, 200);
    }
    
    if (typeof value === 'object' && value !== null) {
        // Recursively sanitize object values
        const sanitized = {};
        for (const [key, val] of Object.entries(value)) {
            if (typeof val === 'string') {
                sanitized[key] = sanitizeForLog(val);
            } else if (typeof val === 'object' && val !== null) {
                sanitized[key] = sanitizeForLog(val);
            } else {
                sanitized[key] = val;
            }
        }
        return sanitized;
    }
    
    return '[SANITIZED]';
}

// Generate secure request hash for deduplication
function generateRequestHash(body, userId, timestamp) {
    const hash = crypto.createHash('sha256');
    hash.update(body);
    hash.update(userId);
    hash.update(timestamp.toString());
    return hash.digest('hex');
}

// Validate input against common attack patterns
function validateInput(input) {
    const attacks = [
        /<script[^>]*>.*?<\/script>/gi, // XSS
        /javascript:/gi, // JavaScript protocol
        /on\w+\s*=/gi, // Event handlers
        /union\s+select/gi, // SQL injection
        /drop\s+table/gi, // SQL injection
        /insert\s+into/gi, // SQL injection
        /delete\s+from/gi, // SQL injection
        /update\s+set/gi, // SQL injection
        /exec\s*\(/gi, // Command injection
        /eval\s*\(/gi, // Code injection
    ];
    
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    
    for (const pattern of attacks) {
        if (pattern.test(inputStr)) {
            return {
                valid: false,
                reason: 'Potentially malicious input detected',
                pattern: pattern.toString()
            };
        }
    }
    
    return { valid: true };
}

// Sanitize user input for database storage
function sanitizeInput(input) {
    if (typeof input === 'string') {
        return input
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/['"]/g, '') // Remove quotes
            .replace(/[;]/g, '') // Remove semicolons
            .trim();
    }
    
    if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }
    
    return input;
}

// Validate email format (if needed)
function isValidEmail(email) {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
    return emailRegex.test(email);
}

// Validate UUID format
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

// Rate limiting helper
function checkRateLimit(userId, requests, limit = 10, windowMs = 3600000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Filter requests within the time window
    const recentRequests = requests.filter(req => req.timestamp > windowStart);
    
    return {
        allowed: recentRequests.length < limit,
        remaining: Math.max(0, limit - recentRequests.length),
        resetTime: windowStart + windowMs,
        count: recentRequests.length
    };
}

// Generate secure random string
function generateSecureString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

// Hash sensitive data for logging
function hashSensitiveData(data) {
    if (typeof data === 'string') {
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
    }
    return '[HASHED]';
}

// Validate JSON size to prevent DoS
function validateJSONSize(jsonString, maxSize = 1024 * 1024) { // 1MB default
    if (jsonString.length > maxSize) {
        return {
            valid: false,
            reason: `JSON size exceeds maximum allowed size of ${maxSize} bytes`,
            size: jsonString.length
        };
    }
    
    return { valid: true };
}

// Escape SQL special characters (additional protection)
function escapeSQL(input) {
    if (typeof input === 'string') {
        return input
            .replace(/'/g, "''")
            .replace(/\\/g, '\\\\')
            .replace(/\0/g, '\\0')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\x1a/g, '\\Z');
    }
    
    return input;
}

// Validate numeric ranges
function validateNumericRange(value, min, max, fieldName) {
    const num = Number(value);
    
    if (isNaN(num)) {
        return {
            valid: false,
            reason: `${fieldName} must be a valid number`
        };
    }
    
    if (num < min || num > max) {
        return {
            valid: false,
            reason: `${fieldName} must be between ${min} and ${max}`
        };
    }
    
    return { valid: true };
}

// Check for suspicious patterns in user input
function detectSuspiciousPatterns(input) {
    const patterns = [
        { name: 'SQL_INJECTION', regex: /(union|select|insert|update|delete|drop|create|alter)\s+/gi },
        { name: 'XSS_ATTEMPT', regex: /<script|javascript:|on\w+\s*=/gi },
        { name: 'PATH_TRAVERSAL', regex: /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/gi },
        { name: 'COMMAND_INJECTION', regex: /[;&|`$()]/g },
        { name: 'LDAP_INJECTION', regex: /[()=*!&|]/g }
    ];
    
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    const detected = [];
    
    for (const pattern of patterns) {
        if (pattern.regex.test(inputStr)) {
            detected.push(pattern.name);
        }
    }
    
    return {
        suspicious: detected.length > 0,
        patterns: detected
    };
}

module.exports = {
    sanitizeForLog,
    generateRequestHash,
    validateInput,
    sanitizeInput,
    isValidEmail,
    isValidUUID,
    checkRateLimit,
    generateSecureString,
    hashSensitiveData,
    validateJSONSize,
    escapeSQL,
    validateNumericRange,
    detectSuspiciousPatterns
};
