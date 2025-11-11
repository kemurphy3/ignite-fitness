/**
 * PlanCache - Manages cached workout plans with LRU eviction and memory limits
 * Handles cache invalidation, warm-up after data changes, and memory-bounded storage
 */

class PlanCache {
  constructor(options = {}) {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.coordinator = window.ExpertCoordinator;
    this.eventBus = window.EventBus;

    // LRU Cache configuration
    this.maxMemoryMB = options.maxMemoryMB || 50;
    this.maxEntries = options.maxEntries || 100;
    this.entryTTL = options.entryTTL || 5 * 60 * 1000; // 5 minutes

    // Initialize LRU Cache
    this.cache = new LRUCache({
      maxSize: this.maxEntries,
      maxMemory: this.maxMemoryMB * 1024 * 1024, // Convert MB to bytes
      ttl: this.entryTTL,
      cleanupInterval: 2 * 60 * 1000, // 2 minutes
    });

    // Legacy compatibility
    this.lastRefresh = new Map();

    this.logger.info('PlanCache initialized with LRU cache', {
      maxMemoryMB: this.maxMemoryMB,
      maxEntries: this.maxEntries,
      entryTTL: this.entryTTL,
    });
  }

  /**
   * Calculate approximate memory usage of an object
   * @param {Object} obj - Object to measure
   * @returns {number} Estimated size in bytes
   */
  estimateObjectSize(obj) {
    try {
      const jsonString = JSON.stringify(obj);
      return new Blob([jsonString]).size;
    } catch (error) {
      // Fallback estimation
      return JSON.stringify(obj).length * 2; // Rough estimate
    }
  }

  /**
   * Update access order for LRU tracking
   * @param {string} key - Cache key
   */
  updateAccessOrder(key) {
    const now = Date.now();
    this.accessOrder.set(key, now);
  }

  /**
   * Get least recently used key
   * @returns {string|null} LRU key or null
   */
  getLRUKey() {
    if (this.accessOrder.size === 0) {
      return null;
    }

    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.accessOrder) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Evict entries to make room for new data
   * @param {number} requiredBytes - Bytes needed for new entry
   */
  evictLRUEntries(requiredBytes = 0) {
    const maxMemoryBytes = this.maxMemoryMB * 1024 * 1024;

    while (
      (this.currentMemoryBytes + requiredBytes > maxMemoryBytes ||
        this.cache.size >= this.maxEntries) &&
      this.cache.size > 0
    ) {
      const lruKey = this.getLRUKey();
      if (!lruKey) {
        break;
      }

      this.evictEntry(lruKey);
    }
  }

  /**
   * Evict a specific entry from cache
   * @param {string} key - Cache key to evict
   */
  evictEntry(key) {
    const entrySize = this.entrySizes.get(key) || 0;

    this.cache.delete(key);
    this.accessOrder.delete(key);
    this.entrySizes.delete(key);
    this.currentMemoryBytes -= entrySize;

    this.logger.debug('Cache entry evicted', {
      key,
      size: entrySize,
      remainingMemory: this.currentMemoryBytes,
    });
  }

  /**
   * Set entry in cache with LRU management
   * @param {string} key - Cache key
   * @param {Object} value - Cache value
   * @param {number} ttl - Time to live in milliseconds
   */
  setCacheEntry(key, value, ttl = this.entryTTL) {
    const entrySize = this.estimateObjectSize(value);

    // Evict entries if needed
    this.evictLRUEntries(entrySize);

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.evictEntry(key);
    }

    // Add new entry
    const now = Date.now();
    this.cache.set(key, {
      value,
      timestamp: now,
      ttl,
      expiresAt: now + ttl,
    });

    this.accessOrder.set(key, now);
    this.entrySizes.set(key, entrySize);
    this.currentMemoryBytes += entrySize;

