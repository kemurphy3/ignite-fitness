/**
 * LRUCache - Least Recently Used cache with automatic eviction
 * Memory-bounded cache with TTL support and automatic cleanup
 */
class LRUCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.maxMemory = options.maxMemory || 50 * 1024 * 1024; // 50MB default
        this.ttl = options.ttl || 60 * 60 * 1000; // 1 hour default
        this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes

        this.cache = new Map();
        this.accessOrder = new Map(); // Track access order
        this.memoryUsage = 0;
        this.hitCount = 0;
        this.missCount = 0;

        this.logger = window.SafeLogger || console;

        // Start cleanup timer
        this.startCleanupTimer();
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or undefined
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.missCount++;
            return undefined;
        }

        // Check TTL
        if (this.isExpired(entry)) {
            this.delete(key);
            this.missCount++;
            return undefined;
        }

        // Update access order
        this.updateAccessOrder(key);
        this.hitCount++;

        return entry.value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {boolean} Success status
     */
    set(key, value, ttl = null) {
        try {
            // Calculate memory usage
            const entrySize = this.calculateSize(key, value);
            const effectiveTtl = ttl || this.ttl;

            // Check if we need to evict entries
            while (this.shouldEvict(entrySize)) {
                this.evictLRU();
            }

            // Remove existing entry if it exists
            if (this.cache.has(key)) {
                this.delete(key);
            }

            // Add new entry
            const entry = {
                value,
                timestamp: Date.now(),
                ttl: effectiveTtl,
                size: entrySize
            };

            this.cache.set(key, entry);
            this.updateAccessOrder(key);
            this.memoryUsage += entrySize;

            this.logger.debug(`Cache set: ${key} (${entrySize} bytes)`);
            return true;

        } catch (error) {
            this.logger.error(`Failed to set cache entry ${key}:`, error);
            return false;
        }
    }

    /**
     * Delete entry from cache
     * @param {string} key - Cache key
     * @returns {boolean} Success status
     */
    delete(key) {
        const entry = this.cache.get(key);
        if (!entry) {return false;}

        this.cache.delete(key);
        this.accessOrder.delete(key);
        this.memoryUsage -= entry.size;

        this.logger.debug(`Cache deleted: ${key}`);
        return true;
    }

    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {boolean} Exists status
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) {return false;}

        if (this.isExpired(entry)) {
            this.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.accessOrder.clear();
        this.memoryUsage = 0;
        this.hitCount = 0;
        this.missCount = 0;

        this.logger.debug('Cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const totalRequests = this.hitCount + this.missCount;
        const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            memoryUsage: this.memoryUsage,
            maxMemory: this.maxMemory,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: Math.round(hitRate * 100) / 100,
            memoryUsagePercent: Math.round((this.memoryUsage / this.maxMemory) * 100)
        };
    }

    /**
     * Check if entry is expired
     * @param {Object} entry - Cache entry
     * @returns {boolean} Expired status
     */
    isExpired(entry) {
        return Date.now() - entry.timestamp > entry.ttl;
    }

    /**
     * Update access order for LRU tracking
     * @param {string} key - Cache key
     */
    updateAccessOrder(key) {
        this.accessOrder.set(key, Date.now());
    }

    /**
     * Calculate size of key-value pair
     * @param {string} key - Cache key
     * @param {*} value - Cache value
     * @returns {number} Size in bytes
     */
    calculateSize(key, value) {
        try {
            const keySize = key.length * 2; // UTF-16 characters
            const valueSize = JSON.stringify(value).length * 2; // Rough estimate
            return keySize + valueSize + 100; // Overhead for object structure
        } catch (error) {
            // Fallback for non-serializable values
            return 1000; // Conservative estimate
        }
    }

    /**
     * Check if we should evict entries
     * @param {number} newEntrySize - Size of new entry
     * @returns {boolean} Should evict
     */
    shouldEvict(newEntrySize) {
        return this.cache.size >= this.maxSize ||
               (this.memoryUsage + newEntrySize) > this.maxMemory;
    }

    /**
     * Evict least recently used entry
     */
    evictLRU() {
        if (this.cache.size === 0) {return;}

        // Find least recently used key
        let lruKey = null;
        let lruTime = Infinity;

        for (const [key, time] of this.accessOrder) {
            if (time < lruTime) {
                lruTime = time;
                lruKey = key;
            }
        }

        if (lruKey) {
            this.delete(lruKey);
            this.logger.debug(`Evicted LRU entry: ${lruKey}`);
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > entry.ttl) {
                expiredKeys.push(key);
            }
        }

        expiredKeys.forEach(key => this.delete(key));

        if (expiredKeys.length > 0) {
            this.logger.debug(`Cleaned up ${expiredKeys.length} expired entries`);
        }
    }

    /**
     * Start cleanup timer
     */
    startCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    /**
     * Stop cleanup timer
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Destroy cache and cleanup resources
     */
    destroy() {
        this.stopCleanupTimer();
        this.clear();
    }
}

// Export for use in other modules
window.LRUCache = LRUCache;
