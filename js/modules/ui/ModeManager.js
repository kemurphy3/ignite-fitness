/**
 * ModeManager - Manages Simple vs Advanced training modes
 * Provides seamless switching between modes with UI updates
 */
class ModeManager {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.eventBus = window.EventBus;

        this.currentMode = 'simple'; // 'simple' or 'advanced'
        this.userPreferences = {};

        this.initialize();
    }

    /**
     * Initialize mode manager
     */
    async initialize() {
        await this.loadUserPreferences();
        this.setupModeToggle();
        this.emitModeChangeEvent();
    }

    /**
     * Load user preferences for mode
     */
    async loadUserPreferences() {
        try {
            const userId = this.getUserId();
            const prefs = await this.storageManager.getPreferences(userId);

            if (prefs?.trainingMode) {
                this.currentMode = prefs.trainingMode;
                this.userPreferences = prefs;
            }
        } catch (error) {
            this.logger.error('Failed to load user preferences', error);
        }
    }

    /**
     * Setup mode toggle in Profile
     */
    setupModeToggle() {
        // Create mode toggle UI
        const toggleElement = this.createModeToggle();

        // Append to profile section
        const profileSection = document.querySelector('.profile-section');
        if (profileSection) {
            profileSection.appendChild(toggleElement);
        }

        // Listen for toggle changes
        const toggleInput = toggleElement.querySelector('#mode-toggle');
        if (toggleInput) {
            toggleInput.addEventListener('change', async (e) => {
                await this.switchMode(e.target.checked ? 'advanced' : 'simple');
            });
        }
    }

    /**
     * Create mode toggle UI element
     * @returns {HTMLElement} Toggle element
     */
    createModeToggle() {
        const container = document.createElement('div');
        container.className = 'mode-toggle-section';
        container.innerHTML = `
            <div class="mode-toggle-header">
                <h3>Training Mode</h3>
            </div>
            <div class="mode-toggle-switch">
                <label class="mode-label ${this.currentMode === 'simple' ? 'active' : ''}" for="simple-mode">
                    <span class="mode-icon">⚡</span>
                    <span class="mode-name">Simple</span>
                    <span class="mode-description">Quick start, minimal controls</span>
                </label>
                <label class="toggle-switch">
                    <input type="checkbox" id="mode-toggle" ${this.currentMode === 'advanced' ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <label class="mode-label ${this.currentMode === 'advanced' ? 'active' : ''}" for="advanced-mode">
                    <span class="mode-icon">⚙️</span>
                    <span class="mode-name">Advanced</span>
                    <span class="mode-description">Full control, all features</span>
                </label>
            </div>
            <div class="mode-explanation">
                <p class="current-mode-description" id="current-mode-description">
                    ${this.currentMode === 'simple'
                        ? 'Simple mode: Tap "Start" and follow along. Perfect for in-gym focus.'
                        : 'Advanced mode: Customize exercises, RPE, timers, and more.'}
                </p>
            </div>
        `;

        return container;
    }

    /**
     * Switch mode
     * @param {string} newMode - New mode ('simple' or 'advanced')
     */
    async switchMode(newMode) {
        if (this.currentMode === newMode) {return;}

        this.currentMode = newMode;

        // Update UI immediately
        this.updateUIForMode(newMode);

        // Persist preference
        await this.saveModePreference(newMode);

        // Emit event for other modules to react
        this.emitModeChangeEvent();

        this.logger.debug('Mode switched', { from: this.currentMode, to: newMode });
    }

    /**
     * Update UI for mode
     * @param {string} mode - Current mode
     */
    updateUIForMode(mode) {
        // Show/hide advanced controls
        const advancedControls = document.querySelectorAll('.advanced-control, .rpe-input, .detailed-settings');
        advancedControls.forEach(el => {
            el.style.display = mode === 'advanced' ? 'block' : 'none';
        });

        // Update description
        const desc = document.getElementById('current-mode-description');
        if (desc) {
            desc.textContent = mode === 'simple'
                ? 'Simple mode: Tap "Start" and follow along. Perfect for in-gym focus.'
                : 'Advanced mode: Customize exercises, RPE, timers, and more.';
        }

        // Update mode labels
        document.querySelectorAll('.mode-label').forEach(label => {
            label.classList.remove('active');
            if (label.textContent.toLowerCase().includes(mode)) {
                label.classList.add('active');
            }
        });

        // Trigger UI refresh if workout tracker exists
        if (window.WorkoutTracker) {
            window.WorkoutTracker.refreshForMode?.(mode);
        }
    }

    /**
     * Save mode preference
     * @param {string} mode - Mode to save
     */
    async saveModePreference(mode) {
        try {
            const userId = this.getUserId();
            const prefs = await this.storageManager.getPreferences(userId);

            await this.storageManager.savePreferences(userId, {
                ...prefs,
                trainingMode: mode,
                modeUpdatedAt: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Failed to save mode preference', error);
        }
    }

    /**
     * Emit mode change event
     */
    emitModeChangeEvent() {
        this.eventBus.emit('MODE_CHANGED', {
            mode: this.currentMode,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get current mode
     * @returns {string} Current mode
     */
    getCurrentMode() {
        return this.currentMode;
    }

    /**
     * Check if advanced mode is active
     * @returns {boolean} Is advanced mode
     */
    isAdvancedMode() {
        return this.currentMode === 'advanced';
    }

    /**
     * Check if simple mode is active
     * @returns {boolean} Is simple mode
     */
    isSimpleMode() {
        return this.currentMode === 'simple';
    }

    getUserId() {
        return window.AuthManager?.getCurrentUsername() || 'anonymous';
    }
}

window.ModeManager = new ModeManager();
