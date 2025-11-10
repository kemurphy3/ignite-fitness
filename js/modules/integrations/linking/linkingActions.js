/**
 * LinkingActions - Handles user decisions for linked activities
 * Manages excluding sources and updating training load
 */

class LinkingActions {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.supabase = null; // Will be initialized with Supabase client
    }

    /**
     * Handle user's link decision
     * @param {Object} activity - Activity data
     * @param {string} action - Action type (keep-both, use-primary, use-secondary)
     * @param {Array} primarySource - Primary source [name, data]
     * @param {Array} secondarySource - Secondary source [name, data]
     * @returns {Promise<Object>} Result of action
     */
    async handleLinkDecision(activity, action, primarySource, secondarySource) {
        try {
            this.logger.info('Handling link decision', {
                activityId: activity.id,
                action,
                primary: primarySource[0],
                secondary: secondarySource[0]
            });

            switch (action) {
                case 'keep-both':
                    return await this.keepBoth(activity);

                case 'use-primary':
                    return await this.usePrimaryOnly(activity, primarySource, secondarySource);

                case 'use-secondary':
                    return await this.useSecondaryOnly(activity, primarySource, secondarySource);

                default:
                    return { success: false, error: 'Unknown action' };
            }

        } catch (error) {
            this.logger.error('Error handling link decision:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Keep both sources active (default behavior)
     * @param {Object} activity - Activity data
     * @returns {Promise<Object>} Result
     */
    async keepBoth(activity) {
        try {
            // Save preference to use both sources
            await this.setLinkPreference(activity.id, 'keep-both');

            return {
                success: true,
                message: 'Keeping both sources active',
                action: 'keep-both'
            };

        } catch (error) {
            this.logger.error('Error keeping both sources:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Use primary source only (exclude secondary)
     * @param {Object} activity - Activity data
     * @param {Array} primarySource - Primary source
     * @param {Array} secondarySource - Secondary source
     * @returns {Promise<Object>} Result
     */
    async usePrimaryOnly(activity, primarySource, secondarySource) {
        try {
            // Mark secondary source as excluded
            await this.excludeSource(activity.id, secondarySource[0]);

            // Save preference
            await this.setLinkPreference(activity.id, 'use-primary');

            // Trigger aggregate recalculation
            await this.triggerAggregateRecalculation(activity);

            return {
                success: true,
                message: `Using ${this.formatSource(primarySource[0])} only`,
                action: 'use-primary'
            };

        } catch (error) {
            this.logger.error('Error using primary only:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Use secondary source only (exclude primary)
     * @param {Object} activity - Activity data
     * @param {Array} primarySource - Primary source
     * @param {Array} secondarySource - Secondary source
     * @returns {Promise<Object>} Result
     */
    async useSecondaryOnly(activity, primarySource, secondarySource) {
        try {
            // Mark primary source as excluded
            await this.excludeSource(activity.id, primarySource[0]);

            // Save preference
            await this.setLinkPreference(activity.id, 'use-secondary');

            // Trigger aggregate recalculation
            await this.triggerAggregateRecalculation(activity);

            return {
                success: true,
                message: `Using ${this.formatSource(secondarySource[0])} only`,
                action: 'use-secondary'
            };

        } catch (error) {
            this.logger.error('Error using secondary only:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Exclude a source from activity
     * @param {number} activityId - Activity ID
     * @param {string} sourceName - Source name to exclude
     * @returns {Promise<void>}
     */
    async excludeSource(activityId, sourceName) {
        try {
            // In a real implementation, this would update the database
            // For now, save to local storage as preference
            await this.setExcludedSource(activityId, sourceName);

            // If this is a soft ignore (external source), store the preference
            if (sourceName !== 'manual') {
                await this.storeSoftIgnore(activityId, sourceName);
            }

            this.logger.info('Source excluded', { activityId, sourceName });

        } catch (error) {
            this.logger.error('Error excluding source:', error);
            throw error;
        }
    }

    /**
     * Set link preference for activity
     * @param {number} activityId - Activity ID
     * @param {string} preference - Preference (keep-both, use-primary, use-secondary)
     */
    async setLinkPreference(activityId, preference) {
        try {
            if (this.storageManager) {
                await this.storageManager.setItem(`activity_${activityId}_link_preference`, preference);
                this.logger.info('Link preference saved', { activityId, preference });
            }
        } catch (error) {
            this.logger.error('Error setting link preference:', error);
        }
    }

    /**
     * Get link preference for activity
     * @param {number} activityId - Activity ID
     * @returns {Promise<string|null>} Preference or null
     */
    async getLinkPreference(activityId) {
        try {
            if (this.storageManager) {
                const preference = await this.storageManager.getItem(`activity_${activityId}_link_preference`);
                return preference;
            }
        } catch (error) {
            this.logger.error('Error getting link preference:', error);
        }
        return null;
    }

    /**
     * Set excluded source
     * @param {number} activityId - Activity ID
     * @param {string} sourceName - Source name
     */
    async setExcludedSource(activityId, sourceName) {
        try {
            if (this.storageManager) {
                const key = `activity_${activityId}_excluded_source`;
                await this.storageManager.setItem(key, sourceName);
                this.logger.info('Excluded source saved', { activityId, sourceName });
            }
        } catch (error) {
            this.logger.error('Error setting excluded source:', error);
        }
    }

    /**
     * Get excluded source for activity
     * @param {number} activityId - Activity ID
     * @returns {Promise<string|null>} Excluded source or null
     */
    async getExcludedSource(activityId) {
        try {
            if (this.storageManager) {
                const excluded = await this.storageManager.getItem(`activity_${activityId}_excluded_source`);
                return excluded;
            }
        } catch (error) {
            this.logger.error('Error getting excluded source:', error);
        }
        return null;
    }

    /**
     * Store soft ignore for external source
     * @param {number} activityId - Activity ID
     * @param {string} sourceName - Source name
     */
    async storeSoftIgnore(activityId, sourceName) {
        try {
            if (this.storageManager) {
                const softIgnores = await this.storageManager.getItem('soft_ignored_sources') || {};
                softIgnores[activityId] = sourceName;
                await this.storageManager.setItem('soft_ignored_sources', softIgnores);
                this.logger.info('Soft ignore stored', { activityId, sourceName });
            }
        } catch (error) {
            this.logger.error('Error storing soft ignore:', error);
        }
    }

    /**
     * Trigger aggregate recalculation for activity date
     * @param {Object} activity - Activity data
     */
    async triggerAggregateRecalculation(activity) {
        try {
            const activityDate = new Date(activity.start_ts).toISOString().split('T')[0];

            this.logger.info('Triggering aggregate recalculation', {
                activityId: activity.id,
                date: activityDate
            });

            // This would typically trigger a backend job to recalculate aggregates
            // For now, we'll use the EventBus to notify other systems
            if (window.EventBus) {
                window.EventBus.emit('activity:exclusion:changed', {
                    activityId: activity.id,
                    date: activityDate
                });
            }

        } catch (error) {
            this.logger.error('Error triggering aggregate recalculation:', error);
        }
    }

    /**
     * Format source name for display
     * @param {string} source - Source name
     * @returns {string} Formatted name
     */
    formatSource(source) {
        const sourceNames = {
            'manual': 'Manual',
            'strava': 'Strava',
            'garmin': 'Garmin',
            'polar': 'Polar',
            'fitbit': 'Fitbit',
            'apple_health': 'Apple Health'
        };
        return sourceNames[source] || source.charAt(0).toUpperCase() + source.slice(1);
    }

    /**
     * Check if source should be excluded for activity
     * @param {number} activityId - Activity ID
     * @param {string} sourceName - Source name
     * @returns {Promise<boolean>} True if excluded
     */
    async isSourceExcluded(activityId, sourceName) {
        try {
            const excludedSource = await this.getExcludedSource(activityId);
            return excludedSource === sourceName;
        } catch (error) {
            this.logger.error('Error checking if source is excluded:', error);
            return false;
        }
    }

    /**
     * Recalculate activity aggregates if source is excluded
     * @param {Object} activity - Activity data
     * @returns {Promise<boolean>} True if recalculated
     */
    async recalculateIfNeeded(activity) {
        try {
            const excludedSource = await this.getExcludedSource(activity.id);
            if (excludedSource) {
                await this.triggerAggregateRecalculation(activity);
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error('Error recalculating aggregates:', error);
            return false;
        }
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.LinkingActions = LinkingActions;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LinkingActions;
}
