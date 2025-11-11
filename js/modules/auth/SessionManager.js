/**
 * SessionManager - Secure session management with sliding windows
 * Implements automatic logout on inactivity with session renewal
 */

class SessionManager extends BaseComponent {
  constructor(options = {}) {
    super(options);

    this.config = {
      sessionTimeout: options.sessionTimeout || 2 * 60 * 60 * 1000, // 2 hours
      warningTime: options.warningTime || 5 * 60 * 1000, // 5 minutes before timeout
      renewalThreshold: options.renewalThreshold || 30 * 60 * 1000, // 30 minutes
      maxRenewals: options.maxRenewals || 3,
      activityTracking: options.activityTracking !== false,
      secureLogout: options.secureLogout !== false,
      ...options,
    };

    this.sessionData = {
      startTime: null,
      lastActivity: null,
      renewalCount: 0,
      isActive: false,
      warningShown: false,
      logoutTimer: null,
      warningTimer: null,
      renewalTimer: null,
    };

    this.activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    this.logger = window.SafeLogger || console;

    this.init();
  }

  /**
   * Initialize session manager
   */
  init() {
    this.loadSessionData();
    this.startSession();
    this.bindActivityEvents();
    this.bindVisibilityEvents();

    this.logger.info('SessionManager initialized', {
      session_timeout: this.config.sessionTimeout,
      warning_time: this.config.warningTime,
    });
  }

  /**
   * Load session data from storage
   */
  loadSessionData() {
    try {
      const stored = localStorage.getItem('session_data');
      if (stored) {
        const data = JSON.parse(stored);

        // Check if session is still valid
        if (data.lastActivity && Date.now() - data.lastActivity < this.config.sessionTimeout) {
          this.sessionData = { ...this.sessionData, ...data };
        } else {
          // Session expired, clear storage
          this.clearSessionData();
        }
      }
    } catch (error) {
      this.logger.error('Failed to load session data:', error);
      this.clearSessionData();
    }
  }

  /**
   * Save session data to storage
   */
  saveSessionData() {
    try {
      const dataToSave = {
        startTime: this.sessionData.startTime,
        lastActivity: this.sessionData.lastActivity,
        renewalCount: this.sessionData.renewalCount,
        isActive: this.sessionData.isActive,
      };

      localStorage.setItem('session_data', JSON.stringify(dataToSave));
    } catch (error) {
      this.logger.error('Failed to save session data:', error);
    }
  }

  /**
   * Clear session data from storage
   */
  clearSessionData() {
    try {
      localStorage.removeItem('session_data');
      localStorage.removeItem('auth_token');
      sessionStorage.clear();
    } catch (error) {
      this.logger.error('Failed to clear session data:', error);
    }
  }

  /**
   * Start a new session
   */
  startSession() {
    const now = Date.now();

    this.sessionData = {
      startTime: now,
      lastActivity: now,
      renewalCount: 0,
      isActive: true,
      warningShown: false,
      logoutTimer: null,
      warningTimer: null,
      renewalTimer: null,
    };

    this.saveSessionData();
    this.scheduleSessionTimeout();
    this.scheduleRenewalCheck();

    this.logger.info('Session started', {
      start_time: new Date(now).toISOString(),
      timeout: this.config.sessionTimeout,
    });

    // Emit session started event
    this.emit('sessionStarted', {
      startTime: now,
      timeout: this.config.sessionTimeout,
    });
  }

  /**
   * Update activity timestamp
   */
  updateActivity() {
    if (!this.sessionData.isActive) {
      return;
    }

    const now = Date.now();
    const timeSinceLastActivity = now - this.sessionData.lastActivity;

    // Only update if significant activity (avoid spam)
    if (timeSinceLastActivity > 1000) {
      // 1 second minimum
      this.sessionData.lastActivity = now;
      this.saveSessionData();

      // Reset warning if it was shown
      if (this.sessionData.warningShown) {
        this.hideSessionWarning();
        this.sessionData.warningShown = false;
      }

      // Reschedule timeout
      this.scheduleSessionTimeout();

      this.logger.debug('Activity updated', {
        last_activity: new Date(now).toISOString(),
      });
    }
  }

  /**
   * Schedule session timeout
   */
  scheduleSessionTimeout() {
    // Clear existing timers
    if (this.sessionData.logoutTimer) {
      clearTimeout(this.sessionData.logoutTimer);
    }
    if (this.sessionData.warningTimer) {
      clearTimeout(this.sessionData.warningTimer);
    }

    const now = Date.now();
    const timeUntilTimeout = this.config.sessionTimeout;
    const timeUntilWarning = timeUntilTimeout - this.config.warningTime;

    // Schedule warning
    this.sessionData.warningTimer = setTimeout(() => {
      this.showSessionWarning();
    }, timeUntilWarning);

    // Schedule logout
    this.sessionData.logoutTimer = setTimeout(() => {
      this.logout('timeout');
    }, timeUntilTimeout);

    this.logger.debug('Session timeout scheduled', {
      timeout_in: timeUntilTimeout,
      warning_in: timeUntilWarning,
    });
  }

