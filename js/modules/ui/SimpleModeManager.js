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

