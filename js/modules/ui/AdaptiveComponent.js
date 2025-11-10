/**
 * AdaptiveComponent - Base class for Simple Mode aware components
 * Components that adapt their UI based on Simple Mode setting
 */

class AdaptiveComponent {
    constructor(element, options = {}) {
        this.element = element || document.createElement('div');
        this.options = options;
        this.simpleMode = window.SimpleModeManager?.isEnabled() ?? true;
        this.logger = window.SafeLogger || console;
        this.setupSimpleModeListener();
    }

    /**
     * Setup Simple Mode change listener
     */
    setupSimpleModeListener() {
        // Listen for Simple Mode changes
        if (window.EventBus) {
            window.EventBus.on('simpleMode:changed', (data) => {
                this.simpleMode = data.enabled;
                this.render();
            });
        } else {
            // Fallback: poll SimpleModeManager
            this.checkSimpleMode();
        }
    }

    /**
     * Check Simple Mode state (fallback)
     */
    checkSimpleMode() {
        if (window.SimpleModeManager) {
            this.simpleMode = window.SimpleModeManager.isEnabled();
        }
    }

    /**
     * Render component based on Simple Mode
     */
    render() {
        this.checkSimpleMode();

        if (this.simpleMode) {
            this.renderSimple();
        } else {
            this.renderAdvanced();
        }
    }

    /**
     * Render simple mode UI (override in subclasses)
     */
    renderSimple() {
        this.logger.debug('AdaptiveComponent: renderSimple() - override in subclass');
    }

    /**
     * Render advanced mode UI (override in subclasses)
     */
    renderAdvanced() {
        this.logger.debug('AdaptiveComponent: renderAdvanced() - override in subclass');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdaptiveComponent;
}

// Make available globally
window.AdaptiveComponent = AdaptiveComponent;

