/**
 * SportSelection - Sport selection component for onboarding
 * Handles sport-specific onboarding flow
 */
class SportSelection {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.selectedSport = null;
    this.sports = this.initializeSports();
  }

  /**
   * Initialize available sports
   * @returns {Array} Sports configuration
   */
  initializeSports() {
    return [
      {
        id: 'soccer',
        name: 'Soccer/Football',
        icon: '⚽',
        description: 'Beautiful game training',
        color: '#22c55e',
        positions: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
        disciplines: ['Field Player', 'Goalkeeper'],
      },
      {
        id: 'basketball',
        name: 'Basketball',
        icon: '🏀',
        description: 'Court performance training',
        color: '#f59e0b',
        positions: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
        disciplines: ['Guard', 'Forward', 'Center'],
      },
      {
        id: 'running',
        name: 'Running',
        icon: '🏃‍♂️',
        description: 'Endurance and speed training',
        color: '#3b82f6',
        positions: ['Sprint', 'Middle Distance', 'Long Distance', 'Marathon'],
        disciplines: ['Track', 'Road', 'Trail', 'Ultra'],
      },
      {
        id: 'general',
        name: 'General Fitness',
        icon: '💪',
        description: 'Overall health and strength',
        color: '#8b5cf6',
        positions: ['Strength', 'Cardio', 'Flexibility', 'Balance'],
        disciplines: ['Weight Training', 'Cardio', 'Yoga', 'Pilates'],
      },
    ];
  }

  /**
   * Render sport selection component
   * @returns {string} HTML content
   */
  render() {
    return `
            <div class="onboarding-step sport-selection">
                <div class="step-header">
                    <h1>What's Your Sport?</h1>
                    <p>Choose your primary sport to get personalized training</p>
                </div>
                
                <div class="sports-grid">
                    ${this.sports.map(sport => this.renderSportCard(sport)).join('')}
                </div>
                
                <div class="step-actions">
                    <button class="btn-secondary" onclick="onboardingManager.previousStep()">
                        Back
                    </button>
                    <button 
                        class="btn-primary" 
                        id="continue-btn"
                        onclick="onboardingManager.nextStep()"
                        disabled
                    >
                        Continue
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Render individual sport card
   * @param {Object} sport - Sport configuration
   * @returns {string} Sport card HTML
   */
  renderSportCard(sport) {
    return `
            <div 
                class="sport-card" 
                data-sport="${sport.id}"
                onclick="sportSelection.selectSport('${sport.id}')"
            >
                <div class="sport-icon" style="color: ${sport.color}">
                    ${sport.icon}
                </div>
                <div class="sport-info">
                    <h3>${sport.name}</h3>
                    <p>${sport.description}</p>
                </div>
                <div class="sport-check">
                    <div class="check-icon">✓</div>
                </div>
            </div>
        `;
  }

  /**
   * Select sport
   * @param {string} sportId - Sport ID
   */
  selectSport(sportId) {
    this.selectedSport = sportId;

    // Update visual state
    document.querySelectorAll('.sport-card').forEach(card => {
      card.classList.remove('selected');
    });

    const selectedCard = document.querySelector(`[data-sport="${sportId}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
    }

    // Enable continue button
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
      continueBtn.disabled = false;
    }

    // Store selection
    this.storeSelection();

    this.logger.debug('Sport selected:', sportId);
  }

  /**
   * Store sport selection
   */
  storeSelection() {
    if (this.selectedSport) {
      const sportData = this.sports.find(s => s.id === this.selectedSport);

      // Store in onboarding data
      if (window.OnboardingManager) {
        window.OnboardingManager.setData('sport', {
          id: this.selectedSport,
          name: sportData.name,
          icon: sportData.icon,
          color: sportData.color,
          positions: sportData.positions,
          disciplines: sportData.disciplines,
        });
      }
    }
  }

  /**
   * Get selected sport
   * @returns {Object|null} Selected sport data
   */
  getSelectedSport() {
    if (!this.selectedSport) {
      return null;
    }
    return this.sports.find(s => s.id === this.selectedSport);
  }

  /**
   * Initialize component
   */
  init() {
    // Add event listeners for keyboard navigation
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && document.activeElement.classList.contains('sport-card')) {
        const sportId = document.activeElement.dataset.sport;
        if (sportId) {
          this.selectSport(sportId);
        }
      }
    });
  }
}

/**
 * PositionSelection - Position/focus selection component
 * Handles position-specific selection based on sport
 */
