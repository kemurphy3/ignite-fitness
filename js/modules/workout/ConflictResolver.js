/**
 * ConflictResolver - Resolves training schedule conflicts
 * Handles game-day scheduling, back-to-back restrictions, and recovery needs
 */
class ConflictResolver {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.storageManager = window.StorageManager;
        
        this.restDaysBetweenHeavySessions = 2; // Minimum rest between heavy leg sessions
    }

    /**
     * Resolve schedule conflicts
     * @param {Object} scheduledWorkout - Workout to be scheduled
     * @param {Object} userSchedule - User's full schedule
     * @param {Object} context - Additional context (game dates, etc.)
     * @returns {Object} Conflict resolution result
     */
    resolveConflicts(scheduledWorkout, userSchedule, context = {}) {
        try {
            const conflicts = this.detectConflicts(scheduledWorkout, userSchedule, context);
            
            if (conflicts.length === 0) {
                return {
                    canProceed: true,
                    conflicts: [],
                    recommendations: []
                };
            }

            const resolution = this.generateResolution(scheduledWorkout, conflicts, userSchedule, context);
            
            return {
                canProceed: resolution.canProceed,
                conflicts: conflicts,
                recommendations: resolution.recommendations,
                modifiedWorkout: resolution.modifiedWorkout || scheduledWorkout
            };
        } catch (error) {
            this.logger.error('Failed to resolve conflicts', error);
            return {
                canProceed: false,
                conflicts: [{ type: 'error', message: error.message }],
                recommendations: ['Unable to resolve conflicts. Please contact support.']
            };
        }
    }

    /**
     * Detect scheduling conflicts
     * @param {Object} scheduledWorkout - Workout to be scheduled
     * @param {Object} userSchedule - User's schedule
     * @param {Object} context - Additional context
     * @returns {Array} List of conflicts
     */
    detectConflicts(scheduledWorkout, userSchedule, context) {
        const conflicts = [];
        const workoutDate = new Date(scheduledWorkout.date);
        
        // 1. Check for game-day conflicts
        if (context.upcomingGames) {
            const gameConflict = this.checkGameDayConflict(workoutDate, context.upcomingGames);
            if (gameConflict) {
                conflicts.push(gameConflict);
            }
        }

        // 2. Check for back-to-back heavy sessions
        if (scheduledWorkout.intensity === 'heavy') {
            const backToBackConflict = this.checkBackToBackConflict(workoutDate, userSchedule);
            if (backToBackConflict) {
                conflicts.push(backToBackConflict);
            }
        }

        // 3. Check for insufficient recovery
        const recoveryConflict = this.checkRecoveryConflict(workoutDate, userSchedule);
        if (recoveryConflict) {
            conflicts.push(recoveryConflict);
        }

        // 4. Check for body part overlap (e.g., heavy legs 2 days in a row)
        if (scheduledWorkout.bodyPart === 'legs') {
            const overlapConflict = this.checkBodyPartOverlap(workoutDate, userSchedule, 'legs');
            if (overlapConflict) {
                conflicts.push(overlapConflict);
            }
        }

        return conflicts;
    }

    /**
     * Check for game-day scheduling conflicts
     * @param {Date} workoutDate - Workout date
     * @param {Array} upcomingGames - Upcoming game dates
     * @returns {Object|null} Conflict object
     */
    checkGameDayConflict(workoutDate, upcomingGames) {
        for (const game of upcomingGames) {
            const gameDate = new Date(game.date);
            const daysToGame = (gameDate - workoutDate) / (1000 * 60 * 60 * 24);
            
            if (daysToGame === 1) {
                // Game -1 day: Heavy leg work conflict
                if (game.priority === 'high' && workoutDate.getHours() > 12) {
                    return {
                        type: 'game_day',
                        severity: 'high',
                        message: 'Game tomorrow - Heavy workout may affect game performance',
                        recommendation: 'Light upper body session or rest day'
                    };
                }
            } else if (daysToGame === 2) {
                // Game -2 days: Heavy leg work conflict
                if (workoutDate.getHours() > 12) {
                    return {
                        type: 'game_day',
                        severity: 'moderate',
                        message: 'Game in 2 days - Heavy legs may delay recovery for game day',
                        recommendation: 'Consider lighter session or move heavy legs to game -3 days'
                    };
                }
            }
        }

        return null;
    }

    /**
     * Check for back-to-back heavy sessions
     * @param {Date} workoutDate - Current workout date
     * @param {Object} userSchedule - User schedule
     * @returns {Object|null} Conflict object
     */
    checkBackToBackConflict(workoutDate, userSchedule) {
        const previousWorkout = this.getPreviousWorkout(workoutDate, userSchedule);
        
        if (previousWorkout && previousWorkout.intensity === 'heavy') {
            return {
                type: 'back_to_back',
                severity: 'high',
                message: 'Back-to-back heavy sessions detected - insufficient recovery',
                recommendation: 'Add rest day or reduce intensity'
            };
        }

        return null;
    }

    /**
     * Check for insufficient recovery between sessions
     * @param {Date} workoutDate - Current workout date
     * @param {Object} userSchedule - User schedule
     * @returns {Object|null} Conflict object
     */
    checkRecoveryConflict(workoutDate, userSchedule) {
        const previousWorkout = this.getPreviousWorkout(workoutDate, userSchedule);
        
        if (!previousWorkout) {
            return null;
        }

        const daysBetween = (workoutDate - new Date(previousWorkout.date)) / (1000 * 60 * 60 * 24);
        
        if (previousWorkout.bodyPart === 'legs' && daysBetween < this.restDaysBetweenHeavySessions) {
            return {
                type: 'recovery',
                severity: 'moderate',
                message: `Only ${daysBetween} days since last leg session - may need more recovery`,
                recommendation: 'Add extra rest day or switch to upper body day'
            };
        }

        return null;
    }

    /**
     * Check for body part overlap
     * @param {Date} workoutDate - Current workout date
     * @param {Object} userSchedule - User schedule
     * @param {string} bodyPart - Body part to check
     * @returns {Object|null} Conflict object
     */
    checkBodyPartOverlap(workoutDate, userSchedule, bodyPart) {
        const previousWorkout = this.getPreviousWorkout(workoutDate, userSchedule);
        
        if (previousWorkout && previousWorkout.bodyPart === bodyPart) {
            const daysBetween = (workoutDate - new Date(previousWorkout.date)) / (1000 * 60 * 60 * 24);
            
            if (daysBetween < 2) {
                return {
                    type: 'body_part_overlap',
                    severity: 'low',
                    message: `Same body part (${bodyPart}) trained ${daysBetween} days ago`,
                    recommendation: 'Allow more recovery time between same-body-part sessions'
                };
            }
        }

        return null;
    }

    /**
     * Get previous workout from schedule
     * @param {Date} workoutDate - Current workout date
     * @param {Object} userSchedule - User schedule
     * @returns {Object|null} Previous workout
     */
    getPreviousWorkout(workoutDate, userSchedule) {
        const workouts = this.getSortedWorkouts(userSchedule);
        
        for (let i = workouts.length - 1; i >= 0; i--) {
            const workoutDateObj = new Date(workouts[i].date);
            if (workoutDateObj < workoutDate) {
                return workouts[i];
            }
        }

        return null;
    }

    /**
     * Get sorted workouts
     * @param {Object} userSchedule - User schedule
     * @returns {Array} Sorted workouts
     */
    getSortedWorkouts(userSchedule) {
        return Object.values(userSchedule).sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
    }

    /**
     * Generate resolution for conflicts
     * @param {Object} scheduledWorkout - Original workout
     * @param {Array} conflicts - Detected conflicts
     * @param {Object} userSchedule - User schedule
     * @param {Object} context - Context
     * @returns {Object} Resolution result
     */
    generateResolution(scheduledWorkout, conflicts, userSchedule, context) {
        const resolution = {
            canProceed: true,
            recommendations: [],
            modifiedWorkout: null
        };

        // Prioritize conflicts by severity
        const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
        const moderateConflicts = conflicts.filter(c => c.severity === 'moderate');
        const lowConflicts = conflicts.filter(c => c.severity === 'low');

        // Handle high severity conflicts
        if (highSeverityConflicts.length > 0) {
            for (const conflict of highSeverityConflicts) {
                if (conflict.type === 'game_day') {
                    resolution.canProceed = false;
                    resolution.modifiedWorkout = this.modifyForGameDay(scheduledWorkout);
                    resolution.recommendations.push(conflict.recommendation);
                } else if (conflict.type === 'back_to_back') {
                    resolution.canProceed = false;
                    resolution.modifiedWorkout = this.modifyForRecovery(scheduledWorkout);
                    resolution.recommendations.push(conflict.recommendation);
                }
            }
        }

        // Handle moderate conflicts (warnings)
        for (const conflict of moderateConflicts) {
            resolution.recommendations.push(conflict.recommendation);
        }

        // Handle low severity conflicts (informational)
        for (const conflict of lowConflicts) {
            resolution.recommendations.push(conflict.message);
        }

        return resolution;
    }

    /**
     * Modify workout for game day
     * @param {Object} workout - Original workout
     * @returns {Object} Modified workout
     */
    modifyForGameDay(workout) {
        return {
            ...workout,
            intensity: 'light',
            bodyPart: 'upper',
            volumeMultiplier: 0.5,
            maxRPE: 6,
            modifications: ['game_day_modified']
        };
    }

    /**
     * Modify workout for recovery
     * @param {Object} workout - Original workout
     * @returns {Object} Modified workout
     */
    modifyForRecovery(workout) {
        return {
            ...workout,
            intensity: 'moderate',
            volumeMultiplier: 0.75,
            modifications: ['recovery_focused']
        };
    }
}

// Create global instance
window.ConflictResolver = new ConflictResolver();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConflictResolver;
}