    this.logger.debug('Cache entry added', {
      key,
      size: entrySize,
      totalMemory: this.currentMemoryBytes,
      totalEntries: this.cache.size,
    });
  }

  /**
   * Get entry from cache with LRU update
   * @param {string} key - Cache key
   * @returns {Object|null} Cached value or null
   */
  getCacheEntry(key) {
    return this.cache.get(key);
  }

  /**
   * Set entry in cache with LRU management
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   * @returns {boolean} Success status
   */
  setCacheEntry(key, value, ttl = null) {
    return this.cache.set(key, value, ttl);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const lruStats = this.cache.getStats();
    return {
      ...lruStats,
      lastRefreshCount: this.lastRefresh.size,
      maxMemoryMB: this.maxMemoryMB,
      maxEntries: this.maxEntries,
      entryTTL: this.entryTTL,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanupExpiredEntries() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.evictEntry(key);
    }

    if (expiredKeys.length > 0) {
      this.logger.info('Expired entries cleaned up', {
        count: expiredKeys.length,
        remainingEntries: this.cache.size,
      });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      totalEntries: this.cache.size,
      memoryUsageMB: Math.round((this.currentMemoryBytes / (1024 * 1024)) * 100) / 100,
      maxMemoryMB: this.maxMemoryMB,
      maxEntries: this.maxEntries,
      memoryUtilization: Math.round(
        (this.currentMemoryBytes / (this.maxMemoryMB * 1024 * 1024)) * 100
      ),
      entryUtilization: Math.round((this.cache.size / this.maxEntries) * 100),
    };
  }

  /**
   * Refresh cache if stale for given dates
   * @param {number} userId - User ID
   * @param {Array<string>} dates - Array of dates to refresh
   * @returns {Promise<void>}
   */
  async refreshIfStale(userId, dates) {
    try {
      this.logger.info('Checking cache staleness', { userId, dates });

      const datesToRefresh = [];

      for (const date of dates) {
        const cacheKey = `${userId}_${date}`;
        const cachedPlan = this.getCacheEntry(cacheKey);

        // Consider cache stale if doesn't exist or expired
        if (!cachedPlan) {
          datesToRefresh.push(date);
        }
      }

      if (datesToRefresh.length > 0) {
        await this.warmCache(userId, datesToRefresh);
      } else {
        this.logger.info('Cache is fresh, no refresh needed', { userId, dates });
      }
    } catch (error) {
      this.logger.error('Error refreshing cache:', error);
    }
  }

  /**
   * Warm cache for specified dates
   * @param {number} userId - User ID
   * @param {Array<string>} dates - Dates to warm
   * @returns {Promise<void>}
   */
  async warmCache(userId, dates) {
    try {
      this.logger.info('Warming cache', { userId, dates });

      for (const date of dates) {
        const cacheKey = `${userId}_${date}`;

        // Build context for this date
        const context = await this.buildContextForDate(userId, date);

        // Generate plan
        if (this.coordinator && typeof this.coordinator.planToday === 'function') {
          const plan = await this.coordinator.planToday(context);

          // Add note about data sync if applicable
          if (this.shouldAddSyncNote(date)) {
            plan.why.push('Plan updated after new data sync.');
          }

          // Cache the plan
          this.setCacheEntry(cacheKey, plan);
          this.lastRefresh.set(cacheKey, Date.now());

          this.logger.info('Cache warmed for date', { userId, date, cacheKey });

          // Store in persistent storage
          await this.storePlan(userId, date, plan);
        }
      }

      // Emit cache refresh event
      if (this.eventBus) {
        this.eventBus.emit('plan_cache:refreshed', {
          userId,
          dates,
        });
      }
    } catch (error) {
      this.logger.error('Error warming cache:', error);
      throw error;
    }
  }

  /**
   * Build context for a specific date
   * @param {number} userId - User ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} Context object
   */
  async buildContextForDate(userId, date) {
    try {
      // Build base context
      const context = {
        user: { id: userId },
        profile: await this.getUserProfile(userId),
        preferences: await this.getUserPreferences(userId),
        schedule: await this.getSchedule(userId, date),
        history: await this.getHistory(userId),
        readiness: await this.getReadiness(userId, date),
      };

      // Build enhanced context with load metrics
      if (this.coordinator && this.coordinator.coordinatorContext) {
        const enhancedContext = await this.coordinator.coordinatorContext.buildContext(context);
        return enhancedContext;
      }

      return context;
    } catch (error) {
      this.logger.error('Error building context:', error);
      return {};
    }
  }

  /**
   * Get cached plan for a date
   * @param {number} userId - User ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object|null>} Cached plan or null
   */
  async getPlan(userId, date) {
    try {
      const cacheKey = `${userId}_${date}`;

      // Check in-memory cache with LRU
      const cachedPlan = this.getCacheEntry(cacheKey);
      if (cachedPlan) {
        this.logger.info('Plan retrieved from cache', { userId, date });
        return cachedPlan;
      }

      // Check persistent storage
      if (this.storageManager) {
        const storedPlan = await this.storageManager.getItem(`plan_${userId}_${date}`);
        if (storedPlan) {
          // Restore to in-memory cache with LRU
          this.setCacheEntry(cacheKey, storedPlan);
          this.lastRefresh.set(cacheKey, Date.now());

          this.logger.info('Plan retrieved from storage', { userId, date });
          return storedPlan;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error getting plan:', error);
      return null;
    }
  }

  /**
   * Store plan in persistent storage
   * @param {number} userId - User ID
   * @param {string} date - Date
   * @param {Object} plan - Plan object
   */
  async storePlan(userId, date, plan) {
    try {
      if (this.storageManager) {
        await this.storageManager.setItem(`plan_${userId}_${date}`, plan);
        this.logger.info('Plan stored', { userId, date });
      }
    } catch (error) {
      this.logger.error('Error storing plan:', error);
    }
  }

  /**
   * Invalidate cache for dates
   * @param {number} userId - User ID
   * @param {Array<string>} dates - Dates to invalidate
   */
  async invalidateCache(userId, dates) {
    try {
      for (const date of dates) {
        const cacheKey = `${userId}_${date}`;

        // Clear in-memory cache using LRU eviction
        this.evictEntry(cacheKey);
        this.lastRefresh.delete(cacheKey);

        // Clear persistent storage
        if (this.storageManager) {
          await this.storageManager.removeItem(`plan_${userId}_${date}`);
        }

        this.logger.info('Cache invalidated', { userId, date, cacheKey });
      }

      // Emit cache invalidation event
      if (this.eventBus) {
        this.eventBus.emit('plan_cache:invalidated', {
          userId,
          dates,
        });
      }
    } catch (error) {
      this.logger.error('Error invalidating cache:', error);
    }
  }

  /**
   * Get today's plan
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Today's plan
   */
  async getTodayPlan(userId) {
    const today = new Date().toISOString().split('T')[0];
    return await this.getPlan(userId, today);
  }

  /**
   * Get tomorrow's plan
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Tomorrow's plan
   */
  async getTomorrowPlan(userId) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    return await this.getPlan(userId, tomorrowStr);
  }

  /**
   * Warm cache for today and tomorrow
   * @param {number} userId - User ID
   * @returns {Promise<void>}
   */
  async warmTodayTomorrow(userId) {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    await this.warmCache(userId, [today, tomorrowStr]);
  }

  /**
   * Check if should add sync note
   * @param {string} date - Date
   * @returns {boolean} True if should add note
   */
  shouldAddSyncNote(date) {
    // Add note if cache was warmed recently (within last 10 seconds)
    const cacheKey = `warm_${date}`;
    const lastWarmTime = this.lastRefresh.get(cacheKey);

    return lastWarmTime && Date.now() - lastWarmTime < 10 * 1000;
  }

  /**
   * Mock user profile getter
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile(userId) {
    return { id: userId, age: 30, gender: 'male' };
  }

  /**
   * Mock preferences getter
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Preferences
   */
  async getUserPreferences(userId) {
    return { trainingMode: 'hybrid' };
  }

  /**
   * Mock schedule getter
   * @param {number} userId - User ID
   * @param {string} date - Date
   * @returns {Promise<Object>} Schedule
   */
  async getSchedule(userId, date) {
    return { isGameDay: false };
  }

  /**
   * Mock history getter
   * @param {number} userId - User ID
   * @returns {Promise<Object>} History
   */
  async getHistory(userId) {
    return { lastSessions: [] };
  }

  /**
   * Mock readiness getter
   * @param {number} userId - User ID
   * @param {string} date - Date
   * @returns {Promise<number>} Readiness
   */
  async getReadiness(userId, date) {
    return 7;
  }

  /**
   * Start periodic cleanup of expired entries
   * @param {number} intervalMs - Cleanup interval in milliseconds
   */
  startPeriodicCleanup(intervalMs = 60000) {
    // Default 1 minute
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, intervalMs);

    this.logger.info('Periodic cleanup started', { intervalMs });
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Periodic cleanup stopped');
    }
  }
}

// Export for browser
if (typeof window !== 'undefined') {
  window.PlanCache = PlanCache;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlanCache;
}
