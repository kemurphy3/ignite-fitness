/**
 * FeatureFlags - Feature flag management and future paywall scaffolding
 * Allows gating advanced features without breaking core flow
 */
class FeatureFlags {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        
        this.flags = {
            advanced_nutrition: true,
            coach_chat_history: true,
            periodization_editor: true,
            detailed_benchmarks: true
        };
        
        this.loadFlags();
    }

    /**
     * Load feature flags from storage
     */
    async loadFlags() {
        try {
            // Check if dependencies are available
            if (!this.storageManager) {
                this.logger.warn('StorageManager not available, using default flags');
                return;
            }
            
            const userId = this.getUserId();
            if (!userId) {
                this.logger.debug('No user ID available, using default flags');
                return;
            }
            
            const savedFlags = await this.storageManager.getData(userId, 'feature_flags');
            
            if (savedFlags) {
                this.flags = { ...this.flags, ...savedFlags };
            }
            
            this.logger.debug('Feature flags loaded', this.flags);
        } catch (error) {
            // Non-critical error - use default flags (expected in local dev)
            // Use debug level since this is expected when storage isn't available
            this.logger.debug('Feature flags not available, using defaults', error.message);
        }
    }

    /**
     * Save feature flags to storage
     */
    async saveFlags() {
        try {
            const userId = this.getUserId();
            await this.storageManager.saveData(userId, 'feature_flags', this.flags);
            
            this.logger.debug('Feature flags saved', this.flags);
        } catch (error) {
            this.logger.error('Failed to save feature flags', error);
        }
    }

    /**
     * Check if feature is enabled
     * @param {string} flagName - Flag name
     * @returns {boolean} Is enabled
     */
    isEnabled(flagName) {
        return this.flags[flagName] === true;
    }

    /**
     * Enable feature flag
     * @param {string} flagName - Flag name
     */
    async enableFlag(flagName) {
        this.flags[flagName] = true;
        await this.saveFlags();
        
        this.logger.audit('FEATURE_FLAG_ENABLED', { flag: flagName });
        
        // Emit event
        this.emitFlagChange(flagName, true);
    }

    /**
     * Disable feature flag
     * @param {string} flagName - Flag name
     */
    async disableFlag(flagName) {
        this.flags[flagName] = false;
        await this.saveFlags();
        
        this.logger.audit('FEATURE_FLAG_DISABLED', { flag: flagName });
        
        // Emit event
        this.emitFlagChange(flagName, false);
    }

    /**
     * Toggle feature flag
     * @param {string} flagName - Flag name
     * @returns {Promise<boolean>} New state
     */
    async toggleFlag(flagName) {
        const newState = !this.flags[flagName];
        
        if (newState) {
            await this.enableFlag(flagName);
        } else {
            await this.disableFlag(flagName);
        }
        
        return newState;
    }

    /**
     * Get all flags
     * @returns {Object} All flags
     */
    getAllFlags() {
        return { ...this.flags };
    }

    /**
     * Get flag descriptions
     * @returns {Object} Flag descriptions
     */
    getFlagDescriptions() {
        return {
            advanced_nutrition: {
                name: 'Advanced Nutrition',
                description: 'Detailed macro tracking and meal timing optimization',
                icon: '🍎',
                category: 'nutrition'
            },
            coach_chat_history: {
                name: 'Coach Chat History',
                description: 'Save and review AI coaching conversations',
                icon: '💬',
                category: 'ai'
            },
            periodization_editor: {
                name: 'Periodization Editor',
                description: 'Edit and customize training blocks',
                icon: '📅',
                category: 'training'
            },
            detailed_benchmarks: {
                name: 'Detailed Benchmarks',
                description: 'Track advanced performance metrics',
                icon: '📊',
                category: 'analytics'
            }
        };
    }

    /**
     * Emit flag change event
     * @param {string} flagName - Flag name
     * @param {boolean} enabled - New state
     */
    emitFlagChange(flagName, enabled) {
        const event = new CustomEvent('featureFlagChanged', {
            detail: { flag: flagName, enabled }
        });
        
        document.dispatchEvent(event);
        
        // Also emit to EventBus if available
        if (window.EventBus) {
            window.EventBus.emit(window.EventBus.TOPICS.PROFILE_UPDATED, {
                type: 'feature_flag_changed',
                flag: flagName,
                enabled
            });
        }
    }

    /**
     * Get user ID
     * @returns {string} User ID
     */
    getUserId() {
        return window.AuthManager?.getCurrentUsername() || 'anonymous';
    }
}

window.FeatureFlags = new FeatureFlags();
