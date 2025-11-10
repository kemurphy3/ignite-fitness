/**
 * WorkoutTimer - Provides session and rest countdown timers
 * Handles overall session timer + per-set rest periods
 * Extends BaseComponent for automatic cleanup
 */
class WorkoutTimer extends BaseComponent {
    constructor() {
        super();

        this.storageManager = window.StorageManager;

        this.sessionTimer = null;
        this.restTimer = null;
        this.sessionStartTime = null;
        this.sessionPausedTime = null;
        this.restStartTime = null;
        this.restDuration = null;
        this.restCallback = null;
        this.currentExercise = null;

        this.isSessionActive = false;
        this.isRestActive = false;
        this.isPaused = false;

        this.sessionElapsed = 0; // in seconds
        this.restRemaining = 0; // in seconds

        // Audio settings
        this.audioEnabled = this.loadAudioSetting();
        this.audioVolume = this.loadAudioVolume();
        this.audioContext = null;

        // Rest period configurations by exercise type/category
        this.restPeriods = {
            // Compound movements (heavy, full body)
            compound: {
                squat: { min: 180, recommended: 240, max: 300 },
                deadlift: { min: 180, recommended: 240, max: 300 },
                bench_press: { min: 120, recommended: 180, max: 240 },
                overhead_press: { min: 120, recommended: 180, max: 240 },
                barbell_row: { min: 90, recommended: 120, max: 180 },
                default: { min: 90, recommended: 120, max: 180 }
            },
            // Isolation movements (single joint)
            isolation: {
                bicep_curl: { min: 45, recommended: 60, max: 90 },
                tricep_extension: { min: 45, recommended: 60, max: 90 },
                lateral_raise: { min: 45, recommended: 60, max: 90 },
                leg_curl: { min: 60, recommended: 90, max: 120 },
                leg_extension: { min: 60, recommended: 90, max: 120 },
                default: { min: 45, recommended: 60, max: 90 }
            },
            // Power/Olympic movements
            power: {
                clean: { min: 180, recommended: 240, max: 300 },
                snatch: { min: 180, recommended: 240, max: 300 },
                jerk: { min: 180, recommended: 240, max: 300 },
                default: { min: 120, recommended: 180, max: 240 }
            },
            // Accessory movements
            accessory: {
                default: { min: 30, recommended: 45, max: 60 }
            },
            // Cardio/conditioning
            cardio: {
                default: { min: 30, recommended: 60, max: 120 }
            },
            // Default for unknown exercises
            default: {
                default: { min: 60, recommended: 90, max: 120 }
            }
        };
    }

    /**
     * Start session timer
     */
    startSession() {
        if (this.isSessionActive && !this.isPaused) {
            this.logger.warn('Session already active');
            return;
        }

        if (this.isPaused) {
            // Resume paused session
            const pauseDuration = Date.now() - this.sessionPausedTime;
            this.sessionStartTime += pauseDuration;
            this.isPaused = false;
            this.logger.debug('Session resumed');
        } else {
            // Start new session
            this.sessionStartTime = Date.now();
            this.sessionElapsed = 0;
            this.isPaused = false;
            this.logger.info('Session started');
        }

        this.isSessionActive = true;
        this.updateSessionTimer();

        // Store session state
        this.saveSessionState();
    }

    /**
     * Pause session timer
     */
    pauseSession() {
        if (!this.isSessionActive) {
            return;
        }

        this.isPaused = true;
        this.sessionPausedTime = Date.now();
        this.logger.debug('Session paused');

        this.saveSessionState();
    }

    /**
     * Resume session timer
     */
    resumeSession() {
        if (!this.isPaused) {
            return;
        }

        const pauseDuration = Date.now() - this.sessionPausedTime;
        this.sessionStartTime += pauseDuration;
        this.isPaused = false;

        this.logger.debug('Session resumed');
        this.saveSessionState();
    }

    /**
     * Stop session timer
     */
    stopSession() {
        if (this.sessionTimer) {
            this.removeTimer(this.sessionTimer);
            this.sessionTimer = null;
        }

        this.isSessionActive = false;
        this.isPaused = false;

        this.logger.info('Session stopped');
        this.clearSessionState();
    }

