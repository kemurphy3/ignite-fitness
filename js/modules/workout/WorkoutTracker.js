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
        this.whyPanel = window.WhyPanel;
        this.workoutTimer = window.WorkoutTimer;
        this.weightMath = window.WeightMath;
        
        this.currentSession = null;
        this.currentPlan = null; // Store current plan
        this.currentExerciseIndex = 0;
        this.exerciseData = [];
        this.sessionStartTime = null;
        this.totalDuration = 0;
        this.isActive = false;
        
        this.initializeSession();
    }

    /**
     * Start workout with plan
     * @param {Object} plan - Workout plan
     */
    startWorkout(plan) {
        this.currentPlan = plan;
        
        if (!plan || !plan.blocks) {
            this.logger.warn('No plan provided');
            return;
        }

        // Store plan for overrides
        this.initializeSession({ exercises: this.extractExercises(plan) });
        
        // Start session timer
        if (this.workoutTimer) {
            this.workoutTimer.startSession();
        }
        
        // Render workout view
        this.render();
    }

    /**
     * Extract exercises from plan blocks
     * @param {Object} plan - Workout plan
     * @returns {Array} Exercise list
     */
    extractExercises(plan) {
        const exercises = [];
        
        plan.blocks.forEach(block => {
            if (block.items) {
                block.items.forEach(item => {
                    exercises.push({
                        name: item.name,
                        sets: item.sets,
                        reps: item.reps,
                        targetRPE: item.targetRPE,
                        notes: item.notes,
                        category: item.category
                    });
                });
            }
        });
        
        return exercises;
    }

    /**
     * Render workout view with WhyPanel
     */
    render() {
        if (!this.currentPlan) {
            this.logger.warn('No plan to render');
            return;
        }

        const workoutView = document.getElementById('workout-view') || document.querySelector('.workout-view');
        
        if (!workoutView) {
            this.logger.warn('Workout view container not found');
            return;
        }

        // Render why panel
        const whyPanelHtml = this.whyPanel?.render(this.currentPlan) || '';
        
        // Render timer display
        const timerHtml = this.renderTimers();
        
        // Render plan blocks
        const blocksHtml = this.renderPlanBlocks(this.currentPlan);
        
        workoutView.innerHTML = `
            <div class="workout-container">
                ${whyPanelHtml}
                ${timerHtml}
                
                <div class="workout-plan">
                    ${blocksHtml}
                </div>
            </div>
        `;

        this.logger.debug('Workout rendered', this.currentPlan);
    }

    /**
     * Render timer display
     * @returns {string} HTML for timer section
     */
    renderTimers() {
        if (!this.workoutTimer) {
            return '';
        }

        const sessionDuration = this.workoutTimer.getSessionDuration();
        const sessionTime = this.workoutTimer.formatDuration(sessionDuration);
        const restRemaining = this.workoutTimer.getRestRemaining();
        const restTime = restRemaining > 0 ? this.workoutTimer.formatDuration(restRemaining) : '0:00';

        return `
            <div class="workout-timers">
                <div class="timer-card session-timer">
                    <div class="timer-label">Session</div>
                    <div class="timer-display" id="session-timer-display">${sessionTime}</div>
                    <div class="timer-controls">
                        <button class="timer-btn" onclick="window.WorkoutTracker.workoutTimer.pauseSession()" aria-label="Pause session">⏸</button>
                        <button class="timer-btn" onclick="window.WorkoutTracker.workoutTimer.resumeSession()" aria-label="Resume session">▶</button>
                        <button class="timer-btn" onclick="window.WorkoutTracker.workoutTimer.stopSession()" aria-label="Stop session">⏹</button>
                    </div>
                </div>
                
                ${restRemaining > 0 ? `
                    <div class="timer-card rest-timer">
                        <div class="timer-label">Rest</div>
                        <div class="timer-display warning" id="rest-timer-display">${restTime}</div>
                        <div class="timer-controls">
                            <button class="timer-btn" onclick="window.WorkoutTracker.workoutTimer.addRestTime(15)" aria-label="Add 15 seconds">+15s</button>
                            <button class="timer-btn" onclick="window.WorkoutTracker.workoutTimer.stopRest()" aria-label="Skip rest">Skip</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render plan blocks with override buttons
     * @param {Object} plan - Workout plan
     * @returns {string} HTML for plan blocks
     */
    renderPlanBlocks(plan) {
        if (!plan.blocks || plan.blocks.length === 0) {
            return '<p>No workout plan available</p>';
        }

        // Get next exercise for preview
        const nextExercise = this.getNextExercise(plan);

        return `
            ${nextExercise ? this.renderNextExercisePreview(nextExercise) : ''}
            ${plan.blocks.map((block, blockIndex) => `
                <div class="workout-block" data-block="${blockIndex}">
                    <h3 class="block-title">${block.name}</h3>
                    <div class="block-duration">${block.durationMin} minutes</div>
                    
                    <div class="block-items">
                        ${block.items.map((item, itemIndex) => `
                            <div class="workout-item">
                                <div class="item-header">
                                    <div class="item-info">
                                        <strong class="item-name">${item.name}</strong>
                                        <div class="item-details">
                                            ${item.sets} sets × ${item.reps} reps @ RPE ${item.targetRPE || 7}
                                        </div>
                                        ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
                                    </div>
                                    <div class="item-actions">
                                        ${this.renderRPEQuickInput(item, itemIndex)}
                                        ${this.whyPanel?.renderOverrideButton(item.name, itemIndex) || ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        `;
    }

    /**
     * Get next exercise to preview
     * @param {Object} plan - Workout plan
     * @returns {Object|null} Next exercise info
     */
    getNextExercise(plan) {
        if (!plan.blocks || plan.blocks.length === 0) {
            return null;
        }

        // Find first incomplete exercise
        for (const block of plan.blocks) {
            if (block.items && block.items.length > 0) {
                for (const item of block.items) {
                    // Check if this exercise hasn't been completed
                    if (!item.completed) {
                        return {
                            name: item.name,
                            sets: item.sets,
                            reps: item.reps,
                            targetRPE: item.targetRPE || 7,
                            notes: item.notes
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Render next exercise preview
     * @param {Object} exercise - Exercise info
     * @returns {string} HTML for preview
     */
    renderNextExercisePreview(exercise) {
        if (!exercise) return '';

        return `
            <div class="next-exercise-preview">
                <h4>Next Up</h4>
                <div class="next-exercise-name">${exercise.name}</div>
                <div class="next-exercise-details">
                    ${exercise.sets} sets × ${exercise.reps} reps @ RPE ${exercise.targetRPE}
                    ${exercise.notes ? ` · ${exercise.notes}` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render RPE quick input buttons
     * @param {Object} exercise - Exercise item
     * @param {number} index - Exercise index
     * @returns {string} HTML for RPE input
     */
    renderRPEQuickInput(exercise, index) {
        return `
            <div class="rpe-quick-input">
                <label class="rpe-label">RPE:</label>
                <div class="rpe-buttons">
                    ${[6, 7, 8, 9, 10].map(rpe => `
                        <button 
                            class="rpe-btn ${exercise.targetRPE === rpe ? 'selected' : ''}"
                            onclick="window.WorkoutTracker.recordRPEQuick(${rpe}, ${index})"
                            aria-label="RPE ${rpe}"
                        >
                            ${rpe}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Record RPE from quick input
     * @param {number} rpe - RPE value (6-10)
     * @param {number} exerciseIndex - Exercise index
     */
    recordRPEQuick(rpe, exerciseIndex) {
        if (rpe < 6 || rpe > 10) {
            this.logger.warn('Invalid RPE value for quick input:', rpe);
            return;
        }

        // Record RPE
        this.recordRPE(rpe, { exerciseIndex });

        // Start rest timer
        if (this.workoutTimer) {
            this.workoutTimer.startRest(90); // 90 second default rest
        }

        // Update UI to show completed
        const exerciseItem = document.querySelector(`[data-index="${exerciseIndex}"]`);
        if (exerciseItem) {
            exerciseItem.classList.add('completed');
        }

        this.logger.debug('Quick RPE recorded', { rpe, exerciseIndex });
    }

    /**
     * Format target weight as plate loading instruction
     * @param {number} targetWeight - Target weight in pounds/kg
     * @param {string} unit - 'lb' or 'kg'
     * @returns {string} Loading instruction text
     */
    formatWeightInstruction(targetWeight, unit = 'lb') {
        if (!this.weightMath) {
            return `${targetWeight} ${unit}`;
        }

        const config = {
            mode: unit === 'kg' ? 'metric' : 'us',
            unit
        };

        const loadPlan = this.weightMath.gymLoadPlan(config, targetWeight);
        
        return loadPlan.text;
    }

    /**
     * Update plan after override
     * @param {Object} newPlan - Updated plan
     */
    updatePlan(newPlan) {
        this.currentPlan = newPlan;
        this.render();
    }

    /**
     * Refresh for mode
     * @param {string} mode - Current mode
     */
    refreshForMode(mode) {
        if (this.currentPlan) {
            this.render();
        }
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
