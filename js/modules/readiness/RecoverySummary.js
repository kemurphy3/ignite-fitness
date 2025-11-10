/**
 * RecoverySummary - Visualizes readiness, fatigue, and safety state
 * Provides color-coded readiness display and safety meter
 */
class RecoverySummary {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.eventBus = window.EventBus;
        this.injuryCheck = window.InjuryCheck;

        this.todayReadiness = null;
        this.weekReadiness = [];
        this.safetyData = null;
    }

    /**
     * Initialize and load data
     */
    async initialize() {
        await this.loadTodayReadiness();
        this.loadWeekReadiness();
        this.calculateSafetyMeter();
        this.setupEventListeners();
    }

    /**
     * Load today's readiness score
     * If no explicit check-in exists, tries passive inference
     */
    async loadTodayReadiness() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const userId = this.getUserId();

            // Try to get explicit readiness check-in first
            const readinessLog = this.storageManager.getReadinessLog(userId, today);

            if (readinessLog && readinessLog.readinessScore !== undefined) {
                // Explicit check-in found
                this.todayReadiness = {
                    score: readinessLog.readinessScore,
                    date: today,
                    color: this.getReadinessColor(readinessLog.readinessScore),
                    source: 'explicit'
                };
                return;
            }

            // No explicit check-in - try passive inference
            try {
                const passiveReadiness = window.PassiveReadiness;
                if (passiveReadiness && typeof passiveReadiness.inferReadiness === 'function') {
                    const inferred = await passiveReadiness.inferReadiness({ userId });

                    if (inferred && inferred.score !== undefined && inferred.score !== null) {
                        this.todayReadiness = {
                            score: inferred.score,
                            date: today,
                            color: this.getReadinessColor(inferred.score),
                            source: 'inferred'
                        };
                        return;
                    }
                }
            } catch (inferenceError) {
                this.logger.debug('Passive readiness inference failed, using default', inferenceError.message);
            }

            // No data available - set to null (user prefers this standard)
            this.todayReadiness = null;
            return;
        } catch (error) {
            this.logger.error('Failed to load today readiness', error);
            // No data available - set to null
            this.todayReadiness = null;
        }
    }

    /**
     * Load week readiness history
     */
    loadWeekReadiness() {
        try {
            const userId = this.getUserId();
            const logs = this.storageManager.getReadinessLogs();

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            this.weekReadiness = Object.values(logs)
                .filter(log => log.userId === userId)
                .filter(log => new Date(log.date) >= sevenDaysAgo)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(log => ({
                    score: log.readinessScore || 5,
                    date: log.date,
                    color: this.getReadinessColor(log.readinessScore || 5)
                }));
        } catch (error) {
            this.logger.error('Failed to load week readiness', error);
            this.weekReadiness = [];
        }
    }

    /**
     * Calculate safety meter (7-day volume vs threshold)
     */
    calculateSafetyMeter() {
        try {
            const userId = this.getUserId();
            const logs = this.storageManager.getSessionLogs();

            // Get sessions from last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentSessions = Object.values(logs)
                .filter(log => log.userId === userId)
                .filter(log => new Date(log.date) >= sevenDaysAgo);

            // Calculate total volume
            const totalVolume = recentSessions.reduce((sum, session) => {
                return sum + (session.totalVolume || 0);
            }, 0);

            // Calculate weekly average
            const weeklyAverage = totalVolume / 7;

            // Calculate previous week for comparison
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            const previousWeekSessions = Object.values(logs)
                .filter(log => log.userId === userId)
                .filter(log => {
                    const logDate = new Date(log.date);
                    return logDate >= fourteenDaysAgo && logDate < sevenDaysAgo;
                });

            const previousWeekVolume = previousWeekSessions.reduce((sum, session) => {
                return sum + (session.totalVolume || 0);
            }, 0);

            const previousWeekAverage = previousWeekVolume / 7;

            // Calculate percentage change
            const volumeChange = previousWeekAverage > 0
                ? ((weeklyAverage - previousWeekAverage) / previousWeekAverage) * 100
                : 0;

            // Determine risk level
            let riskLevel = 'low';
            let riskMessage = 'Safe';

            if (volumeChange > 25) {
                riskLevel = 'high';
                riskMessage = `High Risk - Volume ↑${ volumeChange.toFixed(0) }%`;
            } else if (volumeChange > 15) {
                riskLevel = 'moderate';
                riskMessage = `Moderate Risk - Volume ↑${ volumeChange.toFixed(0) }%`;
            }

            this.safetyData = {
                currentWeekVolume: weeklyAverage,
                previousWeekVolume: previousWeekAverage,
                volumeChange,
                riskLevel,
                riskMessage,
                recentSessions: recentSessions.length,
                date: new Date().toISOString().split('T')[0]
            };
        } catch (error) {
            this.logger.error('Failed to calculate safety meter', error);
            this.safetyData = {
                currentWeekVolume: 0,
                previousWeekVolume: 0,
                volumeChange: 0,
                riskLevel: 'low',
                riskMessage: 'No data',
                recentSessions: 0
            };
        }
    }

    /**
     * Get readiness color based on score
     * @param {number} score - Readiness score (0-10)
     * @returns {string} Color
     */
    getReadinessColor(score) {
        if (score > 7) {return '#10b981';} // Green
        if (score >= 5) {return '#f59e0b';} // Yellow
        return '#ef4444'; // Red
    }

    /**
     * Get today's readiness
     * @returns {Object} Today's readiness data
     */
    getTodayReadiness() {
        // Return null when no readiness data is available (user prefers this standard)
        if (!this.todayReadiness) {
            return null;
        }
        return this.todayReadiness;
    }

    /**
     * Get safety meter data
     * @returns {Object} Safety meter data
     */
    getSafetyMeter() {
        return this.safetyData;
    }

    /**
     * Get last injury flag summary
     * @returns {Object|null} Last injury flag
     */
    getLastInjuryFlag() {
        try {
            const userId = this.getUserId();
            const flags = this.storageManager.getInjuryFlags();

            const userFlags = Object.values(flags)
                .filter(flag => flag.userId === userId)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (userFlags.length === 0) {
                return null;
            }

            const lastFlag = userFlags[0];

            return {
                bodyLocation: lastFlag.bodyLocation,
                painLevel: lastFlag.painLevel,
                painType: lastFlag.painType,
                exerciseName: lastFlag.exerciseName,
                date: lastFlag.date,
                suggestions: lastFlag.suggestions,
                tooltip: this.generateInjuryTooltip(lastFlag)
            };
        } catch (error) {
            this.logger.error('Failed to get last injury flag', error);
            return null;
        }
    }

    /**
     * Generate injury flag tooltip text
     * @param {Object} flag - Injury flag data
     * @returns {string} Tooltip text
     */
    generateInjuryTooltip(flag) {
        const daysAgo = Math.floor((Date.now() - new Date(flag.timestamp)) / (1000 * 60 * 60 * 24));

        return `
Last injury report (${daysAgo} days ago):
• Location: ${flag.bodyLocation}
• Pain level: ${flag.painLevel}/10 (${flag.painType})
• Exercise: ${flag.exerciseName}
• Recommendation: ${flag.suggestions?.message || 'Monitor'}
        `.trim();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.eventBus) {
            // Listen for readiness updates
            this.eventBus.on(this.eventBus.TOPICS.READINESS_UPDATED, () => {
                this.loadTodayReadiness();
                this.loadWeekReadiness();
            });

            // Listen for session completions
            this.eventBus.on(this.eventBus.TOPICS.SESSION_COMPLETED, () => {
                this.calculateSafetyMeter();
            });
        }
    }

    /**
     * Get user ID
     * @returns {string} User ID
     */
    getUserId() {
        const authManager = window.AuthManager;
        return authManager?.getCurrentUsername() || 'anonymous';
    }

    /**
     * Get comprehensive recovery summary
     * @returns {Object} Recovery summary
     */
    getSummary() {
        return {
            todayReadiness: this.getTodayReadiness(),
            weekReadiness: this.weekReadiness,
            safetyMeter: this.getSafetyMeter(),
            lastInjuryFlag: this.getLastInjuryFlag()
        };
    }
}

// Create global instance
window.RecoverySummary = new RecoverySummary();
// Initialize asynchronously - don't block page load
window.RecoverySummary.initialize().catch(err => {
    console.error('RecoverySummary initialization error:', err);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecoverySummary;
}