    /**
     * Update session timer display
     */
    updateSessionTimer() {
        if (this.sessionTimer) {
            this.removeTimer(this.sessionTimer);
        }

        this.sessionTimer = this.addTimer(() => {
            if (!this.isSessionActive || this.isPaused) {
                return;
            }

            const now = Date.now();
            this.sessionElapsed = Math.floor((now - this.sessionStartTime) / 1000);

            this.updateSessionDisplay();

            // Auto-save every 10 seconds
            if (this.sessionElapsed % 10 === 0) {
                this.saveSessionState();
            }
        }, 1000);
    }

    /**
     * Update session timer display
     */
    updateSessionDisplay() {
        const sessionDisplay = document.getElementById('session-timer-display');
        if (sessionDisplay) {
            sessionDisplay.textContent = this.formatDuration(this.sessionElapsed);
        }
    }

    /**
     * Start rest countdown
     * @param {number|Object} durationOrExercise - Duration in seconds OR exercise object with name/category
     * @param {Function} callback - Callback when rest completes
     * @param {Object} options - Additional options (exercise info, RPE, etc.)
     */
    startRest(durationOrExercise, callback = null, options = {}) {
        if (this.restTimer) {
            this.removeTimer(this.restTimer);
        }

        let duration;
        let exerciseInfo = null;

        // If durationOrExercise is an object, treat it as exercise info
        if (typeof durationOrExercise === 'object' && durationOrExercise !== null) {
            exerciseInfo = durationOrExercise;
            this.currentExercise = exerciseInfo;
            duration = this.getRecommendedRestPeriod(exerciseInfo, options);
        } else {
            // Otherwise treat as duration
            duration = durationOrExercise || this.getDefaultRestPeriod(options);

            // If exercise info provided in options
            if (options.exercise) {
                exerciseInfo = options.exercise;
                this.currentExercise = exerciseInfo;
                // Override duration if exercise-based calculation is preferred
                if (options.useExerciseRest !== false) {
                    duration = this.getRecommendedRestPeriod(exerciseInfo, options);
                }
            }
        }

        this.restDuration = duration;
        this.restRemaining = duration;
        this.restStartTime = Date.now();
        this.restCallback = callback;
        this.isRestActive = true;

        this.logger.debug('Rest timer started', { duration, exercise: exerciseInfo, options });

        this.updateRestTimer();

        // Play start alert if enabled
        if (this.audioEnabled) {
            this.playStartAlert();
        }

        // Update UI with exercise-specific guidance
        this.updateRestGuidance(exerciseInfo, duration, options);

        // Store rest state
        this.saveRestState();
    }

    /**
     * Get recommended rest period based on exercise
     * @param {Object} exercise - Exercise object with name/category/type
     * @param {Object} options - Additional options (RPE, set number, etc.)
     * @returns {number} Recommended rest period in seconds
     */
    getRecommendedRestPeriod(exercise, options = {}) {
        if (!exercise) {
            return this.getDefaultRestPeriod(options);
        }

        const exerciseName = (exercise.name || exercise.exercise || '').toLowerCase();
        const category = (exercise.category || exercise.type || '').toLowerCase();
        const rpe = options.rpe || exercise.rpe || 7;
        const setNumber = options.setNumber || 1;
        const isCompound = this.isCompoundMovement(exerciseName, category);
        const isPower = this.isPowerMovement(exerciseName, category);
        const isIsolation = this.isIsolationMovement(exerciseName, category);

        // Determine exercise category
        let categoryKey = 'default';
        if (isPower) {
            categoryKey = 'power';
        } else if (isCompound) {
            categoryKey = 'compound';
        } else if (isIsolation) {
            categoryKey = 'isolation';
        } else if (category.includes('cardio') || category.includes('conditioning')) {
            categoryKey = 'cardio';
        } else if (category.includes('accessory')) {
            categoryKey = 'accessory';
        }

        // Get base rest period for category
        const categoryConfig = this.restPeriods[categoryKey] || this.restPeriods.default;

        // Try to find specific exercise match
        let restConfig = categoryConfig.default;
        for (const [key, config] of Object.entries(categoryConfig)) {
            if (exerciseName.includes(key.replace('_', ' ')) ||
                exerciseName.includes(key.replace('_', '-'))) {
                restConfig = config;
                break;
            }
        }

        // Adjust based on RPE
        let {recommended} = restConfig;
        if (rpe >= 9) {
            // High intensity - extend rest
            recommended = Math.min(restConfig.max, recommended * 1.2);
        } else if (rpe <= 5) {
            // Low intensity - reduce rest
            recommended = Math.max(restConfig.min, recommended * 0.8);
        }

        // Adjust based on set number (later sets may need more rest)
        if (setNumber >= 3) {
            recommended = Math.min(restConfig.max, recommended * 1.1);
        }

        // Round to nearest 15 seconds
        recommended = Math.round(recommended / 15) * 15;

        return Math.max(restConfig.min, Math.min(restConfig.max, recommended));
    }

