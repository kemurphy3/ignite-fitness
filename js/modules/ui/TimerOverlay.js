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
    this.setupKeyboardControls();
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
                    <div class="timer-controls" role="group" aria-label="Session timer controls">
                        <button id="pause-session-timer" 
                                class="timer-control-btn"
                                aria-label="Pause session timer"
                                aria-pressed="false"
                                onclick="window.TimerOverlay?.toggleSessionPause()">
                            <span aria-hidden="true">⏸️</span>
                            <span class="sr-only">Pause</span>
                        </button>
                        <button id="resume-session-timer" 
                                class="timer-control-btn"
                                aria-label="Resume session timer"
                                style="display: none;"
                                onclick="window.TimerOverlay?.toggleSessionPause()">
                            <span aria-hidden="true">▶️</span>
                            <span class="sr-only">Resume</span>
                        </button>
                    </div>
                </div>
                
                <!-- Rest Timer -->
                <div class="rest-timer hidden" id="rest-timer">
                    <div class="timer-label">Rest</div>
                    <div class="timer-display rest" id="rest-timer-display">0:00</div>
                    <div class="rest-context" id="rest-context">
                        <div class="rest-guidance">Rest as needed - recommended: <span id="recommended-rest">60s</span></div>
                        <div class="rest-reason" id="rest-reason">Based on exercise intensity</div>
                    </div>
                    <div class="rest-controls">
                        <button class="rest-control-btn skip" aria-label="Skip rest period" onclick="window.TimerOverlay?.skipRest()">
                            <span class="timer-icon">⏭</span>
                            <span class="control-label">Skip</span>
                        </button>
                        <button class="rest-control-btn" aria-label="Add 15 seconds" onclick="window.TimerOverlay?.adjustRestTimer(15)">
                            <span class="timer-icon">+</span>
                            <span class="control-label">+15s</span>
                        </button>
                        <button class="rest-control-btn" aria-label="Subtract 15 seconds" onclick="window.TimerOverlay?.adjustRestTimer(-15)">
                            <span class="timer-icon">−</span>
                            <span class="control-label">-15s</span>
                        </button>
                        <button class="rest-control-btn extend" aria-label="Extend rest by 30 seconds" onclick="window.TimerOverlay?.extendRest()">
                            <span class="timer-icon">⏱</span>
                            <span class="control-label">+30s</span>
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

    // Set session timer as active
    this.setActiveTimer('session');

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
   * Start rest timer
   * @param {number} duration - Rest duration in seconds (30-180)
   * @param {Function} onComplete - Completion callback
   * @param {Object} context - Rest context information
   */
  startRestTimer(duration = 60, onComplete = null, context = {}) {
    if (duration < 30) {
      duration = 30;
    }
    if (duration > 180) {
      duration = 180;
    }

    this.restEndTime = Date.now() + duration * 1000;

    // Show rest timer
    const restTimerEl = document.getElementById('rest-timer');
    if (restTimerEl) {
      restTimerEl.classList.add('active');
    }

    // Set rest timer as active
    this.setActiveTimer('rest');

    // Update rest context
    this.updateRestContext(duration, context);

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

    this.logger.debug('Rest timer started', { duration, context });
  }

  /**
   * Set active timer and update visual hierarchy
   * @param {string} activeType - 'session' or 'rest'
   */
  setActiveTimer(activeType) {
    const sessionTimer = document.querySelector('.session-timer');
    const restTimer = document.getElementById('rest-timer');

    // Remove all active/inactive classes
    if (sessionTimer) {
      sessionTimer.classList.remove('active', 'inactive');
    }
    if (restTimer) {
      restTimer.classList.remove('active', 'inactive');
    }

    // Set active timer
    if (activeType === 'session' && sessionTimer) {
      sessionTimer.classList.add('active');
      if (restTimer) {
        restTimer.classList.add('inactive');
      }
    } else if (activeType === 'rest' && restTimer) {
      restTimer.classList.add('active');
      if (sessionTimer) {
        sessionTimer.classList.add('inactive');
      }
    }
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

    // Reset to session timer being active
    this.setActiveTimer('session');

    this.restEndTime = null;
  }

  /**
   * Update timer display
   * @param {string} elementId - Element ID
   * @param {number} ms - Milliseconds
   */
  updateTimer(elementId, ms) {
    const element = document.getElementById(elementId);
    if (!element) {
      return;
    }

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
    if (!this.sessionStartTime) {
      return 0;
    }

    const elapsed = Date.now() - this.sessionStartTime - this.pauseDuration;
    return elapsed;
  }

  /**
   * Update rest context information
   * @param {number} duration - Rest duration
   * @param {Object} context - Context information
   */
  updateRestContext(duration, context = {}) {
    const recommendedRest = document.getElementById('recommended-rest');
    const restReason = document.getElementById('rest-reason');

    if (recommendedRest) {
      recommendedRest.textContent = `${duration}s`;
    }

    if (restReason) {
      const reason = context.reason || this.getDefaultRestReason(duration);
      restReason.textContent = reason;
    }
  }

  /**
   * Get default rest reason based on duration
   * @param {number} duration - Rest duration
   * @returns {string} Reason text
   */
  getDefaultRestReason(duration) {
    if (duration <= 45) {
      return 'Light exercise - quick recovery';
    } else if (duration <= 90) {
      return 'Moderate exercise - standard recovery';
    } else {
      return 'Heavy exercise - extended recovery';
    }
  }

  /**
   * Skip rest period
   */
  skipRest() {
    this.stopRestTimer();
    this.logger.debug('Rest skipped by user');
  }

  /**
   * Extend rest period by 30 seconds
   */
  extendRest() {
    if (this.restEndTime) {
      this.restEndTime += 30000; // Add 30 seconds
      this.logger.debug('Rest extended by 30 seconds');
    }
  }

  /**
   * Adjust rest timer
   * @param {number} seconds - Seconds to adjust (positive or negative)
   */
  adjustRestTimer(seconds) {
    if (this.restEndTime) {
      this.restEndTime += seconds * 1000;
      this.logger.debug('Rest timer adjusted', { seconds });
    }
  }

  /**
   * Setup keyboard controls for accessibility
   */
  setupKeyboardControls() {
    document.addEventListener('keydown', e => {
      // Only handle spacebar when timer overlay is visible
      const overlay = document.getElementById('timer-overlay');
      if (!overlay || overlay.classList.contains('hidden')) {
        return;
      }

      // Spacebar to pause/resume session timer
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        this.toggleSessionPause();
      }
    });
  }

  /**
   * Toggle session timer pause/resume
   */
  toggleSessionPause() {
    const pauseBtn = document.getElementById('pause-session-timer');
    const resumeBtn = document.getElementById('resume-session-timer');

    if (this.isPaused) {
      this.resumeSessionTimer();
      if (pauseBtn) {
        pauseBtn.style.display = 'block';
      }
      if (resumeBtn) {
        resumeBtn.style.display = 'none';
      }
      if (pauseBtn) {
        pauseBtn.setAttribute('aria-pressed', 'false');
      }
    } else {
      this.pauseSessionTimer();
      if (pauseBtn) {
        pauseBtn.style.display = 'none';
      }
      if (resumeBtn) {
        resumeBtn.style.display = 'block';
      }
      if (pauseBtn) {
        pauseBtn.setAttribute('aria-pressed', 'true');
      }
    }

    // Announce state change to screen readers
    this.announceTimerState();
  }

  /**
   * Pause session timer
   */
  pauseSessionTimer() {
    if (this.sessionTimer && !this.isPaused) {
      this.isPaused = true;
      this.pauseStartTime = Date.now();
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;

      this.logger.debug('Session timer paused');
    }
  }

  /**
   * Resume session timer
   */
  resumeSessionTimer() {
    if (this.isPaused) {
      this.isPaused = false;
      if (this.pauseStartTime) {
        this.pauseDuration += Date.now() - this.pauseStartTime;
        this.pauseStartTime = null;
      }

      // Restart the timer
      this.sessionTimer = setInterval(() => {
        const elapsed = Date.now() - this.sessionStartTime - this.pauseDuration;
        this.updateTimer('session-timer-display', elapsed);
      }, 1000);

      this.logger.debug('Session timer resumed');
    }
  }

  /**
   * Announce timer state changes to screen readers
   */
  announceTimerState() {
    const announcement = this.isPaused ? 'Session timer paused' : 'Session timer resumed';

    // Use LiveRegionManager for better announcement management
    if (window.LiveRegionManager) {
      window.LiveRegionManager.handleTimerAnnouncement({
        type: this.isPaused ? 'timer-pause' : 'timer-resume',
        message: announcement,
      });
    } else {
      // Fallback to simple announcement
      this.announceToScreenReader(announcement);
    }
  }

  /**
   * Announce timer completion
   */
  announceTimerCompletion() {
    const elapsed = this.getElapsedTime();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (window.LiveRegionManager) {
      window.LiveRegionManager.handleTimerAnnouncement({
        type: 'timer-complete',
        duration,
        message: `Session completed in ${duration}`,
      });
    } else {
      this.announceToScreenReader(`Session completed in ${duration}`);
    }
  }

  /**
   * Announce rest timer completion
   */
  announceRestCompletion() {
    if (window.LiveRegionManager) {
      window.LiveRegionManager.handleTimerAnnouncement({
        type: 'rest-complete',
        message: 'Rest period completed. Ready for next exercise',
      });
    } else {
      this.announceToScreenReader('Rest period completed. Ready for next exercise');
    }
  }

  /**
   * Announce rest timer start
   */
  announceRestStart(duration) {
    if (window.LiveRegionManager) {
      window.LiveRegionManager.handleTimerAnnouncement({
        type: 'rest-start',
        duration,
        message: `Rest period started. Recommended duration: ${duration} seconds`,
      });
    } else {
      this.announceToScreenReader(`Rest period started. Recommended duration: ${duration} seconds`);
    }
  }
}

// Create global instance
window.TimerOverlay = new TimerOverlay();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimerOverlay;
}
