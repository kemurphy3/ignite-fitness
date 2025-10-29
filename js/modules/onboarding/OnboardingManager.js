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
     * @returns {Array} Onboarding steps
     */
    initializeSteps() {
        return [
            {
                id: 'goals',
                title: "What are your training goals?",
                component: 'Goals',
                description: 'Select all that apply',
                skippable: true
            },
            {
                id: 'sport_soccer',
                title: "Soccer-Specific Details",
                component: 'SportSoccer',
                description: 'Your position and season phase',
                skippable: true
            },
            {
                id: 'equipment_time',
                title: "Training Constraints",
                component: 'EquipmentTime',
                description: 'Schedule and equipment preferences',
                skippable: true
            },
            {
                id: 'preferences',
                title: "Review & Complete",
                component: 'Preferences',
                description: 'Finalize your profile',
                skippable: false
            }
        ];
    }

    /**
     * Check if user needs onboarding
     * @returns {boolean} Needs onboarding
     */
    needsOnboarding() {
        try {
            const user = this.authManager?.getCurrentUser();
            if (!user) return false;

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
                return window.SportSelection?.render() || this.renderFallback(step);
            case 'PositionSelection':
                return window.PositionSelection?.render() || this.renderFallback(step);
            case 'ProfileSetup':
                return window.ProfileSetup?.render() || this.renderFallback(step);
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
        this.isCompleted = true;
        
        // Save complete user profile and preferences in single object
        await this.saveCompleteProfile();
        
        this.logger.audit('ONBOARDING_COMPLETED', { 
            data: this.onboardingData,
            version: this.onboardingVersion 
        });
        
        this.updateOnboardingUI();
    }
    
    /**
     * Save complete profile (user_profile + preferences combined)
     */
    async saveCompleteProfile() {
        try {
            const userId = this.getUserId();
            
            // Combine all onboarding data into single object
            const completeProfile = {
                // User profile data
                user_profile: {
                    userId,
                    goals: this.onboardingData.goals || ['general_fitness'],
                    sport: this.onboardingData.sport || 'soccer',
                    position: this.onboardingData.position || 'midfielder',
                    season_phase: this.onboardingData.season_phase || 'in-season',
                    experience_level: this.onboardingData.experience || 'intermediate',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                
                // Preferences
                preferences: {
                    available_days: this.onboardingData.available_days || ['monday', 'wednesday', 'friday'],
                    session_length: this.onboardingData.session_length || 45,
                    equipment_type: this.onboardingData.equipment || 'commercial_gym',
                    exercise_dislikes: this.onboardingData.exercise_dislikes || [],
                    aesthetic_focus: this.onboardingData.aesthetic_focus || 'functional',
                    training_mode: 'simple', // Default to simple mode
                    onboarding_version: this.onboardingVersion,
                    completed_at: new Date().toISOString()
                }
            };
            
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
            const container = document.getElementById('app-content') || document.getElementById('main-content');
            if (container) {
                const firstWorkoutView = new window.FirstWorkoutExperience();
                container.innerHTML = firstWorkoutView.showWorkoutIntro(firstWorkout);
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
        // Use existing workout generator if available
        if (window.WorkoutGenerator || window.ExpertCoordinator) {
            // This would call the actual workout generator
            // For now, return a default personalized workout
            return {
                name: 'Your First Workout',
                duration: this.onboardingData.preferences?.session_length || 30,
                difficulty: this.getDifficultyLevel(),
                exercises: this.getDefaultExercises()
            };
        }
        
        return {
            name: 'Welcome Workout',
            duration: 30,
            difficulty: 'Beginner Friendly',
            exercises: [
                { name: 'Warm-up', sets: 1, reps: '5 min' },
                { name: 'Bodyweight Squats', sets: 3, reps: 10 },
                { name: 'Push-ups', sets: 3, reps: 8 },
                { name: 'Plank', sets: 3, reps: '30 sec' },
                { name: 'Cool-down Stretch', sets: 1, reps: '5 min' }
            ]
        };
    }

    /**
     * Get difficulty level from onboarding data
     * @returns {string} Difficulty level
     */
    getDifficultyLevel() {
        const experience = this.onboardingData.profile?.experience || 'beginner';
        const levels = {
            'beginner': 'Beginner Friendly',
            'intermediate': 'Moderate',
            'advanced': 'Challenging',
            'expert': 'Elite'
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
     */
    initializeCurrentStep() {
        const step = this.onboardingSteps[this.currentStep];
        if (!step) return;

        // Initialize step component
        switch (step.component) {
            case 'SportSelection':
                window.SportSelection?.init();
                break;
            case 'PositionSelection':
                window.PositionSelection?.init();
                break;
            case 'ProfileSetup':
                window.ProfileSetup?.init();
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
                    version: this.onboardingVersion
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
            progress: (this.currentStep + 1) / this.onboardingSteps.length * 100,
            isCompleted: this.isCompleted
        };
    }

    /**
     * Get time estimate for remaining steps
     * @returns {string} Time estimate text
     */
    getTimeEstimate() {
        const remainingSteps = this.onboardingSteps.length - this.currentStep - 1;
        const stepTimeEstimates = {
            'goals': 1,
            'sport_soccer': 2,
            'equipment_time': 2,
            'preferences': 1
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