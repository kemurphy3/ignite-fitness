/**
 * SimpleModeManager - Manages Simple Mode UI state
 * Storage key: ignite.ui.simpleMode
 * Default: true for NEW users; existing users keep prior choice
 */

class SimpleModeManager {
    constructor() {
        this.storageKey = 'ignite.ui.simpleMode';
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.simpleMode = null; // Will be loaded from storage
        this.setupAuthListener(); // Setup auth state listener
    }

    /**
     * Setup listener for auth state changes
     */
    setupAuthListener() {
        // Wait for AuthManager to be available
        if (window.AuthManager) {
            window.AuthManager.onAuthStateChange((authState) => {
                if (authState.type === 'login') {
                    // New user gets Simple Mode by default
                    if (this.isNewUser(authState.user)) {
                        this.logger.info('New user detected, enabling Simple Mode');
                        this.setEnabled(true);
                    }
                } else if (authState.type === 'logout') {
                    // Reset to default for next user
                    this.logger.info('User logged out, resetting Simple Mode');
                    this.reset();
                }
            });
        } else {
            // Retry after a delay if AuthManager not yet loaded
            setTimeout(() => this.setupAuthListener(), 500);
        }
    }

    /**
     * Check if user is new (hasn't completed onboarding)
     * @param {Object} user - User object
     * @returns {boolean} True if new user
     */
    isNewUser(user) {
        if (!user) return true;
        
        // Check if user has completed onboarding
        const hasCompletedOnboarding = localStorage.getItem('ignite.user.hasCompletedOnboarding') === 'true';
        
        // Check if user has any workout data
        const hasWorkoutData = user.data && (
            (user.data.workouts && user.data.workouts.length > 0) ||
            (user.data.soccerSessions && user.data.soccerSessions.length > 0)
        );
        
        // New user = no onboarding completion AND no workout data
        return !hasCompletedOnboarding && !hasWorkoutData;
    }

    /**
     * Initialize Simple Mode - check if user is new vs existing
     * @returns {boolean} Simple mode state
     */
    init() {
        try {
            // Check if user has existing preference
            const existingPref = localStorage.getItem(this.storageKey);
            
            if (existingPref !== null) {
                // Existing user - keep their choice
                this.simpleMode = existingPref === 'true';
                this.logger.info('Loaded existing simple mode preference', { simpleMode: this.simpleMode });
            } else {
                // NEW user - default to true
                this.simpleMode = true;
                this.save();
                this.logger.info('New user - defaulting to simple mode');
            }
            
            return this.simpleMode;
        } catch (error) {
            this.logger.error('Failed to initialize simple mode', error);
            // Safe default
            this.simpleMode = true;
            return this.simpleMode;
        }
    }

    /**
     * Get current simple mode state
     * @returns {boolean} Simple mode enabled
     */
    isEnabled() {
        if (this.simpleMode === null) {
            // Lazy init if not yet initialized
            return this.init();
        }
        return this.simpleMode;
    }

    /**
     * Set simple mode state
     * @param {boolean} enabled - Whether to enable simple mode
     */
    setEnabled(enabled) {
        this.simpleMode = enabled === true;
        this.save();
        
        // Emit event for UI updates
        if (this.eventBus) {
            this.eventBus.emit('simpleMode:changed', { enabled: this.simpleMode });
        }
        
        this.logger.info('Simple mode updated', { enabled: this.simpleMode });
    }

    /**
     * Toggle simple mode
     * @returns {boolean} New state
     */
    toggle() {
        const newState = !this.isEnabled();
        this.setEnabled(newState);
        return newState;
    }

    /**
     * Save simple mode preference to storage
     */
    save() {
        try {
            localStorage.setItem(this.storageKey, this.simpleMode.toString());
        } catch (error) {
            this.logger.error('Failed to save simple mode preference', error);
        }
    }

    /**
     * Reset to default (for new users)
     */
    reset() {
        this.simpleMode = true;
        this.save();
    }

    /**
     * Task 2: Save recovery day preference
     * @param {string} preference - 'accept' | 'override' | 'ask'
     * @returns {Promise<void>}
     */
    async saveRecoveryDayPreference(preference) {
        try {
            const authManager = window.AuthManager;
            const userId = authManager?.getCurrentUsername();
            
            if (!userId) {
                this.logger.warn('Cannot save recovery day preference: user not logged in');
                return;
            }

            const storageKey = 'ignite.ui.recoveryDayPreference';
            localStorage.setItem(storageKey, preference);
            
            // Also save via StorageManager if available
            if (this.storageManager && typeof this.storageManager.savePreferences === 'function') {
                await this.storageManager.savePreferences(userId, {
                    recoveryDayPreference: preference
                });
            }

            this.logger.info('Recovery day preference saved', { userId, preference });
        } catch (error) {
            this.logger.error('Failed to save recovery day preference', error);
            throw error;
        }
    }

    /**
     * Task 2: Get recovery day preference
     * @returns {string} 'accept' | 'override' | 'ask'
     */
    getRecoveryDayPreference() {
        try {
            const storageKey = 'ignite.ui.recoveryDayPreference';
            const preference = localStorage.getItem(storageKey);
            
            // Validate preference value
            if (preference && ['accept', 'override', 'ask'].includes(preference)) {
                return preference;
            }
            
            // Default: ask user each time
            return 'ask';
        } catch (error) {
            this.logger.error('Failed to get recovery day preference', error);
            return 'ask'; // Safe default
        }
    }
}

// Create global instance and initialize
window.SimpleModeManager = new SimpleModeManager();

// Auto-initialize if AuthManager is available (to detect new vs existing users)
if (window.AuthManager) {
    // Wait for auth to be ready, then init
    setTimeout(() => {
        window.SimpleModeManager.init();
    }, 100);
} else {
    // Initialize immediately if auth not available
    window.SimpleModeManager.init();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleModeManager;
}

