/**
 * Safe Logging Utility - Masks sensitive data in logs
 * Prevents accidental exposure of tokens, passwords, and other sensitive information
 */

class SafeLogger {
  constructor(options = {}) {
    this.options = {
      enableMasking: options.enableMasking !== false,
      maskChar: options.maskChar || '*',
      visibleChars: options.visibleChars || 4,
      sensitivePatterns: [
        /access_token/i,
        /refresh_token/i,
        /authorization/i,
        /password/i,
        /secret/i,
        /key/i,
        /token/i,
        /api_key/i,
        /private_key/i,
        /client_secret/i,
        /session_id/i,
        /cookie/i,
        /bearer/i,
        /auth/i,
        /credential/i,
        /signature/i,
        /nonce/i,
        /salt/i,
        /hash/i,
      ],
      ...options,
    };

    this.logger = console;
    this.originalMethods = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    this.setupSafeLogging();
  }

  /**
   * Setup safe logging methods
   */
  setupSafeLogging() {
    const methods = ['log', 'info', 'warn', 'error', 'debug'];

    methods.forEach(method => {
      console[method] = (...args) => {
        const safeArgs = args.map(arg => this.sanitizeLogArg(arg));
        this.originalMethods[method].apply(console, safeArgs);
      };
    });
  }

  /**
   * Sanitize log argument
   * @param {any} arg - Argument to sanitize
   * @returns {any} Sanitized argument
   */
  sanitizeLogArg(arg) {
    if (!this.options.enableMasking) {
      return arg;
    }

    if (typeof arg === 'string') {
      return this.maskSensitiveString(arg);
    }

    if (typeof arg === 'object' && arg !== null) {
      return this.maskSensitiveObject(arg);
    }

    return arg;
  }

  /**
   * Mask sensitive string
   * @param {string} str - String to mask
   * @returns {string} Masked string
   */
  maskSensitiveString(str) {
    // Check if string contains sensitive patterns
    const isSensitive = this.options.sensitivePatterns.some(pattern => pattern.test(str));

    if (!isSensitive) {
      return str;
    }

    // Extract potential token values
    const tokenPatterns = [
      /(access_token["\s]*[:=]["\s]*)([^"'\s,}]+)/gi,
      /(refresh_token["\s]*[:=]["\s]*)([^"'\s,}]+)/gi,
      /(token["\s]*[:=]["\s]*)([^"'\s,}]+)/gi,
      /(password["\s]*[:=]["\s]*)([^"'\s,}]+)/gi,
      /(secret["\s]*[:=]["\s]*)([^"'\s,}]+)/gi,
      /(key["\s]*[:=]["\s]*)([^"'\s,}]+)/gi,
      /(authorization["\s]*[:=]["\s]*)([^"'\s,}]+)/gi,
      /(bearer["\s]*[:=]["\s]*)([^"'\s,}]+)/gi,
    ];

    let maskedStr = str;

    tokenPatterns.forEach(pattern => {
      maskedStr = maskedStr.replace(pattern, (match, prefix, token) => {
        return prefix + this.maskToken(token);
      });
    });

    return maskedStr;
  }

  /**
   * Mask sensitive object
   * @param {Object} obj - Object to mask
   * @returns {Object} Masked object
   */
  maskSensitiveObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeLogArg(item));
    }

    const masked = {};

    Object.entries(obj).forEach(([key, value]) => {
      const isSensitiveKey = this.options.sensitivePatterns.some(pattern => pattern.test(key));

      if (isSensitiveKey) {
        masked[key] = this.maskToken(value);
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveObject(value);
      } else if (typeof value === 'string') {
        masked[key] = this.maskSensitiveString(value);
      } else {
        masked[key] = value;
      }
    });

    return masked;
  }

  /**
   * Mask token value
   * @param {string} token - Token to mask
   * @returns {string} Masked token
   */
  maskToken(token) {
    if (!token || typeof token !== 'string') {
      return '[MASKED]';
    }

    const tokenStr = String(token);

    if (tokenStr.length <= this.options.visibleChars) {
      return this.options.maskChar.repeat(tokenStr.length);
    }

    const visiblePart = tokenStr.slice(-this.options.visibleChars);
    const maskedPart = this.options.maskChar.repeat(tokenStr.length - this.options.visibleChars);

    return maskedPart + visiblePart;
  }

  /**
   * Create safe logger instance
   * @param {Object} options - Logger options
   * @returns {SafeLogger} Safe logger instance
   */
  static create(options = {}) {
    return new SafeLogger(options);
  }

  /**
   * Mask token utility function
   * @param {string} token - Token to mask
   * @returns {string} Masked token
   */
  static maskToken(token) {
    const logger = new SafeLogger();
    return logger.maskToken(token);
  }

  /**
   * Mask object utility function
   * @param {Object} obj - Object to mask
   * @returns {Object} Masked object
   */
  static maskObject(obj) {
    const logger = new SafeLogger();
    return logger.maskSensitiveObject(obj);
  }

  /**
   * Check if string contains sensitive data
   * @param {string} str - String to check
   * @returns {boolean} Contains sensitive data
   */
  static isSensitive(str) {
    const logger = new SafeLogger();
    return logger.options.sensitivePatterns.some(pattern => pattern.test(str));
  }

  /**
   * Get logger statistics
   * @returns {Object} Logger statistics
   */
  getStats() {
    return {
      enableMasking: this.options.enableMasking,
      sensitivePatterns: this.options.sensitivePatterns.length,
      visibleChars: this.options.visibleChars,
      maskChar: this.options.maskChar,
    };
  }

  /**
   * Disable masking (for debugging)
   */
  disableMasking() {
    this.options.enableMasking = false;
  }

  /**
   * Enable masking
   */
  enableMasking() {
    this.options.enableMasking = true;
  }

  /**
   * Add custom sensitive pattern
   * @param {RegExp} pattern - Pattern to add
   */
  addSensitivePattern(pattern) {
    this.options.sensitivePatterns.push(pattern);
  }

  /**
   * Remove sensitive pattern
   * @param {RegExp} pattern - Pattern to remove
   */
  removeSensitivePattern(pattern) {
    const index = this.options.sensitivePatterns.indexOf(pattern);
    if (index > -1) {
      this.options.sensitivePatterns.splice(index, 1);
    }
  }

  /**
   * Restore original console methods
   */
  restore() {
    Object.entries(this.originalMethods).forEach(([method, original]) => {
      console[method] = original;
    });
  }
}

// Export for use in other modules
module.exports = SafeLogger;

// Also export for browser use
if (typeof window !== 'undefined') {
  window.SafeLogger = SafeLogger;
}
