/**
 * SessionManager - Handles user sessions and persistence
 * Manages session state, timeout, and cleanup
 */
class SessionManager {
    constructor() {
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
        this.checkInterval = 5 * 60 * 1000; // 5 minutes
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.sessionCheckTimer = null;
        
        this.startSessionMonitoring();
    }

    /**
     * Start session monitoring
     */
    startSessionMonitoring() {
        // Check session validity every 5 minutes
        this.sessionCheckTimer = setInterval(() => {
            this.checkSessionValidity();
        }, this.checkInterval);

        // Listen for visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseSession();
            } else {
                this.resumeSession();
            }
        });

        // Listen for page unload
        window.addEventListener('beforeunload', () => {
            this.cleanupSession();
        });
    }

    /**
     * Check if current session is valid
     * @returns {boolean} Session validity
     */
    checkSessionValidity() {
        try {
            const loginTime = localStorage.getItem('ignitefitness_login_time');
            if (!loginTime) {
                this.logger.info('No login time found, session invalid');
                return false;
            }

            const loginTimestamp = parseInt(loginTime);
            const now = Date.now();
            const sessionAge = now - loginTimestamp;

            if (sessionAge > this.sessionTimeout) {
                this.logger.info('Session expired', { 
                    sessionAge: sessionAge,
                    timeout: this.sessionTimeout 
                });
                this.eventBus?.emit('session:expired');
                return false;
            }

            return true;
        } catch (error) {
            this.logger.error('Session validity check failed', error);
            return false;
        }
    }

    /**
     * Create new session
     * @param {string} username - Username
     * @returns {Object} Session creation result
     */
    createSession(username) {
        try {
            const sessionData = {
                username,
                loginTime: Date.now(),
                lastActivity: Date.now(),
                sessionId: this.generateSessionId()
            };

            localStorage.setItem('ignitefitness_current_user', username);
            localStorage.setItem('ignitefitness_login_time', sessionData.loginTime.toString());
            localStorage.setItem('ignitefitness_session_data', JSON.stringify(sessionData));

            this.logger.audit('SESSION_CREATED', { username, sessionId: sessionData.sessionId });
            this.eventBus?.emit('session:created', sessionData);

            return { success: true, session: sessionData };
        } catch (error) {
            this.logger.error('Failed to create session', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update session activity
     * @returns {Object} Update result
     */
    updateSessionActivity() {
        try {
            const sessionData = this.getSessionData();
            if (!sessionData) {
                return { success: false, error: 'No active session' };
            }

            sessionData.lastActivity = Date.now();
            localStorage.setItem('ignitefitness_session_data', JSON.stringify(sessionData));

            return { success: true, session: sessionData };
        } catch (error) {
            this.logger.error('Failed to update session activity', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current session data
     * @returns {Object|null} Session data
     */
    getSessionData() {
        try {
            const sessionData = localStorage.getItem('ignitefitness_session_data');
            return sessionData ? JSON.parse(sessionData) : null;
        } catch (error) {
            this.logger.error('Failed to get session data', error);
            return null;
        }
    }

    /**
     * Pause session (when tab becomes hidden)
     */
    pauseSession() {
        try {
            const sessionData = this.getSessionData();
            if (sessionData) {
                sessionData.pausedAt = Date.now();
                localStorage.setItem('ignitefitness_session_data', JSON.stringify(sessionData));
                this.logger.debug('Session paused');
            }
        } catch (error) {
            this.logger.error('Failed to pause session', error);
        }
    }

    /**
     * Resume session (when tab becomes visible)
     */
    resumeSession() {
        try {
            const sessionData = this.getSessionData();
            if (sessionData) {
                sessionData.resumedAt = Date.now();
                sessionData.lastActivity = Date.now();
                localStorage.setItem('ignitefitness_session_data', JSON.stringify(sessionData));
                this.logger.debug('Session resumed');
            }
        } catch (error) {
            this.logger.error('Failed to resume session', error);
        }
    }

    /**
     * End current session
     * @returns {Object} Session end result
     */
    endSession() {
        try {
            const sessionData = this.getSessionData();
            if (sessionData) {
                this.logger.audit('SESSION_ENDED', { 
                    username: sessionData.username,
                    sessionId: sessionData.sessionId,
                    duration: Date.now() - sessionData.loginTime
                });
                this.eventBus?.emit('session:ended', sessionData);
            }

            // Clear session data
            localStorage.removeItem('ignitefitness_current_user');
            localStorage.removeItem('ignitefitness_login_time');
            localStorage.removeItem('ignitefitness_session_data');

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to end session', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cleanup session on page unload
     */
    cleanupSession() {
        try {
            // Update last activity before cleanup
            this.updateSessionActivity();
            
            // Clear any temporary session data
            const tempKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('ignitefitness_temp_')
            );
            
            tempKeys.forEach(key => {
                localStorage.removeItem(key);
            });

            this.logger.debug('Session cleanup completed');
        } catch (error) {
            this.logger.error('Session cleanup failed', error);
        }
    }

    /**
     * Generate unique session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get session duration
     * @returns {number} Session duration in milliseconds
     */
    getSessionDuration() {
        try {
            const sessionData = this.getSessionData();
            if (!sessionData) return 0;
            
            return Date.now() - sessionData.loginTime;
        } catch (error) {
            this.logger.error('Failed to get session duration', error);
            return 0;
        }
    }

    /**
     * Get time since last activity
     * @returns {number} Time since last activity in milliseconds
     */
    getTimeSinceLastActivity() {
        try {
            const sessionData = this.getSessionData();
            if (!sessionData) return 0;
            
            return Date.now() - sessionData.lastActivity;
        } catch (error) {
            this.logger.error('Failed to get time since last activity', error);
            return 0;
        }
    }

    /**
     * Check if session is about to expire
     * @param {number} warningTime - Warning time in milliseconds (default: 5 minutes)
     * @returns {boolean} Is session about to expire
     */
    isSessionAboutToExpire(warningTime = 5 * 60 * 1000) {
        try {
            const sessionData = this.getSessionData();
            if (!sessionData) return false;
            
            const timeUntilExpiry = this.sessionTimeout - (Date.now() - sessionData.loginTime);
            return timeUntilExpiry <= warningTime;
        } catch (error) {
            this.logger.error('Failed to check session expiry', error);
            return false;
        }
    }

    /**
     * Extend session
     * @returns {Object} Extension result
     */
    extendSession() {
        try {
            const sessionData = this.getSessionData();
            if (!sessionData) {
                return { success: false, error: 'No active session' };
            }

            sessionData.loginTime = Date.now();
            sessionData.lastActivity = Date.now();
            localStorage.setItem('ignitefitness_session_data', JSON.stringify(sessionData));
            localStorage.setItem('ignitefitness_login_time', sessionData.loginTime.toString());

            this.logger.audit('SESSION_EXTENDED', { 
                username: sessionData.username,
                sessionId: sessionData.sessionId 
            });
            this.eventBus?.emit('session:extended', sessionData);

            return { success: true, session: sessionData };
        } catch (error) {
            this.logger.error('Failed to extend session', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop session monitoring
     */
    stopSessionMonitoring() {
        if (this.sessionCheckTimer) {
            clearInterval(this.sessionCheckTimer);
            this.sessionCheckTimer = null;
        }
    }
}

// Create global instance
window.SessionManager = new SessionManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionManager;
}
