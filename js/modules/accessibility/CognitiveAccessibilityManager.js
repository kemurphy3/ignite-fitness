/**
 * CognitiveAccessibilityManager - Provides cognitive accessibility features
 * Includes reading aids, content simplification, and cognitive load reduction
 */
class CognitiveAccessibilityManager {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.isActive = false;
    this.userPreferences = {
      plainLanguageMode: false,
      readingLevel: 'normal', // 'simple', 'normal', 'detailed'
      contentSummarization: false,
      attentionManagement: false,
      readingAssistance: false,
      cognitiveLoadReduction: false,
      visualCues: true,
      progressIndicators: true,
      errorPrevention: true,
      confirmationDialogs: true,
    };

    this.readingLevels = {
      simple: {
        maxWordsPerSentence: 15,
        maxSyllablesPerWord: 2,
        useSimpleWords: true,
        avoidJargon: true,
        useActiveVoice: true,
      },
      normal: {
        maxWordsPerSentence: 25,
        maxSyllablesPerWord: 3,
        useSimpleWords: false,
        avoidJargon: false,
        useActiveVoice: false,
      },
      detailed: {
        maxWordsPerSentence: 35,
        maxSyllablesPerWord: 4,
        useSimpleWords: false,
        avoidJargon: false,
        useActiveVoice: false,
      },
    };

    this.simpleWords = new Map([
      ['utilize', 'use'],
      ['facilitate', 'help'],
      ['implement', 'do'],
      ['optimize', 'improve'],
      ['configure', 'set up'],
      ['initialize', 'start'],
      ['terminate', 'end'],
      ['synchronize', 'sync'],
      ['authenticate', 'log in'],
      ['validate', 'check'],
      ['comprehensive', 'complete'],
      ['substantial', 'large'],
      ['significant', 'important'],
      ['appropriate', 'right'],
      ['approximately', 'about'],
    ]);

