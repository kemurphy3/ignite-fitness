/**
 * VoiceControlManager - Handles voice commands for hands-free workout tracking
 * Provides speech recognition, voice commands, and speech feedback
 */

// Import EventBus - ensure it's available globally
let EventBus;
if (typeof window !== 'undefined' && window.EventBus) {
  // eslint-disable-next-line prefer-destructuring
  EventBus = window.EventBus;
} else if (typeof globalThis !== 'undefined' && globalThis.EventBus) {
  // eslint-disable-next-line prefer-destructuring
  EventBus = globalThis.EventBus;
} else if (typeof module !== 'undefined' && module.exports) {
  try {
    EventBus = require('../core/EventBus.js');
  } catch (e) {
    // Fallback no-op EventBus if require fails
    EventBus = {
      subscribe: () => () => {},
      unsubscribe: () => {},
      on: () => () => {},
      off: () => {},
      emit: () => {},
      publish: () => {},
    };
  }
} else {
  // Fallback no-op EventBus
  EventBus = {
    subscribe: () => () => {},
    unsubscribe: () => {},
    on: () => () => {},
    off: () => {},
    emit: () => {},
    publish: () => {},
  };
}
class VoiceControlManager {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.isListening = false;
    this.isSupported = false;
    this.recognition = null;
    this.synthesis = null;
    this.commands = new Map();
    this.userPreferences = {
      voiceCommands: true,
      speechFeedback: true,
      noiseCancellation: true,
      voiceLanguage: 'en-US',
      voiceSpeed: 1.0,
      voicePitch: 1.0,
      voiceVolume: 1.0,
      wakeWord: 'fitness',
      continuousListening: false,
    };

