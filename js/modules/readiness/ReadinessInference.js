/**
 * ReadinessInference - Infers user readiness when check-in is skipped
 * Uses prior session RPE, volume changes, injury flags, and external activities
 */
class ReadinessInference {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
    }

    /**
     * Infer readiness score when manual check-in is missing
     * @param {Object} options - Inference options
     * @param {Array} options.lastSessions - Recent session data
     * @param {Object} options.schedule - Schedule information
     * @returns {Promise<Object>} Readiness with score and inferred flag
     */
    async inferReadiness({ lastSessions = [], schedule = {} }) {
        try {
            let readiness = 7; // Default moderate
            const rationale = [];

            // Factor 1: Yesterday's session RPE
            if (lastSessions.length > 0) {
                const lastSession = lastSessions[0];
                const lastRPE = lastSession?.averageRPE || lastSession?.rpe || 7;

                if (lastRPE >= 8) {
                    readiness -= 2;
                    rationale.push('Yesterday\'s session was intense (RPE ≥8)');
                } else if (lastRPE < 5) {
                    readiness += 1;
                    rationale.push('Yesterday\'s session was light');
                }

                // Factor 2: Weekly volume trend
                if (lastSessions.length >= 3) {
                    const weeklyVolume = lastSessions.slice(0, 3).reduce((sum, s) => sum + (s.volume || 0), 0);
                    const previousWeekVolume = lastSessions.slice(3, 6).reduce((sum, s) => sum + (s.volume || 0), 0);

                    if (weeklyVolume > previousWeekVolume * 1.25) {
                        readiness -= 1;
                        rationale.push('Weekly volume increased significantly');
                    }
                }
            }

            // Factor 3: Back-to-back days
            if (lastSessions.length >= 2 && lastSessions[0].date && lastSessions[1].date) {
                const daysDiff = Math.abs(
                    new Date(lastSessions[0].date) - new Date(lastSessions[1].date)
                ) / (1000 * 60 * 60 * 24);

                if (daysDiff < 1.5) {
                    readiness -= 1;
                    rationale.push('Training on consecutive days');
                }
            }

            // Factor 4: Game day proximity
            if (schedule.daysUntilGame !== undefined) {
                if (schedule.daysUntilGame <= 1) {
                    readiness -= 1;
                    rationale.push('Game very soon');
                } else if (schedule.daysUntilGame === 2) {
                    readiness -= 0.5;
                    rationale.push('Game in 2 days');
                }
            }

            // Clamp to 1-10 and round
            const score = Math.max(1, Math.min(10, Math.round(readiness)));

            return {
                score,
                inferred: true,
                rationale: rationale.join('; ')
            };
        } catch (error) {
            this.logger.error('Failed to infer readiness', error);
            return {
                score: 7,
                inferred: true,
                rationale: 'Default moderate readiness'
            };
        }
    }

    /**
     * Gather data for inference
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Inference data
     */
    async gatherInferenceData(userId) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const lastSession = await this.storageManager.getSessionLog(userId, yesterdayStr);
        const lastRPE = lastSession?.averageRPE || null;

        const volumeChange = await this.calculateVolumeChange(userId);

        const recentInjuries = await this.getRecentInjuries(userId);

        const externalLoad = await this.getExternalLoad(userId);

        return {
            lastRPE: lastRPE || 7,
            volumeChange,
            recentInjuries,
            externalLoad
        };
    }

    /**
     * Calculate volume change percentage
     * @param {string} userId - User ID
     * @returns {Promise<number>} Volume change %
     */
    async calculateVolumeChange(userId) {
        try {
            const logs = await this.storageManager.getSessionLogs(userId);
            if (!logs || logs.length < 2) {return 0;}

            const recentVolume = logs[logs.length - 1]?.totalVolume || 0;
            const previousVolume = logs[logs.length - 2]?.totalVolume || 0;

            if (previousVolume === 0) {return 0;}

            return ((recentVolume - previousVolume) / previousVolume) * 100;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get recent injury flags
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Recent injuries
     */
    async getRecentInjuries(userId) {
        try {
            const flags = await this.storageManager.getInjuryFlags(userId);
            if (!flags || !Array.isArray(flags)) {return [];}

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            return flags.filter(flag => {
                const flagDate = new Date(flag.date);
                return flagDate >= sevenDaysAgo && flag.active;
            });
        } catch (error) {
            return [];
        }
    }

    /**
     * Get external load from Strava/similar
     * @param {string} userId - User ID
     * @returns {Promise<number>} External load score
     */
    async getExternalLoad(userId) {
        try {
            const activities = await this.storageManager.getExternalActivities(userId);
            if (!activities || activities.length === 0) {return 0;}

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const yesterdayActivities = activities.filter(act => act.date === yesterdayStr);

            return yesterdayActivities.reduce((load, act) => {
                return load + (act.duration || 0) * 0.1; // Simple load calculation
            }, 0);
        } catch (error) {
            return 0;
        }
    }
}

window.ReadinessInference = ReadinessInference;