  /**
   * Schedule renewal check
   */
  scheduleRenewalCheck() {
    if (this.sessionData.renewalTimer) {
      clearTimeout(this.sessionData.renewalTimer);
    }

    this.sessionData.renewalTimer = setTimeout(() => {
      this.checkForRenewal();
    }, this.config.renewalThreshold);
  }

  /**
   * Check if session should be renewed
   */
  async checkForRenewal() {
    if (!this.sessionData.isActive) {
      return;
    }

    const now = Date.now();
    const timeSinceLastActivity = now - this.sessionData.lastActivity;

    // Check if user is active and session is close to expiring
    if (
      timeSinceLastActivity < this.config.renewalThreshold &&
      this.sessionData.renewalCount < this.config.maxRenewals
    ) {
      try {
        await this.renewSession();
      } catch (error) {
        this.logger.error('Session renewal failed:', error);
        this.logout('renewal_failed');
      }
    }

    // Schedule next check
    this.scheduleRenewalCheck();
  }

  /**
   * Renew session
   */
  async renewSession() {
    try {
      const response = await fetch('/.netlify/functions/renew-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          renewal_count: this.sessionData.renewalCount,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Update session data
        this.sessionData.renewalCount++;
        this.sessionData.lastActivity = Date.now();
        this.saveSessionData();

        // Update auth token if provided
        if (data.new_token) {
          localStorage.setItem('auth_token', data.new_token);
        }

        this.logger.info('Session renewed', {
          renewal_count: this.sessionData.renewalCount,
          max_renewals: this.config.maxRenewals,
        });

        // Emit renewal event
        this.emit('sessionRenewed', {
          renewalCount: this.sessionData.renewalCount,
          maxRenewals: this.config.maxRenewals,
        });

        return true;
      } else {
        throw new Error('Session renewal failed');
      }
    } catch (error) {
      this.logger.error('Session renewal error:', error);
      throw error;
    }
  }

  /**
   * Show session warning
   */
  showSessionWarning() {
    if (this.sessionData.warningShown) {
      return;
    }

    this.sessionData.warningShown = true;

    const warning = document.createElement('div');
    warning.className = 'session-warning';
    warning.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-warning);
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            z-index: 10001;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;

    const remainingTime = Math.ceil(this.config.warningTime / 1000 / 60);

