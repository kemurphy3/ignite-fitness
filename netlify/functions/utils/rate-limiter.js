/**
 * Rate Limiter Utility
 * Implements per-IP and per-user rate limiting for OAuth endpoints
 * Provides brute force protection with progressive backoff
 */

const SafeLogger = require('./safe-logging');

// Create safe logger for rate limiting
const loggerInstance = SafeLogger.create({
  enableMasking: true,
  visibleChars: 4,
  maskChar: '*',
});

// Create logger with convenience methods
const logger = {
  info: (...args) => console.info('[RateLimiter]', ...args),
  warn: (...args) => console.warn('[RateLimiter]', ...args),
  error: (...args) => console.error('[RateLimiter]', ...args),
  debug: (...args) => console.debug('[RateLimiter]', ...args),
  log: (...args) => console.log('[RateLimiter]', ...args),
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // OAuth specific limits
  oauth: {
    window: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    progressiveBackoff: true,
    backoffMultiplier: 2,
    maxBackoff: 60 * 60 * 1000, // 1 hour
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
  },

  // General API limits
  api: {
    window: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 100,
    progressiveBackoff: false,
  },

  // Login specific limits
  login: {
    window: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 10,
    progressiveBackoff: true,
    backoffMultiplier: 2,
    maxBackoff: 60 * 60 * 1000, // 1 hour
  },
};

// In-memory storage for rate limiting (in production, use Redis)
const rateLimitStore = new Map();

// Cleanup interval
let cleanupInterval;

/**
 * Rate Limiter Class
 */
class RateLimiter {
  constructor(config = {}) {
    this.config = { ...RATE_LIMIT_CONFIG, ...config };
    this.store = rateLimitStore;

    // Start cleanup interval
    this.startCleanup();

    logger.info('RateLimiter initialized', {
      config: this.config,
    });
  }

