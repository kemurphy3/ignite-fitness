/**
 * Minimal Onboarding Flow
 * Collects essential data: sport focus, equipment, time windows, injuries
 */

class MinimalOnboarding {
  constructor() {
    this.currentStep = 0;
    this.onboardingData = {
      sport_focus: null,
      secondary_sports: [],
      equipment_access: [],
      time_windows: {},
      injury_flags: [],
      weekly_minutes: {},
      training_level: 'intermediate',
    };

    this.steps = ['sport_focus', 'equipment_access', 'time_windows', 'injury_flags', 'completion'];

    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.authManager = window.AuthManager;
  }

  /**
   * Initialize onboarding flow
   */
  async initialize() {
    try {
      // Check if user already completed onboarding
      const existingProfile = await this.loadExistingProfile();
      if (existingProfile && existingProfile.onboarding_completed) {
        this.logger.info('User already completed onboarding');
        return { completed: true, profile: existingProfile };
      }

      this.render();
      return { completed: false };
    } catch (error) {
      this.logger.error('Onboarding initialization failed:', error);
      throw error;
    }
  }

  /**
   * Render current onboarding step
   */
  render() {
    const container = this.getContainer();
    const stepName = this.steps[this.currentStep];

    container.innerHTML = `
            <div class="minimal-onboarding">
                <div class="onboarding-header">
                    <div class="progress-indicator">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(this.currentStep / (this.steps.length - 1)) * 100}%"></div>
                        </div>
                        <span class="step-counter">Step ${this.currentStep + 1} of ${this.steps.length}</span>
                    </div>
                </div>

                <div class="onboarding-content">
                    ${this.renderStep(stepName)}
                </div>

                <div class="onboarding-actions">
                    ${this.currentStep > 0 ? '<button class="btn-secondary" onclick="window.minimalOnboarding.previousStep()">Back</button>' : ''}
                    ${
                      this.currentStep < this.steps.length - 1
                        ? '<button class="btn-primary" onclick="window.minimalOnboarding.nextStep()" id="next-btn">Next</button>'
                        : '<button class="btn-primary" onclick="window.minimalOnboarding.completeOnboarding()" id="complete-btn">Get Started</button>'
                    }
                </div>
            </div>
        `;

    // Store reference for onclick handlers
    window.minimalOnboarding = this;
    this.attachStepEventListeners(stepName);
  }

  /**
   * Render specific onboarding step
   */
  renderStep(stepName) {
    switch (stepName) {
      case 'sport_focus':
        return this.renderSportFocusStep();
      case 'equipment_access':
        return this.renderEquipmentStep();
      case 'time_windows':
        return this.renderTimeWindowsStep();
      case 'injury_flags':
        return this.renderInjuryFlagsStep();
      case 'completion':
        return this.renderCompletionStep();
      default:
        return '<div>Unknown step</div>';
    }
  }

