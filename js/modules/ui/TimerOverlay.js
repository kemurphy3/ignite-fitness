/**
 * TimerOverlay - Session and rest timers with visual display
 * Provides touch-friendly timers for in-gym workout flow
 */
class TimerOverlay {
    constructor() {
        this.logger = window.SafeLogger || console;
        
        this.sessionTimer = null;
        this.restTimer = null;
        this.sessionStartTime = null;
        this.restEndTime = null;
        this.isPaused = false;
        this.pauseDuration = 0;
        this.pauseStartTime = null;
        
        this.createOverlay();
    }

    /**
     * Create timer overlay UI
     */
    createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'timer-overlay';
        overlay.className = 'timer-overlay hidden';
        overlay.innerHTML = `
            <div class="timer-container">
                <!-- Session Timer -->
                <div class="session-timer">
                    <div class="timer-label">Session</div>
                    <div class="timer-display" id="session-timer-display">00:00</div>
                </div>
                
                <!-- Rest Timer -->
                <div class="rest-timer hidden" id="rest-timer">
                    <div class="timer-label">Rest</div>
                    <div class="timer-display rest" id="rest-timer-display">0:00</div>
                    <div class="rest-controls">
                        <button class="rest-control-btn" aria-label="Add 15 seconds" onclick="window.TimerOverlay?.adjustRestTimer(15)">
                            <span class="timer-icon">+</span>
                            <span class="control-label">+15s</span>
                        </button>
                        <button class="rest-control-btn" aria-label="Subtract 15 seconds" onclick="window.TimerOverlay?.adjustRestTimer(-15)">
                            <span class="timer-icon">−</span>
                            <span class="control-label">-15s</span>
                        </button>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="workout-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progress-bar"></div>
                    </div>
                    <div class="progress-text" id="progress-text">Exercise 0/0</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    /**
     * Start session timer
     */
    startSessionTimer() {
        this.sessionStartTime = Date.now();
        this.isPaused = false;
        this.showOverlay();
        
        this.updateTimer('session-timer-display', 0);
        
        this.sessionTimer = setInterval(() => {
            const elapsed = Date.now() - this.sessionStartTime - this.pauseDuration;
            this.updateTimer('session-timer-display', elapsed);
        }, 1000);
        
        this.logger.debug('Session timer started');
    }

    /**
     * Stop session timer
     */
    stopSessionTimer() {
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }
        
        this.hideOverlay();
        this.logger.debug('Session timer stopped');
    }

    /**
     * Pause session timer
     */
    pauseSessionTimer() {
        if (this.sessionTimer && !this.isPaused) {
            this.isPaused = true;
            this.pauseStartTime = Date.now();
            clearInterval(this.sessionTimer);
            this.logger.debug('Session timer paused');
        }
    }

    /**
     * Resume session timer
     */
    resumeSessionTimer() {
        if (this.isPaused) {
            const pauseDuration = Date.now() - this.pauseStartTime;
            this.pauseDuration += pauseDuration;
            this.pauseStartTime = null;
            this.isPaused = false;
            
            this.startSessionTimer();
            this.logger.debug('Session timer resumed');
        }
    }

    /**
     * Start rest timer
     * @param {number} duration - Rest duration in seconds (30-180)
     * @param {Function} onComplete - Completion callback
     */
    startRestTimer(duration = 60, onComplete = null) {
        if (duration < 30) duration = 30;
        if (duration > 180) duration = 180;
        
        this.restEndTime = Date.now() + (duration * 1000);
        
        // Show rest timer
        const restTimerEl = document.getElementById('rest-timer');
        if (restTimerEl) {
            restTimerEl.classList.add('active');
        }
        
        this.restTimer = setInterval(() => {
            const remaining = Math.max(0, this.restEndTime - Date.now());
            
            if (remaining <= 0) {
                this.stopRestTimer();
                
                // Play notification sound
                this.playNotification();
                
                if (onComplete) {
                    onComplete();
                }
            } else {
                this.updateRestTimerDisplay(remaining);
            }
        }, 100);
        
        this.logger.debug('Rest timer started', { duration });
    }

    /**
     * Stop rest timer
     */
    stopRestTimer() {
        if (this.restTimer) {
            clearInterval(this.restTimer);
            this.restTimer = null;
        }
        
        const restTimerEl = document.getElementById('rest-timer');
        if (restTimerEl) {
            restTimerEl.classList.remove('active');
        }
        
        this.restEndTime = null;
    }

    /**
     * Update rest timer display
     * @param {number} remainingMs - Remaining milliseconds
     */
    updateRestTimerDisplay(remainingMs) {
        const seconds = Math.floor(remainingMs / 1000);
        const display = document.getElementById('rest-timer-display');
        
        if (display) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            display.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
            
            // Add urgency class when < 10 seconds
            if (seconds < 10) {
                display.classList.add('urgent');
            } else {
                display.classList.remove('urgent');
            }
        }
    }

    /**
     * Update timer display
     * @param {string} elementId - Element ID
     * @param {number} ms - Milliseconds
     */
    updateTimer(elementId, ms) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        element.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Update progress bar
     * @param {number} percentage - Progress percentage
     * @param {string} text - Progress text
     */
    updateProgress(percentage, text = null) {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        
        if (text) {
            const progressText = document.getElementById('progress-text');
            if (progressText) {
                progressText.textContent = text;
            }
        }
    }

    /**
     * Show overlay
     */
    showOverlay() {
        const overlay = document.getElementById('timer-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    /**
     * Hide overlay
     */
    hideOverlay() {
        const overlay = document.getElementById('timer-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Play notification sound
     */
    playNotification() {
        // Simple beep using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            this.logger.debug('Audio notification not available:', error);
        }
    }

    /**
     * Get elapsed session time
     * @returns {number} Elapsed time in milliseconds
     */
    getElapsedTime() {
        if (!this.sessionStartTime) return 0;
        
        const elapsed = Date.now() - this.sessionStartTime - this.pauseDuration;
        return elapsed;
    }

    /**
     * Get remaining rest time
     * @returns {number} Remaining rest time in milliseconds
     */
    getRemainingRestTime() {
        if (!this.restEndTime) return 0;
        
        const remaining = Math.max(0, this.restEndTime - Date.now());
        return remaining;
    }
}

// Create global instance
window.TimerOverlay = new TimerOverlay();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimerOverlay;
}