  /**
   * Check if request is allowed
   * @param {string} key - Rate limit key (IP, user ID, etc.)
   * @param {string} type - Rate limit type (oauth, api, login)
   * @returns {Object} Rate limit result
   */
  checkRateLimit(key, type = 'api') {
    try {
      const config = this.config[type] || this.config.api;
      const now = Date.now();

      // Get or create rate limit entry
      let entry = this.store.get(key);
      if (!entry) {
        entry = {
          attempts: 0,
          firstAttempt: now,
          lastAttempt: now,
          backoffUntil: 0,
          violations: 0,
        };
        this.store.set(key, entry);
      }

      // Check if currently in backoff period
      if (now < entry.backoffUntil) {
        const remainingBackoff = Math.ceil((entry.backoffUntil - now) / 1000);

        logger.warn('Rate limit backoff active', {
          key,
          type,
          remaining_seconds: remainingBackoff,
          violations: entry.violations,
        });

        return {
          allowed: false,
          reason: 'backoff',
          remainingSeconds: remainingBackoff,
          violations: entry.violations,
          retryAfter: entry.backoffUntil,
        };
      }

      // Reset attempts if window has passed
      if (now - entry.firstAttempt > config.window) {
        entry.attempts = 0;
        entry.firstAttempt = now;
        entry.violations = 0;
      }

      // Check if limit exceeded
      if (entry.attempts >= config.maxAttempts) {
        entry.violations++;
        entry.lastAttempt = now;

        // Apply progressive backoff if enabled
        if (config.progressiveBackoff) {
          const backoffDuration = Math.min(
            config.window * Math.pow(config.backoffMultiplier, entry.violations - 1),
            config.maxBackoff
          );
          entry.backoffUntil = now + backoffDuration;
        }

        logger.warn('Rate limit exceeded', {
          key,
          type,
          attempts: entry.attempts,
          violations: entry.violations,
          backoff_until: entry.backoffUntil,
        });

        return {
          allowed: false,
          reason: 'limit_exceeded',
          attempts: entry.attempts,
          violations: entry.violations,
          retryAfter: entry.backoffUntil,
          remainingSeconds: Math.ceil((entry.backoffUntil - now) / 1000),
        };
      }

      // Allow request and increment attempts
      entry.attempts++;
      entry.lastAttempt = now;

      logger.debug('Rate limit check passed', {
        key,
        type,
        attempts: entry.attempts,
        max_attempts: config.maxAttempts,
      });

      return {
        allowed: true,
        attempts: entry.attempts,
        remainingAttempts: config.maxAttempts - entry.attempts,
        resetTime: entry.firstAttempt + config.window,
      };
    } catch (error) {
      logger.error('Rate limit check failed', {
        key,
        type,
        error: error.message,
      });

      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        reason: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Record successful request
   * @param {string} key - Rate limit key
   * @param {string} type - Rate limit type
   */
  recordSuccess(key, type = 'api') {
    try {
      const entry = this.store.get(key);
      if (entry) {
        // Reset violations on successful request
        entry.violations = 0;
        entry.backoffUntil = 0;

        logger.debug('Rate limit success recorded', {
          key,
          type,
        });
      }
    } catch (error) {
      logger.error('Failed to record success', {
        key,
        type,
        error: error.message,
      });
    }
  }

  /**
   * Get rate limit status
   * @param {string} key - Rate limit key
   * @param {string} type - Rate limit type
   * @returns {Object} Rate limit status
   */
  getStatus(key, type = 'api') {
    try {
      const config = this.config[type] || this.config.api;
      const entry = this.store.get(key);

      if (!entry) {
        return {
          attempts: 0,
          remainingAttempts: config.maxAttempts,
          resetTime: Date.now() + config.window,
          violations: 0,
          backoffUntil: 0,
        };
      }

      const now = Date.now();
      const windowStart = entry.firstAttempt;
      const windowEnd = windowStart + config.window;

      return {
        attempts: entry.attempts,
        remainingAttempts: Math.max(0, config.maxAttempts - entry.attempts),
        resetTime: windowEnd,
        violations: entry.violations,
        backoffUntil: entry.backoffUntil,
        inBackoff: now < entry.backoffUntil,
        remainingBackoffSeconds: Math.max(0, Math.ceil((entry.backoffUntil - now) / 1000)),
      };
    } catch (error) {
      logger.error('Failed to get rate limit status', {
        key,
        type,
        error: error.message,
      });

      return {
        attempts: 0,
        remainingAttempts: 0,
        resetTime: Date.now(),
        violations: 0,
        backoffUntil: 0,
        error: error.message,
      };
    }
  }

  /**
   * Reset rate limit for key
   * @param {string} key - Rate limit key
   * @param {string} type - Rate limit type
   */
  reset(key, type = 'api') {
    try {
      this.store.delete(key);

      logger.info('Rate limit reset', {
        key,
        type,
      });
    } catch (error) {
      logger.error('Failed to reset rate limit', {
        key,
        type,
        error: error.message,
      });
    }
  }

  /**
   * Get all rate limit entries
   * @returns {Array} All rate limit entries
   */
  getAllEntries() {
    try {
      const entries = [];

      for (const [key, entry] of this.store.entries()) {
        entries.push({
          key,
          ...entry,
        });
      }

      return entries;
    } catch (error) {
      logger.error('Failed to get all entries', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get rate limit statistics
   * @returns {Object} Rate limit statistics
   */
  getStats() {
    try {
      const stats = {
        totalEntries: this.store.size,
        activeEntries: 0,
        backoffEntries: 0,
        totalViolations: 0,
        config: this.config,
      };

      const now = Date.now();

      for (const [_key, entry] of this.store.entries()) {
        stats.activeEntries++;
        stats.totalViolations += entry.violations;

        if (now < entry.backoffUntil) {
          stats.backoffEntries++;
        }
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get stats', {
        error: error.message,
      });
      return {
        totalEntries: 0,
        activeEntries: 0,
        backoffEntries: 0,
        totalViolations: 0,
        error: error.message,
      };
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }

    cleanupInterval = setInterval(() => {
      this.cleanup();
    }, RATE_LIMIT_CONFIG.oauth.cleanupInterval);

    logger.info('Rate limit cleanup started', {
      interval: RATE_LIMIT_CONFIG.oauth.cleanupInterval,
    });
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;

      logger.info('Rate limit cleanup stopped');
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, entry] of this.store.entries()) {
        // Remove entries older than the longest window
        const maxWindow = Math.max(
          RATE_LIMIT_CONFIG.oauth.window,
          RATE_LIMIT_CONFIG.api.window,
          RATE_LIMIT_CONFIG.login.window
        );

        if (now - entry.lastAttempt > maxWindow) {
          this.store.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.debug('Rate limit cleanup completed', {
          cleaned_count: cleanedCount,
          remaining_entries: this.store.size,
        });
      }
    } catch (error) {
      logger.error('Rate limit cleanup failed', {
        error: error.message,
      });
    }
  }
}

// Create global rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * Rate limiting middleware for Netlify functions
 * @param {Function} handler - Function handler
 * @param {string} type - Rate limit type
 * @returns {Function} Wrapped handler with rate limiting
 */
function withRateLimit(handler, type = 'api') {
  return async (event, context) => {
    try {
      // Extract rate limit key
      const key = extractRateLimitKey(event);

      // Check rate limit
      const rateLimitResult = rateLimiter.checkRateLimit(key, type);

      if (!rateLimitResult.allowed) {
        logger.warn('Rate limit exceeded', {
          key,
          type,
          reason: rateLimitResult.reason,
          violations: rateLimitResult.violations,
        });

        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Retry-After': Math.ceil(rateLimitResult.remainingSeconds || 60),
            'X-RateLimit-Limit': RATE_LIMIT_CONFIG[type]?.maxAttempts || 100,
            'X-RateLimit-Remaining': 0,
            'X-RateLimit-Reset': rateLimitResult.retryAfter || Date.now() + 60000,
          },
          body: JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter: rateLimitResult.remainingSeconds,
            violations: rateLimitResult.violations,
          }),
        };
      }