    /**
     * Get default rest period
     * @param {Object} options - Options
     * @returns {number} Default rest in seconds
     */
    getDefaultRestPeriod(options = {}) {
        return options.defaultRest || 90; // 90 seconds default
    }

    /**
     * Check if exercise is a compound movement
     * @param {string} exerciseName - Exercise name
     * @param {string} category - Exercise category
     * @returns {boolean} Is compound
     */
    isCompoundMovement(exerciseName, category) {
        const compoundKeywords = ['squat', 'deadlift', 'press', 'row', 'pull', 'dip', 'chin', 'pull-up'];
        return compoundKeywords.some(keyword =>
            exerciseName.includes(keyword) || category.includes(keyword)
        );
    }

    /**
     * Check if exercise is a power movement
     * @param {string} exerciseName - Exercise name
     * @param {string} category - Exercise category
     * @returns {boolean} Is power
     */
    isPowerMovement(exerciseName, category) {
        const powerKeywords = ['clean', 'snatch', 'jerk', 'power', 'olympic'];
        return powerKeywords.some(keyword =>
            exerciseName.includes(keyword) || category.includes(keyword)
        );
    }

    /**
     * Check if exercise is an isolation movement
     * @param {string} exerciseName - Exercise name
     * @param {string} category - Exercise category
     * @returns {boolean} Is isolation
     */
    isIsolationMovement(exerciseName, category) {
        const isolationKeywords = ['curl', 'extension', 'raise', 'fly', 'shrug'];
        return isolationKeywords.some(keyword =>
            exerciseName.includes(keyword) || category.includes(keyword)
        );
    }

    /**
     * Update rest guidance UI
     * @param {Object} exercise - Exercise info
     * @param {number} duration - Rest duration
     * @param {Object} options - Options
     */
    updateRestGuidance(exercise, duration, options) {
        const guidanceEl = document.getElementById('rest-guidance');
        if (!guidanceEl) {return;}

        if (exercise) {
            const exerciseName = exercise.name || exercise.exercise || 'Exercise';
            guidanceEl.innerHTML = `
                <div class="rest-guidance-content">
                    <div class="rest-exercise">${exerciseName}</div>
                    <div class="rest-recommendation">Recommended rest: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</div>
                    ${options.rpe ? `<div class="rest-rpe">RPE: ${options.rpe}/10</div>` : ''}
                </div>
            `;
            guidanceEl.style.display = 'block';
        } else {
            guidanceEl.style.display = 'none';
        }
    }

    /**
     * Update rest countdown
     */
    updateRestTimer() {
        if (this.restTimer) {
            this.removeTimer(this.restTimer);
        }

        this.restTimer = this.addTimer(() => {
            if (!this.isRestActive) {
                this.removeTimer(this.restTimer);
                return;
            }

            const now = Date.now();
            const elapsed = Math.floor((now - this.restStartTime) / 1000);
            this.restRemaining = Math.max(0, this.restDuration - elapsed);

            this.updateRestDisplay();

            // Play audio alerts at specific intervals
            if (this.audioEnabled && this.restRemaining > 0) {
                if (this.restRemaining === 10) {
                    this.playWarningAlert();
                } else if (this.restRemaining === 5) {
                    this.playWarningAlert(2); // Play twice
                } else if (this.restRemaining === 30) {
                    this.playHalfwayAlert();
                }
            }

            if (this.restRemaining === 0) {
                this.completeRest();
            }
        }, 1000);
    }

    /**
     * Update rest countdown display
     */
    updateRestDisplay() {
        const restDisplay = document.getElementById('rest-timer-display');
        if (restDisplay) {
            restDisplay.textContent = this.formatDuration(this.restRemaining);

            // Update visual indicator
            const percentage = (this.restRemaining / this.restDuration) * 100;
            restDisplay.style.setProperty('--rest-percentage', `${percentage}%`);

            // Add warning color when time is low
            if (this.restRemaining <= 10) {
                restDisplay.classList.add('warning');
            } else {
                restDisplay.classList.remove('warning');
            }
        }
    }

