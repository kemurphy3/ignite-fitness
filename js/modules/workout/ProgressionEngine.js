/**
 * ProgressionEngine - Intelligent progression tracking and weight management
 * Handles auto-progression based on RPE, sets completed, and user feedback
 */
class ProgressionEngine {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.storageManager = window.StorageManager;
        
        this.progressionRules = this.initializeProgressionRules();
        this.exerciseBounds = this.initializeExerciseBounds();
        this.repSchemes = this.initializeRepSchemes();
    }

    /**
     * Initialize progression rules
     * @returns {Object} Progression rules and logic
     */
    initializeProgressionRules() {
        return {
            weightIncrease: {
                rpeThreshold: 8,
                setsThreshold: 1.0, // All sets completed
                increasePercentage: 0.025, // 2.5%
                message: "Great work! Bumping up the weight 💪"
            },
            weightDecrease: {
                rpeThreshold: 9,
                decreasePercentage: 0.05, // 5%
                message: "That was really tough - let's dial it back"
            },
            repProgression: {
                rpeThreshold: 8,
                setsThreshold: 1.0,
                repIncrease: 1,
                message: "Excellent! Adding a rep to build strength"
            },
            maintenance: {
                message: "Keep up the great work! Maintain this load"
            }
        };
    }

    /**
     * Initialize exercise bounds (floor/ceiling weights)
     * @returns {Object} Exercise weight bounds
     */
    initializeExerciseBounds() {
        return {
            'squat': { min: 45, max: 500 },
            'deadlift': { min: 45, max: 600 },
            'bench_press': { min: 45, max: 400 },
            'overhead_press': { min: 20, max: 200 },
            'barbell_row': { min: 45, max: 300 },
            'pull_up': { min: 0, max: 100 }, // Bodyweight + added weight
            'push_up': { min: 0, max: 50 }, // Bodyweight + added weight
            'dumbbell_curl': { min: 5, max: 50 },
            'dumbbell_press': { min: 10, max: 100 },
            'lateral_raise': { min: 5, max: 30 },
            'tricep_extension': { min: 5, max: 50 },
            'leg_press': { min: 90, max: 1000 },
            'leg_curl': { min: 20, max: 200 },
            'calf_raise': { min: 0, max: 200 }
        };
    }

    /**
     * Initialize rep schemes for different exercises
     * @returns {Object} Rep schemes by exercise
     */
    initializeRepSchemes() {
        return {
            'squat': { min: 1, max: 20, progression: [5, 6, 8, 10, 12] },
            'deadlift': { min: 1, max: 10, progression: [3, 5, 6, 8] },
            'bench_press': { min: 1, max: 15, progression: [5, 6, 8, 10, 12] },
            'overhead_press': { min: 1, max: 12, progression: [5, 6, 8, 10] },
            'barbell_row': { min: 1, max: 15, progression: [5, 6, 8, 10, 12] },
            'pull_up': { min: 1, max: 20, progression: [3, 5, 6, 8, 10] },
            'push_up': { min: 1, max: 50, progression: [8, 10, 12, 15, 20] },
            'dumbbell_curl': { min: 1, max: 20, progression: [8, 10, 12, 15] },
            'dumbbell_press': { min: 1, max: 15, progression: [6, 8, 10, 12] },
            'lateral_raise': { min: 1, max: 20, progression: [10, 12, 15, 20] },
            'tricep_extension': { min: 1, max: 20, progression: [8, 10, 12, 15] },
            'leg_press': { min: 1, max: 25, progression: [10, 12, 15, 20] },
            'leg_curl': { min: 1, max: 20, progression: [10, 12, 15, 20] },
            'calf_raise': { min: 1, max: 30, progression: [15, 20, 25, 30] }
        };
    }

    /**
     * Calculate next session parameters for an exercise
     * @param {Object} exercise - Current exercise data
     * @param {number} lastRPE - Last session RPE
     * @param {number} setsCompleted - Sets completed (0-1 ratio)
     * @param {number} repsCompleted - Reps completed in last set
     * @returns {Object} Next session parameters
     */
    calculateNextSession(exercise, lastRPE, setsCompleted, repsCompleted = null) {
        try {
            const exerciseName = exercise.name?.toLowerCase().replace(/\s+/g, '_') || 'unknown';
            const bounds = this.exerciseBounds[exerciseName] || { min: 0, max: 1000 };
            const repScheme = this.repSchemes[exerciseName] || { min: 1, max: 20, progression: [8, 10, 12] };
            
            let nextSession = {
                ...exercise,
                progression: 'maintenance',
                message: this.progressionRules.maintenance.message,
                changes: []
            };

            // Check for weight increase (all sets completed at RPE 8+)
            if (setsCompleted >= this.progressionRules.weightIncrease.setsThreshold && 
                lastRPE >= this.progressionRules.weightIncrease.rpeThreshold) {
                
                const newWeight = Math.min(
                    bounds.max,
                    Math.round(exercise.weight * (1 + this.progressionRules.weightIncrease.increasePercentage) * 2.5) / 2.5 // Round to nearest 2.5
                );
                
                if (newWeight > exercise.weight) {
                    nextSession.weight = newWeight;
                    nextSession.progression = 'weight_increase';
                    nextSession.message = this.progressionRules.weightIncrease.message;
                    nextSession.changes.push(`Weight increased from ${exercise.weight} to ${newWeight} lbs`);
                }
            }

            // Check for weight decrease (RPE 9-10)
            if (lastRPE >= this.progressionRules.weightDecrease.rpeThreshold) {
                const newWeight = Math.max(
                    bounds.min,
                    Math.round(exercise.weight * (1 - this.progressionRules.weightDecrease.decreasePercentage) * 2.5) / 2.5
                );
                
                if (newWeight < exercise.weight) {
                    nextSession.weight = newWeight;
                    nextSession.progression = 'weight_decrease';
                    nextSession.message = this.progressionRules.weightDecrease.message;
                    nextSession.changes.push(`Weight decreased from ${exercise.weight} to ${newWeight} lbs`);
                }
            }

            // Check for rep progression (if weight is at ceiling and RPE is good)
            if (exercise.weight >= bounds.max * 0.95 && // Near weight ceiling
                setsCompleted >= this.progressionRules.repProgression.setsThreshold &&
                lastRPE >= this.progressionRules.repProgression.rpeThreshold &&
                repsCompleted && repsCompleted < repScheme.max) {
                
                const currentReps = exercise.reps || 8;
                const newReps = Math.min(repScheme.max, currentReps + this.progressionRules.repProgression.repIncrease);
                
                if (newReps > currentReps) {
                    nextSession.reps = newReps;
                    nextSession.progression = 'rep_increase';
                    nextSession.message = this.progressionRules.repProgression.message;
                    nextSession.changes.push(`Reps increased from ${currentReps} to ${newReps}`);
                }
            }

            // Ensure weight stays within bounds
            nextSession.weight = Math.max(bounds.min, Math.min(bounds.max, nextSession.weight));
            
            this.logger.debug('Progression calculated', {
                exercise: exerciseName,
                lastRPE,
                setsCompleted,
                progression: nextSession.progression,
                changes: nextSession.changes
            });

            return nextSession;
        } catch (error) {
            this.logger.error('Failed to calculate progression', error);
            return {
                ...exercise,
                progression: 'error',
                message: 'Unable to calculate progression',
                changes: []
            };
        }
    }

    /**
     * Process exercise feedback and adjust accordingly
     * @param {string} exerciseName - Name of the exercise
     * @param {string} feedback - User feedback
     * @param {Object} currentExercise - Current exercise data
     * @returns {Object} Adjusted exercise or alternative
     */
    processExerciseFeedback(exerciseName, feedback, currentExercise) {
        try {
            const feedbackLower = feedback.toLowerCase();
            const exerciseNameLower = exerciseName.toLowerCase();
            
            let adjustment = {
                exercise: currentExercise,
                message: '',
                alternative: null,
                changes: []
            };

            // Handle different feedback types
            if (feedbackLower.includes('hurt') || feedbackLower.includes('pain')) {
                adjustment.message = "Let's find a safer alternative for you";
                adjustment.alternative = this.findAlternativeExercise(exerciseNameLower, 'safer');
                adjustment.changes.push('Exercise flagged for discomfort');
            } else if (feedbackLower.includes('easy') || feedbackLower.includes('too light')) {
                const newWeight = Math.round(currentExercise.weight * 1.1 * 2.5) / 2.5;
                adjustment.exercise.weight = newWeight;
                adjustment.message = "Let's make it more challenging!";
                adjustment.changes.push(`Weight increased to ${newWeight} lbs`);
            } else if (feedbackLower.includes("can't") || feedbackLower.includes('too hard')) {
                adjustment.message = "Let's try a regression or alternative";
                adjustment.alternative = this.findAlternativeExercise(exerciseNameLower, 'easier');
                adjustment.changes.push('Exercise difficulty reduced');
            } else if (feedbackLower.includes("don't like") || feedbackLower.includes('hate')) {
                adjustment.message = "Let's find something you enjoy more";
                adjustment.alternative = this.findAlternativeExercise(exerciseNameLower, 'preference');
                adjustment.changes.push('Exercise replaced due to preference');
            }

            this.logger.debug('Exercise feedback processed', {
                exercise: exerciseName,
                feedback,
                adjustment: adjustment.changes
            });

            return adjustment;
        } catch (error) {
            this.logger.error('Failed to process exercise feedback', error);
            return {
                exercise: currentExercise,
                message: 'Unable to process feedback',
                alternative: null,
                changes: []
            };
        }
    }

    /**
     * Find alternative exercise based on feedback
     * @param {string} originalExercise - Original exercise name
     * @param {string} type - Type of alternative needed
     * @returns {Object|null} Alternative exercise
     */
    findAlternativeExercise(originalExercise, type) {
        const alternatives = {
            'squat': {
                safer: { name: 'Goblet Squat', weight: 0, reps: 12, sets: 3 },
                easier: { name: 'Bodyweight Squat', weight: 0, reps: 15, sets: 3 },
                preference: { name: 'Leg Press', weight: 90, reps: 12, sets: 3 }
            },
            'deadlift': {
                safer: { name: 'Romanian Deadlift', weight: 0, reps: 10, sets: 3 },
                easier: { name: 'RDL with Dumbbells', weight: 20, reps: 12, sets: 3 },
                preference: { name: 'Hip Thrust', weight: 0, reps: 15, sets: 3 }
            },
            'bench_press': {
                safer: { name: 'Dumbbell Press', weight: 20, reps: 10, sets: 3 },
                easier: { name: 'Push-ups', weight: 0, reps: 10, sets: 3 },
                preference: { name: 'Incline Press', weight: 45, reps: 8, sets: 3 }
            },
            'overhead_press': {
                safer: { name: 'Dumbbell Press', weight: 15, reps: 10, sets: 3 },
                easier: { name: 'Pike Push-ups', weight: 0, reps: 8, sets: 3 },
                preference: { name: 'Lateral Raises', weight: 10, reps: 12, sets: 3 }
            },
            'pull_up': {
                safer: { name: 'Lat Pulldown', weight: 50, reps: 10, sets: 3 },
                easier: { name: 'Assisted Pull-ups', weight: 0, reps: 8, sets: 3 },
                preference: { name: 'Cable Rows', weight: 40, reps: 12, sets: 3 }
            }
        };

        return alternatives[originalExercise]?.[type] || null;
    }

    /**
     * Adapt workout to available time
     * @param {number} availableTime - Available time in minutes
     * @param {Object} plannedWorkout - Planned workout data
     * @returns {Object} Adapted workout
     */
    adaptWorkoutToTime(availableTime, plannedWorkout) {
        try {
            const estimatedTime = plannedWorkout.estimatedTime || 60;
            const timeRatio = availableTime / estimatedTime;
            
            let adaptedWorkout = { ...plannedWorkout };
            
            if (timeRatio < 0.6) {
                // Create superset version
                adaptedWorkout = this.createSupersetVersion(plannedWorkout);
                adaptedWorkout.message = `Workout adapted for ${availableTime} minutes using supersets`;
            } else if (timeRatio < 0.8) {
                // Reduce rest times
                adaptedWorkout = this.reduceRestTimes(plannedWorkout);
                adaptedWorkout.message = `Workout adapted for ${availableTime} minutes with reduced rest`;
            } else {
                adaptedWorkout.message = `Workout fits your ${availableTime} minute window`;
            }
            
            adaptedWorkout.estimatedTime = availableTime;
            
            this.logger.debug('Workout adapted for time', {
                availableTime,
                originalTime: estimatedTime,
                timeRatio,
                adaptation: adaptedWorkout.message
            });
            
            return adaptedWorkout;
        } catch (error) {
            this.logger.error('Failed to adapt workout to time', error);
            return {
                ...plannedWorkout,
                message: 'Unable to adapt workout for time',
                estimatedTime: availableTime
            };
        }
    }

    /**
     * Create superset version of workout
     * @param {Object} workout - Original workout
     * @returns {Object} Superset workout
     */
    createSupersetVersion(workout) {
        const exercises = workout.exercises || [];
        const supersets = [];
        
        // Group exercises into supersets (2 exercises per superset)
        for (let i = 0; i < exercises.length; i += 2) {
            const superset = {
                name: `Superset ${Math.floor(i / 2) + 1}`,
                exercises: exercises.slice(i, i + 2),
                restTime: 60, // 1 minute between supersets
                sets: Math.min(3, exercises[i]?.sets || 3)
            };
            supersets.push(superset);
        }
        
        return {
            ...workout,
            type: 'superset',
            exercises: supersets,
            estimatedTime: Math.ceil(workout.estimatedTime * 0.6),
            message: 'Workout converted to supersets for time efficiency'
        };
    }

    /**
     * Reduce rest times in workout
     * @param {Object} workout - Original workout
     * @returns {Object} Workout with reduced rest
     */
    reduceRestTimes(workout) {
        const exercises = workout.exercises || [];
        const adaptedExercises = exercises.map(exercise => ({
            ...exercise,
            restTime: Math.max(30, Math.floor((exercise.restTime || 90) * 0.7)) // Reduce by 30%, minimum 30s
        }));
        
        return {
            ...workout,
            exercises: adaptedExercises,
            estimatedTime: Math.ceil(workout.estimatedTime * 0.8),
            message: 'Workout adapted with reduced rest times'
        };
    }

    /**
     * Get progression history for an exercise
     * @param {string} exerciseName - Name of the exercise
     * @param {number} days - Number of days to look back
     * @returns {Array} Progression history
     */
    getProgressionHistory(exerciseName, days = 30) {
        try {
            // This would typically fetch from database/IndexedDB
            // For now, return mock data
            const history = [];
            const today = new Date();
            
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                
                history.push({
                    date: date.toISOString().split('T')[0],
                    weight: 100 + (Math.random() * 20),
                    reps: 8 + Math.floor(Math.random() * 4),
                    rpe: 6 + Math.floor(Math.random() * 4),
                    progression: Math.random() > 0.7 ? 'increased' : 'maintained'
                });
            }
            
            return history;
        } catch (error) {
            this.logger.error('Failed to get progression history', error);
            return [];
        }
    }

    /**
     * Save exercise preference
     * @param {string} exerciseName - Name of the exercise
     * @param {string} preference - User preference (avoid, prefer, neutral)
     * @param {string} reason - Reason for preference
     * @returns {Object} Save result
     */
    saveExercisePreference(exerciseName, preference, reason = '') {
        try {
            const preferenceData = {
                exerciseName,
                preference,
                reason,
                timestamp: new Date().toISOString()
            };
            
            // Save to localStorage
            const preferences = this.storageManager?.get('exercise_preferences', []);
            const existingIndex = preferences.findIndex(p => p.exerciseName === exerciseName);
            
            if (existingIndex >= 0) {
                preferences[existingIndex] = preferenceData;
            } else {
                preferences.push(preferenceData);
            }
            
            this.storageManager?.set('exercise_preferences', preferences);
            
            this.logger.audit('EXERCISE_PREFERENCE_SAVED', {
                exerciseName,
                preference,
                reason
            });
            
            return { success: true, preference: preferenceData };
        } catch (error) {
            this.logger.error('Failed to save exercise preference', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get exercise preferences
     * @returns {Array} Exercise preferences
     */
    getExercisePreferences() {
        try {
            return this.storageManager?.get('exercise_preferences', []);
        } catch (error) {
            this.logger.error('Failed to get exercise preferences', error);
            return [];
        }
    }

    /**
     * Check if exercise should be avoided
     * @param {string} exerciseName - Name of the exercise
     * @returns {boolean} Should be avoided
     */
    shouldAvoidExercise(exerciseName) {
        try {
            const preferences = this.getExercisePreferences();
            const preference = preferences.find(p => p.exerciseName === exerciseName);
            return preference?.preference === 'avoid';
        } catch (error) {
            this.logger.error('Failed to check exercise avoidance', error);
            return false;
        }
    }
}

// Create global instance
window.ProgressionEngine = new ProgressionEngine();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressionEngine;
}