  /**
   * Render sport focus selection step
   */
  renderSportFocusStep() {
    return `
            <div class="step-content sport-focus-step">
                <h2>What's your primary training focus?</h2>
                <p>This helps us suggest the right workouts and substitutions</p>

                <div class="sport-options">
                    <div class="sport-card ${this.onboardingData.sport_focus === 'running' ? 'selected' : ''}"
                         onclick="window.minimalOnboarding.selectSport('running')">
                        <div class="sport-icon">🏃‍♂️</div>
                        <h3>Running</h3>
                        <p>Road, track, trail running</p>
                    </div>

                    <div class="sport-card ${this.onboardingData.sport_focus === 'cycling' ? 'selected' : ''}"
                         onclick="window.minimalOnboarding.selectSport('cycling')">
                        <div class="sport-icon">🚴‍♂️</div>
                        <h3>Cycling</h3>
                        <p>Road, indoor, mountain biking</p>
                    </div>

                    <div class="sport-card ${this.onboardingData.sport_focus === 'swimming' ? 'selected' : ''}"
                         onclick="window.minimalOnboarding.selectSport('swimming')">
                        <div class="sport-icon">🏊‍♂️</div>
                        <h3>Swimming</h3>
                        <p>Pool and open water</p>
                    </div>

                    <div class="sport-card ${this.onboardingData.sport_focus === 'multi_sport' ? 'selected' : ''}"
                         onclick="window.minimalOnboarding.selectSport('multi_sport')">
                        <div class="sport-icon">🏆</div>
                        <h3>Multi-Sport</h3>
                        <p>Triathlon, cross-training</p>
                    </div>
                </div>

                <div class="secondary-sports" style="display: ${this.onboardingData.sport_focus ? 'block' : 'none'}">
                    <h3>Secondary Activities (optional)</h3>
                    <div class="secondary-checkboxes">
                        <label><input type="checkbox" value="strength" onchange="window.minimalOnboarding.toggleSecondarySport(this)"> Strength Training</label>
                        <label><input type="checkbox" value="yoga" onchange="window.minimalOnboarding.toggleSecondarySport(this)"> Yoga/Flexibility</label>
                        <label><input type="checkbox" value="soccer" onchange="window.minimalOnboarding.toggleSecondarySport(this)"> Soccer/Football</label>
                        <label><input type="checkbox" value="basketball" onchange="window.minimalOnboarding.toggleSecondarySport(this)"> Basketball</label>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Render equipment access step
   */
  renderEquipmentStep() {
    const equipmentChecked = equipment => {
      return this.onboardingData.equipment_access.includes(equipment) ? 'checked' : '';
    };

    return `
            <div class="step-content equipment-step">
                <h2>What equipment do you have access to?</h2>
                <p>We'll only suggest workouts you can actually do</p>

                <div class="equipment-categories">
                    <div class="equipment-category">
                        <h3>🏃‍♂️ Running</h3>
                        <div class="equipment-options">
                            <label><input type="checkbox" value="outdoor_roads" ${equipmentChecked('outdoor_roads')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Roads/paths</label>
                            <label><input type="checkbox" value="track" ${equipmentChecked('track')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Athletic track</label>
                            <label><input type="checkbox" value="trails" ${equipmentChecked('trails')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Trails</label>
                            <label><input type="checkbox" value="hills" ${equipmentChecked('hills')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Hills</label>
                            <label><input type="checkbox" value="treadmill" ${equipmentChecked('treadmill')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Treadmill</label>
                        </div>
                    </div>

                    <div class="equipment-category">
                        <h3>🚴‍♂️ Cycling</h3>
                        <div class="equipment-options">
                            <label><input type="checkbox" value="road_bike" ${equipmentChecked('road_bike')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Road bike</label>
                            <label><input type="checkbox" value="indoor_trainer" ${equipmentChecked('indoor_trainer')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Indoor trainer</label>
                            <label><input type="checkbox" value="mountain_bike" ${equipmentChecked('mountain_bike')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Mountain bike</label>
                            <label><input type="checkbox" value="safe_roads" ${equipmentChecked('safe_roads')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Safe cycling roads</label>
                        </div>
                    </div>

                    <div class="equipment-category">
                        <h3>🏊‍♂️ Swimming</h3>
                        <div class="equipment-options">
                            <label><input type="checkbox" value="pool" ${equipmentChecked('pool')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Swimming pool</label>
                            <label><input type="checkbox" value="open_water" ${equipmentChecked('open_water')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Open water</label>
                            <label><input type="checkbox" value="lane_swimming" ${equipmentChecked('lane_swimming')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Lap lanes</label>
                        </div>
                    </div>

                    <div class="equipment-category">
                        <h3>💪 Strength</h3>
                        <div class="equipment-options">
                            <label><input type="checkbox" value="gym" ${equipmentChecked('gym')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Gym access</label>
                            <label><input type="checkbox" value="home_weights" ${equipmentChecked('home_weights')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Home weights</label>
                            <label><input type="checkbox" value="bodyweight_space" ${equipmentChecked('bodyweight_space')} onchange="window.minimalOnboarding.toggleEquipment(this)"> Bodyweight space</label>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Render time windows step
   */
  renderTimeWindowsStep() {
    const timeChecked = timeSlot => {
      return this.onboardingData.time_windows.preferred_times?.includes(timeSlot) ? 'checked' : '';
    };

    const durationChecked = duration => {
      return this.onboardingData.time_windows.typical_duration == duration ? 'checked' : '';
    };

    const daysSelected = days => {
      return this.onboardingData.time_windows.days_per_week === days ? 'selected' : '';
    };

    return `
            <div class="step-content time-windows-step">
                <h2>When do you typically train?</h2>
                <p>This helps us plan realistic workout schedules</p>

                <div class="time-preferences">
                    <div class="time-group">
                        <h3>Preferred Times</h3>
                        <div class="time-slots">
                            <label><input type="checkbox" value="early_morning" ${timeChecked('early_morning')} onchange="window.minimalOnboarding.toggleTimeSlot(this)"> Early Morning (5-7 AM)</label>
                            <label><input type="checkbox" value="morning" ${timeChecked('morning')} onchange="window.minimalOnboarding.toggleTimeSlot(this)"> Morning (7-10 AM)</label>
                            <label><input type="checkbox" value="midday" ${timeChecked('midday')} onchange="window.minimalOnboarding.toggleTimeSlot(this)"> Midday (10 AM-2 PM)</label>
                            <label><input type="checkbox" value="afternoon" ${timeChecked('afternoon')} onchange="window.minimalOnboarding.toggleTimeSlot(this)"> Afternoon (2-6 PM)</label>
                            <label><input type="checkbox" value="evening" ${timeChecked('evening')} onchange="window.minimalOnboarding.toggleTimeSlot(this)"> Evening (6-9 PM)</label>
                        </div>
                    </div>

                    <div class="time-group">
                        <h3>Typical Workout Duration</h3>
                        <div class="duration-options">
                            <label><input type="radio" name="typical_duration" value="30" ${durationChecked(30)} onchange="window.minimalOnboarding.setDuration('30')"> 30 minutes or less</label>
                            <label><input type="radio" name="typical_duration" value="45" ${durationChecked(45)} onchange="window.minimalOnboarding.setDuration('45')"> 30-45 minutes</label>
                            <label><input type="radio" name="typical_duration" value="60" ${durationChecked(60) || !this.onboardingData.time_windows.typical_duration ? 'checked' : ''} onchange="window.minimalOnboarding.setDuration('60')"> 45-60 minutes</label>
                            <label><input type="radio" name="typical_duration" value="90" ${durationChecked(90)} onchange="window.minimalOnboarding.setDuration('90')"> 60-90 minutes</label>
                            <label><input type="radio" name="typical_duration" value="120" ${durationChecked(120)} onchange="window.minimalOnboarding.setDuration('120')"> 90+ minutes</label>
                        </div>
                    </div>

                    <div class="time-group">
                        <h3>Training Days per Week</h3>
                        <div class="days-selector">
                            <button type="button" class="days-btn ${daysSelected(3)}" onclick="window.minimalOnboarding.setTrainingDays(3)">3 days</button>
                            <button type="button" class="days-btn ${daysSelected(4)}" onclick="window.minimalOnboarding.setTrainingDays(4)">4 days</button>
                            <button type="button" class="days-btn ${daysSelected(5)}" onclick="window.minimalOnboarding.setTrainingDays(5)">5 days</button>
                            <button type="button" class="days-btn ${daysSelected(6)}" onclick="window.minimalOnboarding.setTrainingDays(6)">6 days</button>
                            <button type="button" class="days-btn ${daysSelected(7)}" onclick="window.minimalOnboarding.setTrainingDays(7)">Daily</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Render injury flags step
   */
  renderInjuryFlagsStep() {
    const injuryChecked = injury => {
      return this.onboardingData.injury_flags.includes(injury) ? 'checked' : '';
    };

    return `
            <div class="step-content injury-flags-step">
                <h2>Any current injuries or limitations?</h2>
                <p>We'll modify workouts to keep you safe and healthy</p>

                <div class="injury-options">
                    <div class="no-injuries">
                        <label class="radio-card ${this.onboardingData.injury_flags.length === 0 ? 'selected' : ''}">
                            <input type="radio" name="has_injuries" value="none" onchange="window.minimalOnboarding.setNoInjuries()" ${this.onboardingData.injury_flags.length === 0 ? 'checked' : ''}>
                            <div class="card-content">
                                <span class="icon">✅</span>
                                <span class="text">No current injuries</span>
                            </div>
                        </label>
                    </div>

                    <div class="injury-areas" style="display: ${this.onboardingData.injury_flags.length > 0 ? 'block' : 'none'}">
                        <h3>Select affected areas:</h3>
                        <div class="body-areas">
                            <label><input type="checkbox" value="knee" ${injuryChecked('knee')} onchange="window.minimalOnboarding.toggleInjury(this)"> Knee</label>
                            <label><input type="checkbox" value="ankle" ${injuryChecked('ankle')} onchange="window.minimalOnboarding.toggleInjury(this)"> Ankle</label>
                            <label><input type="checkbox" value="hip" ${injuryChecked('hip')} onchange="window.minimalOnboarding.toggleInjury(this)"> Hip</label>
                            <label><input type="checkbox" value="back" ${injuryChecked('back')} onchange="window.minimalOnboarding.toggleInjury(this)"> Lower back</label>
                            <label><input type="checkbox" value="shoulder" ${injuryChecked('shoulder')} onchange="window.minimalOnboarding.toggleInjury(this)"> Shoulder</label>
                            <label><input type="checkbox" value="wrist" ${injuryChecked('wrist')} onchange="window.minimalOnboarding.toggleInjury(this)"> Wrist</label>
                            <label><input type="checkbox" value="other" ${injuryChecked('other')} onchange="window.minimalOnboarding.toggleInjury(this)"> Other</label>
                        </div>
                    </div>

                    <div class="has-injuries">
                        <label class="radio-card">
                            <input type="radio" name="has_injuries" value="yes" onchange="window.minimalOnboarding.showInjuryAreas()">
                            <div class="card-content">
                                <span class="icon">⚠️</span>
                                <span class="text">I have current injuries</span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Render completion step
   */
  renderCompletionStep() {
    return `
            <div class="step-content completion-step">
                <div class="completion-summary">
                    <h2>🎉 You're all set!</h2>
                    <p>Here's what we've set up for you:</p>

                    <div class="summary-cards">
                        <div class="summary-card">
                            <h3>🎯 Primary Focus</h3>
                            <p>${this.formatSportFocus(this.onboardingData.sport_focus)}</p>
                        </div>

                        <div class="summary-card">
                            <h3>⚡ Equipment</h3>
                            <p>${this.onboardingData.equipment_access.length} items available</p>
                        </div>

                        <div class="summary-card">
                            <h3>⏰ Schedule</h3>
                            <p>${this.onboardingData.time_windows.days_per_week || 4} days/week, ${this.onboardingData.time_windows.typical_duration || 60}min sessions</p>
                        </div>

                        <div class="summary-card">
                            <h3>🛡️ Safety</h3>
                            <p>${this.onboardingData.injury_flags.length === 0 ? 'No current limitations' : `${this.onboardingData.injury_flags.length} area(s) to accommodate`}</p>
                        </div>
                    </div>

                    <div class="next-steps">
                        <h3>What's next?</h3>
                        <ul>
                            <li>✅ View your personalized workout plan</li>
                            <li>✅ Get AI-powered workout substitutions</li>
                            <li>✅ Track your training load and progress</li>
                            <li>✅ Receive safety recommendations</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
  }

  // Event handlers
  selectSport(sport) {
    this.onboardingData.sport_focus = sport;
    this.render();
  }

  toggleSecondarySport(checkbox) {
    const sport = checkbox.value;
    if (checkbox.checked) {
      if (!this.onboardingData.secondary_sports.includes(sport)) {
        this.onboardingData.secondary_sports.push(sport);
      }
    } else {
      this.onboardingData.secondary_sports = this.onboardingData.secondary_sports.filter(
        s => s !== sport
      );
    }
  }

  toggleEquipment(checkbox) {
    const equipment = checkbox.value;
    if (checkbox.checked) {
      if (!this.onboardingData.equipment_access.includes(equipment)) {
        this.onboardingData.equipment_access.push(equipment);
      }
    } else {
      this.onboardingData.equipment_access = this.onboardingData.equipment_access.filter(
        e => e !== equipment
      );
    }
  }

  toggleTimeSlot(checkbox) {
    const timeSlot = checkbox.value;
    if (!this.onboardingData.time_windows.preferred_times) {
      this.onboardingData.time_windows.preferred_times = [];
    }

    if (checkbox.checked) {
      if (!this.onboardingData.time_windows.preferred_times.includes(timeSlot)) {
        this.onboardingData.time_windows.preferred_times.push(timeSlot);
      }
    } else {
      this.onboardingData.time_windows.preferred_times =
        this.onboardingData.time_windows.preferred_times.filter(t => t !== timeSlot);
    }
  }

  setDuration(duration) {
    this.onboardingData.time_windows.typical_duration = parseInt(duration);
  }

  setTrainingDays(days) {
    this.onboardingData.time_windows.days_per_week = days;
    this.render();
  }

  setNoInjuries() {
    this.onboardingData.injury_flags = [];
    this.render();
  }

  showInjuryAreas() {
    // Will show injury selection in the render
    this.render();
  }

  toggleInjury(checkbox) {
    const injury = checkbox.value;
    if (checkbox.checked) {
      if (!this.onboardingData.injury_flags.includes(injury)) {
        this.onboardingData.injury_flags.push(injury);
      }
    } else {
      this.onboardingData.injury_flags = this.onboardingData.injury_flags.filter(i => i !== injury);
    }
  }

  // Navigation
  nextStep() {
    if (this.validateCurrentStep()) {
      this.currentStep++;
      this.render();
    }
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.render();
    }
  }

  /**
   * Complete onboarding and save profile
   */
  async completeOnboarding() {
    try {
      const profile = await this.saveOnboardingData();

      // Trigger completion event
      if (window.EventBus) {
        window.EventBus.emit('onboarding:completed', { profile });
      }

      // Navigate to main app
      this.navigateToMainApp();

      return profile;
    } catch (error) {
      this.logger.error('Failed to complete onboarding:', error);
      this.showError('Failed to save your profile. Please try again.');
    }
  }

  /**
   * Validate current step has required data
   */
  validateCurrentStep() {
    const stepName = this.steps[this.currentStep];

    switch (stepName) {
      case 'sport_focus':
        if (!this.onboardingData.sport_focus) {
          this.showError('Please select your primary training focus');
          return false;
        }
        break;
      case 'equipment_access':
        if (this.onboardingData.equipment_access.length === 0) {
          this.showError('Please select at least one equipment option');
          return false;
        }
        break;
      case 'time_windows':
        if (!this.onboardingData.time_windows.typical_duration) {
          this.onboardingData.time_windows.typical_duration = 60; // Default
        }
        if (!this.onboardingData.time_windows.days_per_week) {
          this.onboardingData.time_windows.days_per_week = 4; // Default
        }
        break;
    }

    return true;
  }

  /**
   * Save onboarding data to storage and database
   */
  async saveOnboardingData() {
    const userId =
      this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername() || 'anonymous';

    const profile = {
      user_id: userId,
      sport_focus: this.onboardingData.sport_focus,
      secondary_sports: this.onboardingData.secondary_sports,
      equipment_access: this.onboardingData.equipment_access,
      time_windows: this.onboardingData.time_windows,
      injury_flags: this.onboardingData.injury_flags,
      training_level: 'intermediate', // Default
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      profile_version: '1.0',
    };

    // Save to local storage first
    if (this.storageManager) {
      await this.storageManager.setItem('user_profile', profile);
    }

    // Save to database
    try {
      const response = await fetch('/.netlify/functions/users-profile-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authManager?.getToken() || ''}`,
        },
        body: JSON.stringify(profile),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile to database');
      }

      this.logger.info('Onboarding profile saved successfully');
      return profile;
    } catch (error) {
      this.logger.warn('Database save failed, using local storage only:', error);
      return profile;
    }
  }

  /**
   * Load existing profile if available
   */
  async loadExistingProfile() {
    try {
      // Try local storage first
      if (this.storageManager) {
        const localProfile = await this.storageManager.getItem('user_profile');
        if (localProfile && localProfile.onboarding_completed) {
          return localProfile;
        }
      }

      // Try database
      const response = await fetch('/.netlify/functions/users-profile-get', {
        headers: {
          Authorization: `Bearer ${this.authManager?.getToken() || ''}`,
        },
      });

      if (response.ok) {
        const profile = await response.json();
        if (profile.onboarding_completed) {
          return profile;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load existing profile:', error);
    }

    return null;
  }

  // Utility methods
  formatSportFocus(sport) {
    const sportNames = {
      running: 'Running',
      cycling: 'Cycling',
      swimming: 'Swimming',
      multi_sport: 'Multi-Sport',
    };
    return sportNames[sport] || sport;
  }

  getContainer() {
    let container = document.getElementById('onboarding-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'onboarding-container';
      container.className = 'modal-overlay';
      document.body.appendChild(container);
    }
    return container;
  }

  navigateToMainApp() {
    // Hide onboarding
    const container = this.getContainer();
    container.style.display = 'none';

    // Show main app (trigger app initialization)
    if (window.app && window.app.initializeMainApp) {
      window.app.initializeMainApp();
    } else if (window.Router) {
      window.Router.navigate('#/dashboard');
    }
  }

  showError(message) {
    // Simple error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'onboarding-error';
    errorDiv.textContent = message;
    errorDiv.style.cssText =
      'color: red; padding: 10px; margin: 10px 0; border: 1px solid red; border-radius: 4px;';

    const content = document.querySelector('.onboarding-content');
    if (content) {
      content.insertBefore(errorDiv, content.firstChild);
      setTimeout(() => errorDiv.remove(), 5000);
    }
  }

  attachStepEventListeners(stepName) {
    // Additional event listeners can be attached here for specific steps
  }
}

export default MinimalOnboarding;
