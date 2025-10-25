/**
 * OnboardingManager - Handles user onboarding questionnaire and preferences
 * Manages onboarding flow, preference storage, and role-based access
 */
class OnboardingManager {
    constructor() {
        this.onboardingVersion = 1;
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.authManager = window.AuthManager;
        this.storageManager = window.StorageManager;
        
        this.onboardingQuestions = this.initializeQuestions();
        this.currentStep = 0;
        this.onboardingData = {};
    }

    /**
     * Initialize onboarding questions
     * @returns {Array} Onboarding questions
     */
    initializeQuestions() {
        return [
            {
                id: 'primary_goal',
                question: 'What is your primary fitness goal?',
                type: 'radio',
                options: [
                    { value: 'strength', label: 'Strength & Power', description: 'Build muscle and increase strength' },
                    { value: 'sport_performance', label: 'Sport Performance', description: 'Improve athletic performance' },
                    { value: 'general_fitness', label: 'General Fitness', description: 'Overall health and wellness' },
                    { value: 'endurance', label: 'Endurance', description: 'Improve cardiovascular fitness' },
                    { value: 'weight_loss', label: 'Weight Loss', description: 'Lose weight and get lean' }
                ],
                required: true
            },
            {
                id: 'data_preference',
                question: 'How much data do you want to see?',
                type: 'radio',
                options: [
                    { value: 'basics', label: 'Basics', description: 'Simple metrics, next workout, progress streak' },
                    { value: 'some_metrics', label: 'Some Metrics', description: 'Progress charts, weekly load, strength gains' },
                    { value: 'all_data', label: 'All Data', description: 'Detailed analytics, load management, periodization' }
                ],
                required: true
            },
            {
                id: 'training_background',
                question: 'What is your training background?',
                type: 'radio',
                options: [
                    { value: 'beginner', label: 'Beginner', description: 'New to structured training' },
                    { value: 'intermediate', label: 'Intermediate', description: 'Some experience with training' },
                    { value: 'former_athlete', label: 'Former Athlete', description: 'Previous competitive sports experience' },
                    { value: 'current_competitor', label: 'Current Competitor', description: 'Currently competing in sports' },
                    { value: 'coach', label: 'Coach/Trainer', description: 'Training others professionally' }
                ],
                required: true
            },
            {
                id: 'primary_sport',
                question: 'What is your primary sport or activity?',
                type: 'radio',
                options: [
                    { value: 'soccer', label: 'Soccer', description: 'Football/soccer focused training' },
                    { value: 'multiple_sports', label: 'Multiple Sports', description: 'Participate in various sports' },
                    { value: 'general_fitness', label: 'General Fitness', description: 'No specific sport focus' },
                    { value: 'running', label: 'Running', description: 'Running and endurance sports' },
                    { value: 'strength_sports', label: 'Strength Sports', description: 'Powerlifting, weightlifting, etc.' },
                    { value: 'other', label: 'Other', description: 'Specify in notes' }
                ],
                required: true
            },
            {
                id: 'time_commitment',
                question: 'How many days per week can you train?',
                type: 'radio',
                options: [
                    { value: '2-3_days', label: '2-3 Days', description: 'Light training schedule' },
                    { value: '4-5_days', label: '4-5 Days', description: 'Moderate training schedule' },
                    { value: '6+_days', label: '6+ Days', description: 'High frequency training' }
                ],
                required: true
            },
            {
                id: 'role',
                question: 'What is your role?',
                type: 'radio',
                options: [
                    { value: 'athlete', label: 'Athlete', description: 'Training for personal goals' },
                    { value: 'coach', label: 'Coach', description: 'Training athletes and clients' }
                ],
                required: true
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
     * @returns {Object} Start result
     */
    startOnboarding() {
        try {
            this.currentStep = 0;
            this.onboardingData = {};
            
            this.logger.audit('ONBOARDING_STARTED', { 
                userId: this.authManager?.getCurrentUsername() 
            });
            this.eventBus?.emit('onboarding:started');
            
            return { success: true, step: this.currentStep };
        } catch (error) {
            this.logger.error('Failed to start onboarding', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current onboarding question
     * @returns {Object} Current question
     */
    getCurrentQuestion() {
        if (this.currentStep >= this.onboardingQuestions.length) {
            return null;
        }
        
        return {
            ...this.onboardingQuestions[this.currentStep],
            step: this.currentStep + 1,
            totalSteps: this.onboardingQuestions.length
        };
    }

    /**
     * Answer current question
     * @param {string} answer - User's answer
     * @returns {Object} Answer result
     */
    answerQuestion(answer) {
        try {
            const currentQuestion = this.getCurrentQuestion();
            if (!currentQuestion) {
                return { success: false, error: 'No current question' };
            }

            // Validate answer
            if (!answer && currentQuestion.required) {
                return { success: false, error: 'Answer is required' };
            }

            // Store answer
            this.onboardingData[currentQuestion.id] = answer;
            
            this.logger.debug('Onboarding question answered', { 
                question: currentQuestion.id, 
                answer 
            });
            
            return { success: true, data: this.onboardingData };
        } catch (error) {
            this.logger.error('Failed to answer question', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Move to next question
     * @returns {Object} Next step result
     */
    nextStep() {
        try {
            this.currentStep++;
            
            if (this.currentStep >= this.onboardingQuestions.length) {
                // Onboarding complete
                return this.completeOnboarding();
            }
            
            return { 
                success: true, 
                step: this.currentStep,
                question: this.getCurrentQuestion()
            };
        } catch (error) {
            this.logger.error('Failed to move to next step', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Complete onboarding process
     * @returns {Object} Completion result
     */
    completeOnboarding() {
        try {
            const user = this.authManager?.getCurrentUser();
            if (!user) {
                return { success: false, error: 'No user logged in' };
            }

            // Update user preferences
            const preferences = {
                ...user.preferences,
                ...this.onboardingData,
                onboarding_version: this.onboardingVersion,
                onboarding_completed_at: new Date().toISOString()
            };

            // Save to user data
            const updateResult = this.authManager.updateUserData({ preferences });
            if (!updateResult.success) {
                return { success: false, error: updateResult.error };
            }

            // Save to server if available
            this.saveOnboardingToServer(preferences);

            this.logger.audit('ONBOARDING_COMPLETED', { 
                userId: this.authManager.getCurrentUsername(),
                preferences: this.onboardingData
            });
            this.eventBus?.emit('onboarding:completed', preferences);
            
            return { 
                success: true, 
                preferences,
                message: 'Onboarding completed successfully!' 
            };
        } catch (error) {
            this.logger.error('Failed to complete onboarding', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Save onboarding data to server
     * @param {Object} preferences - User preferences
     */
    async saveOnboardingToServer(preferences) {
        try {
            if (window.ApiClient) {
                await window.ApiClient.post('/user-preferences', preferences);
                this.logger.debug('Onboarding data saved to server');
            }
        } catch (error) {
            this.logger.warn('Failed to save onboarding to server', error);
            // Fall back to IndexedDB for offline storage
            if (this.storageManager) {
                await this.storageManager.addToSyncQueue('user_preferences', preferences);
            }
        }
    }

    /**
     * Skip onboarding (for existing users)
     * @returns {Object} Skip result
     */
    skipOnboarding() {
        try {
            const user = this.authManager?.getCurrentUser();
            if (!user) {
                return { success: false, error: 'No user logged in' };
            }

            // Set default preferences
            const defaultPreferences = {
                data_preference: 'some_metrics',
                primary_goal: 'general_fitness',
                training_background: 'intermediate',
                primary_sport: 'general_fitness',
                time_commitment: '4-5_days',
                role: 'athlete',
                onboarding_version: this.onboardingVersion,
                onboarding_skipped: true
            };

            const updateResult = this.authManager.updateUserData({ 
                preferences: { ...user.preferences, ...defaultPreferences }
            });

            if (updateResult.success) {
                this.logger.audit('ONBOARDING_SKIPPED', { 
                    userId: this.authManager.getCurrentUsername() 
                });
                this.eventBus?.emit('onboarding:skipped', defaultPreferences);
            }

            return updateResult;
        } catch (error) {
            this.logger.error('Failed to skip onboarding', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user preferences
     * @returns {Object} User preferences
     */
    getUserPreferences() {
        try {
            const user = this.authManager?.getCurrentUser();
            return user?.preferences || {};
        } catch (error) {
            this.logger.error('Failed to get user preferences', error);
            return {};
        }
    }

    /**
     * Update user preferences
     * @param {Object} newPreferences - New preferences
     * @returns {Object} Update result
     */
    updateUserPreferences(newPreferences) {
        try {
            const user = this.authManager?.getCurrentUser();
            if (!user) {
                return { success: false, error: 'No user logged in' };
            }

            const updatedPreferences = {
                ...user.preferences,
                ...newPreferences,
                updated_at: new Date().toISOString()
            };

            const updateResult = this.authManager.updateUserData({ 
                preferences: updatedPreferences 
            });

            if (updateResult.success) {
                this.logger.audit('PREFERENCES_UPDATED', { 
                    userId: this.authManager.getCurrentUsername(),
                    changes: newPreferences
                });
                this.eventBus?.emit('preferences:updated', updatedPreferences);
            }

            return updateResult;
        } catch (error) {
            this.logger.error('Failed to update preferences', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get dashboard mode based on data preference
     * @returns {string} Dashboard mode
     */
    getDashboardMode() {
        const preferences = this.getUserPreferences();
        return preferences.data_preference || 'some_metrics';
    }

    /**
     * Get user role
     * @returns {string} User role
     */
    getUserRole() {
        const preferences = this.getUserPreferences();
        return preferences.role || 'athlete';
    }

    /**
     * Check if user is a coach
     * @returns {boolean} Is coach
     */
    isCoach() {
        return this.getUserRole() === 'coach';
    }

    /**
     * Get onboarding progress
     * @returns {Object} Progress data
     */
    getOnboardingProgress() {
        return {
            currentStep: this.currentStep,
            totalSteps: this.onboardingQuestions.length,
            progress: Math.round((this.currentStep / this.onboardingQuestions.length) * 100),
            completed: this.currentStep >= this.onboardingQuestions.length
        };
    }

    /**
     * Reset onboarding (for testing or re-onboarding)
     * @returns {Object} Reset result
     */
    resetOnboarding() {
        try {
            const user = this.authManager?.getCurrentUser();
            if (!user) {
                return { success: false, error: 'No user logged in' };
            }

            // Remove onboarding completion flag
            const preferences = { ...user.preferences };
            delete preferences.onboarding_version;
            delete preferences.onboarding_completed_at;

            const updateResult = this.authManager.updateUserData({ preferences });
            
            if (updateResult.success) {
                this.logger.audit('ONBOARDING_RESET', { 
                    userId: this.authManager.getCurrentUsername() 
                });
                this.eventBus?.emit('onboarding:reset');
            }

            return updateResult;
        } catch (error) {
            this.logger.error('Failed to reset onboarding', error);
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
window.OnboardingManager = new OnboardingManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OnboardingManager;
}
