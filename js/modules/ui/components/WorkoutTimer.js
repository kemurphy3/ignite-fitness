/**
 * WorkoutTimer - Provides session and rest countdown timers
 * Handles overall session timer + per-set rest periods
 */
class WorkoutTimer {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        
        this.sessionTimer = null;
        this.restTimer = null;
        this.sessionStartTime = null;
        this.sessionPausedTime = null;
        this.restStartTime = null;
        this.restDuration = null;
        this.restCallback = null;
        
        this.isSessionActive = false;
        this.isRestActive = false;
        this.isPaused = false;
        
        this.sessionElapsed = 0; // in seconds
        this.restRemaining = 0; // in seconds
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
            clearInterval(this.sessionTimer);
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
            clearInterval(this.sessionTimer);
        }

        this.sessionTimer = setInterval(() => {
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
     * @param {number} duration - Duration in seconds
     * @param {Function} callback - Callback when rest completes
     */
    startRest(duration, callback = null) {
        if (this.restTimer) {
            clearInterval(this.restTimer);
        }

        this.restDuration = duration;
        this.restRemaining = duration;
        this.restStartTime = Date.now();
        this.restCallback = callback;
        this.isRestActive = true;

        this.logger.debug('Rest timer started', { duration });

        this.updateRestTimer();

        // Store rest state
        this.saveRestState();
    }

    /**
     * Update rest countdown
     */
    updateRestTimer() {
        if (this.restTimer) {
            clearInterval(this.restTimer);
        }

        this.restTimer = setInterval(() => {
            if (!this.isRestActive) {
                clearInterval(this.restTimer);
                return;
            }

            const now = Date.now();
            const elapsed = Math.floor((now - this.restStartTime) / 1000);
            this.restRemaining = Math.max(0, this.restDuration - elapsed);

            this.updateRestDisplay();

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
        this.stopRest();

        if (this.restCallback) {
            this.restCallback();
        }

        this.logger.debug('Rest completed');
    }

    /**
     * Stop rest timer
     */
    stopRest() {
        if (this.restTimer) {
            clearInterval(this.restTimer);
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

