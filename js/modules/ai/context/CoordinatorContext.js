/**
 * CoordinatorContext
 * Provides enhanced context for ExpertCoordinator with rolling load, data confidence, and recent activity
 */

class CoordinatorContext {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.authManager = window.AuthManager;
        this.dbClient = null;
        this.initializeDatabase();
    }

    /**
     * Initialize database client
     */
    async initializeDatabase() {
        try {
            // Try to load the database client
            if (typeof window !== 'undefined' && window.AIContextDatabase) {
                this.dbClient = new window.AIContextDatabase();
            } else if (typeof require !== 'undefined') {
                const AIContextDatabase = require('../../netlify/functions/utils/ai-context-database.js');
                this.dbClient = new AIContextDatabase();
            }
            
            this.logger.info('Database client initialized for CoordinatorContext');
        } catch (error) {
            this.logger.warn('Failed to initialize database client, using fallback mode:', error.message);
        }
    }

    /**
     * Build enhanced context for coordinator
     * @param {Object} baseContext - Base user context
     * @returns {Promise<Object>} Enhanced context with load metrics and confidence
     */
    async buildContext(baseContext) {
        try {
            const userId = baseContext.user?.id || baseContext.profile?.id;
            
            if (!userId) {
                this.logger.warn('No userId in context, returning base context');
                return baseContext;
            }

            const enhancedContext = {
                ...baseContext,
                load: await this.buildLoadMetrics(userId),
                yesterday: await this.getYesterdayActivity(userId),
                dataConfidence: await this.calculateDataConfidence(userId)
            };

            this.logger.info('Enhanced context built', {
                atl7: enhancedContext.load.atl7,
                ctl28: enhancedContext.load.ctl28,
                confidence: enhancedContext.dataConfidence.recent7days
            });

            return enhancedContext;

        } catch (error) {
            this.logger.error('Error building enhanced context:', error);
            return baseContext;
        }
    }

    /**
     * Build load metrics from daily aggregates
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Load metrics (atl7, ctl28, monotony, strain)
     */
    async buildLoadMetrics(userId) {
        try {
            // Use real database queries if available
            if (this.dbClient) {
                const metrics = await this.dbClient.getLoadMetrics(userId);
                
                // Cache the results
                if (this.storageManager) {
                    await this.storageManager.setItem(`user_${userId}_load_metrics`, metrics);
                }
                
                this.logger.debug('Load metrics fetched from database', {
                    userId,
                    atl7: metrics.atl7,
                    ctl28: metrics.ctl28,
                    dataPoints: metrics.dataPoints
                });
                
                return metrics;
            }

            // Fallback: Try to get from StorageManager
            if (this.storageManager) {
                try {
                    const cachedMetrics = await this.storageManager.getItem(`user_${userId}_load_metrics`);
                    if (cachedMetrics) {
                        return cachedMetrics;
                    }
                } catch (error) {
                    this.logger.debug('No cached load metrics found');
                }
            }

            // Final fallback: return default values
            this.logger.warn('Using fallback load metrics - no database connection');
            return { atl7: 0, ctl28: 0, monotony: 1.0, strain: 0, dataPoints: 0 };

        } catch (error) {
            this.logger.error('Error building load metrics:', error);
            return { atl7: 0, ctl28: 0, monotony: 1.0, strain: 0, dataPoints: 0 };
        }
    }

    /**
     * Get yesterday's activity data
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Yesterday's activity summary
     */
    async getYesterdayActivity(userId) {
        try {
            // Use real database queries if available
            if (this.dbClient) {
                const yesterdayActivity = await this.dbClient.getYesterdayActivity(userId);
                
                // Cache the results
                if (this.storageManager) {
                    const yesterdayStr = this.getYesterdayDateStr();
                    await this.storageManager.setItem(`user_${userId}_yesterday_${yesterdayStr}`, yesterdayActivity);
                }
                
                this.logger.debug('Yesterday activity fetched from database', {
                    userId,
                    activities: yesterdayActivity.activities,
                    duration: yesterdayActivity.duration_s,
                    type: yesterdayActivity.type
                });
                
                return yesterdayActivity;
            }

            // Fallback: Try to get from StorageManager
            if (this.storageManager) {
                try {
                    const yesterdayStr = this.getYesterdayDateStr();
                    const cached = await this.storageManager.getItem(`user_${userId}_yesterday_${yesterdayStr}`);
                    if (cached) {
                        return cached;
                    }
                } catch (error) {
                    this.logger.debug('No cached yesterday activity found');
                }
            }

            // Final fallback: return default values
            this.logger.warn('Using fallback yesterday activity - no database connection');
            return { type: null, duration_s: 0, avg_hr: null, z4_min: 0, z5_min: 0, activities: 0 };

        } catch (error) {
            this.logger.error('Error getting yesterday activity:', error);
            return { type: null, duration_s: 0, avg_hr: null, z4_min: 0, z5_min: 0, activities: 0 };
        }
    }

    /**
     * Calculate data confidence scores
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Confidence metrics
     */
    async calculateDataConfidence(userId) {
        try {
            // Use real database queries if available
            if (this.dbClient) {
                const confidence = await this.dbClient.calculateDataConfidence(userId);
                
                this.logger.debug('Data confidence calculated from database', {
                    userId,
                    recent7days: confidence.recent7days,
                    sessionDetail: confidence.sessionDetail,
                    dataPoints: confidence.dataPoints
                });
                
                return confidence;
            }

            // Fallback: return default confidence
            this.logger.warn('Using fallback data confidence - no database connection');
            return { recent7days: 0, sessionDetail: 0, trend: 'flat', dataPoints: 0 };

        } catch (error) {
            this.logger.error('Error calculating data confidence:', error);
            return { recent7days: 0, sessionDetail: 0, trend: 'flat', dataPoints: 0 };
        }
    }

    /**
     * Update context with recent imports
     * Call this after ingesting new data
     * @param {number} userId - User ID
     * @param {Array} importedActivities - Recently imported activities
     */
    async updateContextAfterImport(userId, importedActivities) {
        try {
            // Clear caches to force recalculation
            if (this.storageManager) {
                await this.storageManager.removeItem(`user_${userId}_load_metrics`);
                await this.storageManager.removeItem(`user_${userId}_yesterday_${this.getYesterdayDateStr()}`);
                await this.storageManager.removeItem(`user_${userId}_context`);
            }

            this.logger.info('Context cache cleared after import', {
                userId,
                importedCount: importedActivities.length
            });

        } catch (error) {
            this.logger.error('Error updating context after import:', error);
        }
    }

    /**
     * Get yesterday's date string
     * @returns {string} Date string (YYYY-MM-DD)
     */
    getYesterdayDateStr() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    /**
     * Get attendance metric for confidence
     * @param {number} userId - User ID
     * @returns {Promise<number>} Confidence score
     */
    async getAttendanceMetric(userId) {
        try {
            const confidence = await this.calculateDataConfidence(userId);
            return confidence.recent7days;

        } catch (error) {
            this.logger.error('Error getting attendance metric:', error);
            return 0;
        }
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.CoordinatorContext = CoordinatorContext;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoordinatorContext;
}