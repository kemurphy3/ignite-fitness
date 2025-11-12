/**
 * OnboardingManager - Handles user onboarding questionnaire and preferences
 * Manages onboarding flow, preference storage, and role-based access
 * Updated for sport-specific onboarding flow
 */
class OnboardingManager {
  constructor() {
    this.onboardingVersion = 2; // Updated version for sport-specific flow
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.authManager = window.AuthManager;
    this.storageManager = window.StorageManager;

    this.onboardingSteps = this.initializeSteps();
    this.currentStep = 0;
    this.onboardingData = {};
    this.isCompleted = false;
  }

  /**
   * Initialize onboarding steps
   * Enhanced for multi-sport beta requirements
   * @returns {Array} Onboarding steps
   */
  initializeSteps() {
    return [
      {
        id: 'sport_selection',
        title: 'Primary Sport Focus',
        component: 'SportSelection',
        description: 'Choose your main training focus',
        required: true,
        skippable: false,
      },
      {
        id: 'secondary_sports',
        title: 'Secondary Activities',
        component: 'SecondarySports',
        description: 'Cross-training and seasonal activities',
        required: false,
        skippable: true,
      },
      {
        id: 'current_volume',
        title: 'Current Training Volume',
        component: 'CurrentVolume',
        description: 'Weekly training minutes by activity',
        required: true,
        skippable: false,
      },
      {
        id: 'recent_efforts',
        title: 'Recent Best Efforts',
        component: 'RecentEfforts',
        description: 'Help us estimate your zones',
        required: false,
        skippable: true,
      },
      {
        id: 'equipment_access',
        title: 'Equipment & Access',
        component: 'EquipmentAccess',
        description: 'Available training facilities',
        required: true,
        skippable: false,
      },
      {
        id: 'injury_history',
        title: 'Injury Flags',
        component: 'InjuryHistory',
        description: 'Current limitations and past issues',
        required: false,
        skippable: true,
      },
      {
        id: 'time_windows',
        title: 'Schedule Preferences',
        component: 'TimeWindows',
        description: 'When and how long you can train',
        required: true,
        skippable: false,
      },
      {
        id: 'review_complete',
        title: 'Review & Launch',
        component: 'ReviewComplete',
        description: 'Confirm your profile and start training',
        required: true,
        skippable: false,
      },
    ];
  }

  /**
   * Check if user needs onboarding
   * @returns {boolean} Needs onboarding
   */
  needsOnboarding() {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) {
        return false;
      }

      // Check if user has completed onboarding
      const preferences = user.preferences || {};
      const onboardingVersion = preferences.onboarding_version || 0;