      // Add rate limit headers
      const response = await handler(event, context);

      if (response && response.headers) {
        response.headers['X-RateLimit-Limit'] = RATE_LIMIT_CONFIG[type]?.maxAttempts || 100;
        response.headers['X-RateLimit-Remaining'] = rateLimitResult.remainingAttempts || 0;
        response.headers['X-RateLimit-Reset'] = rateLimitResult.resetTime || Date.now() + 900000;
      }

      // Record successful request
      rateLimiter.recordSuccess(key, type);

      return response;
    } catch (error) {
      logger.error('Rate limiting middleware error', {
        error: error.message,
        type,
      });

      // Fail open - allow request if rate limiting fails
      return await handler(event, context);
    }
  };
}

/**
 * Extract rate limit key from event
 * @param {Object} event - Netlify function event
 * @returns {string} Rate limit key
 */
function extractRateLimitKey(event) {
  // Try to get IP address from various sources
  const ipSources = [
    event.headers['x-forwarded-for'],
    event.headers['x-real-ip'],
    event.headers['cf-connecting-ip'],
    event.headers['x-client-ip'],
    event.headers['x-forwarded'],
    event.headers['forwarded-for'],
    event.headers.forwarded,
  ];

  let ip = 'unknown';

  for (const source of ipSources) {
    if (source) {
      // Take first IP if comma-separated
      ip = source.split(',')[0].trim();
      break;
    }
  }

  // Add user ID if available
  const authHeader = event.headers.authorization || event.headers.Authorization;
  let userId = 'anonymous';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // In production, decode JWT to get user ID
    userId = token.substring(0, 16); // Simplified for demo
  }

  return `${ip}:${userId}`;
}

/**
 * OAuth-specific rate limiting middleware
 * @param {Function} handler - Function handler
 * @returns {Function} Wrapped handler with OAuth rate limiting
 */
function withOAuthRateLimit(handler) {
  return withRateLimit(handler, 'oauth');
}

/**
 * Login-specific rate limiting middleware
 * @param {Function} handler - Function handler
 * @returns {Function} Wrapped handler with login rate limiting
 */
function withLoginRateLimit(handler) {
  return withRateLimit(handler, 'login');
}

/**
 * Get rate limit status endpoint
 */
exports.getRateLimitStatus = async event => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const key = extractRateLimitKey(event);
    const type = event.queryStringParameters?.type || 'api';

    const status = rateLimiter.getStatus(key, type);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        key,
        type,
        status,
      }),
    };
  } catch (error) {
    logger.error('Failed to get rate limit status', {
      error: error.message,
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Reset rate limit endpoint
 */
exports.resetRateLimit = async event => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const key = extractRateLimitKey(event);
    const type = event.queryStringParameters?.type || 'api';

    rateLimiter.reset(key, type);

    logger.info('Rate limit reset', {
      key,
      type,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Rate limit reset successfully',
        key,
        type,
      }),
    };
  } catch (error) {
    logger.error('Failed to reset rate limit', {
      error: error.message,
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Get rate limit statistics endpoint
 */
exports.getRateLimitStats = async event => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const stats = rateLimiter.getStats();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        stats,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Failed to get rate limit stats', {
      error: error.message,
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

// Export functions
module.exports = {
  RateLimiter,
  withRateLimit,
  withOAuthRateLimit,
  withLoginRateLimit,
  extractRateLimitKey,
  rateLimiter,
  RATE_LIMIT_CONFIG,
};
