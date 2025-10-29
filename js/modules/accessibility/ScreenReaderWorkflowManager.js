/**
 * ScreenReaderWorkflowManager - Optimizes workout flow for screen reader users
 * Provides streamlined navigation, audio cues, and simplified interaction modes
 */
class ScreenReaderWorkflowManager {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.isScreenReaderMode = false;
        this.userPreferences = {
            audioCues: true,
            simplifiedMode: false,
            shortcutKeys: true,
            audioFeedback: true,
            readingSpeed: 'normal',
            contentDensity: 'normal'
        };
        
        this.shortcuts = new Map();
        this.audioCues = new Map();
        this.workflowStates = new Map();
        
        this.init();
    }

    /**
     * Initialize screen reader workflow manager
     */
    init() {
        this.detectScreenReader();
        this.setupShortcuts();
        this.setupAudioCues();
        this.setupEventListeners();
        this.loadUserPreferences();
        this.logger.debug('ScreenReaderWorkflowManager initialized');
    }

    /**
     * Detect if screen reader is active
     */
    detectScreenReader() {
        // Check for common screen reader indicators
        const indicators = [
            'navigator.userAgentData' in window && navigator.userAgentData.mobile,
            window.speechSynthesis && window.speechSynthesis.getVoices().length > 0,
            document.querySelector('[aria-live]'),
            window.navigator.userAgent.includes('NVDA') || 
            window.navigator.userAgent.includes('JAWS') ||
            window.navigator.userAgent.includes('VoiceOver')
        ];

        this.isScreenReaderMode = indicators.some(indicator => indicator);
        
        if (this.isScreenReaderMode) {
            document.body.classList.add('screen-reader-mode');
            this.enableScreenReaderOptimizations();
        }
    }

    /**
     * Enable screen reader optimizations
     */
    enableScreenReaderOptimizations() {
        // Add screen reader specific classes
        document.body.classList.add('sr-optimized');
        
        // Announce screen reader mode activation
        this.announce('Screen reader optimized mode activated');
        
        // Enable simplified navigation
        this.enableSimplifiedNavigation();
        
        // Setup audio cues
        this.enableAudioCues();
    }

    /**
     * Setup keyboard shortcuts for screen reader users
     */
    setupShortcuts() {
        this.shortcuts.set('workout-start', {
            key: 'w',
            ctrl: true,
            description: 'Start workout session',
            action: () => this.startWorkoutSession()
        });

        this.shortcuts.set('exercise-next', {
            key: 'n',
            ctrl: true,
            description: 'Next exercise',
            action: () => this.nextExercise()
        });

        this.shortcuts.set('exercise-previous', {
            key: 'p',
            ctrl: true,
            description: 'Previous exercise',
            action: () => this.previousExercise()
        });

        this.shortcuts.set('timer-pause', {
            key: 'space',
            ctrl: true,
            description: 'Pause/resume timer',
            action: () => this.toggleTimer()
        });

        this.shortcuts.set('set-complete', {
            key: 's',
            ctrl: true,
            description: 'Mark set complete',
            action: () => this.completeSet()
        });

        this.shortcuts.set('workout-complete', {
            key: 'c',
            ctrl: true,
            description: 'Complete workout',
            action: () => this.completeWorkout()
        });

        this.shortcuts.set('help', {
            key: 'h',
            ctrl: true,
            description: 'Show help',
            action: () => this.showHelp()
        });

        this.shortcuts.set('preferences', {
            key: 'comma',
            ctrl: true,
            description: 'Open preferences',
            action: () => this.openPreferences()
        });
    }

    /**
     * Setup audio cues for workout flow
     */
    setupAudioCues() {
        this.audioCues.set('workout-start', {
            text: 'Workout session started',
            audio: 'workout-start.mp3',
            priority: 'high'
        });

        this.audioCues.set('exercise-start', {
            text: 'Starting exercise',
            audio: 'exercise-start.mp3',
            priority: 'normal'
        });

        this.audioCues.set('set-complete', {
            text: 'Set completed',
            audio: 'set-complete.mp3',
            priority: 'normal'
        });

        this.audioCues.set('rest-start', {
            text: 'Rest period started',
            audio: 'rest-start.mp3',
            priority: 'normal'
        });

        this.audioCues.set('rest-complete', {
            text: 'Rest period completed',
            audio: 'rest-complete.mp3',
            priority: 'normal'
        });

        this.audioCues.set('workout-complete', {
            text: 'Workout completed',
            audio: 'workout-complete.mp3',
            priority: 'high'
        });

        this.audioCues.set('timer-warning', {
            text: 'Timer warning',
            audio: 'timer-warning.mp3',
            priority: 'high'
        });

        this.audioCues.set('timer-complete', {
            text: 'Timer completed',
            audio: 'timer-complete.mp3',
            priority: 'high'
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Listen for workout events
        EventBus.subscribe('workout:started', this.handleWorkoutStarted.bind(this));
        EventBus.subscribe('workout:paused', this.handleWorkoutPaused.bind(this));
        EventBus.subscribe('workout:resumed', this.handleWorkoutResumed.bind(this));
        EventBus.subscribe('workout:completed', this.handleWorkoutCompleted.bind(this));
        EventBus.subscribe('exercise:started', this.handleExerciseStarted.bind(this));
        EventBus.subscribe('exercise:completed', this.handleExerciseCompleted.bind(this));
        EventBus.subscribe('set:completed', this.handleSetCompleted.bind(this));
        EventBus.subscribe('timer:started', this.handleTimerStarted.bind(this));
        EventBus.subscribe('timer:completed', this.handleTimerCompleted.bind(this));
        EventBus.subscribe('timer:warning', this.handleTimerWarning.bind(this));

        // Listen for preference changes
        EventBus.subscribe('accessibility:preferencesChanged', this.handlePreferencesChanged.bind(this));
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyboardShortcuts(e) {
        if (!this.userPreferences.shortcutKeys) return;

        const shortcut = Array.from(this.shortcuts.values()).find(s => 
            s.key === e.key.toLowerCase() && s.ctrl === e.ctrlKey
        );

        if (shortcut) {
            e.preventDefault();
            shortcut.action();
            this.announce(`Shortcut activated: ${shortcut.description}`);
        }
    }

    /**
     * Start workout session with screen reader optimizations
     */
    startWorkoutSession() {
        // Announce workout start
        this.playAudioCue('workout-start');
        
        // Create simplified workout interface
        this.createSimplifiedWorkoutInterface();
        
        // Announce current exercise
        this.announceCurrentExercise();
        
        // Publish event
        EventBus.publish('workout:started', { screenReaderOptimized: true });
    }

    /**
     * Create simplified workout interface for screen readers
     */
    createSimplifiedWorkoutInterface() {
        const container = document.getElementById('workout-container');
        if (!container) return;

        // Add screen reader optimized classes
        container.classList.add('sr-workout-optimized');
        
        // Create simplified navigation
        const nav = document.createElement('nav');
        nav.className = 'sr-workout-nav';
        nav.setAttribute('aria-label', 'Workout navigation');
        
        nav.innerHTML = `
            <button id="sr-next-exercise" class="sr-nav-btn" aria-label="Next exercise">
                Next Exercise (Ctrl+N)
            </button>
            <button id="sr-previous-exercise" class="sr-nav-btn" aria-label="Previous exercise">
                Previous Exercise (Ctrl+P)
            </button>
            <button id="sr-complete-set" class="sr-nav-btn" aria-label="Complete set">
                Complete Set (Ctrl+S)
            </button>
            <button id="sr-pause-timer" class="sr-nav-btn" aria-label="Pause timer">
                Pause Timer (Ctrl+Space)
            </button>
        `;

        container.insertBefore(nav, container.firstChild);

        // Add event listeners
        document.getElementById('sr-next-exercise').addEventListener('click', () => this.nextExercise());
        document.getElementById('sr-previous-exercise').addEventListener('click', () => this.previousExercise());
        document.getElementById('sr-complete-set').addEventListener('click', () => this.completeSet());
        document.getElementById('sr-pause-timer').addEventListener('click', () => this.toggleTimer());
    }

    /**
     * Next exercise with screen reader optimizations
     */
    nextExercise() {
        // Play audio cue
        this.playAudioCue('exercise-start');
        
        // Announce exercise details
        this.announceCurrentExercise();
        
        // Publish event
        EventBus.publish('exercise:next', { screenReaderOptimized: true });
    }

    /**
     * Previous exercise with screen reader optimizations
     */
    previousExercise() {
        // Play audio cue
        this.playAudioCue('exercise-start');
        
        // Announce exercise details
        this.announceCurrentExercise();
        
        // Publish event
        EventBus.publish('exercise:previous', { screenReaderOptimized: true });
    }

    /**
     * Complete set with screen reader optimizations
     */
    completeSet() {
        // Play audio cue
        this.playAudioCue('set-complete');
        
        // Announce set completion
        this.announce('Set completed');
        
        // Publish event
        EventBus.publish('set:completed', { screenReaderOptimized: true });
    }

    /**
     * Toggle timer with screen reader optimizations
     */
    toggleTimer() {
        // Play audio cue
        this.playAudioCue('timer-pause');
        
        // Announce timer state
        this.announce('Timer paused');
        
        // Publish event
        EventBus.publish('timer:toggled', { screenReaderOptimized: true });
    }

    /**
     * Complete workout with screen reader optimizations
     */
    completeWorkout() {
        // Play audio cue
        this.playAudioCue('workout-complete');
        
        // Announce workout completion
        this.announce('Workout completed successfully');
        
        // Publish event
        EventBus.publish('workout:completed', { screenReaderOptimized: true });
    }

    /**
     * Show help for screen reader users
     */
    showHelp() {
        const helpContent = this.generateHelpContent();
        
        // Create help modal
        const modal = document.createElement('div');
        modal.className = 'sr-help-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'sr-help-title');
        
        modal.innerHTML = `
            <h2 id="sr-help-title">Screen Reader Workout Help</h2>
            <div class="sr-help-content">
                ${helpContent}
            </div>
            <button class="sr-help-close" aria-label="Close help">Close</button>
        `;
        
        document.body.appendChild(modal);
        
        // Focus on modal
        modal.focus();
        
        // Close on escape
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modal.remove();
            }
        });
        
        // Close on button click
        modal.querySelector('.sr-help-close').addEventListener('click', () => {
            modal.remove();
        });
    }

    /**
     * Generate help content for screen reader users
     */
    generateHelpContent() {
        let content = '<h3>Keyboard Shortcuts</h3><ul>';
        
        this.shortcuts.forEach((shortcut, key) => {
            content += `<li><strong>Ctrl+${shortcut.key.toUpperCase()}</strong>: ${shortcut.description}</li>`;
        });
        
        content += '</ul>';
        
        content += '<h3>Audio Cues</h3>';
        content += '<p>Audio cues are played for important workout events. You can disable them in preferences.</p>';
        
        content += '<h3>Simplified Mode</h3>';
        content += '<p>Simplified mode reduces visual clutter and focuses on essential information.</p>';
        
        return content;
    }

    /**
     * Open preferences for screen reader users
     */
    openPreferences() {
        const preferences = this.generatePreferencesInterface();
        
        // Create preferences modal
        const modal = document.createElement('div');
        modal.className = 'sr-preferences-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'sr-preferences-title');
        
        modal.innerHTML = `
            <h2 id="sr-preferences-title">Screen Reader Preferences</h2>
            <div class="sr-preferences-content">
                ${preferences}
            </div>
            <button class="sr-preferences-save" aria-label="Save preferences">Save</button>
            <button class="sr-preferences-cancel" aria-label="Cancel">Cancel</button>
        `;
        
        document.body.appendChild(modal);
        
        // Focus on modal
        modal.focus();
        
        // Setup event listeners
        this.setupPreferencesEventListeners(modal);
    }

    /**
     * Generate preferences interface
     */
    generatePreferencesInterface() {
        return `
            <div class="sr-preference-group">
                <label>
                    <input type="checkbox" id="audio-cues" ${this.userPreferences.audioCues ? 'checked' : ''}>
                    Enable audio cues
                </label>
            </div>
            <div class="sr-preference-group">
                <label>
                    <input type="checkbox" id="simplified-mode" ${this.userPreferences.simplifiedMode ? 'checked' : ''}>
                    Enable simplified mode
                </label>
            </div>
            <div class="sr-preference-group">
                <label>
                    <input type="checkbox" id="shortcut-keys" ${this.userPreferences.shortcutKeys ? 'checked' : ''}>
                    Enable keyboard shortcuts
                </label>
            </div>
            <div class="sr-preference-group">
                <label>
                    <input type="checkbox" id="audio-feedback" ${this.userPreferences.audioFeedback ? 'checked' : ''}>
                    Enable audio feedback
                </label>
            </div>
            <div class="sr-preference-group">
                <label for="reading-speed">Reading Speed:</label>
                <select id="reading-speed">
                    <option value="slow" ${this.userPreferences.readingSpeed === 'slow' ? 'selected' : ''}>Slow</option>
                    <option value="normal" ${this.userPreferences.readingSpeed === 'normal' ? 'selected' : ''}>Normal</option>
                    <option value="fast" ${this.userPreferences.readingSpeed === 'fast' ? 'selected' : ''}>Fast</option>
                </select>
            </div>
            <div class="sr-preference-group">
                <label for="content-density">Content Density:</label>
                <select id="content-density">
                    <option value="minimal" ${this.userPreferences.contentDensity === 'minimal' ? 'selected' : ''}>Minimal</option>
                    <option value="normal" ${this.userPreferences.contentDensity === 'normal' ? 'selected' : ''}>Normal</option>
                    <option value="detailed" ${this.userPreferences.contentDensity === 'detailed' ? 'selected' : ''}>Detailed</option>
                </select>
            </div>
        `;
    }

    /**
     * Setup preferences event listeners
     */
    setupPreferencesEventListeners(modal) {
        const saveBtn = modal.querySelector('.sr-preferences-save');
        const cancelBtn = modal.querySelector('.sr-preferences-cancel');
        
        saveBtn.addEventListener('click', () => {
            this.savePreferences(modal);
            modal.remove();
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on escape
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modal.remove();
            }
        });
    }

    /**
     * Save preferences
     */
    savePreferences(modal) {
        const preferences = {
            audioCues: modal.querySelector('#audio-cues').checked,
            simplifiedMode: modal.querySelector('#simplified-mode').checked,
            shortcutKeys: modal.querySelector('#shortcut-keys').checked,
            audioFeedback: modal.querySelector('#audio-feedback').checked,
            readingSpeed: modal.querySelector('#reading-speed').value,
            contentDensity: modal.querySelector('#content-density').value
        };
        
        this.userPreferences = { ...this.userPreferences, ...preferences };
        this.saveUserPreferences();
        
        // Apply preferences
        this.applyPreferences();
        
        // Announce preferences saved
        this.announce('Preferences saved');
    }

    /**
     * Apply user preferences
     */
    applyPreferences() {
        // Apply simplified mode
        if (this.userPreferences.simplifiedMode) {
            document.body.classList.add('sr-simplified-mode');
        } else {
            document.body.classList.remove('sr-simplified-mode');
        }
        
        // Apply content density
        document.body.className = document.body.className.replace(/sr-density-\w+/g, '');
        document.body.classList.add(`sr-density-${this.userPreferences.contentDensity}`);
        
        // Apply reading speed
        document.body.className = document.body.className.replace(/sr-speed-\w+/g, '');
        document.body.classList.add(`sr-speed-${this.userPreferences.readingSpeed}`);
    }

    /**
     * Play audio cue
     * @param {string} cueName - Audio cue name
     */
    playAudioCue(cueName) {
        if (!this.userPreferences.audioCues) return;
        
        const cue = this.audioCues.get(cueName);
        if (!cue) return;
        
        // Announce text
        this.announce(cue.text);
        
        // Play audio if available
        if (cue.audio && this.userPreferences.audioFeedback) {
            const audio = new Audio(`/audio/${cue.audio}`);
            audio.play().catch(error => {
                this.logger.debug('Audio playback failed:', error);
            });
        }
    }

    /**
     * Announce text to screen readers
     * @param {string} text - Text to announce
     */
    announce(text) {
        if (window.LiveRegionManager) {
            window.LiveRegionManager.announce('status-announcements', text, 'normal');
        }
    }

    /**
     * Announce current exercise details
     */
    announceCurrentExercise() {
        // This would be implemented based on actual workout data
        const exercise = this.getCurrentExercise();
        if (exercise) {
            const announcement = `${exercise.name}. ${exercise.sets} sets of ${exercise.reps} reps. ${exercise.weight} pounds.`;
            this.announce(announcement);
        }
    }

    /**
     * Get current exercise (placeholder)
     */
    getCurrentExercise() {
        // This would be implemented based on actual workout data
        return {
            name: 'Bench Press',
            sets: 3,
            reps: 10,
            weight: 135
        };
    }

    /**
     * Handle workout events
     */
    handleWorkoutStarted() {
        this.playAudioCue('workout-start');
        this.announce('Workout session started');
    }

    handleWorkoutPaused() {
        this.announce('Workout paused');
    }

    handleWorkoutResumed() {
        this.announce('Workout resumed');
    }

    handleWorkoutCompleted() {
        this.playAudioCue('workout-complete');
        this.announce('Workout completed successfully');
    }

    handleExerciseStarted() {
        this.playAudioCue('exercise-start');
        this.announceCurrentExercise();
    }

    handleExerciseCompleted() {
        this.announce('Exercise completed');
    }

    handleSetCompleted() {
        this.playAudioCue('set-complete');
        this.announce('Set completed');
    }

    handleTimerStarted() {
        this.announce('Timer started');
    }

    handleTimerCompleted() {
        this.playAudioCue('timer-complete');
        this.announce('Timer completed');
    }

    handleTimerWarning() {
        this.playAudioCue('timer-warning');
        this.announce('Timer warning');
    }

    handlePreferencesChanged(preferences) {
        this.userPreferences = { ...this.userPreferences, ...preferences };
        this.applyPreferences();
    }

    /**
     * Load user preferences
     */
    loadUserPreferences() {
        try {
            const saved = localStorage.getItem('screen-reader-preferences');
            if (saved) {
                const preferences = JSON.parse(saved);
                this.userPreferences = { ...this.userPreferences, ...preferences };
                this.applyPreferences();
            }
        } catch (error) {
            this.logger.debug('Could not load screen reader preferences:', error);
        }
    }

    /**
     * Save user preferences
     */
    saveUserPreferences() {
        try {
            localStorage.setItem('screen-reader-preferences', JSON.stringify(this.userPreferences));
        } catch (error) {
            this.logger.debug('Could not save screen reader preferences:', error);
        }
    }

    /**
     * Enable simplified navigation
     */
    enableSimplifiedNavigation() {
        // Add simplified navigation styles
        const style = document.createElement('style');
        style.textContent = `
            .sr-simplified-mode .complex-ui { display: none; }
            .sr-simplified-mode .sr-workout-nav { display: block; }
            .sr-density-minimal .secondary-content { display: none; }
            .sr-density-detailed .secondary-content { display: block; }
            .sr-speed-slow { animation-duration: 2s; }
            .sr-speed-fast { animation-duration: 0.5s; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Enable audio cues
     */
    enableAudioCues() {
        // Audio cues are enabled by default when screen reader mode is detected
        this.userPreferences.audioCues = true;
        this.userPreferences.audioFeedback = true;
    }

    /**
     * Get user preferences
     * @returns {Object} User preferences
     */
    getPreferences() {
        return { ...this.userPreferences };
    }

    /**
     * Update user preferences
     * @param {Object} preferences - New preferences
     */
    updatePreferences(preferences) {
        this.userPreferences = { ...this.userPreferences, ...preferences };
        this.saveUserPreferences();
        this.applyPreferences();
        EventBus.publish('accessibility:preferencesChanged', preferences);
    }

    /**
     * Check if screen reader mode is active
     * @returns {boolean} Whether screen reader mode is active
     */
    isScreenReaderActive() {
        return this.isScreenReaderMode;
    }
}

// Create global instance
window.ScreenReaderWorkflowManager = new ScreenReaderWorkflowManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScreenReaderWorkflowManager;
}
