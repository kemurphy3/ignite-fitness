/**
 * SafeLogger - Centralized logging with security and masking
 * Never logs sensitive data like tokens, passwords, or personal info
 */
class SafeLogger {
    constructor() {
        this.logLevel = 'info';
        this.sensitivePatterns = [
            /password/i,
            /token/i,
            /secret/i,
            /key/i,
            /auth/i,
            /credential/i,
            /ssn/i,
            /social/i,
            /email/i,
            /phone/i,
            /address/i,
            /name/i
        ];
        this.maskedValue = '[MASKED]';
    }

    /**
     * Set log level
     * @param {string} level - Log level (debug, info, warn, error)
     */
    setLevel(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        if (levels.includes(level)) {
            this.logLevel = level;
        }
    }

    /**
     * Check if log level should be output
     * @param {string} level - Log level to check
     * @returns {boolean} Should output
     */
    shouldLog(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        return levels[level] >= levels[this.logLevel];
    }

    /**
     * Mask sensitive data in objects
     * @param {any} data - Data to mask
     * @returns {any} Masked data
     */
    maskSensitiveData(data) {
        if (data === null || data === undefined) return data;
        
        if (typeof data === 'string') {
            // Check if string contains sensitive patterns
            for (const pattern of this.sensitivePatterns) {
                if (pattern.test(data)) {
                    return this.maskedValue;
                }
            }
            return data;
        }

        if (Array.isArray(data)) {
            return data.map(item => this.maskSensitiveData(item));
        }

        if (typeof data === 'object') {
            const masked = {};
            for (const [key, value] of Object.entries(data)) {
                // Check if key contains sensitive patterns
                const isSensitive = this.sensitivePatterns.some(pattern => pattern.test(key));
                if (isSensitive) {
                    masked[key] = this.maskedValue;
                } else {
                    masked[key] = this.maskSensitiveData(value);
                }
            }
            return masked;
        }

        return data;
    }

    /**
     * Format log message
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     * @returns {Array} Formatted log arguments
     */
    formatLog(level, message, ...args) {
        const timestamp = new Date().toISOString();
        // Actually call maskSensitiveData, don't just reference it
        const maskedArgs = args.map(arg => this.maskSensitiveData(arg));
        
        return [
            `[${timestamp}] [${level.toUpperCase()}] ${message}`,
            ...maskedArgs
        ];
    }

    /**
     * Debug level logging
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    debug(message, ...args) {
        if (!this.shouldLog('debug')) return;
        const formatted = this.formatLog('debug', message, ...args);
        console.debug(...formatted);
    }

    /**
     * Info level logging
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    info(message, ...args) {
        if (!this.shouldLog('info')) return;
        const formatted = this.formatLog('info', message, ...args);
        console.info(...formatted);
    }

    /**
     * Warning level logging
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    warn(message, ...args) {
        if (!this.shouldLog('warn')) return;
        const formatted = this.formatLog('warn', message, ...args);
        console.warn(...formatted);
    }

    /**
     * Error level logging
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    error(message, ...args) {
        if (!this.shouldLog('error')) return;
        const formatted = this.formatLog('error', message, ...args);
        console.error(...formatted);
    }

    /**
     * Log user action for audit trail
     * @param {string} action - Action performed
     * @param {Object} context - Additional context
     */
    audit(action, context = {}) {
        const auditData = {
            action,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            context: this.maskSensitiveData(context)
        };

        this.info('AUDIT', auditData);
        
        // Emit audit event for other modules
        if (window.EventBus) {
            window.EventBus.emit('audit', auditData);
        }
    }

    /**
     * Log security event
     * @param {string} event - Security event type
     * @param {Object} details - Event details
     */
    security(event, details = {}) {
        const securityData = {
            event,
            timestamp: new Date().toISOString(),
            details: this.maskSensitiveData(details)
        };

        this.warn('SECURITY', securityData);
        
        // Emit security event for other modules
        if (window.EventBus) {
            window.EventBus.emit('security', securityData);
        }
    }

    /**
     * Log performance metrics
     * @param {string} operation - Operation name
     * @param {number} duration - Duration in milliseconds
     * @param {Object} metadata - Additional metadata
     */
    performance(operation, duration, metadata = {}) {
        const perfData = {
            operation,
            duration,
            timestamp: new Date().toISOString(),
            metadata: this.maskSensitiveData(metadata)
        };

        this.info('PERFORMANCE', perfData);
        
        // Emit performance event for other modules
        if (window.EventBus) {
            window.EventBus.emit('performance', perfData);
        }
    }
}

// Create global instance
window.SafeLogger = new SafeLogger();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SafeLogger;
}