    /**
     * Complete rest period
     */
    completeRest() {
        // Play completion alert
        if (this.audioEnabled) {
            this.playCompletionAlert();
        }

        // Show visual notification
        this.showCompletionNotification();

        this.stopRest();

        if (this.restCallback) {
            this.restCallback();
        }

        this.logger.debug('Rest completed');
        this.currentExercise = null;
    }

    /**
     * Show completion notification
     */
    showCompletionNotification() {
        const notification = document.createElement('div');
        notification.className = 'rest-complete-notification';
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--color-success, #10b981);
            color: white;
            padding: 24px 32px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            animation: pulse 0.5s ease-in-out;
        `;
        notification.textContent = 'Rest Complete! Ready for next set.';

        document.body.appendChild(notification);

        // Remove after 2 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 2000);
    }

    /**
     * Play start alert
     */
    playStartAlert() {
        this.playBeep(600, 0.15, 200); // Low tone, short
    }

    /**
     * Play halfway alert
     */
    playHalfwayAlert() {
        this.playBeep(800, 0.2, 200); // Medium tone
    }

    /**
     * Play warning alert (10, 5 seconds remaining)
     * @param {number} count - Number of beeps
     */
    playWarningAlert(count = 1) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                this.playBeep(1000, 0.25, 150); // Higher tone
            }, i * 200);
        }
    }

    /**
     * Play completion alert
     */
    playCompletionAlert() {
        // Play ascending tones
        this.playBeep(600, 0.2, 100);
        setTimeout(() => this.playBeep(800, 0.2, 100), 150);
        setTimeout(() => this.playBeep(1000, 0.3, 200), 300);
    }

    /**
     * Play a beep sound
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {number} delay - Delay in milliseconds
     */
    playBeep(frequency = 800, duration = 0.2, delay = 0) {
        setTimeout(() => {
            try {
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }

                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';

                const volume = this.audioVolume || 0.3;
                gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + duration);
            } catch (error) {
                this.logger.debug('Audio alert not available:', error);
            }
        }, delay);
    }

    /**
     * Enable/disable audio alerts
     * @param {boolean} enabled - Enabled state
     */
    setAudioEnabled(enabled) {
        this.audioEnabled = enabled;
        this.saveAudioSetting(enabled);
    }

    /**
     * Set audio volume
     * @param {number} volume - Volume (0.0 - 1.0)
     */
    setAudioVolume(volume) {
        this.audioVolume = Math.max(0, Math.min(1, volume));
        this.saveAudioVolume(this.audioVolume);
    }

    /**
     * Load audio setting from storage
     * @returns {boolean} Audio enabled
     */
    loadAudioSetting() {
        try {
            const stored = localStorage.getItem('workout_timer_audio_enabled');
            return stored !== null ? stored === 'true' : true; // Default: enabled
        } catch (e) {
            return true;
        }
    }

    /**
     * Save audio setting to storage
     * @param {boolean} enabled - Enabled state
     */
    saveAudioSetting(enabled) {
        try {
            localStorage.setItem('workout_timer_audio_enabled', enabled.toString());
        } catch (e) {
            this.logger.error('Failed to save audio setting', e);
        }
    }

    /**
     * Load audio volume from storage
     * @returns {number} Audio volume
     */
    loadAudioVolume() {
        try {
            const stored = localStorage.getItem('workout_timer_audio_volume');
            return stored !== null ? parseFloat(stored) : 0.3; // Default: 30%
        } catch (e) {
            return 0.3;
        }
    }

    /**
     * Save audio volume to storage
     * @param {number} volume - Volume
     */
    saveAudioVolume(volume) {
        try {
            localStorage.setItem('workout_timer_audio_volume', volume.toString());
        } catch (e) {
            this.logger.error('Failed to save audio volume', e);
        }
    }

    /**
     * Stop rest timer
     */
    stopRest() {
        if (this.restTimer) {
            this.removeTimer(this.restTimer);
            this.restTimer = null;
        }

        this.isRestActive = false;
        this.restRemaining = 0;

        this.clearRestState();
    }

    /**
     * Pause rest timer
     */
    pauseRest() {
        if (!this.isRestActive) {
            return;
        }

        this.isPaused = true;
        this.logger.debug('Rest paused');
    }

    /**
     * Resume rest timer
     */
    resumeRest() {
        if (!this.isPaused) {
            return;
        }

        this.isPaused = false;
        this.logger.debug('Rest resumed');
    }

    /**
     * Add time to session timer (adjustment)
     * @param {number} seconds - Seconds to add
     */
    addTime(seconds) {
        if (this.sessionStartTime) {
            this.sessionStartTime -= seconds * 1000;
        }

        this.logger.debug('Time adjusted', { seconds });
    }

    /**
     * Add time to rest timer
     * @param {number} seconds - Seconds to add
     */
    addRestTime(seconds) {
        this.restDuration += seconds;
        this.restRemaining += seconds;

        this.logger.debug('Rest time adjusted', { seconds });
    }

    /**
     * Format duration as MM:SS
     * @param {number} seconds - Total seconds
     * @returns {string} Formatted duration
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Get current session duration
     * @returns {number} Duration in seconds
     */
    getSessionDuration() {
        if (!this.isSessionActive) {
            return this.sessionElapsed;
        }

        if (this.isPaused) {
            const pausedDuration = Math.floor((this.sessionPausedTime - this.sessionStartTime) / 1000);
            return pausedDuration;
        }

        return this.sessionElapsed;
    }

    /**
     * Get current rest remaining
     * @returns {number} Remaining seconds
     */
    getRestRemaining() {
        return this.restRemaining;
    }

    /**
     * Save session state to localStorage
     */
    saveSessionState() {
        try {
            const state = {
                isActive: this.isSessionActive,
                isPaused: this.isPaused,
                startTime: this.sessionStartTime,
                elapsed: this.sessionElapsed
            };

            localStorage.setItem('workout_timer_session_state', JSON.stringify(state));
        } catch (e) {
            this.logger.error('Failed to save session state', e);
        }
    }

    /**
     * Load session state from localStorage
     * @returns {boolean} Success
     */
    loadSessionState() {
        try {
            const stateJson = localStorage.getItem('workout_timer_session_state');
            if (!stateJson) {
                return false;
            }

            const state = JSON.parse(stateJson);

            if (state.isActive && !state.isPaused) {
                // Calculate elapsed time
                const now = Date.now();
                const elapsed = Math.floor((now - state.startTime) / 1000);

                this.sessionElapsed = elapsed;
                this.sessionStartTime = state.startTime;
                this.isSessionActive = state.isActive;
                this.isPaused = state.isPaused;

                this.logger.debug('Session state loaded', { elapsed });

                return true;
            }

            return false;
        } catch (e) {
            this.logger.error('Failed to load session state', e);
            return false;
        }
    }

    /**
     * Clear session state
     */
    clearSessionState() {
        try {
            localStorage.removeItem('workout_timer_session_state');
        } catch (e) {
            this.logger.error('Failed to clear session state', e);
        }
    }

    /**
     * Save rest state to localStorage
     */
    saveRestState() {
        try {
            const state = {
                isActive: this.isRestActive,
                duration: this.restDuration,
                remaining: this.restRemaining,
                startTime: this.restStartTime
            };

            localStorage.setItem('workout_timer_rest_state', JSON.stringify(state));
        } catch (e) {
            this.logger.error('Failed to save rest state', e);
        }
    }

    /**
     * Load rest state from localStorage
     * @returns {boolean} Success
     */
    loadRestState() {
        try {
            const stateJson = localStorage.getItem('workout_timer_rest_state');
            if (!stateJson) {
                return false;
            }

            const state = JSON.parse(stateJson);

            if (state.isActive) {
                const now = Date.now();
                const elapsed = Math.floor((now - state.startTime) / 1000);
                this.restRemaining = Math.max(0, state.remaining - elapsed);

                if (this.restRemaining > 0) {
                    this.restDuration = state.duration;
                    this.restStartTime = state.startTime;
                    this.isRestActive = true;

                    this.updateRestTimer();

                    this.logger.debug('Rest state loaded', { remaining: this.restRemaining });

                    return true;
                }
            }

            return false;
        } catch (e) {
            this.logger.error('Failed to load rest state', e);
            return false;
        }
    }

    /**
     * Clear rest state
     */
    clearRestState() {
        try {
            localStorage.removeItem('workout_timer_rest_state');
        } catch (e) {
            this.logger.error('Failed to clear rest state', e);
        }
    }

    /**
     * Reset all timers
     */
    reset() {
        this.stopSession();
        this.stopRest();

        this.sessionStartTime = null;
        this.sessionPausedTime = null;
        this.restStartTime = null;

        this.sessionElapsed = 0;
        this.restRemaining = 0;
    }
}

window.WorkoutTimer = new WorkoutTimer();

