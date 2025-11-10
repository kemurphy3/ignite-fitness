/**
 * Deduplication Rules
 * Handles activity deduplication logic and richness scoring
 */

class DedupRules {
    /**
     * Build deduplication hash for an activity
     * @param {Object} activity - Activity data
     * @param {number} activity.userId - User ID
     * @param {string} activity.startTs - Start timestamp (ISO string)
     * @param {number} activity.durationS - Duration in seconds
     * @param {string} activity.type - Activity type
     * @returns {string} SHA256 hash for deduplication
     */
    static buildDedupHash(activity) {
        const { userId, startTs, durationS, type } = activity;

        if (!userId || !startTs || !durationS || !type) {
            throw new Error('Missing required fields for dedup hash: userId, startTs, durationS, type');
        }

        // Round duration to minutes for fuzzy matching (±1 minute tolerance)
        const durationMinutes = Math.round(durationS / 60);

        // Create normalized string for hashing
        const hashInput = `${userId}|${startTs}|${durationMinutes}|${type}`;

        // Use HashUtils if available, otherwise fallback
        if (typeof window !== 'undefined' && window.HashUtils) {
            return window.HashUtils.sha256Sync(hashInput);
        }

        // Fallback implementation
        return this.simpleHash(hashInput);
    }

    /**
     * Calculate richness score for an activity
     * @param {Object} activity - Activity data
     * @returns {number} Richness score (0.0 to 1.0)
     */
    static richnessScore(activity) {
        let score = 0.0;

        // Heart rate data (+0.4)
        if (activity.hasHr || activity.avgHr || activity.maxHr || activity.hrStream) {
            score += 0.4;
        }

        // GPS data (+0.2)
        if (activity.hasGps || activity.distanceM || activity.gpsStream) {
            score += 0.2;
        }

        // Power data (+0.2)
        if (activity.hasPower || activity.powerStream) {
            score += 0.2;
        }

        // Per-second data (+0.1)
        if (activity.perSecondData || activity.highResolutionData) {
            score += 0.1;
        }

        // Device information (+0.1)
        if (activity.device || activity.deviceName || activity.deviceType) {
            score += 0.1;
        }

        // Additional data quality indicators
        if (activity.caloriesKcal && activity.caloriesKcal > 0) {
            score += 0.05;
        }

        if (activity.elevationGain && activity.elevationGain > 0) {
            score += 0.05;
        }

        // Cap at 1.0
        return Math.min(score, 1.0);
    }

    /**
     * Check if activities are likely duplicates
     * @param {Object} activity1 - First activity
     * @param {Object} activity2 - Second activity
     * @returns {boolean} True if likely duplicates
     */
    static likelyDuplicate(activity1, activity2) {
        // Must be same user and type
        if (activity1.userId !== activity2.userId || activity1.type !== activity2.type) {
            return false;
        }

        // Time tolerance: ±6 minutes
        const timeDiffMs = Math.abs(new Date(activity1.startTs) - new Date(activity2.startTs));
        const timeDiffMinutes = timeDiffMs / (1000 * 60);

        if (timeDiffMinutes > 6) {
            return false;
        }

        // Duration tolerance: ±10%
        const duration1 = activity1.durationS || 0;
        const duration2 = activity2.durationS || 0;

        if (duration1 === 0 || duration2 === 0) {
            return false;
        }

        const durationDiff = Math.abs(duration1 - duration2);
        const durationTolerance = Math.max(duration1, duration2) * 0.1;

        if (durationDiff > durationTolerance) {
            return false;
        }

        return true;
    }

    /**
     * Find likely duplicates in activity list
     * @param {Array} activities - Array of activities
     * @param {Object} targetActivity - Activity to find duplicates for
     * @returns {Array} Array of duplicate activities
     */
    static findLikelyDuplicates(activities, targetActivity) {
        return activities.filter(activity =>
            activity.id !== targetActivity.id &&
            this.likelyDuplicate(activity, targetActivity)
        );
    }