    warning.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 20px;">⚠️</div>
                <div>
                    <div style="font-weight: bold; margin-bottom: 4px;">Session Expiring Soon</div>
                    <div style="font-size: 14px;">Your session will expire in ${remainingTime} minutes due to inactivity.</div>
                </div>
            </div>
            <div style="margin-top: 12px; display: flex; gap: 8px;">
                <button class="btn btn-primary extend-session-btn" style="padding: 8px 16px; font-size: 14px;">
                    Extend Session
                </button>
                <button class="btn btn-secondary logout-now-btn" style="padding: 8px 16px; font-size: 14px;">
                    Logout Now
                </button>
            </div>
        `;

    // Add CSS animation
    if (!document.querySelector('#session-warning-styles')) {
      const style = document.createElement('style');
      style.id = 'session-warning-styles';
      style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
      document.head.appendChild(style);
    }

    document.body.appendChild(warning);

    // Bind events
    warning.querySelector('.extend-session-btn').addEventListener('click', () => {
      this.extendSession();
      warning.remove();
    });

    warning.querySelector('.logout-now-btn').addEventListener('click', () => {
      this.logout('user_requested');
      warning.remove();
    });

    // Auto-hide after warning time
    setTimeout(() => {
      if (warning.parentElement) {
        warning.remove();
      }
    }, this.config.warningTime);

    this.logger.info('Session warning shown', {
      remaining_time: remainingTime,
    });

    // Emit warning event
    this.emit('sessionWarning', {
      remainingTime,
    });
  }

  /**
   * Hide session warning
   */
  hideSessionWarning() {
    const warning = document.querySelector('.session-warning');
    if (warning) {
      warning.remove();
    }
  }

  /**
   * Extend session
   */
  async extendSession() {
    try {
      this.sessionData.lastActivity = Date.now();
      this.sessionData.warningShown = false;
      this.saveSessionData();

      // Reschedule timeout
      this.scheduleSessionTimeout();

      this.logger.info('Session extended', {
        extended_at: new Date().toISOString(),
      });

      // Emit extension event
      this.emit('sessionExtended', {
        extendedAt: Date.now(),
      });
    } catch (error) {
      this.logger.error('Failed to extend session:', error);
    }
  }

  /**
   * Logout user
   * @param {string} reason - Logout reason
   */
  async logout(reason = 'user_requested') {
    try {
      // Clear timers
      this.clearTimers();

      // Mark session as inactive
      this.sessionData.isActive = false;
      this.saveSessionData();

      // Call logout endpoint
      try {
        await fetch('/.netlify/functions/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.getAuthToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason,
            session_duration: Date.now() - this.sessionData.startTime,
          }),
        });
      } catch (error) {
        this.logger.warn('Logout endpoint failed:', error);
      }

      // Clear all session data
      this.clearSessionData();

      this.logger.info('User logged out', {
        reason,
        session_duration: Date.now() - this.sessionData.startTime,
      });

      // Emit logout event
      this.emit('sessionLogout', {
        reason,
        sessionDuration: Date.now() - this.sessionData.startTime,
      });

      // Redirect to login page
      if (this.config.secureLogout) {
        window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
      }
    } catch (error) {
      this.logger.error('Logout failed:', error);

      // Force redirect even if logout fails
      window.location.href = '/login?reason=logout_failed';
    }
  }

  /**
   * Clear all timers
   */
  clearTimers() {
    if (this.sessionData.logoutTimer) {
      clearTimeout(this.sessionData.logoutTimer);
      this.sessionData.logoutTimer = null;
    }

    if (this.sessionData.warningTimer) {
      clearTimeout(this.sessionData.warningTimer);
      this.sessionData.warningTimer = null;
    }

    if (this.sessionData.renewalTimer) {
      clearTimeout(this.sessionData.renewalTimer);
      this.sessionData.renewalTimer = null;
    }
  }

  /**
   * Bind activity events
   */
  bindActivityEvents() {
    if (!this.config.activityTracking) {
      return;
    }

    this.activityEvents.forEach(eventType => {
      document.addEventListener(
        eventType,
        () => {
          this.updateActivity();
        },
        { passive: true }
      );
    });
  }

  /**
   * Bind visibility events
   */
  bindVisibilityEvents() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.logger.debug('Page hidden, pausing session tracking');
      } else {
        this.logger.debug('Page visible, resuming session tracking');
        this.updateActivity();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.logger.debug('Page unloading, cleaning up session');
      this.clearTimers();
    });
  }

  /**
   * Get session status
   * @returns {Object} Session status
   */
  getSessionStatus() {
    const now = Date.now();
    const timeSinceLastActivity = now - this.sessionData.lastActivity;
    const timeUntilTimeout = this.config.sessionTimeout - timeSinceLastActivity;

    return {
      isActive: this.sessionData.isActive,
      startTime: this.sessionData.startTime,
      lastActivity: this.sessionData.lastActivity,
      renewalCount: this.sessionData.renewalCount,
      maxRenewals: this.config.maxRenewals,
      timeSinceLastActivity,
      timeUntilTimeout: Math.max(0, timeUntilTimeout),
      warningShown: this.sessionData.warningShown,
      canRenew: this.sessionData.renewalCount < this.config.maxRenewals,
    };
  }

  /**
   * Get session statistics
   * @returns {Object} Session statistics
   */
  getSessionStats() {
    const now = Date.now();
    const sessionDuration = now - this.sessionData.startTime;

    return {
      sessionDuration,
      renewalCount: this.sessionData.renewalCount,
      maxRenewals: this.config.maxRenewals,
      renewalRate: this.sessionData.renewalCount / (sessionDuration / (60 * 60 * 1000)), // renewals per hour
      isActive: this.sessionData.isActive,
      config: this.config,
    };
  }

  /**
   * Update session configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Reschedule timeout with new configuration
    if (this.sessionData.isActive) {
      this.scheduleSessionTimeout();
    }

    this.logger.info('Session configuration updated', {
      new_config: newConfig,
    });
  }

  /**
   * Get auth token
   * @returns {string} Auth token
   */
  getAuthToken() {
    return localStorage.getItem('auth_token') || '';
  }

  /**
   * Destroy session manager
   */
  destroy() {
    this.clearTimers();
    this.unbindActivityEvents();

    this.logger.info('SessionManager destroyed');
  }

  /**
   * Unbind activity events
   */
  unbindActivityEvents() {
    this.activityEvents.forEach(eventType => {
      document.removeEventListener(eventType, this.updateActivity);
    });
  }
}

// Export for use in other modules
window.SessionManager = SessionManager;