class PositionSelection {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.selectedPosition = null;
    this.selectedDiscipline = null;
  }

  /**
   * Render position selection component
   * @returns {string} HTML content
   */
  render() {
    const sportData = window.OnboardingManager?.getData('sport');
    if (!sportData) {
      return '<div class="error">No sport selected</div>';
    }

    return `
            <div class="onboarding-step position-selection">
                <div class="step-header">
                    <h1>What's Your Position/Focus?</h1>
                    <p>Choose your ${sportData.name.toLowerCase()} position or training focus</p>
                </div>
                
                <div class="position-section">
                    <h3>Primary Position</h3>
                    <div class="positions-grid">
                        ${sportData.positions.map(position => this.renderPositionCard(position)).join('')}
                    </div>
                </div>
                
                ${
                  sportData.disciplines
                    ? `
                    <div class="discipline-section">
                        <h3>Training Discipline</h3>
                        <div class="disciplines-grid">
                            ${sportData.disciplines.map(discipline => this.renderDisciplineCard(discipline)).join('')}
                        </div>
                    </div>
                `
                    : ''
                }
                
                <div class="step-actions">
                    <button class="btn-secondary" onclick="onboardingManager.previousStep()">
                        Back
                    </button>
                    <button 
                        class="btn-primary" 
                        id="continue-btn"
                        onclick="onboardingManager.nextStep()"
                        disabled
                    >
                        Continue
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Render position card
   * @param {string} position - Position name
   * @returns {string} Position card HTML
   */
  renderPositionCard(position) {
    return `
            <div 
                class="position-card" 
                data-position="${position}"
                onclick="positionSelection.selectPosition('${position}')"
            >
                <div class="position-name">${position}</div>
                <div class="position-check">
                    <div class="check-icon">✓</div>
                </div>
            </div>
        `;
  }

  /**
   * Render discipline card
   * @param {string} discipline - Discipline name
   * @returns {string} Discipline card HTML
   */
  renderDisciplineCard(discipline) {
    return `
            <div 
                class="discipline-card" 
                data-discipline="${discipline}"
                onclick="positionSelection.selectDiscipline('${discipline}')"
            >
                <div class="discipline-name">${discipline}</div>
                <div class="discipline-check">
                    <div class="check-icon">✓</div>
                </div>
            </div>
        `;
  }

  /**
   * Select position
   * @param {string} position - Position name
   */
  selectPosition(position) {
    this.selectedPosition = position;

    // Update visual state
    document.querySelectorAll('.position-card').forEach(card => {
      card.classList.remove('selected');
    });

    const selectedCard = document.querySelector(`[data-position="${position}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
    }

    this.checkCanContinue();
    this.storeSelection();

    this.logger.debug('Position selected:', position);
  }

  /**
   * Select discipline
   * @param {string} discipline - Discipline name
   */
  selectDiscipline(discipline) {
    this.selectedDiscipline = discipline;

    // Update visual state
    document.querySelectorAll('.discipline-card').forEach(card => {
      card.classList.remove('selected');
    });

    const selectedCard = document.querySelector(`[data-discipline="${discipline}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
    }

    this.checkCanContinue();
    this.storeSelection();

    this.logger.debug('Discipline selected:', discipline);
  }

  /**
   * Check if can continue
   */
  checkCanContinue() {
    const continueBtn = document.getElementById('continue-btn');
    if (!continueBtn) {
      return;
    }

    const sportData = window.OnboardingManager?.getData('sport');
    const canContinue =
      this.selectedPosition && (!sportData.disciplines || this.selectedDiscipline);

    continueBtn.disabled = !canContinue;
  }

  /**
   * Store selection
   */
  storeSelection() {
    if (window.OnboardingManager) {
      window.OnboardingManager.setData('position', {
        position: this.selectedPosition,
        discipline: this.selectedDiscipline,
      });
    }
  }

  /**
   * Initialize component
   */
  init() {
    // Focus first position card for keyboard navigation
    setTimeout(() => {
      const firstCard = document.querySelector('.position-card');
      if (firstCard) {
        firstCard.focus();
      }
    }, 100);
  }
}

/**
 * ProfileSetup - Profile setup component
 * Handles user profile information collection
 */
class ProfileSetup {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.formData = {};
  }

  /**
   * Render profile setup component
   * @returns {string} HTML content
   */
  render() {
    return `
            <div class="onboarding-step profile-setup">
                <div class="step-header">
                    <h1>Tell Us About Yourself</h1>
                    <p>Help us personalize your training experience</p>
                </div>
                
                <form class="profile-form" onsubmit="profileSetup.handleSubmit(event)">
                    <div class="form-group">
                        <label for="age">Age</label>
                        <input 
                            type="number" 
                            id="age" 
                            name="age" 
                            min="13" 
                            max="100" 
                            required
                            placeholder="Enter your age"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="experience">Experience Level</label>
                        <select id="experience" name="experience" required>
                            <option value="">Select your experience level</option>
                            <option value="beginner">Beginner (0-1 years)</option>
                            <option value="intermediate">Intermediate (1-3 years)</option>
                            <option value="advanced">Advanced (3+ years)</option>
                            <option value="elite">Elite/Professional</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="primary-goals">Primary Goals</label>
                        <div class="goals-grid">
                            <label class="goal-option">
                                <input type="checkbox" name="goals" value="strength">
                                <span>Build Strength</span>
                            </label>
                            <label class="goal-option">
                                <input type="checkbox" name="goals" value="endurance">
                                <span>Improve Endurance</span>
                            </label>
                            <label class="goal-option">
                                <input type="checkbox" name="goals" value="speed">
                                <span>Increase Speed</span>
                            </label>
                            <label class="goal-option">
                                <input type="checkbox" name="goals" value="flexibility">
                                <span>Enhance Flexibility</span>
                            </label>
                            <label class="goal-option">
                                <input type="checkbox" name="goals" value="injury-prevention">
                                <span>Prevent Injuries</span>
                            </label>
                            <label class="goal-option">
                                <input type="checkbox" name="goals" value="performance">
                                <span>Sport Performance</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="injury-history">Injury History</label>
                        <textarea 
                            id="injury-history" 
                            name="injury-history" 
                            placeholder="Describe any previous injuries or areas of concern (optional)"
                            rows="3"
                        ></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="training-frequency">Training Frequency</label>
                        <select id="training-frequency" name="training-frequency" required>
                            <option value="">How often do you train?</option>
                            <option value="2-3">2-3 times per week</option>
                            <option value="4-5">4-5 times per week</option>
                            <option value="6+">6+ times per week</option>
                        </select>
                    </div>
                </form>
                
                <div class="step-actions">
                    <button class="btn-secondary" onclick="onboardingManager.previousStep()">
                        Back
                    </button>
                    <button 
                        class="btn-primary" 
                        onclick="profileSetup.handleSubmit()"
                    >
                        Complete Setup
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Handle form submission
   * @param {Event} event - Form event
   */
  handleSubmit(event) {
    if (event) {
      event.preventDefault();
    }

    const formData = this.collectFormData();

    if (this.validateForm(formData)) {
      this.storeProfileData(formData);
      window.onboardingManager.completeOnboarding();
    } else {
      this.showValidationErrors();
    }
  }

  /**
   * Collect form data
   * @returns {Object} Form data
   */
  collectFormData() {
    const form = document.querySelector('.profile-form');
    const formData = new FormData(form);

    const data = {
      age: parseInt(formData.get('age')),
      experience: formData.get('experience'),
      goals: formData.getAll('goals'),
      injuryHistory: formData.get('injury-history'),
      trainingFrequency: formData.get('training-frequency'),
    };

    return data;
  }

  /**
   * Validate form data
   * @param {Object} data - Form data
   * @returns {boolean} Validation result
   */
  validateForm(data) {
    if (!data.age || data.age < 13 || data.age > 100) {
      return false;
    }

    if (!data.experience) {
      return false;
    }

    if (!data.goals || data.goals.length === 0) {
      return false;
    }

    if (!data.trainingFrequency) {
      return false;
    }

    return true;
  }

  /**
   * Show validation errors
   */
  showValidationErrors() {
    // Simple validation feedback
    // eslint-disable-next-line no-alert
    alert('Please fill in all required fields');
  }

  /**
   * Store profile data
   * @param {Object} data - Profile data
   */
  storeProfileData(data) {
    if (window.OnboardingManager) {
      window.OnboardingManager.setData('profile', data);
    }

    this.logger.debug('Profile data stored:', data);
  }

  /**
   * Initialize component
   */
  init() {
    // Focus first input
    setTimeout(() => {
      const firstInput = document.querySelector('#age');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
  }
}

// Create global instances
window.SportSelection = new SportSelection();
window.PositionSelection = new PositionSelection();
window.ProfileSetup = new ProfileSetup();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SportSelection, PositionSelection, ProfileSetup };
}