    /**
     * Merge duplicate activities
     * @param {Object} primaryActivity - Primary activity (higher richness)
     * @param {Object} secondaryActivity - Secondary activity to merge
     * @returns {Object} Merged activity
     */
    static mergeActivities(primaryActivity, secondaryActivity) {
        const merged = { ...primaryActivity };

        // Update source set to include both sources
        merged.sourceSet = merged.sourceSet || {};
        merged.mergedFrom = merged.mergedFrom || [];

        // Add secondary source info
        if (secondaryActivity.canonicalSource) {
            merged.sourceSet[secondaryActivity.canonicalSource] = {
                id: secondaryActivity.canonicalExternalId,
                richness: this.richnessScore(secondaryActivity)
            };
        }

        // Add to merge trail
        merged.mergedFrom.push({
            source: secondaryActivity.canonicalSource,
            externalId: secondaryActivity.canonicalExternalId,
            mergedAt: new Date().toISOString()
        });

        // Update richness score
        merged.richnessScore = this.richnessScore(merged);

        return merged;
    }

    /**
     * Determine which activity should be primary in a merge
     * @param {Object} activity1 - First activity
     * @param {Object} activity2 - Second activity
     * @returns {Object} Primary activity
     */
    static selectPrimaryActivity(activity1, activity2) {
        const richness1 = this.richnessScore(activity1);
        const richness2 = this.richnessScore(activity2);

        // Higher richness wins
        if (richness1 > richness2) {
            return activity1;
        } else if (richness2 > richness1) {
            return activity2;
        }

        // If equal richness, prefer manual over external
        if (activity1.canonicalSource === 'manual' && activity2.canonicalSource !== 'manual') {
            return activity1;
        } else if (activity2.canonicalSource === 'manual' && activity1.canonicalSource !== 'manual') {
            return activity2;
        }

        // If still equal, prefer more recent
        return new Date(activity1.createdAt) > new Date(activity2.createdAt) ? activity1 : activity2;
    }

    /**
     * Process activities for deduplication
     * @param {Array} activities - Array of activities to process
     * @returns {Object} Processed results
     */
    static processForDeduplication(activities) {
        const processed = [];
        const duplicates = [];
        const processedHashes = new Set();

        for (const activity of activities) {
            const hash = this.buildDedupHash(activity);

            if (processedHashes.has(hash)) {
                // Find existing activity with same hash
                const existingIndex = processed.findIndex(a => this.buildDedupHash(a) === hash);
                const existing = processed[existingIndex];

                // Determine primary activity
                const primary = this.selectPrimaryActivity(existing, activity);
                const secondary = primary === existing ? activity : existing;

                // Merge activities
                const merged = this.mergeActivities(primary, secondary);
                processed[existingIndex] = merged;

                duplicates.push({
                    primary,
                    secondary,
                    merged
                });
            } else {
                processedHashes.add(hash);
                processed.push(activity);
            }
        }

        return {
            processed,
            duplicates,
            totalProcessed: activities.length,
            duplicatesFound: duplicates.length
        };
    }

    /**
     * Simple hash function fallback
     * @param {string} input - String to hash
     * @returns {string} Simple hash
     */
    static simpleHash(input) {
        let hash = 0;
        if (input.length === 0) {return hash.toString();}

        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return Math.abs(hash).toString(16);
    }

    /**
     * Validate activity data for deduplication
     * @param {Object} activity - Activity to validate
     * @returns {Object} Validation result
     */
    static validateActivity(activity) {
        const errors = [];
        const warnings = [];

        // Required fields
        if (!activity.userId) {errors.push('Missing userId');}
        if (!activity.startTs) {errors.push('Missing startTs');}
        if (!activity.durationS) {errors.push('Missing durationS');}
        if (!activity.type) {errors.push('Missing type');}

        // Data quality warnings
        if (activity.durationS && activity.durationS < 60) {
            warnings.push('Very short duration (< 1 minute)');
        }

        if (activity.durationS && activity.durationS > 86400) {
            warnings.push('Very long duration (> 24 hours)');
        }

        if (activity.avgHr && (activity.avgHr < 40 || activity.avgHr > 220)) {
            warnings.push('Unusual average heart rate');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DedupRules;
}

// Export for browser
if (typeof window !== 'undefined') {
    window.DedupRules = DedupRules;
}
