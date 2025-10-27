/**
 * ProgressionEngine - Handles adaptive load adjustments based on RPE and readiness
 * Implements game-day scheduling, deload weeks, and RPE-based progression
 */
class ProgressionEngine {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.storageManager = window.StorageManager;
        
        this.deloadWeekFrequency = 4; // Every 4th week
        this.rpeAdjustmentStep = 0.05; // ±5% adjustment
    }

    /**
     * Get adjusted load for next session based on RPE
     * @param {string} userId - User ID
     * @param {Object} currentWorkout - Current workout data
     * @param {number} rpe - Rate of Perceived Exertion (1-10)
     * @returns {Promise<Object>} Adjusted workout load
     */
    async adjustLoadFromRPE(userId, currentWorkout, rpe) {
        try {
            const adjustments = {
                intensityMultiplier: 1.0,
                volumeMultiplier: 1.0,
                coachMessage: ''
            };

            // RPE-based adjustments
            if (rpe >= 9) {
                // Very hard - reduce next session by 5%
                adjustments.intensityMultiplier = 0.95;
                adjustments.volumeMultiplier = 0.95;
                adjustments.coachMessage = 'Previous session was very hard (RPE 9+). Reducing load by 5% for optimal adaptation.';
            } else if (rpe >= 8) {
                // Hard - reduce by 3%
                adjustments.intensityMultiplier = 0.97;
                adjustments.volumeMultiplier = 0.97;
                adjustments.coachMessage = 'Previous session was hard (RPE 8). Slightly reducing load by 3%.';
            } else if (rpe >= 7) {
                // Moderate - maintain
                adjustments.intensityMultiplier = 1.0;
                adjustments.volumeMultiplier = 1.0;
                adjustments.coachMessage = 'Previous session was moderate (RPE 7). Maintaining current load.';
            } else if (rpe >= 5) {
                // Easy - increase by 5%
                adjustments.intensityMultiplier = 1.05;
                adjustments.volumeMultiplier = 1.05;
                adjustments.coachMessage = 'Previous session was easy (RPE 5-6). Increasing load by 5% for progressive overload.';
            } else {
                // Very easy - increase by 10%
                adjustments.intensityMultiplier = 1.10;
                adjustments.volumeMultiplier = 1.10;
                adjustments.coachMessage = 'Previous session was very easy (RPE <5). Increasing load by 10% to challenge adaptation.';
            }

            // Save RPE data for next session
            await this.saveRPE(userId, currentWorkout, rpe);

            this.logger.debug('RPE-based load adjustment', { rpe, adjustments });
            return adjustments;
        } catch (error) {
            this.logger.error('Failed to adjust load from RPE', error);
            return { intensityMultiplier: 1.0, volumeMultiplier: 1.0, coachMessage: '' };
        }
    }

    /**
     * Save RPE data for tracking
     * @param {string} userId - User ID
     * @param {Object} workout - Workout data
     * @param {number} rpe - RPE value
     */
    async saveRPE(userId, workout, rpe) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const rpeData = {
                userId,
                date,
                workout_id: workout.id,
                rpe,
                savedAt: new Date().toISOString()
            };

            // Save to progression events
            await this.storageManager.saveProgressionEvent(userId, date, {
                type: 'rpe_tracking',
                exercise: workout.type || 'full_body',
                ...rpeData
            });

            this.logger.debug('RPE saved', { userId, rpe });
        } catch (error) {
            this.logger.error('Failed to save RPE', error);
        }
    }

    /**
     * Check if current week is a deload week
     * @param {number} currentWeek - Current training week
     * @returns {boolean} Is deload week
     */
    isDeloadWeek(currentWeek) {
        return (currentWeek % this.deloadWeekFrequency) === 0;
    }

    /**
     * Get deload adjustments (20% volume reduction)
     * @returns {Object} Deload adjustments
     */
    getDeloadAdjustments() {
        return {
            intensityMultiplier: 1.0, // Maintain intensity
            volumeMultiplier: 0.80,    // Reduce volume by 20%
            deload: true,
            coachMessage: 'Deload week detected (every 4th week). Reducing volume by 20% for active recovery and supercompensation.'
        };
    }

    /**
     * Get workout adjustments for game day scheduling
     * @param {Object} schedule - Schedule data
     * @returns {Object} Workout adjustments
     */
    getGameDayAdjustments(schedule = {}) {
        const today = new Date();
        const gameDate = schedule.gameDate ? new Date(schedule.gameDate) : null;
        
        if (!gameDate) {
            return { intensityMultiplier: 1.0, volumeMultiplier: 1.0 };
        }

        const daysToGame = Math.ceil((gameDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysToGame === 1) {
            // Game -1 day: Upper body light
            return {
                intensityMultiplier: 0.5,
                volumeMultiplier: 0.5,
                bodyRegion: 'upper',
                coachMessage: 'Game tomorrow - Upper body light session only. Avoid heavy legs.'
            };
        } else if (daysToGame === 2) {
            // Game -2 days: No heavy legs (RPE > 7)
            return {
                intensityMultiplier: 0.7,
                volumeMultiplier: 0.8,
                maxRPE: 7,
                coachMessage: 'Game in 2 days - Moderate session. Keep leg work light (RPE ≤ 7).'
            };
        }

        return { intensityMultiplier: 1.0, volumeMultiplier: 1.0 };
    }

    /**
     * Get comprehensive workout adjustments
     * Combines readiness, RPE, deload, and game-day adjustments
     * @param {string} userId - User ID
     * @param {Object} readinessAdjustments - Readiness-based adjustments
     * @param {Object} schedule - Training schedule
     * @param {number} currentWeek - Current training week
     * @returns {Promise<Object>} Final adjustments
     */
    async getComprehensiveAdjustments(userId, readinessAdjustments, schedule, currentWeek) {
        try {
            const adjustments = {
                intensityMultiplier: 1.0,
                volumeMultiplier: 1.0,
                workoutType: 'standard',
                coachMessages: [],
                modifications: []
            };

            // Start with readiness adjustments
            adjustments.intensityMultiplier *= readinessAdjustments.intensityMultiplier;
            adjustments.workoutType = readinessAdjustments.workoutType;
            if (readinessAdjustments.coachMessage) {
                adjustments.coachMessages.push(readinessAdjustments.coachMessage);
            }

            // Check for deload week
            if (this.isDeloadWeek(currentWeek)) {
                const deload = this.getDeloadAdjustments();
                adjustments.volumeMultiplier *= deload.volumeMultiplier;
                adjustments.modifications.push('deload_week');
                adjustments.coachMessages.push(deload.coachMessage);
            }

            // Check for game day scheduling
            const gameDayAdjustments = this.getGameDayAdjustments(schedule);
            if (gameDayAdjustments.intensityMultiplier !== 1.0) {
                adjustments.intensityMultiplier *= gameDayAdjustments.intensityMultiplier;
                adjustments.volumeMultiplier *= gameDayAdjustments.volumeMultiplier;
                if (gameDayAdjustments.coachMessage) {
                    adjustments.coachMessages.push(gameDayAdjustments.coachMessage);
                }
                if (gameDayAdjustments.maxRPE) {
                    adjustments.maxRPE = gameDayAdjustments.maxRPE;
                }
                if (gameDayAdjustments.bodyRegion) {
                    adjustments.bodyRegion = gameDayAdjustments.bodyRegion;
                }
            }

            // Apply RPE adjustments from previous session
            const previousRPE = await this.getPreviousSessionRPE(userId);
            if (previousRPE) {
                const rpeAdjustments = await this.adjustLoadFromRPE(userId, {}, previousRPE.rpe);
                adjustments.intensityMultiplier *= rpeAdjustments.intensityMultiplier;
                adjustments.volumeMultiplier *= rpeAdjustments.volumeMultiplier;
                if (rpeAdjustments.coachMessage) {
                    adjustments.coachMessages.push(rpeAdjustments.coachMessage);
                }
            }

            // Combine messages
            adjustments.coachMessage = adjustments.coachMessages.join(' ');

            this.logger.debug('Comprehensive adjustments calculated', { adjustments });
            return adjustments;
        } catch (error) {
            this.logger.error('Failed to get comprehensive adjustments', error);
            return { intensityMultiplier: 1.0, volumeMultiplier: 1.0, workoutType: 'standard', coachMessage: '' };
        }
    }

    /**
     * Get previous session RPE
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} Previous RPE data
     */
    async getPreviousSessionRPE(userId) {
        try {
            const events = this.storageManager.getProgressionEvents();
            const userEvents = Object.values(events).filter(e => e.userId === userId);
            
            // Sort by date descending
            userEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Find most recent RPE tracking event
            for (const event of userEvents) {
                if (event.type === 'rpe_tracking') {
                    return event;
                }
            }
            
            return null;
        } catch (error) {
            this.logger.error('Failed to get previous session RPE', error);
            return null;
        }
    }

    /**
     * Get current training week
     * @param {string} programStartDate - Program start date
     * @returns {number} Current week number
     */
    getCurrentWeek(programStartDate) {
        const start = new Date(programStartDate);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.ceil(diffDays / 7);
    }
}

// Create global instance
window.ProgressionEngine = new ProgressionEngine();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressionEngine;
}