    this.init();
  }

  /**
   * Initialize voice control manager
   */
  init() {
    this.checkSupport();
    this.setupCommands();
    this.setupEventListeners();
    this.loadUserPreferences();
    this.logger.debug('VoiceControlManager initialized');
  }

  /**
   * Check if speech recognition and synthesis are supported
   */
  checkSupport() {
    // Check for speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
      this.isSupported = true;
    }

    // Check for speech synthesis support
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.isSupported = true;
    }

    if (!this.isSupported) {
      this.logger.warn('Speech recognition or synthesis not supported');
    }
  }

  /**
   * Setup speech recognition
   */
  setupRecognition() {
    if (!this.recognition) {
      return;
    }

    this.recognition.continuous = this.userPreferences.continuousListening;
    this.recognition.interimResults = false;
    this.recognition.lang = this.userPreferences.voiceLanguage;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.logger.debug('Speech recognition started');
      EventBus.publish('voice:listeningStarted');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.logger.debug('Speech recognition ended');
      EventBus.publish('voice:listeningEnded');
    };

    this.recognition.onresult = event => {
      this.handleRecognitionResult(event);
    };

    this.recognition.onerror = event => {
      this.logger.error('Speech recognition error:', event.error);
      this.handleRecognitionError(event);
    };

    this.recognition.onnomatch = () => {
      this.speak('Command not recognized. Please try again.');
    };
  }

  /**
   * Setup voice commands
   */
  setupCommands() {
    // Workout commands
    this.commands.set('start workout', {
      action: () => this.startWorkout(),
      description: 'Start a new workout session',
      category: 'workout',
    });

    this.commands.set('pause workout', {
      action: () => this.pauseWorkout(),
      description: 'Pause the current workout',
      category: 'workout',
    });

    this.commands.set('resume workout', {
      action: () => this.resumeWorkout(),
      description: 'Resume the paused workout',
      category: 'workout',
    });

    this.commands.set('end workout', {
      action: () => this.endWorkout(),
      description: 'End the current workout',
      category: 'workout',
    });

    // Exercise commands
    this.commands.set('next exercise', {
      action: () => this.nextExercise(),
      description: 'Move to the next exercise',
      category: 'exercise',
    });

    this.commands.set('previous exercise', {
      action: () => this.previousExercise(),
      description: 'Move to the previous exercise',
      category: 'exercise',
    });

    this.commands.set('complete set', {
      action: () => this.completeSet(),
      description: 'Mark the current set as complete',
      category: 'exercise',
    });

    this.commands.set('add weight', {
      action: () => this.addWeight(),
      description: 'Increase the weight for current exercise',
      category: 'exercise',
    });

    this.commands.set('reduce weight', {
      action: () => this.reduceWeight(),
      description: 'Decrease the weight for current exercise',
      category: 'exercise',
    });

    // Timer commands
    this.commands.set('start timer', {
      action: () => this.startTimer(),
      description: 'Start the workout timer',
      category: 'timer',
    });

    this.commands.set('pause timer', {
      action: () => this.pauseTimer(),
      description: 'Pause the workout timer',
      category: 'timer',
    });

    this.commands.set('stop timer', {
      action: () => this.stopTimer(),
      description: 'Stop the workout timer',
      category: 'timer',
    });

    this.commands.set('rest timer', {
      action: () => this.startRestTimer(),
      description: 'Start the rest timer',
      category: 'timer',
    });

    // Navigation commands
    this.commands.set('go home', {
      action: () => this.goHome(),
      description: 'Navigate to home screen',
      category: 'navigation',
    });

    this.commands.set('go to progress', {
      action: () => this.goToProgress(),
      description: 'Navigate to progress screen',
      category: 'navigation',
    });

    this.commands.set('go to settings', {
      action: () => this.goToSettings(),
      description: 'Navigate to settings screen',
      category: 'navigation',
    });

    // Help commands
    this.commands.set('help', {
      action: () => this.showHelp(),
      description: 'Show available voice commands',
      category: 'help',
    });

    this.commands.set('what can you do', {
      action: () => this.showHelp(),
      description: 'Show available voice commands',
      category: 'help',
    });

    // System commands
    this.commands.set('stop listening', {
      action: () => this.stopListening(),
      description: 'Stop voice recognition',
      category: 'system',
    });

    this.commands.set('start listening', {
      action: () => this.startListening(),
      description: 'Start voice recognition',
      category: 'system',
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for voice control events
    EventBus.subscribe('voice:startListening', this.startListening.bind(this));
    EventBus.subscribe('voice:stopListening', this.stopListening.bind(this));
    EventBus.subscribe('voice:toggleListening', this.toggleListening.bind(this));

    // Listen for preference changes
    EventBus.subscribe(
      'accessibility:preferencesChanged',
      this.handlePreferencesChanged.bind(this)
    );

    // Listen for workout events
    EventBus.subscribe('workout:started', this.handleWorkoutStarted.bind(this));
    EventBus.subscribe('workout:paused', this.handleWorkoutPaused.bind(this));
    EventBus.subscribe('workout:resumed', this.handleWorkoutResumed.bind(this));
    EventBus.subscribe('workout:completed', this.handleWorkoutCompleted.bind(this));
  }

  /**
   * Handle speech recognition result
   * @param {SpeechRecognitionEvent} event - Recognition event
   */
  handleRecognitionResult(event) {
    const result = event.results[event.resultIndex];
    const transcript = result[0].transcript.toLowerCase().trim();

    this.logger.debug('Speech recognized:', transcript);

    // Check for wake word
    if (this.userPreferences.wakeWord && !transcript.includes(this.userPreferences.wakeWord)) {
      return;
    }

    // Remove wake word from transcript
    const command = transcript.replace(this.userPreferences.wakeWord, '').trim();

    // Find matching command
    const matchedCommand = this.findMatchingCommand(command);

    if (matchedCommand) {
      this.executeCommand(matchedCommand, command);
    } else {
      this.speak('Command not recognized. Say help for available commands.');
    }
  }

  /**
   * Find matching command
   * @param {string} command - Command text
   * @returns {Object|null} Matching command or null
   */
  findMatchingCommand(command) {
    // Exact match
    if (this.commands.has(command)) {
      return { key: command, command: this.commands.get(command) };
    }

    // Partial match
    for (const [key, cmd] of this.commands.entries()) {
      if (command.includes(key) || key.includes(command)) {
        return { key, command: cmd };
      }
    }

    // Fuzzy match
    for (const [key, cmd] of this.commands.entries()) {
      if (this.calculateSimilarity(command, key) > 0.7) {
        return { key, command: cmd };
      }
    }

    return null;
  }

  /**
   * Calculate similarity between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Execute voice command
   * @param {Object} matchedCommand - Matched command
   */
  executeCommand(matchedCommand) {
    const { key, command } = matchedCommand;

    try {
      command.action();
      this.speak(`Executed: ${command.description}`);
      this.logger.debug('Voice command executed:', key);
    } catch (error) {
      this.logger.error('Error executing voice command:', error);
      this.speak('Error executing command. Please try again.');
    }
  }

  /**
   * Handle recognition error
   * @param {SpeechRecognitionErrorEvent} event - Error event
   */
  handleRecognitionError(event) {
    let errorMessage = 'Speech recognition error. ';

    switch (event.error) {
      case 'no-speech':
        errorMessage += 'No speech detected.';
        break;
      case 'audio-capture':
        errorMessage += 'Audio capture failed.';
        break;
      case 'not-allowed':
        errorMessage += 'Microphone access denied.';
        break;
      case 'network':
        errorMessage += 'Network error.';
        break;
      default:
        errorMessage += 'Unknown error.';
    }

    this.speak(errorMessage);
  }

  /**
   * Start voice recognition
   */
  startListening() {
    if (!this.isSupported || !this.userPreferences.voiceCommands) {
      this.speak('Voice commands not available.');
      return;
    }

    if (this.isListening) {
      this.speak('Already listening.');
      return;
    }

    try {
      this.recognition.start();
      this.speak('Listening for voice commands.');
    } catch (error) {
      this.logger.error('Error starting speech recognition:', error);
      this.speak('Error starting voice recognition.');
    }
  }

  /**
   * Stop voice recognition
   */
  stopListening() {
    if (!this.isListening) {
      this.speak('Not currently listening.');
      return;
    }

    this.recognition.stop();
    this.speak('Stopped listening.');
  }

  /**
   * Toggle voice recognition
   */
  toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  /**
   * Speak text using speech synthesis
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   */
  speak(text, options = {}) {
    if (!this.synthesis || !this.userPreferences.speechFeedback) {
      return;
    }

    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Set voice options
    utterance.rate = options.rate || this.userPreferences.voiceSpeed;
    utterance.pitch = options.pitch || this.userPreferences.voicePitch;
    utterance.volume = options.volume || this.userPreferences.voiceVolume;
    utterance.lang = options.lang || this.userPreferences.voiceLanguage;

    // Set voice
    const voices = this.synthesis.getVoices();
    const preferredVoice = voices.find(
      voice =>
        voice.lang.startsWith(this.userPreferences.voiceLanguage) && voice.name.includes('Google')
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Event handlers
    utterance.onstart = () => {
      this.logger.debug('Speech started:', text);
    };

    utterance.onend = () => {
      this.logger.debug('Speech ended');
    };

    utterance.onerror = event => {
      this.logger.error('Speech synthesis error:', event.error);
    };

    this.synthesis.speak(utterance);
  }

  /**
   * Workout commands
   */
  startWorkout() {
    EventBus.publish('workout:start', { voiceCommand: true });
    this.speak('Starting workout session.');
  }

  pauseWorkout() {
    EventBus.publish('workout:pause', { voiceCommand: true });
    this.speak('Workout paused.');
  }

  resumeWorkout() {
    EventBus.publish('workout:resume', { voiceCommand: true });
    this.speak('Workout resumed.');
  }

  endWorkout() {
    EventBus.publish('workout:end', { voiceCommand: true });
    this.speak('Workout ended.');
  }

  /**
   * Exercise commands
   */
  nextExercise() {
    EventBus.publish('exercise:next', { voiceCommand: true });
    this.speak('Moving to next exercise.');
  }

  previousExercise() {
    EventBus.publish('exercise:previous', { voiceCommand: true });
    this.speak('Moving to previous exercise.');
  }

  completeSet() {
    EventBus.publish('set:complete', { voiceCommand: true });
    this.speak('Set completed.');
  }

  addWeight() {
    EventBus.publish('weight:add', { voiceCommand: true });
    this.speak('Weight increased.');
  }

  reduceWeight() {
    EventBus.publish('weight:reduce', { voiceCommand: true });
    this.speak('Weight decreased.');
  }

  /**
   * Timer commands
   */
  startTimer() {
    EventBus.publish('timer:start', { voiceCommand: true });
    this.speak('Timer started.');
  }

  pauseTimer() {
    EventBus.publish('timer:pause', { voiceCommand: true });
    this.speak('Timer paused.');
  }

  stopTimer() {
    EventBus.publish('timer:stop', { voiceCommand: true });
    this.speak('Timer stopped.');
  }

  startRestTimer() {
    EventBus.publish('timer:rest', { voiceCommand: true });
    this.speak('Rest timer started.');
  }

  /**
   * Navigation commands
   */
  goHome() {
    EventBus.publish('navigation:home', { voiceCommand: true });
    this.speak('Navigating to home.');
  }

  goToProgress() {
    EventBus.publish('navigation:progress', { voiceCommand: true });
    this.speak('Navigating to progress.');
  }

  goToSettings() {
    EventBus.publish('navigation:settings', { voiceCommand: true });
    this.speak('Navigating to settings.');
  }

  /**
   * Help command
   */
  showHelp() {
    const helpText = this.generateHelpText();
    this.speak(helpText);
  }

  /**
   * Generate help text
   */
  generateHelpText() {
    let help = 'Available voice commands: ';

    const categories = ['workout', 'exercise', 'timer', 'navigation', 'help', 'system'];

    categories.forEach(category => {
      const categoryCommands = Array.from(this.commands.entries())
        .filter(([, cmd]) => cmd.category === category)
        .map(([key]) => key);

      if (categoryCommands.length > 0) {
        help += `${category} commands: ${categoryCommands.join(', ')}. `;
      }
    });

    return help;
  }

  /**
   * Handle preference changes
   */
  handlePreferencesChanged(preferences) {
    this.userPreferences = { ...this.userPreferences, ...preferences };
    this.saveUserPreferences();
    this.applyPreferences();
  }

  /**
   * Apply user preferences
   */
  applyPreferences() {
    if (this.recognition) {
      this.recognition.lang = this.userPreferences.voiceLanguage;
      this.recognition.continuous = this.userPreferences.continuousListening;
    }
  }

  /**
   * Handle workout events
   */
  handleWorkoutStarted() {
    this.speak('Workout session started.');
  }

  handleWorkoutPaused() {
    this.speak('Workout paused.');
  }

  handleWorkoutResumed() {
    this.speak('Workout resumed.');
  }

  handleWorkoutCompleted() {
    this.speak('Workout completed successfully.');
  }

  /**
   * Load user preferences
   */
  loadUserPreferences() {
    try {
      const saved = localStorage.getItem('voice-control-preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.userPreferences = { ...this.userPreferences, ...preferences };
        this.applyPreferences();
      }
    } catch (error) {
      this.logger.debug('Could not load voice control preferences:', error);
    }
  }

  /**
   * Save user preferences
   */
  saveUserPreferences() {
    try {
      localStorage.setItem('voice-control-preferences', JSON.stringify(this.userPreferences));
    } catch (error) {
      this.logger.debug('Could not save voice control preferences:', error);
    }
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
   * Check if voice control is supported
   * @returns {boolean} Whether voice control is supported
   */
  isVoiceControlSupported() {
    return this.isSupported;
  }

  /**
   * Check if currently listening
   * @returns {boolean} Whether currently listening
   */
  isCurrentlyListening() {
    return this.isListening;
  }

  /**
   * Get available commands
   * @returns {Map} Available commands
   */
  getCommands() {
    return new Map(this.commands);
  }
}

// Create global instance
window.VoiceControlManager = new VoiceControlManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceControlManager;
}