      return onboardingVersion < this.onboardingVersion;
    } catch (error) {
      this.logger.error('Failed to check onboarding status', error);
      return true; // Default to showing onboarding if check fails
    }
  }

  /**
   * Start onboarding process
   * @param {string} userId - User ID
   */
  startOnboarding(userId) {
    this.currentStep = 0;
    this.onboardingData = {};
    this.isCompleted = false;
    this.logger.audit('ONBOARDING_STARTED', { userId, version: this.onboardingVersion });

    // Navigate to onboarding route
    if (window.Router) {
      window.Router.navigate('#/onboarding');
    } else {
      this.showOnboardingUI();
    }
  }

  /**
   * Render onboarding step
   * @returns {string} Onboarding HTML
   */
  render() {
    if (this.isCompleted) {
      return this.renderCompletion();
    }

    const step = this.onboardingSteps[this.currentStep];
    if (!step) {
      this.logger.error('Invalid onboarding step:', this.currentStep);
      return this.renderError();
    }

    const progress = this.getProgress();
    const timeEstimate = this.getTimeEstimate();

    return `
            <div class="onboarding-container">
                <div class="onboarding-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress.progress}%"></div>
                    </div>
                    <div class="progress-text">
                        Step ${progress.currentStep + 1} of ${progress.totalSteps} • ${timeEstimate}
                    </div>
                </div>
                
                <div class="onboarding-content">
                    ${this.renderStepComponent(step)}
                </div>
            </div>
        `;
  }

  /**
   * Render step component
   * @param {Object} step - Step configuration
   * @returns {string} Component HTML
   */
  renderStepComponent(step) {
    switch (step.component) {
      case 'SportSelection':
        return window.SportSelection
          ? new window.SportSelection().render(this.onboardingData)
          : this.renderFallback(step);
      case 'SecondarySports':
        return window.SecondarySports
          ? new window.SecondarySports().render(this.onboardingData)
          : this.renderFallback(step);
      case 'CurrentVolume':
        return window.CurrentVolume
          ? new window.CurrentVolume().render(this.onboardingData)
          : this.renderFallback(step);
      case 'RecentEfforts':
        return window.RecentEfforts
          ? new window.RecentEfforts().render(this.onboardingData)
          : this.renderFallback(step);
      case 'EquipmentAccess':
        return window.EquipmentAccess
          ? new window.EquipmentAccess().render(this.onboardingData)
          : this.renderFallback(step);
      case 'InjuryHistory':
        return window.InjuryHistory
          ? new window.InjuryHistory().render(this.onboardingData)
          : this.renderFallback(step);
      case 'TimeWindows':
        return window.TimeWindows
          ? new window.TimeWindows().render(this.onboardingData)
          : this.renderFallback(step);
      case 'ReviewComplete':
        return window.ReviewComplete
          ? new window.ReviewComplete().render(this.onboardingData)
          : this.renderFallback(step);
      // Legacy components (for backwards compatibility)
      case 'Goals':
        if (window.GoalsStep) {
          window.GoalsStep.followUpData = this.onboardingData.goalFollowUps || {};
          return window.GoalsStep.render(this.onboardingData);
        }
        return this.renderFallback(step);
      case 'SportSoccer':
        return window.SportSoccer
          ? new window.SportSoccer().render(this.onboardingData)
          : this.renderFallback(step);
      case 'EquipmentTime':
        return window.EquipmentTime
          ? new window.EquipmentTime().render(this.onboardingData)
          : this.renderFallback(step);
      case 'Preferences':
        return window.Preferences
          ? new window.Preferences().render(this.onboardingData)
          : this.renderFallback(step);
      default:
        return this.renderFallback(step);
    }
  }

  /**
   * Render fallback step
   * @param {Object} step - Step configuration
   * @returns {string} Fallback HTML
   */
  renderFallback(step) {
    return `
            <div class="onboarding-step">
                <div class="step-header">
                    <h1>${step.title}</h1>
                    <p>${step.description}</p>
                </div>
                <div class="step-content">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Setting up ${step.title.toLowerCase()}...</p>
                        <p class="loading-subtitle">This will take just a moment</p>
                    </div>
                </div>
                <div class="step-actions">
                    <button class="btn-secondary" onclick="onboardingManager.previousStep()" aria-label="Go back to previous step">
                        Back
                    </button>
                    <button class="btn-primary" onclick="onboardingManager.nextStep()" aria-label="Continue to next step">
                        Continue
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Render completion screen
   * @returns {string} Completion HTML
   */
  renderCompletion() {
    return `
            <div class="onboarding-completion">
                <div class="completion-content">
                    <div class="completion-icon">🎉</div>
                    <h1>Welcome to IgniteFitness!</h1>
                    <p>Your personalized training plan is ready</p>
                    
                    <div class="completion-summary">
                        <h3>Your Profile</h3>
                        <div class="profile-summary">
                            <div class="summary-item">
                                <strong>Sport:</strong> ${this.onboardingData.sport?.name || 'Not selected'}
                            </div>
                            <div class="summary-item">
                                <strong>Position:</strong> ${this.onboardingData.position?.position || 'Not selected'}
                            </div>
                            <div class="summary-item">
                                <strong>Experience:</strong> ${this.onboardingData.profile?.experience || 'Not selected'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="completion-actions">
                        <button class="btn-primary" onclick="onboardingManager.finishOnboarding()" aria-label="Start your personalized training plan">
                            Start Training
                        </button>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Render error state
   * @returns {string} Error HTML
   */
  renderError() {
    return `
            <div class="onboarding-error">
                <div class="error-content">
                    <div class="error-icon">⚠️</div>
                    <h1>Something went wrong</h1>
                    <p>We couldn't load this step properly. This usually happens when:</p>
                    <ul style="text-align: left; margin: 16px 0;">
                        <li>Your internet connection is slow</li>
                        <li>The page needs to refresh</li>
                        <li>There's a temporary issue</li>
                    </ul>
                    <div class="error-actions">
                        <button class="btn-secondary" onclick="onboardingManager.previousStep()" aria-label="Go back to previous step">
                            Go Back
                        </button>
                        <button class="btn-primary" onclick="onboardingManager.startOnboarding()" aria-label="Restart onboarding">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Navigate to next step
   */
  nextStep() {
    if (this.currentStep < this.onboardingSteps.length - 1) {
      this.currentStep++;
      this.updateOnboardingUI();
      this.initializeCurrentStep();
    } else {
      this.completeOnboarding();
    }
  }

  /**
   * Navigate to previous step
   */
  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.updateOnboardingUI();
      this.initializeCurrentStep();
    }
  }

  /**
   * Complete onboarding process
   */
  async completeOnboarding() {
    // Show generating state first
    this.showGeneratingState();

    try {
      // Save complete user profile and preferences in single object
      await this.saveCompleteProfile();

      // Small delay to show generating state (improves UX)
      await new Promise(resolve => setTimeout(resolve, 1500));

      this.isCompleted = true;

      this.logger.audit('ONBOARDING_COMPLETED', {
        data: this.onboardingData,
        version: this.onboardingVersion,
      });

      // Show first workout experience
      this.finishOnboarding();
    } catch (error) {
      this.logger.error('Failed to complete onboarding', error);
      this.showError("Something went wrong. Let's try again.");
    }
  }

  /**
   * Show generating state during workout creation
   */
  showGeneratingState() {
    const container =
      document.getElementById('app-content') || document.getElementById('main-content');
    if (!container) {
      return;
    }

    container.innerHTML = `
            <div class="onboarding-generating">
                <div class="generating-content">
                    <div class="spinner-large" style="
                        width: 60px;
                        height: 60px;
                        border: 4px solid #e2e8f0;
                        border-top: 4px solid #4299e1;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 2rem;
                    "></div>
                    <h2 style="margin: 0 0 0.5rem 0; color: #2d3748;">Creating Your Personalized Plan</h2>
                    <p class="generating-message" style="color: #718096; margin: 0 0 2rem 0;">Analyzing your goals and schedule...</p>
                    
                    <div class="generating-steps" style="display: flex; flex-direction: column; gap: 1rem; max-width: 400px; margin: 0 auto;">
                        <div class="gen-step active" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: #f7fafc; border-radius: 8px;">
                            <span style="font-size: 1.25rem;">🎯</span>
                            <span style="color: #2d3748;">Understanding your goals</span>
                        </div>
                        <div class="gen-step active" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: #f7fafc; border-radius: 8px;">
                            <span style="font-size: 1.25rem;">📅</span>
                            <span style="color: #2d3748;">Optimizing your schedule</span>
                        </div>
                        <div class="gen-step active" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: #f7fafc; border-radius: 8px;">
                            <span style="font-size: 1.25rem;">🤖</span>
                            <span style="color: #2d3748;">AI creating your workout</span>
                        </div>
                        <div class="gen-step" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: #e6fffa; border-radius: 8px;">
                            <span style="font-size: 1.25rem;">✅</span>
                            <span style="color: #2d3748; font-weight: 600;">Ready to start!</span>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const container =
      document.getElementById('app-content') || document.getElementById('main-content');
    if (!container) {
      return;
    }

    container.innerHTML = `
            <div class="onboarding-error">
                <div class="error-content" style="text-align: center; padding: 2rem;">
                    <div class="error-icon" style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h2 style="color: #2d3748; margin: 0 0 0.5rem 0;">Something went wrong</h2>
                    <p style="color: #718096; margin: 0 0 1.5rem 0;">${message}</p>
                    <button class="btn-primary" onclick="window.OnboardingManager?.completeOnboarding()" style="
                        background: #4299e1;
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        Try Again
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Save step data
   * @param {string} stepId - Step ID
   * @param {Object} data - Step data
   */
  saveStepData(stepId, data) {
    if (!this.onboardingData[stepId]) {
      this.onboardingData[stepId] = {};
    }
    Object.assign(this.onboardingData[stepId], data);
    Object.assign(this.onboardingData, data);
    this.logger.debug('Step data saved', { stepId, data });
  }

  /**
   * Save complete profile (user_profile + preferences combined)
   * Enhanced for multi-sport beta requirements
   */
  async saveCompleteProfile() {
    try {
      const userId = this.getUserId();
      const existingProfile = this.storageManager?.getUserProfile?.(userId);
      const programStartDate = this.determineProgramStartDate(existingProfile);
      this.onboardingData.programStartDate = programStartDate;

      // Combine all onboarding data into single object
      const completeProfile = {
        // User profile data (multi-sport)
        user_profile: {
          userId,
          primarySport: this.onboardingData.primarySport || 'running',
          secondarySports: this.onboardingData.secondarySports || [],
          sportSpecific: this.onboardingData.sportSpecific || {},
          goals: this.onboardingData.goals || ['general_fitness'],
          sport: this.onboardingData.sport || this.onboardingData.primarySport || 'running',
          position: this.onboardingData.position || 'general',
          season_phase: this.onboardingData.season_phase || 'in-season',
          experience_level:
            this.onboardingData.experience || this.onboardingData.trainingLevel || 'intermediate',
          trainingLevel: this.onboardingData.trainingLevel || 'intermediate',
          weeklyVolumes: this.onboardingData.weeklyVolumes || {},
          recentEfforts: this.onboardingData.recentEfforts || {},
          currentInjuries: this.onboardingData.currentInjuries || [],
          pastInjuries: this.onboardingData.pastInjuries || [],
          limitations: this.onboardingData.limitations || [],
          programStartDate,
          program_start_date: programStartDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },

        // Preferences (multi-sport)
        preferences: {
          equipment: this.onboardingData.equipment || [],
          timePreferences: this.onboardingData.timePreferences || {},
          timeWindows: this.onboardingData.timeWindows || {},
          available_days: this.onboardingData.available_days || ['monday', 'wednesday', 'friday'],
          session_length:
            this.onboardingData.session_length ||
            this.onboardingData.timePreferences?.typicalDuration ||
            60,
          equipment_type: Array.isArray(this.onboardingData.equipment)
            ? 'mixed'
            : this.onboardingData.equipment || 'commercial_gym',
          exercise_dislikes: this.onboardingData.exercise_dislikes || [],
          aesthetic_focus: this.onboardingData.aesthetic_focus || 'functional',
          training_mode: 'simple', // Default to simple mode
          onboarding_version: this.onboardingVersion,
          completed_at: new Date().toISOString(),
          programStartDate,
          program_start_date: programStartDate,
        },
      };

      // Validate required fields
      const validation = this.validateOnboardingData(completeProfile);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Save to StorageManager
      await this.storageManager.saveUserProfile(userId, completeProfile);

      // Also save preferences separately for easy access
      await this.storageManager.savePreferences(userId, completeProfile.preferences);

      this.logger.debug('Complete profile saved', completeProfile);
    } catch (error) {
      this.logger.error('Failed to save complete profile', error);
      throw error;
    }
  }

  /**
   * Validate onboarding data
   * @param {Object} profile - Complete profile data
   * @returns {Object} Validation result
   */
  validateOnboardingData(profile) {
    const errors = [];
    const userProfile = profile.user_profile || {};
    const preferences = profile.preferences || {};

    // Required fields
    if (!userProfile.primarySport) {
      errors.push('Primary sport is required');
    }
    if (!userProfile.trainingLevel) {
      errors.push('Training level is required');
    }
    if (!userProfile.weeklyVolumes || Object.keys(userProfile.weeklyVolumes).length === 0) {
      errors.push('Weekly training volume is required');
    }
    if (!preferences.equipment || preferences.equipment.length === 0) {
      errors.push('At least one equipment/facility is required');
    }
    if (!preferences.timeWindows && !preferences.timePreferences) {
      errors.push('Time preferences are required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  determineProgramStartDate(existingProfile = {}) {
    const candidateValues = [
      this.onboardingData?.programStartDate,
      this.onboardingData?.trainingStartDate,
      this.onboardingData?.seasonStartDate,
      existingProfile?.user_profile?.programStartDate,
      existingProfile?.user_profile?.program_start_date,
      existingProfile?.preferences?.programStartDate,
      existingProfile?.preferences?.program_start_date,
      existingProfile?.user_profile?.created_at,
    ].filter(Boolean);

    const validDates = candidateValues
      .map(value => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      })
      .filter(Boolean);

    if (validDates.length === 0) {
      return new Date().toISOString();
    }

    validDates.sort((a, b) => a - b);
    return validDates[0].toISOString();
  }

  /**
   * Skip current step
   */
  skipStep() {
    const step = this.onboardingSteps[this.currentStep];

    if (step.skippable) {
      this.logger.debug('Step skipped', { step: step.id });
      this.nextStep();
    }
  }

  /**
   * Get user ID
   * @returns {string} User ID
   */
  getUserId() {
    return this.authManager?.getCurrentUsername() || 'anonymous';
  }

  /**
   * Finish onboarding and show first workout experience
   */
  finishOnboarding() {
    // Save onboarding data
    this.saveOnboardingData();

    // Generate first workout
    const firstWorkout = this.generateFirstWorkout();

    // Show first workout experience instead of going straight to dashboard
    if (window.FirstWorkoutExperience) {
      const container =
        document.getElementById('app-content') || document.getElementById('main-content');
      if (container) {
        const firstWorkoutView = new window.FirstWorkoutExperience();
        container.innerHTML = firstWorkoutView.showWorkoutIntro(firstWorkout);

        // Mark onboarding as complete in localStorage
        const userId = this.getUserId();
        if (userId) {
          localStorage.setItem('ignite.user.hasCompletedOnboarding', 'true');

          // Update user preferences
          if (window.AuthManager) {
            const user = window.AuthManager.getCurrentUser();
            if (user) {
              if (!user.preferences) {
                user.preferences = {};
              }
              user.preferences.onboarding_version = this.onboardingVersion;
              user.preferences.hasCompletedOnboarding = true;
              window.AuthManager.updateUserData({ preferences: user.preferences });
            }
          }
        }
      }
    } else {
      // Fallback: Navigate to dashboard
      if (window.Router) {
        window.Router.navigate('#/');
      }
    }

    this.logger.audit('ONBOARDING_FINISHED', { data: this.onboardingData });
  }

  /**
   * Generate first workout based on onboarding data
   * @returns {Object} First workout data
   */
  generateFirstWorkout() {
    try {
      // Build user profile from onboarding data
      const userProfile = {
        goals: this.onboardingData.goals || ['general_fitness'],
        experience:
          this.onboardingData.profile?.experience || this.onboardingData.experience || 'beginner',
        sport: this.onboardingData.sport?.id || this.onboardingData.sport || 'general',
        position: this.onboardingData.position?.position || this.onboardingData.position,
        season_phase: this.onboardingData.season_phase || 'off-season',
        preferences: this.onboardingData.preferences || {
          available_days: this.onboardingData.available_days || ['monday', 'wednesday', 'friday'],
          session_length: this.onboardingData.session_length || 45,
          equipment_type: this.onboardingData.equipment || 'commercial_gym',
        },
      };

      // Try to use ExpertCoordinator for personalized workout generation
      if (
        window.ExpertCoordinator &&
        typeof window.ExpertCoordinator.generateWorkout === 'function'
      ) {
        try {
          const context = {
            user: userProfile,
            readiness: 7, // Default moderate readiness for first workout
            sessionType: 'Full Body',
            duration: userProfile.preferences.session_length || 45,
            goals: userProfile.goals,
          };

          const generatedPlan = window.ExpertCoordinator.generateWorkout(context);
          if (generatedPlan && generatedPlan.blocks && generatedPlan.blocks.length > 0) {
            // Convert expert plan to workout format
            const exercises = [];
            generatedPlan.blocks.forEach(block => {
              if (block.exercises && Array.isArray(block.exercises)) {
                block.exercises.forEach(ex => {
                  exercises.push({
                    name: ex.name || ex.exercise || 'Exercise',
                    sets: ex.sets || 3,
                    reps: ex.reps || 10,
                    weight: ex.weight || null,
                  });
                });
              }
            });

            if (exercises.length > 0) {
              return {
                name: 'Your First Workout',
                duration: context.duration,
                difficulty: this.getDifficultyLevel(),
                exercises,
                rationale: generatedPlan.rationale || 'Personalized based on your goals',
              };
            }
          }
        } catch (error) {
          this.logger.warn(
            'Failed to generate workout with ExpertCoordinator, using fallback',
            error
          );
        }
      }

      // Try WorkoutGenerator as fallback
      if (
        window.WorkoutGenerator &&
        typeof window.WorkoutGenerator.generateWorkout === 'function'
      ) {
        try {
          const sessionType = 'Full Body';
          const duration = userProfile.preferences.session_length || 45;
          const generatedWorkout = window.WorkoutGenerator.generateWorkout(
            userProfile,
            sessionType,
            duration
          );

          if (
            generatedWorkout &&
            generatedWorkout.exercises &&
            generatedWorkout.exercises.length > 0
          ) {
            return {
              name: generatedWorkout.type || 'Your First Workout',
              duration: generatedWorkout.duration || duration,
              difficulty: this.getDifficultyLevel(),
              exercises: generatedWorkout.exercises,
              notes: generatedWorkout.notes || '',
            };
          }
        } catch (error) {
          this.logger.warn(
            'Failed to generate workout with WorkoutGenerator, using default',
            error
          );
        }
      }

      // Default personalized workout based on goals
      return {
        name: 'Your First Workout',
        duration: userProfile.preferences.session_length || 30,
        difficulty: this.getDifficultyLevel(),
        exercises: this.getDefaultExercises(),
        personalized: true,
      };
    } catch (error) {
      this.logger.error('Error generating first workout', error);
      // Safe fallback
      return {
        name: 'Welcome Workout',
        duration: 30,
        difficulty: 'Beginner Friendly',
        exercises: [
          { name: 'Warm-up', sets: 1, reps: '5 min' },
          { name: 'Bodyweight Squats', sets: 3, reps: 10 },
          { name: 'Push-ups', sets: 3, reps: 8 },
          { name: 'Plank', sets: 3, reps: '30 sec' },
          { name: 'Cool-down Stretch', sets: 1, reps: '5 min' },
        ],
      };
    }
  }

  /**
   * Get difficulty level from onboarding data
   * @returns {string} Difficulty level
   */
  getDifficultyLevel() {
    const experience = this.onboardingData.profile?.experience || 'beginner';
    const levels = {
      beginner: 'Beginner Friendly',
      intermediate: 'Moderate',
      advanced: 'Challenging',
      expert: 'Elite',
    };
    return levels[experience] || 'Beginner Friendly';
  }

  /**
   * Get default exercises based on goals
   * @returns {Array} Exercise list
   */
  getDefaultExercises() {
    const goals = this.onboardingData.goals || ['general_fitness'];
    const exercises = [];

    // Add warm-up
    exercises.push({ name: 'Warm-up', sets: 1, reps: '5 min' });

    // Add exercises based on goals
    if (goals.includes('strength') || goals.includes('build_muscle')) {
      exercises.push({ name: 'Bodyweight Squats', sets: 3, reps: 10 });
      exercises.push({ name: 'Push-ups', sets: 3, reps: 8 });
      exercises.push({ name: 'Plank', sets: 3, reps: '30 sec' });
    } else if (goals.includes('endurance') || goals.includes('cardio')) {
      exercises.push({ name: 'Light Jogging', sets: 1, reps: '10 min' });
      exercises.push({ name: 'Bodyweight Squats', sets: 2, reps: 15 });
      exercises.push({ name: 'Jumping Jacks', sets: 3, reps: 20 });
    } else {
      // General fitness
      exercises.push({ name: 'Bodyweight Squats', sets: 3, reps: 10 });
      exercises.push({ name: 'Push-ups', sets: 3, reps: 8 });
      exercises.push({ name: 'Plank', sets: 2, reps: '30 sec' });
    }

    // Add cool-down
    exercises.push({ name: 'Cool-down Stretch', sets: 1, reps: '5 min' });

    return exercises;
  }

  /**
   * Update onboarding UI
   */
  updateOnboardingUI() {
    const container = document.getElementById('app-content');
    if (container) {
      container.innerHTML = this.render();
    }
  }

  /**
   * Initialize current step
   * Enhanced for multi-sport onboarding
   */
  initializeCurrentStep() {
    const step = this.onboardingSteps[this.currentStep];
    if (!step) {
      return;
    }

    // Initialize step component
    switch (step.component) {
      // Enhanced multi-sport steps
      case 'SportSelection':
      case 'SecondarySports':
      case 'CurrentVolume':
      case 'RecentEfforts':
      case 'EquipmentAccess':
      case 'InjuryHistory':
      case 'TimeWindows':
      case 'ReviewComplete':
        // New components auto-initialize via render
        break;
      // Legacy steps (for backwards compatibility)
      case 'Goals':
        // Goals step handles its own initialization via event listeners
        break;
      case 'SportSoccer':
        window.SportSoccer?.init?.();
        break;
      case 'EquipmentTime':
        window.EquipmentTime?.init?.();
        break;
      case 'Preferences':
        window.Preferences?.init?.();
        break;
    }
  }

  /**
   * Set onboarding data
   * @param {string} key - Data key
   * @param {*} value - Data value
   */
  setData(key, value) {
    this.onboardingData[key] = value;
    this.logger.debug('Onboarding data updated:', key, value);
  }

  /**
   * Get onboarding data
   * @param {string} key - Data key
   * @returns {*} Data value
   */
  getData(key) {
    return this.onboardingData[key];
  }

  /**
   * Save onboarding data to storage
   */
  saveOnboardingData() {
    if (this.authManager && this.authManager.getCurrentUsername()) {
      const username = this.authManager.getCurrentUsername();

      // Save to user profile
      if (window.users && window.users[username]) {
        window.users[username].onboardingData = {
          ...this.onboardingData,
          completedAt: new Date().toISOString(),
          version: this.onboardingVersion,
        };

        // Update localStorage
        localStorage.setItem('ignitefitness_users', JSON.stringify(window.users));
      }
    }

    this.logger.debug('Onboarding data saved');
  }

  /**
   * Show onboarding UI (fallback method)
   */
  showOnboardingUI() {
    const container = document.getElementById('app-content');
    if (container) {
      container.innerHTML = this.render();
      this.initializeCurrentStep();
    }
  }

  /**
   * Get current step
   * @returns {Object} Current step
   */
  getCurrentStep() {
    return this.onboardingSteps[this.currentStep];
  }

  /**
   * Get onboarding progress
   * @returns {Object} Progress information
   */
  getProgress() {
    return {
      currentStep: this.currentStep,
      totalSteps: this.onboardingSteps.length,
      progress: ((this.currentStep + 1) / this.onboardingSteps.length) * 100,
      isCompleted: this.isCompleted,
    };
  }

  /**
   * Get time estimate for remaining steps
   * @returns {string} Time estimate text
   */
  getTimeEstimate() {
    const _remainingSteps = this.onboardingSteps.length - this.currentStep - 1;
    const stepTimeEstimates = {
      goals: 1,
      sport_soccer: 2,
      equipment_time: 2,
      preferences: 1,
    };

    let totalMinutes = 0;
    for (let i = this.currentStep + 1; i < this.onboardingSteps.length; i++) {
      const step = this.onboardingSteps[i];
      totalMinutes += stepTimeEstimates[step.id] || 1;
    }

    if (totalMinutes === 0) {
      return 'Almost done!';
    } else if (totalMinutes === 1) {
      return '~1 min remaining';
    } else {
      return `~${totalMinutes} min remaining`;
    }
  }

  /**
   * Reset onboarding
   */
  resetOnboarding() {
    this.currentStep = 0;
    this.onboardingData = {};
    this.isCompleted = false;
    this.logger.debug('Onboarding reset');
  }
}

// Create global instance
window.OnboardingManager = new OnboardingManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OnboardingManager;
}