    this.init();
  }

  /**
   * Initialize cognitive accessibility manager
   */
  init() {
    this.setupEventListeners();
    this.loadUserPreferences();
    this.detectCognitiveNeeds();
    this.logger.debug('CognitiveAccessibilityManager initialized');
  }

  /**
   * Detect cognitive accessibility needs
   */
  detectCognitiveNeeds() {
    // Check for cognitive accessibility preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

    if (prefersReducedMotion || prefersHighContrast) {
      this.userPreferences.cognitiveLoadReduction = true;
      this.userPreferences.visualCues = true;
    }

    // Check for reading assistance needs
    const hasReadingAssistance = document.querySelector('[data-reading-assistance]');
    if (hasReadingAssistance) {
      this.userPreferences.readingAssistance = true;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for cognitive accessibility events
    EventBus.subscribe('cognitive:enable', this.enableCognitiveFeatures.bind(this));
    EventBus.subscribe('cognitive:disable', this.disableCognitiveFeatures.bind(this));
    EventBus.subscribe('cognitive:preferencesChanged', this.handlePreferencesChanged.bind(this));

    // Listen for content changes
    EventBus.subscribe('content:loaded', this.processContent.bind(this));
    EventBus.subscribe('content:updated', this.processContent.bind(this));

    // Listen for form interactions
    EventBus.subscribe('form:focus', this.handleFormFocus.bind(this));
    EventBus.subscribe('form:blur', this.handleFormBlur.bind(this));
    EventBus.subscribe('form:error', this.handleFormError.bind(this));
  }

  /**
   * Enable cognitive accessibility features
   */
  enableCognitiveFeatures() {
    this.isActive = true;
    document.body.classList.add('cognitive-accessibility-enabled');

    // Apply current preferences
    this.applyPreferences();

    // Process existing content
    this.processContent();

    this.logger.debug('Cognitive accessibility features enabled');
  }

  /**
   * Disable cognitive accessibility features
   */
  disableCognitiveFeatures() {
    this.isActive = false;
    document.body.classList.remove('cognitive-accessibility-enabled');

    // Remove cognitive enhancements
    this.removeCognitiveEnhancements();

    this.logger.debug('Cognitive accessibility features disabled');
  }

  /**
   * Process content for cognitive accessibility
   */
  processContent() {
    if (!this.isActive) {
      return;
    }

    // Process text content
    if (this.userPreferences.plainLanguageMode) {
      this.simplifyTextContent();
    }

    // Process reading level
    if (this.userPreferences.readingLevel !== 'normal') {
      this.adjustReadingLevel();
    }

    // Add content summarization
    if (this.userPreferences.contentSummarization) {
      this.addContentSummaries();
    }

    // Add attention management features
    if (this.userPreferences.attentionManagement) {
      this.addAttentionManagement();
    }

    // Add reading assistance
    if (this.userPreferences.readingAssistance) {
      this.addReadingAssistance();
    }

    // Reduce cognitive load
    if (this.userPreferences.cognitiveLoadReduction) {
      this.reduceCognitiveLoad();
    }
  }

  /**
   * Simplify text content to plain language
   */
  simplifyTextContent() {
    const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6');

    textElements.forEach(element => {
      if (element.dataset.cognitiveProcessed) {
        return;
      }

      const originalText = element.textContent;
      const simplifiedText = this.simplifyText(originalText);

      if (simplifiedText !== originalText) {
        element.innerHTML = simplifiedText;
        element.dataset.cognitiveProcessed = 'true';
        element.dataset.originalText = originalText;
      }
    });
  }

  /**
   * Simplify text using plain language principles
   * @param {string} text - Text to simplify
   * @returns {string} Simplified text
   */
  simplifyText(text) {
    let simplified = text;

    // Replace complex words with simple ones
    this.simpleWords.forEach((simple, complex) => {
      const regex = new RegExp(`\\b${complex}\\b`, 'gi');
      simplified = simplified.replace(regex, simple);
    });

    // Break long sentences
    simplified = this.breakLongSentences(simplified);

    // Use active voice
    simplified = this.convertToActiveVoice(simplified);

    // Remove jargon
    simplified = this.removeJargon(simplified);

    return simplified;
  }

  /**
   * Break long sentences into shorter ones
   * @param {string} text - Text to process
   * @returns {string} Text with shorter sentences
   */
  breakLongSentences(text) {
    const sentences = text.split(/[.!?]+/);
    const maxWords = this.readingLevels[this.userPreferences.readingLevel].maxWordsPerSentence;

    return sentences
      .map(sentence => {
        const words = sentence.trim().split(/\s+/);
        if (words.length <= maxWords) {
          return sentence.trim();
        }

        // Break long sentences
        const chunks = [];
        for (let i = 0; i < words.length; i += maxWords) {
          chunks.push(words.slice(i, i + maxWords).join(' '));
        }

        return `${chunks.join('. ')}.`;
      })
      .join(' ');
  }

  /**
   * Convert passive voice to active voice
   * @param {string} text - Text to convert
   * @returns {string} Text in active voice
   */
  convertToActiveVoice(text) {
    // Simple passive to active conversions
    const passivePatterns = [
      { pattern: /is (.*?) by/g, replacement: '$1' },
      { pattern: /was (.*?) by/g, replacement: '$1' },
      { pattern: /are (.*?) by/g, replacement: '$1' },
      { pattern: /were (.*?) by/g, replacement: '$1' },
    ];

    let active = text;
    passivePatterns.forEach(({ pattern, replacement }) => {
      active = active.replace(pattern, replacement);
    });

    return active;
  }

  /**
   * Remove jargon and technical terms
   * @param {string} text - Text to process
   * @returns {string} Text without jargon
   */
  removeJargon(text) {
    const jargonTerms = [
      'algorithm',
      'API',
      'database',
      'framework',
      'interface',
      'metadata',
      'protocol',
      'query',
      'schema',
      'syntax',
    ];

    let clean = text;
    jargonTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      clean = clean.replace(regex, 'system');
    });

    return clean;
  }

  /**
   * Adjust reading level
   */
  adjustReadingLevel() {
    const level = this.userPreferences.readingLevel;
    const config = this.readingLevels[level];

    // Apply reading level styles
    document.body.className = document.body.className.replace(/reading-level-\w+/g, '');
    document.body.classList.add(`reading-level-${level}`);

    // Adjust content based on level
    if (level === 'simple') {
      this.simplifyContent();
    } else if (level === 'detailed') {
      this.addDetailedContent();
    }
  }

  /**
   * Simplify content for simple reading level
   */
  simplifyContent() {
    // Hide complex elements
    const complexElements = document.querySelectorAll('.complex, .technical, .advanced');
    complexElements.forEach(element => {
      element.style.display = 'none';
    });

    // Show simplified versions
    const simpleElements = document.querySelectorAll('.simple, .basic');
    simpleElements.forEach(element => {
      element.style.display = 'block';
    });
  }

  /**
   * Add detailed content for detailed reading level
   */
  addDetailedContent() {
    // Show all content
    const hiddenElements = document.querySelectorAll('.detailed, .advanced');
    hiddenElements.forEach(element => {
      element.style.display = 'block';
    });
  }

  /**
   * Add content summaries
   */
  addContentSummaries() {
    const contentSections = document.querySelectorAll('section, article, .content-section');

    contentSections.forEach(section => {
      if (section.dataset.summaryAdded) {
        return;
      }

      const summary = this.generateSummary(section);
      if (summary) {
        const summaryElement = document.createElement('div');
        summaryElement.className = 'content-summary';
        summaryElement.innerHTML = `
                    <h3>Summary</h3>
                    <p>${summary}</p>
                `;

        section.insertBefore(summaryElement, section.firstChild);
        section.dataset.summaryAdded = 'true';
      }
    });
  }

  /**
   * Generate content summary
   * @param {HTMLElement} element - Element to summarize
   * @returns {string} Summary text
   */
  generateSummary(element) {
    const text = element.textContent;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length < 3) {
      return null;
    }

    // Take first and last sentences as summary
    const firstSentence = sentences[0].trim();
    const lastSentence = sentences[sentences.length - 1].trim();

    return `${firstSentence}. ${lastSentence}.`;
  }

  /**
   * Add attention management features
   */
  addAttentionManagement() {
    // Add focus indicators
    this.addFocusIndicators();

    // Add progress indicators
    if (this.userPreferences.progressIndicators) {
      this.addProgressIndicators();
    }

    // Add visual cues
    if (this.userPreferences.visualCues) {
      this.addVisualCues();
    }
  }

  /**
   * Add focus indicators
   */
  addFocusIndicators() {
    const style = document.createElement('style');
    style.textContent = `
            .cognitive-accessibility-enabled *:focus {
                outline: 3px solid #ff6b35 !important;
                outline-offset: 2px !important;
                box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.3) !important;
            }
            
            .cognitive-accessibility-enabled .focus-highlight {
                background-color: rgba(255, 107, 53, 0.1) !important;
                border: 2px solid #ff6b35 !important;
            }
        `;
    document.head.appendChild(style);
  }

  /**
   * Add progress indicators
   */
  addProgressIndicators() {
    const progressElements = document.querySelectorAll('.progress, .step, .workout-step');

    progressElements.forEach((element, index) => {
      if (element.dataset.progressAdded) {
        return;
      }

      const progressBar = document.createElement('div');
      progressBar.className = 'cognitive-progress';
      progressBar.innerHTML = `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(index + 1) * 20}%"></div>
                </div>
                <span class="progress-text">Step ${index + 1}</span>
            `;

      element.appendChild(progressBar);
      element.dataset.progressAdded = 'true';
    });
  }

  /**
   * Add visual cues
   */
  addVisualCues() {
    // Add visual cues to important elements
    const importantElements = document.querySelectorAll('.important, .warning, .error, .success');

    importantElements.forEach(element => {
      if (element.dataset.visualCueAdded) {
        return;
      }

      const cue = document.createElement('div');
      cue.className = 'visual-cue';
      cue.innerHTML = '⚠️';

      element.appendChild(cue);
      element.dataset.visualCueAdded = 'true';
    });
  }

  /**
   * Add reading assistance
   */
  addReadingAssistance() {
    // Add reading assistance tools
    this.addReadingTools();

    // Add text highlighting
    this.addTextHighlighting();

    // Add pronunciation help
    this.addPronunciationHelp();
  }

  /**
   * Add reading tools
   */
  addReadingTools() {
    const readingTools = document.createElement('div');
    readingTools.className = 'reading-tools';
    readingTools.innerHTML = `
            <button class="reading-tool" data-action="highlight">Highlight</button>
            <button class="reading-tool" data-action="speak">Speak</button>
            <button class="reading-tool" data-action="define">Define</button>
            <button class="reading-tool" data-action="translate">Translate</button>
        `;

    document.body.appendChild(readingTools);

    // Add event listeners
    readingTools.addEventListener('click', e => {
      const { action } = e.target.dataset;
      this.handleReadingToolAction(action);
    });
  }

  /**
   * Handle reading tool actions
   * @param {string} action - Action to perform
   */
  handleReadingToolAction(action) {
    switch (action) {
      case 'highlight':
        this.highlightSelectedText();
        break;
      case 'speak':
        this.speakSelectedText();
        break;
      case 'define':
        this.defineSelectedText();
        break;
      case 'translate':
        this.translateSelectedText();
        break;
    }
  }

  /**
   * Highlight selected text
   */
  highlightSelectedText() {
    const selection = window.getSelection();
    if (selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'cognitive-highlight';
      span.style.backgroundColor = '#ffff00';
      span.style.color = '#000000';

      try {
        range.surroundContents(span);
      } catch (e) {
        // Handle case where selection spans multiple elements
        this.logger.debug('Could not highlight selection:', e);
      }
    }
  }

  /**
   * Speak selected text
   */
  speakSelectedText() {
    const selection = window.getSelection();
    if (selection.toString().trim()) {
      if (window.VoiceControlManager) {
        window.VoiceControlManager.speak(selection.toString());
      }
    }
  }

  /**
   * Define selected text
   */
  defineSelectedText() {
    const selection = window.getSelection();
    if (selection.toString().trim()) {
      const word = selection.toString().trim();
      const definition = this.getDefinition(word);

      if (definition) {
        this.showDefinition(word, definition);
      }
    }
  }

  /**
   * Get definition for word
   * @param {string} word - Word to define
   * @returns {string} Definition
   */
  getDefinition(word) {
    const definitions = {
      workout: 'A session of physical exercise',
      exercise: 'Physical activity to improve health',
      set: 'A group of repetitions',
      rep: 'A single repetition of an exercise',
      weight: 'The amount of weight lifted',
      timer: 'A device to measure time',
      rest: 'A period of relaxation between exercises',
    };

    return definitions[word.toLowerCase()];
  }

  /**
   * Show definition
   * @param {string} word - Word
   * @param {string} definition - Definition
   */
  showDefinition(word, definition) {
    const tooltip = document.createElement('div');
    tooltip.className = 'definition-tooltip';
    tooltip.innerHTML = `
            <strong>${word}</strong>: ${definition}
        `;

    document.body.appendChild(tooltip);

    // Position tooltip
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    tooltip.style.position = 'absolute';
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;
    tooltip.style.zIndex = '1000';

    // Remove tooltip after 3 seconds
    setTimeout(() => {
      tooltip.remove();
    }, 3000);
  }

  /**
   * Translate selected text
   */
  translateSelectedText() {
    const selection = window.getSelection();
    if (selection.toString().trim()) {
      // This would integrate with a translation service
      this.logger.debug('Translation requested for:', selection.toString());
    }
  }

  /**
   * Add text highlighting
   */
  addTextHighlighting() {
    const style = document.createElement('style');
    style.textContent = `
            .cognitive-highlight {
                background-color: #ffff00 !important;
                color: #000000 !important;
                padding: 2px 4px !important;
                border-radius: 3px !important;
            }
        `;
    document.head.appendChild(style);
  }

  /**
   * Add pronunciation help
   */
  addPronunciationHelp() {
    const pronunciationElements = document.querySelectorAll('[data-pronunciation]');

    pronunciationElements.forEach(element => {
      const { pronunciation } = element.dataset;
      const help = document.createElement('span');
      help.className = 'pronunciation-help';
      help.textContent = ` (${pronunciation})`;
      help.setAttribute('aria-label', `Pronounced: ${pronunciation}`);

      element.appendChild(help);
    });
  }

  /**
   * Reduce cognitive load
   */
  reduceCognitiveLoad() {
    // Simplify navigation
    this.simplifyNavigation();

    // Reduce visual clutter
    this.reduceVisualClutter();

    // Add error prevention
    if (this.userPreferences.errorPrevention) {
      this.addErrorPrevention();
    }

    // Add confirmation dialogs
    if (this.userPreferences.confirmationDialogs) {
      this.addConfirmationDialogs();
    }
  }

  /**
   * Simplify navigation
   */
  simplifyNavigation() {
    // Hide complex navigation elements
    const complexNav = document.querySelectorAll('.complex-nav, .advanced-nav');
    complexNav.forEach(nav => {
      nav.style.display = 'none';
    });

    // Show simplified navigation
    const simpleNav = document.querySelectorAll('.simple-nav, .basic-nav');
    simpleNav.forEach(nav => {
      nav.style.display = 'block';
    });
  }

  /**
   * Reduce visual clutter
   */
  reduceVisualClutter() {
    // Hide decorative elements
    const decorativeElements = document.querySelectorAll('.decorative, .ornament');
    decorativeElements.forEach(element => {
      element.style.display = 'none';
    });

    // Simplify colors
    const style = document.createElement('style');
    style.textContent = `
            .cognitive-accessibility-enabled {
                --color-primary: #0066cc !important;
                --color-secondary: #666666 !important;
                --color-accent: #ff6b35 !important;
            }
        `;
    document.head.appendChild(style);
  }

  /**
   * Add error prevention
   */
  addErrorPrevention() {
    // Add confirmation for destructive actions
    const destructiveButtons = document.querySelectorAll('[data-destructive]');
    destructiveButtons.forEach(button => {
      button.addEventListener('click', e => {
        if (!confirm('Are you sure you want to perform this action?')) {
          e.preventDefault();
        }
      });
    });
  }

  /**
   * Add confirmation dialogs
   */
  addConfirmationDialogs() {
    // Add confirmation for important actions
    const importantButtons = document.querySelectorAll('[data-important]');
    importantButtons.forEach(button => {
      button.addEventListener('click', e => {
        if (!confirm('Please confirm this action.')) {
          e.preventDefault();
        }
      });
    });
  }

  /**
   * Handle form focus
   */
  handleFormFocus(event) {
    if (!this.isActive) {
      return;
    }

    const field = event.target;

    // Add helpful hints
    if (field.dataset.help) {
      this.showFieldHelp(field);
    }

    // Add validation hints
    if (field.dataset.validation) {
      this.showValidationHint(field);
    }
  }

  /**
   * Handle form blur
   */
  handleFormBlur(event) {
    if (!this.isActive) {
      return;
    }

    const field = event.target;

    // Hide help
    this.hideFieldHelp(field);
  }

  /**
   * Handle form error
   */
  handleFormError(event) {
    if (!this.isActive) {
      return;
    }

    const field = event.target;

    // Show error help
    this.showErrorHelp(field);
  }

  /**
   * Show field help
   * @param {HTMLElement} field - Form field
   */
  showFieldHelp(field) {
    const { help } = field.dataset;
    if (!help) {
      return;
    }

    const helpElement = document.createElement('div');
    helpElement.className = 'field-help';
    helpElement.textContent = help;

    field.parentNode.appendChild(helpElement);
  }

  /**
   * Hide field help
   * @param {HTMLElement} field - Form field
   */
  hideFieldHelp(field) {
    const helpElement = field.parentNode.querySelector('.field-help');
    if (helpElement) {
      helpElement.remove();
    }
  }

  /**
   * Show validation hint
   * @param {HTMLElement} field - Form field
   */
  showValidationHint(field) {
    const { validation } = field.dataset;
    if (!validation) {
      return;
    }

    const hintElement = document.createElement('div');
    hintElement.className = 'validation-hint';
    hintElement.textContent = validation;

    field.parentNode.appendChild(hintElement);
  }

  /**
   * Show error help
   * @param {HTMLElement} field - Form field
   */
  showErrorHelp(field) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-help';
    errorElement.textContent = 'Please check your input and try again.';

    field.parentNode.appendChild(errorElement);
  }

  /**
   * Remove cognitive enhancements
   */
  removeCognitiveEnhancements() {
    // Remove all cognitive enhancement elements
    const enhancements = document.querySelectorAll('[data-cognitive-processed]');
    enhancements.forEach(element => {
      element.removeAttribute('data-cognitive-processed');
    });

    // Remove cognitive styles
    const cognitiveStyles = document.querySelectorAll('style[data-cognitive]');
    cognitiveStyles.forEach(style => {
      style.remove();
    });
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
    if (this.isActive) {
      this.processContent();
    }
  }

  /**
   * Load user preferences
   */
  loadUserPreferences() {
    try {
      const saved = localStorage.getItem('cognitive-accessibility-preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.userPreferences = { ...this.userPreferences, ...preferences };
        this.applyPreferences();
      }
    } catch (error) {
      this.logger.debug('Could not load cognitive accessibility preferences:', error);
    }
  }

  /**
   * Save user preferences
   */
  saveUserPreferences() {
    try {
      localStorage.setItem(
        'cognitive-accessibility-preferences',
        JSON.stringify(this.userPreferences)
      );
    } catch (error) {
      this.logger.debug('Could not save cognitive accessibility preferences:', error);
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
   * Check if cognitive accessibility is active
   * @returns {boolean} Whether cognitive accessibility is active
   */
  isCognitiveAccessibilityActive() {
    return this.isActive;
  }
}

// Create global instance
window.CognitiveAccessibilityManager = new CognitiveAccessibilityManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CognitiveAccessibilityManager;
}
