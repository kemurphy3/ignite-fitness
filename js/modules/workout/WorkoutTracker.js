/**
 * WorkoutTracker - Handles workout logging and tracking
 * Extracted from app.js for modular architecture
 */
class WorkoutTracker {
    constructor() {
        this.currentWorkout = null;
        this.workoutHistory = [];
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.storageManager = window.StorageManager;
        
        this.loadWorkoutHistory();
    }

    /**
     * Load workout history from storage
     */
    loadWorkoutHistory() {
        try {
            const stored = this.storageManager?.getFromLocalStorage('workout_history');
            if (stored) {
                this.workoutHistory = stored;
            }
        } catch (error) {
            this.logger.error('Failed to load workout history', error);
            this.workoutHistory = [];
        }
    }

    /**
     * Save workout history to storage
     */
    saveWorkoutHistory() {
        try {
            this.storageManager?.saveToLocalStorage('workout_history', this.workoutHistory);
        } catch (error) {
            this.logger.error('Failed to save workout history', error);
        }
    }

    /**
     * Start a new workout
     * @param {Object} workoutData - Workout data
     * @returns {Object} Start result
     */
    startWorkout(workoutData) {
        try {
            if (this.currentWorkout) {
                return { success: false, error: 'Workout already in progress' };
            }

            const workout = {
                id: `workout_${Date.now()}`,
                name: workoutData.name || 'Workout',
                type: workoutData.type || 'General',
                startTime: new Date().toISOString(),
                exercises: [],
                notes: workoutData.notes || '',
                userId: window.AuthManager?.getCurrentUsername() || 'anonymous',
                status: 'in_progress'
            };

            this.currentWorkout = workout;
            
            this.logger.audit('WORKOUT_STARTED', { 
                workoutId: workout.id, 
                type: workout.type 
            });
            this.eventBus?.emit('workout:started', workout);
            
            return { success: true, workout };
        } catch (error) {
            this.logger.error('Failed to start workout', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add exercise to current workout
     * @param {Object} exerciseData - Exercise data
     * @returns {Object} Add result
     */
    addExerciseToWorkout(exerciseData) {
        try {
            if (!this.currentWorkout) {
                return { success: false, error: 'No workout in progress' };
            }

            const exercise = {
                id: `exercise_${Date.now()}`,
                name: exerciseData.name,
                sets: exerciseData.sets || [],
                notes: exerciseData.notes || '',
                addedAt: new Date().toISOString()
            };

            this.currentWorkout.exercises.push(exercise);
            
            this.logger.debug('Exercise added to workout', { 
                workoutId: this.currentWorkout.id, 
                exerciseName: exercise.name 
            });
            this.eventBus?.emit('workout:exerciseAdded', { 
                workout: this.currentWorkout, 
                exercise 
            });
            
            return { success: true, exercise };
        } catch (error) {
            this.logger.error('Failed to add exercise to workout', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add set to exercise
     * @param {string} exerciseId - Exercise ID
     * @param {Object} setData - Set data
     * @returns {Object} Add result
     */
    addSetToExercise(exerciseId, setData) {
        try {
            if (!this.currentWorkout) {
                return { success: false, error: 'No workout in progress' };
            }

            const exercise = this.currentWorkout.exercises.find(ex => ex.id === exerciseId);
            if (!exercise) {
                return { success: false, error: 'Exercise not found' };
            }

            const set = {
                id: `set_${Date.now()}`,
                reps: setData.reps,
                weight: setData.weight,
                duration: setData.duration,
                rest: setData.rest,
                rpe: setData.rpe,
                notes: setData.notes || '',
                completedAt: new Date().toISOString()
            };

            exercise.sets.push(set);
            
            this.logger.debug('Set added to exercise', { 
                workoutId: this.currentWorkout.id, 
                exerciseId, 
                set 
            });
            this.eventBus?.emit('workout:setAdded', { 
                workout: this.currentWorkout, 
                exercise, 
                set 
            });
            
            return { success: true, set };
        } catch (error) {
            this.logger.error('Failed to add set to exercise', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Complete current workout
     * @param {Object} completionData - Completion data
     * @returns {Object} Complete result
     */
    completeWorkout(completionData = {}) {
        try {
            if (!this.currentWorkout) {
                return { success: false, error: 'No workout in progress' };
            }

            const endTime = new Date().toISOString();
            const duration = new Date(endTime) - new Date(this.currentWorkout.startTime);

            const completedWorkout = {
                ...this.currentWorkout,
                endTime,
                duration: Math.round(duration / 1000 / 60), // minutes
                status: 'completed',
                notes: completionData.notes || this.currentWorkout.notes,
                rating: completionData.rating,
                completedAt: endTime
            };

            // Add to history
            this.workoutHistory.unshift(completedWorkout);
            
            // Keep only last 100 workouts
            if (this.workoutHistory.length > 100) {
                this.workoutHistory = this.workoutHistory.slice(0, 100);
            }

            // Save to storage
            this.saveWorkoutHistory();
            
            // Save to IndexedDB for offline storage
            if (this.storageManager) {
                this.storageManager.saveWorkoutToIndexedDB(completedWorkout);
            }

            // Clear current workout
            this.currentWorkout = null;
            
            this.logger.audit('WORKOUT_COMPLETED', { 
                workoutId: completedWorkout.id, 
                duration: completedWorkout.duration,
                exercises: completedWorkout.exercises.length 
            });
            this.eventBus?.emit('workout:completed', completedWorkout);
            
            return { success: true, workout: completedWorkout };
        } catch (error) {
            this.logger.error('Failed to complete workout', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cancel current workout
     * @returns {Object} Cancel result
     */
    cancelWorkout() {
        try {
            if (!this.currentWorkout) {
                return { success: false, error: 'No workout in progress' };
            }

            const workoutId = this.currentWorkout.id;
            this.currentWorkout = null;
            
            this.logger.audit('WORKOUT_CANCELLED', { workoutId });
            this.eventBus?.emit('workout:cancelled', { workoutId });
            
            return { success: true };
        } catch (error) {
            this.logger.error('Failed to cancel workout', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current workout
     * @returns {Object|null} Current workout
     */
    getCurrentWorkout() {
        return this.currentWorkout;
    }

    /**
     * Get workout history
     * @param {number} limit - Limit results
     * @returns {Array} Workout history
     */
    getWorkoutHistory(limit = 50) {
        return this.workoutHistory.slice(0, limit);
    }

    /**
     * Get workout by ID
     * @param {string} id - Workout ID
     * @returns {Object|null} Workout
     */
    getWorkoutById(id) {
        return this.workoutHistory.find(workout => workout.id === id) || null;
    }

    /**
     * Get workouts by date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array} Workouts in range
     */
    getWorkoutsByDateRange(startDate, endDate) {
        return this.workoutHistory.filter(workout => {
            const workoutDate = new Date(workout.startTime);
            return workoutDate >= startDate && workoutDate <= endDate;
        });
    }

    /**
     * Get workout statistics
     * @param {number} days - Number of days to look back
     * @returns {Object} Statistics
     */
    getWorkoutStatistics(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const recentWorkouts = this.workoutHistory.filter(workout => 
            new Date(workout.startTime) >= cutoffDate
        );

        const totalWorkouts = recentWorkouts.length;
        const totalDuration = recentWorkouts.reduce((sum, workout) => sum + (workout.duration || 0), 0);
        const totalExercises = recentWorkouts.reduce((sum, workout) => sum + workout.exercises.length, 0);
        
        const workoutTypes = {};
        recentWorkouts.forEach(workout => {
            workoutTypes[workout.type] = (workoutTypes[workout.type] || 0) + 1;
        });

        return {
            totalWorkouts,
            totalDuration,
            totalExercises,
            averageDuration: totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0,
            workoutTypes,
            period: `${days} days`
        };
    }

    /**
     * Get exercise progress
     * @param {string} exerciseName - Exercise name
     * @param {number} days - Number of days to look back
     * @returns {Array} Exercise progress
     */
    getExerciseProgress(exerciseName, days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const progress = [];
        
        this.workoutHistory.forEach(workout => {
            if (new Date(workout.startTime) >= cutoffDate) {
                const exercise = workout.exercises.find(ex => ex.name === exerciseName);
                if (exercise && exercise.sets.length > 0) {
                    const maxWeight = Math.max(...exercise.sets.map(set => set.weight || 0));
                    const totalReps = exercise.sets.reduce((sum, set) => sum + (set.reps || 0), 0);
                    
                    progress.push({
                        date: workout.startTime,
                        maxWeight,
                        totalReps,
                        sets: exercise.sets.length
                    });
                }
            }
        });

        return progress.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Quick log workout
     * @param {Object} workoutData - Quick workout data
     * @returns {Object} Log result
     */
    quickLogWorkout(workoutData) {
        try {
            const workout = {
                id: `quick_${Date.now()}`,
                name: workoutData.name || 'Quick Workout',
                type: workoutData.type || 'General',
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: workoutData.duration || 30,
                exercises: workoutData.exercises || [],
                notes: workoutData.notes || '',
                userId: window.AuthManager?.getCurrentUsername() || 'anonymous',
                status: 'completed',
                isQuickLog: true,
                completedAt: new Date().toISOString()
            };

            // Add to history
            this.workoutHistory.unshift(workout);
            this.saveWorkoutHistory();
            
            // Save to IndexedDB
            if (this.storageManager) {
                this.storageManager.saveWorkoutToIndexedDB(workout);
            }
            
            this.logger.audit('QUICK_WORKOUT_LOGGED', { 
                workoutId: workout.id, 
                duration: workout.duration 
            });
            this.eventBus?.emit('workout:quickLogged', workout);
            
            return { success: true, workout };
        } catch (error) {
            this.logger.error('Failed to quick log workout', error);
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
window.WorkoutTracker = new WorkoutTracker();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkoutTracker;
}
