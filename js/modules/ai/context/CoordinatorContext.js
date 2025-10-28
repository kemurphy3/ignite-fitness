/**
 * CoordinatorContext
 * Provides enhanced context for ExpertCoordinator with rolling load, data confidence, and recent activity
 */

class CoordinatorContext {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.authManager = window.AuthManager;
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
            // In a real implementation, this would query daily_aggregates table
            // For now, return default values with logic to fetch from storage
            const metrics = {
                atl7: 0,
                ctl28: 0,
                monotony: 1.0,
                strain: 0
            };

            // Try to get from StorageManager if available
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

            // Fetch from database if available (placeholder)
            // const { data } = await supabase
            //     .from('daily_aggregates')
            //     .select('*')
            //     .eq('user_id', userId)
            //     .order('date', { ascending: false })
            //     .limit(28);

            return metrics;

        } catch (error) {
            this.logger.error('Error building load metrics:', error);
            return { atl7: 0, ctl28: 0, monotony: 1.0, strain: 0 };
        }
    }

    /**
     * Get yesterday's activity data
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Yesterday's activity summary
     */
    async getYesterdayActivity(userId) {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);

            const yesterdayStr = yesterday.toISOString().split('T')[0];

            // In a real implementation, query activities for yesterday
            // For now, return default
            const yesterdayActivity = {
                type: null,
                duration_s: 0,
                avg_hr: null,
                z4_min: 0,
                z5_min: 0,
                activities: []
            };

            // Try to get from StorageManager
            if (this.storageManager) {
                try {
                    const cached = await this.storageManager.getItem(`user_${userId}_yesterday_${yesterdayStr}`);
                    if (cached) {
                        return cached;
                    }
                } catch (error) {
                    this.logger.debug('No cached yesterday activity found');
                }
            }

            // Query database for yesterday's activities
            // const { data } = await supabase
            //     .from('activities')
            //     .select('*')
            //     .eq('user_id', userId)
            //     .gte('start_ts', yesterday.toISOString())
            //     .lt('start_ts', new Date(yesterday.getTime() + 24 * 60 * 60 * 1000).toISOString());

            // if (data && data.length > 0) {
            //     return this.aggregateYesterdayActivity(data);
            // }

            return yesterdayActivity;

        } catch (error) {
            this.logger.error('Error getting yesterday activity:', error);
            return { type: null, duration_s: 0, avg_hr: null, z4_min: 0, z5_min: 0, activities: [] };
        }
    }

    /**
     * Aggregate yesterday's activities into summary
     * @param {Array} activities - Array of activities
     * @returns {Object} Aggregated activity data
     */
    aggregateYesterdayActivity(activities) {
        const aggregated = {
            type: null,
            duration_s: 0,
            avg_hr: null,
            z4_min: 0,
            z5_min: 0,
            activities: []
        };

        for (const activity of activities) {
            aggregated.duration_s += activity.duration_s || 0;
            
            if (activity.avg_hr && aggregated.avg_hr) {
                aggregated.avg_hr = (aggregated.avg_hr + activity.avg_hr) / 2;
            } else if (activity.avg_hr) {
                aggregated.avg_hr = activity.avg_hr;
            }

            // Get zone minutes from daily aggregates if available
            // This would typically come from the daily_aggregates table
            // For now, estimate based on activity
            if (activity.avg_hr && activity.max_hr) {
                const hrReserve = (activity.avg_hr - 60) / (activity.max_hr - 60);
                if (hrReserve > 0.8) {
                    aggregated.z4_min += (activity.duration_s / 60) * 0.5;
                    aggregated.z5_min += (activity.duration_s / 60) * 0.3;
                }
            }
        }

        // Determine primary activity type
        const typeCounts = {};
        for (const activity of activities) {
            typeCounts[activity.type] = (typeCounts[activity.type] || 0) + (activity.duration_s || 0);
        }
        
        const primaryType = Object.keys(typeCounts).reduce((a, b) => 
            typeCounts[a] > typeCounts[b] ? a : b, 
            null
        );
        aggregated.type = primaryType;

        return aggregated;
    }

    /**
     * Calculate data confidence scores
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Confidence metrics
     */
    async calculateDataConfidence(userId) {
        try {
            const confidence = {
                recent7days: 0,
                sessionDetail: 0,
                trend: 'flat'
            };

            // Calculate recent7days: share of days with HR data
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            // Query last 7 days of activities
            // const { data } = await supabase
            //     .from('activities')
            //     .select('has_hr, avg_hr, source_set')
            //     .eq('user_id', userId)
            //     .gte('start_ts', sevenDaysAgo.toISOString());

            // if (data && data.length > 0) {
            //     const daysWithHR = new Set();
            //     let totalRichness = 0;
                
            //     for (const activity of data) {
            //         const date = new Date(activity.start_ts).toISOString().split('T')[0];
            //         if (activity.has_hr || activity.avg_hr) {
            //             daysWithHR.add(date);
            //         }
            //         
            //         // Calculate richness from source_set
            //         if (activity.source_set && Object.keys(activity.source_set).length > 0) {
            //             const sources = Object.values(activity.source_set);
            //             const avgRichness = sources.reduce((sum, s) => sum + (s.richness || 0), 0) / sources.length;
            //             totalRichness += avgRichness;
            //         }
            //     }
                
            //     confidence.recent7days = daysWithHR.size / 7;
            //     confidence.sessionDetail = totalRichness / data.length;
            // }

            // Determine trend (placeholder - would analyze metrics over time)
            confidence.trend = 'flat';

            return confidence;

        } catch (error) {
            this.logger.error('Error calculating data confidence:', error);
            return { recent7days: 0, sessionDetail: 0, trend: 'flat' };
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
