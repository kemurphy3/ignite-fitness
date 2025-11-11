/**
 * Input Sanitization Middleware
 * Prevents XSS, SQL injection, and LDAP injection attacks
 */

const DOMPurify = require('isomorphic-dompurify');
const SafeLogger = require('./safe-logging');

const logger = SafeLogger.create({ enableMasking: true });

// Dangerous patterns to detect and block
const DANGEROUS_PATTERNS = {
  sql: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|\|)/,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i,
  ],
  xss: [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
  ],
  ldap: [/[()=*!&|]/, /(\b(OR|AND|NOT)\b)/i, /(\b(CN|OU|DC|UID|MAIL)\s*=)/i],
};

/**
 * Sanitize input data
 * @param {any} input - Input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {any} Sanitized input
 */
function sanitizeInput(input, options = {}) {
  const config = {
    allowHTML: false,
    maxLength: 10000,
    removeScripts: true,
    removeStyles: true,
    ...options,
  };

  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return sanitizeString(input, config);
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item, config));
  }

  if (typeof input === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value, config);
    }
    return sanitized;
  }

  return input;
}

/**
 * Sanitize string input
 * @param {string} str - String to sanitize
 * @param {Object} config - Sanitization config
 * @returns {string} Sanitized string
 */
function sanitizeString(str, config) {
  if (!str || typeof str !== 'string') {
    return str;
  }

  // Check length
  if (str.length > config.maxLength) {
    logger.warn('Input truncated due to length', {
      original_length: str.length,
      max_length: config.maxLength,
    });
    str = str.substring(0, config.maxLength);
  }

  // Detect dangerous patterns
  const threats = detectThreats(str);
  if (threats.length > 0) {
    logger.warn('Dangerous patterns detected', {
      threats,
      input: str.substring(0, 100),
    });
    throw new Error(`Dangerous input detected: ${threats.join(', ')}`);
  }

  // Sanitize HTML if needed
  if (config.allowHTML) {
    str = DOMPurify.sanitize(str, {
      ALLOWED_TAGS: config.allowedTags || [],
      ALLOWED_ATTR: config.allowedAttrs || [],
      KEEP_CONTENT: true,
    });
  } else {
    // Remove all HTML tags
    str = str.replace(/<[^>]*>/g, '');
  }

  // Remove scripts and styles
  if (config.removeScripts) {
    str = str.replace(/<script[^>]*>.*?<\/script>/gi, '');
    str = str.replace(/javascript:/gi, '');
  }

  if (config.removeStyles) {
    str = str.replace(/<style[^>]*>.*?<\/style>/gi, '');
    str = str.replace(/style\s*=/gi, '');
  }

  return str.trim();
}

/**
 * Detect security threats in input
 * @param {string} input - Input to analyze
 * @returns {Array} Detected threats
 */
function detectThreats(input) {
  const threats = [];

  // Check SQL injection patterns
  DANGEROUS_PATTERNS.sql.forEach(pattern => {
    if (pattern.test(input)) {
      threats.push('SQL_INJECTION');
    }
  });

  // Check XSS patterns
  DANGEROUS_PATTERNS.xss.forEach(pattern => {
    if (pattern.test(input)) {
      threats.push('XSS');
    }
  });

  // Check LDAP injection patterns
  DANGEROUS_PATTERNS.ldap.forEach(pattern => {
    if (pattern.test(input)) {
      threats.push('LDAP_INJECTION');
    }
  });

  return [...new Set(threats)];
}

/**
 * Sanitization middleware for Netlify functions
 * @param {Function} handler - Function handler
 * @param {Object} options - Sanitization options
 * @returns {Function} Wrapped handler with sanitization
 */
function withSanitization(handler, options = {}) {
  return async (event, context) => {
    try {
      // Sanitize request body
      if (event.body) {
        const parsedBody = JSON.parse(event.body);
        const sanitizedBody = sanitizeInput(parsedBody, options);
        event.body = JSON.stringify(sanitizedBody);
      }

      // Sanitize query parameters
      if (event.queryStringParameters) {
        event.queryStringParameters = sanitizeInput(event.queryStringParameters, options);
      }

      // Sanitize headers (basic sanitization)
      if (event.headers) {
        for (const [key, value] of Object.entries(event.headers)) {
          if (typeof value === 'string') {
            event.headers[key] = sanitizeString(value, { maxLength: 1000 });
          }
        }
      }

      return await handler(event, context);
    } catch (error) {
      logger.error('Sanitization failed', {
        error: error.message,
        input: event.body ? event.body.substring(0, 100) : 'N/A',
      });

      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid input detected',
          message: 'Input contains potentially dangerous content',
        }),
      };
    }
  };
}

/**
 * Validate and sanitize user input
 * @param {Object} input - User input
 * @param {Object} schema - Validation schema
 * @returns {Object} Sanitized and validated input
 */
function validateAndSanitize(input, schema) {
  const result = {};
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = input[field];

    // Required field check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    // Type validation
    if (value !== undefined && rules.type) {
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
        continue;
      }
      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push(`${field} must be a number`);
        continue;
      }
    }

    // Sanitize string values
    if (typeof value === 'string') {
      result[field] = sanitizeString(value, {
        maxLength: rules.maxLength || 1000,
        allowHTML: rules.allowHTML || false,
      });
    } else {
      result[field] = value;
    }

    // Length validation
    if (rules.maxLength && result[field] && result[field].length > rules.maxLength) {
      errors.push(`${field} exceeds maximum length of ${rules.maxLength}`);
    }

    // Pattern validation
    if (rules.pattern && result[field] && !rules.pattern.test(result[field])) {
      errors.push(`${field} format is invalid`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return result;
}

module.exports = {
  sanitizeInput,
  sanitizeString,
  detectThreats,
  withSanitization,
  validateAndSanitize,
  DANGEROUS_PATTERNS,
};
