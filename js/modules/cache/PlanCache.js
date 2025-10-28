/**
 * PlanCache - Manages cached workout plans and refreshes them when stale
 * Handles cache invalidation and warm-up after data changes
 */

class PlanCache {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.coordinator = window.ExpertCoordinator;
        this.eventBus = window.EventBus;
        
        this.cache = new Map();
        this.lastRefresh = new Map();
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
                const lastRefreshTime = this.lastRefresh.get(cacheKey);
                const cacheEntry = this.cache.get(cacheKey);

                // Consider cache stale if older than 5 minutes or doesn't exist
                const isStale = !cacheEntry || !lastRefreshTime || 
                    (Date.now() - lastRefreshTime) > 5 * 60 * 1000;

                if (isStale) {
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
                    this.cache.set(cacheKey, plan);
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
                    dates
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
                readiness: await this.getReadiness(userId, date)
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
            
            // Check in-memory cache
            const cachedPlan = this.cache.get(cacheKey);
            if (cachedPlan) {
                this.logger.info('Plan retrieved from cache', { userId, date });
                return cachedPlan;
            }

            // Check persistent storage
            if (this.storageManager) {
                const storedPlan = await this.storageManager.getItem(`plan_${userId}_${date}`);
                if (storedPlan) {
                    // Restore to in-memory cache
                    this.cache.set(cacheKey, storedPlan);
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
                
                // Clear in-memory cache
                this.cache.delete(cacheKey);
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
                    dates
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
        
        return lastWarmTime && (Date.now() - lastWarmTime) < 10 * 1000;
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
}

// Export for browser
if (typeof window !== 'undefined') {
    window.PlanCache = PlanCache;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlanCache;
}
