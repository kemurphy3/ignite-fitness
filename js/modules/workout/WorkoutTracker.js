/**
 * WorkoutTracker - Tracks workout session with timers, RPE, and flow
 * Provides in-gym experience with progress tracking and RPE collection
 */
class WorkoutTracker {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.storageManager = window.StorageManager;
        this.timerOverlay = window.TimerOverlay;
        this.progressionEngine = window.ProgressionEngine;
        
        this.currentSession = null;
        this.currentExerciseIndex = 0;
        this.exerciseData = [];
        this.sessionStartTime = null;
        this.totalDuration = 0;
        this.isActive = false;
        
        this.initializeSession();
    }

    /**
     * Initialize workout session
     * @param {Object} workout - Workout data
     */
    initializeSession(workout) {
        if (!workout) {
            this.logger.warn('No workout provided');
            return;
        }
        
        this.currentSession = {
            workoutId: workout.id || `workout_${Date.now()}`,
            workoutName: workout.name || 'Workout',
            exercises: workout.exercises || [],
            startTime: new Date().toISOString(),
            status: 'active',
            exercises: []
        };
        
        this.currentExerciseIndex = 0;
        this.exerciseData = [];
        this.sessionStartTime = Date.now();
        this.isActive = true;
        
        this.logger.debug('Workout session initialized', this.currentSession);
        
        // Start session timer
        if (this.timerOverlay) {
            this.timerOverlay.startSessionTimer();
        }
    }

    /**
     * Start next exercise
     * @returns {Object|null} Next exercise data
     */
    startNextExercise() {
        if (!this.currentSession) {
            this.logger.warn('No active session');
            return null;
        }
        
        const exercise = this.currentSession.exercises[this.currentExerciseIndex];
        if (!exercise) {
            this.logger.debug('All exercises completed');
            return null;
        }
        
        const exerciseData = {
            exerciseId: exercise.id || `exercise_${Date.now()}`,
            exerciseName: exercise.name,
            sets: exercise.sets || 1,
            reps: exercise.reps || '8-10',
            weight: exercise.weight || null,
            status: 'in_progress',
            startTime: new Date().toISOString(),
            completedSets: [],
            rpeData: []
        };
        
        this.exerciseData.push(exerciseData);
        
        this.logger.debug('Exercise started', exerciseData);
        return exerciseData;
    }

    /**
     * Complete current set
     * @param {Object} setData - Set data
     * @returns {Object} Updated exercise data
     */
    completeSet(setData = {}) {
        const currentExercise = this.getCurrentExercise();
        if (!currentExercise) {
            return null;
        }
        
        const set = {
            setNumber: (currentExercise.completedSets.length + 1),
            weight: setData.weight || currentExercise.weight,
            reps: setData.reps || currentExercise.reps,
            completedAt: new Date().toISOString(),
            restCompleted: setData.restCompleted || false
        };
        
        currentExercise.completedSets.push(set);
        
        this.logger.debug('Set completed', set);
        
        // Emit event
        this.eventBus.emit('workout:set_completed', {
            sessionId: this.currentSession.workoutId,
            exercise: currentExercise,
            set
        });
        
        return currentExercise;
    }

    /**
     * Record RPE for current exercise
     * @param {number} rpe - Rate of perceived exertion (1-10)
     * @param {Object} context - Additional context
     * @returns {Object} Updated exercise data
     */
    recordRPE(rpe, context = {}) {
        if (rpe < 1 || rpe > 10) {
            this.logger.warn('Invalid RPE value:', rpe);
            return null;
        }
        
        const currentExercise = this.getCurrentExercise();
        if (!currentExercise) {
            return null;
        }
        
        const rpeData = {
            rpe,
            exerciseId: currentExercise.exerciseId,
            exerciseName: currentExercise.exerciseName,
            recordedAt: new Date().toISOString(),
            ...context
        };
        
        currentExercise.rpeData.push(rpeData);
        
        this.logger.debug('RPE recorded', rpeData);
        
        // Emit event
        this.eventBus.emit('workout:rpe_recorded', rpeData);
        
        // Store in progression system
        if (this.progressionEngine) {
            this.progressionEngine.saveRPE(
                this.getUserId(),
                new Date().toISOString().split('T')[0],
                {
                    rpe,
                    exercise: currentExercise.exerciseName,
                    ...context
                }
            );
        }
        
        return currentExercise;
    }

    /**
     * Complete current exercise and move to next
     * @returns {Object|null} Next exercise
     */
    completeExercise() {
        const currentExercise = this.getCurrentExercise();
        if (!currentExercise) {
            return null;
        }
        
        currentExercise.status = 'completed';
        currentExercise.endTime = new Date().toISOString();
        currentExercise.duration = Date.now() - new Date(currentExercise.startTime).getTime();
        
        this.logger.debug('Exercise completed', currentExercise);
        
        // Emit event
        this.eventBus.emit('workout:exercise_completed', {
            sessionId: this.currentSession.workoutId,
            exercise: currentExercise
        });
        
        // Move to next exercise
        this.currentExerciseIndex++;
        
        return this.startNextExercise();
    }

    /**
     * Swap exercise for alternative
     * @param {Object} alternativeExercise - Alternative exercise
     * @returns {Object} Updated session
     */
    swapExercise(alternativeExercise) {
        if (!this.currentSession) {
            return null;
        }
        
        const currentIndex = this.currentExerciseIndex;
        const currentExercise = this.currentSession.exercises[currentIndex];
        
        // Replace in session
        this.currentSession.exercises[currentIndex] = {
            ...alternativeExercise,
            swapped: true,
            originalExercise: currentExercise.name,
            swappedAt: new Date().toISOString()
        };
        
        this.logger.debug('Exercise swapped', {
            from: currentExercise.name,
            to: alternativeExercise.name
        });
        
        // Emit event
        this.eventBus.emit('workout:exercise_swapped', {
            sessionId: this.currentSession.workoutId,
            from: currentExercise,
            to: alternativeExercise
        });
        
        return this.currentSession;
    }

    /**
     * Get current exercise
     * @returns {Object|null} Current exercise data
     */
    getCurrentExercise() {
        if (!this.exerciseData.length) {
            return null;
        }
        
        return this.exerciseData[this.exerciseData.length - 1];
    }

    /**
     * Get workout progress
     * @returns {Object} Progress data
     */
    getProgress() {
        if (!this.currentSession) {
            return { percentage: 0, completedExercises: 0, totalExercises: 0 };
        }
        
        const totalExercises = this.currentSession.exercises.length;
        const completedExercises = this.currentExerciseIndex;
        const percentage = (completedExercises / totalExercises) * 100;
        
        const currentExercise = this.getCurrentExercise();
        let exerciseProgress = 0;
        
        if (currentExercise) {
            const totalSets = currentExercise.sets;
            const completedSets = currentExercise.completedSets.length;
            exerciseProgress = (completedSets / totalSets) * 100;
        }
        
        return {
            percentage: Math.round(percentage),
            completedExercises,
            totalExercises,
            currentExerciseProgress: Math.round(exerciseProgress),
            currentExercise: this.currentSession.exercises[this.currentExerciseIndex],
            elapsedTime: Date.now() - this.sessionStartTime
        };
    }

    /**
     * Complete entire workout session
     * @returns {Promise<Object>} Session completion data
     */
    async completeSession() {
        if (!this.currentSession || !this.isActive) {
            return null;
        }
        
        const endTime = new Date().toISOString();
        this.totalDuration = Date.now() - this.sessionStartTime;
        
        const sessionData = {
            ...this.currentSession,
            status: 'completed',
            endTime,
            duration: this.totalDuration,
            exercises: this.exerciseData,
            totalExercises: this.exerciseData.length,
            totalVolume: this.calculateTotalVolume(),
            averageRPE: this.calculateAverageRPE()
        };
        
        // Save to storage
        const userId = this.getUserId();
        if (userId) {
            const date = new Date().toISOString().split('T')[0];
            await this.storageManager.saveSessionLog(userId, date, sessionData);
        }
        
        // Emit SESSION_COMPLETED event
        this.eventBus.emit(this.eventBus.TOPICS.SESSION_COMPLETED, sessionData);
        
        // Stop timers
        if (this.timerOverlay) {
            this.timerOverlay.stopSessionTimer();
        }
        
        this.isActive = false;
        
        this.logger.audit('SESSION_COMPLETED', sessionData);
        
        return sessionData;
    }

    /**
     * Calculate total volume
     * @returns {number} Total volume
     */
    calculateTotalVolume() {
        return this.exerciseData.reduce((total, exercise) => {
            const exerciseVolume = exercise.completedSets.reduce((sum, set) => {
                return sum + (set.weight * set.reps);
            }, 0);
            return total + exerciseVolume;
        }, 0);
    }

    /**
     * Calculate average RPE
     * @returns {number} Average RPE
     */
    calculateAverageRPE() {
        const allRPE = this.exerciseData.flatMap(ex => ex.rpeData.map(r => r.rpe));
        if (allRPE.length === 0) return 0;
        
        const avg = allRPE.reduce((sum, rpe) => sum + rpe, 0) / allRPE.length;
        return Math.round(avg * 10) / 10;
    }

    /**
     * Pause session
     */
    pauseSession() {
        if (this.isActive && this.timerOverlay) {
            this.timerOverlay.pauseSessionTimer();
            this.isActive = false;
            
            this.logger.debug('Session paused');
        }
    }

    /**
     * Resume session
     */
    resumeSession() {
        if (!this.isActive) {
            this.isActive = true;
            if (this.timerOverlay) {
                this.timerOverlay.resumeSessionTimer();
            }
            
            this.logger.debug('Session resumed');
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
     * Get session summary
     * @returns {Object} Session summary
     */
    getSessionSummary() {
        if (!this.currentSession) {
            return null;
        }
        
        const progress = this.getProgress();
        
        return {
            sessionId: this.currentSession.workoutId,
            workoutName: this.currentSession.workoutName,
            status: this.currentSession.status,
            progress: progress.percentage + '%',
            completedExercises: progress.completedExercises + '/' + progress.totalExercises,
            elapsedTime: this.formatDuration(Date.now() - this.sessionStartTime),
            currentExercise: progress.currentExercise?.name || 'None',
            isActive: this.isActive
        };
    }

    /**
     * Format duration
     * @param {number} ms - Milliseconds
     * @returns {string} Formatted duration
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Create global instance
window.WorkoutTracker = new WorkoutTracker();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkoutTracker;
}