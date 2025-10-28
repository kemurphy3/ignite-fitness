/**
 * SessionOutcomeLogger - Tracks session outcomes for adaptive feedback
 * Records RPE, volume, and completion data for next session adjustments
 */
class SessionOutcomeLogger {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.eventBus = window.EventBus;
        
        this.listenForCompletion();
    }

    /**
     * Listen for SESSION_COMPLETED events
     */
    listenForCompletion() {
        this.eventBus.on(this.eventBus.TOPICS.SESSION_COMPLETED, async (data) => {
            await this.logOutcome(data);
        });
    }

    /**
     * Log session outcome
     * @param {Object} sessionData - Completed session data
     */
    async logOutcome(sessionData) {
        try {
            const userId = sessionData.userId || this.getUserId();
            const date = new Date().toISOString().split('T')[0];
            
            const outcome = {
                userId,
                date,
                sessionId: sessionData.sessionId,
                exercises: sessionData.exercises || [],
                totalVolume: sessionData.totalVolume || 0,
                duration: sessionData.duration || 0,
                averageRPE: this.calculateAverageRPE(sessionData.exercises || []),
                completionRate: this.calculateCompletionRate(sessionData.exercises || []),
                notes: sessionData.notes || '',
                modifications: sessionData.modifications || [],
                readinessBefore: sessionData.readinessBefore || null,
                readinessAfter: sessionData.readinessAfter || null
            };
            
            // Save outcome
            await this.storageManager.saveSessionLog(userId, date, outcome);
            
            // Trigger load adjustments
            if (outcome.averageRPE) {
                this.eventBus.emit('OUTCOME_LOGGED', {
                    userId,
                    outcome,
                    recommendations: this.generateRecommendations(outcome)
                });
            }
            
            this.logger.debug('Session outcome logged', outcome);
        } catch (error) {
            this.logger.error('Failed to log session outcome', error);
        }
    }

    /**
     * Calculate average RPE from exercises
     * @param {Array} exercises - Exercise data
     * @returns {number} Average RPE
     */
    calculateAverageRPE(exercises) {
        if (!exercises || exercises.length === 0) return null;
        
        const rpeValues = exercises
            .map(ex => ex.rpe)
            .filter(rpe => rpe !== null && rpe !== undefined);
        
        if (rpeValues.length === 0) return null;
        
        return rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length;
    }

    /**
     * Calculate completion rate
     * @param {Array} exercises - Exercise data
     * @returns {number} Completion rate (0-1)
     */
    calculateCompletionRate(exercises) {
        if (!exercises || exercises.length === 0) return 0;
        
        const completed = exercises.filter(ex => ex.completed).length;
        return completed / exercises.length;
    }

    /**
     * Generate recommendations based on outcome
     * @param {Object} outcome - Session outcome
     * @returns {Object} Recommendations
     */
    generateRecommendations(outcome) {
        const recommendations = {
            loadChange: 0,
            volumeChange: 0,
            message: ''
        };
        
        // RPE-based recommendations
        if (outcome.averageRPE >= 9) {
            recommendations.loadChange = -0.05; // -5%
            recommendations.message = 'Very hard session - reduce load 5% next time';
        } else if (outcome.averageRPE >= 8) {
            recommendations.loadChange = 0;
            recommendations.message = 'Hard session - maintain current load';
        } else if (outcome.averageRPE >= 7) {
            recommendations.loadChange = 0.025; // +2.5%
            recommendations.message = 'Moderate session - slight load increase';
        } else if (outcome.averageRPE >= 5) {
            recommendations.loadChange = 0.05; // +5%
            recommendations.message = 'Easy session - increase load 5%';
        } else {
            recommendations.loadChange = 0.10; // +10%
            recommendations.message = 'Very easy session - substantial load increase needed';
        }
        
        // Volume recommendations
        if (outcome.completionRate < 0.8) {
            recommendations.volumeChange = -0.20;
            recommendations.message += '. Reduce volume due to incomplete session.';
        }
        
        return recommendations;
    }

    getUserId() {
        return window.AuthManager?.getCurrentUsername() || 'anonymous';
    }
}

window.SessionOutcomeLogger = SessionOutcomeLogger;
