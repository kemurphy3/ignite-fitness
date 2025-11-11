/**
 * CoachingEngine - AI-powered coaching and recommendations
 * Handles AI interactions and personalized coaching
 */
class CoachingEngine {
  constructor() {
    this.contextAwareAI = null;
    this.seasonalTraining = null;
    this.patternDetector = null;
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.authManager = window.AuthManager;
    this.workoutTracker = window.WorkoutTracker;

    this.initializeAI();
  }

  /**
   * Initialize AI systems
   */
  initializeAI() {
    try {
      // Initialize context-aware AI if available
      if (typeof ContextAwareAI !== 'undefined') {
        this.contextAwareAI = new ContextAwareAI();
        this.logger.info('Context-aware AI initialized');
      }

      // Initialize seasonal training if available
      if (typeof SeasonalTrainingSystem !== 'undefined') {
        this.seasonalTraining = new SeasonalTrainingSystem();
        this.seasonalTraining.initialize();
        this.logger.info('Seasonal training system initialized');
      }

      // Initialize pattern detector if available
      if (typeof PatternDetector !== 'undefined') {
        this.patternDetector = new PatternDetector();
        this.logger.info('Pattern detector initialized');
      }
    } catch (error) {
      this.logger.error('Failed to initialize AI systems', error);
    }
  }

  /**
   * Process user input and generate AI response
   * @param {string} input - User input
   * @returns {Promise<Object>} AI response
   */
  async processUserInput(input) {
    try {
      // Use PersonalizedCoaching for context-aware responses
      if (window.PersonalizedCoaching) {
        const personalizedResponse = window.PersonalizedCoaching.generateResponse(input);

        if (personalizedResponse.success) {
          this.logger.audit('AI_INTERACTION', {
            input: input.substring(0, 100),
            responseLength: personalizedResponse.response.length,
            scenario: personalizedResponse.scenario,
          });

          // Emit coaching event for analytics
          this.eventBus?.emit('coaching:responseGenerated', {
            user: this.authManager?.getCurrentUsername(),
            message: input,
            response: personalizedResponse.response,
            scenario: personalizedResponse.scenario,
            context: personalizedResponse.context,
          });

          return {
            success: true,
            response: personalizedResponse.response,
            type: 'personalized_ai',
            scenario: personalizedResponse.scenario,
          };
        }
      }

      // Fallback to context-aware AI
      if (!this.contextAwareAI) {
        return {
          success: false,
          response: 'AI system is not available. Please try again later.',
          type: 'error',
        };
      }

      // Get user context
      const context = this.buildUserContext();

      // Process with AI
      const response = await this.contextAwareAI.processUserInput(input, context);

      this.logger.audit('AI_INTERACTION', {
        input: input.substring(0, 100), // Log first 100 chars only
        responseLength: response.length,
      });

      return {
        success: true,
        response,
        type: 'ai',
      };
    } catch (error) {
      this.logger.error('AI processing failed', error);
      return {
        success: false,
        response: 'Sorry, I encountered an error. Please try again.',
        type: 'error',
      };
    }
  }

  /**
   * Build user context for AI
   * @returns {Object} User context
   */
  buildUserContext() {
    try {
      const user = this.authManager?.getCurrentUser();
      const recentWorkouts = this.workoutTracker?.getWorkoutHistory(5) || [];
      const seasonalPhase = this.seasonalTraining?.getCurrentPhase() || null;

      return {
        user: user
          ? {
              username: user.username,
              goals: user.goals,
              personalData: user.personalData,
              experience: user.personalData?.experience || 'beginner',
            }
          : null,
        recentWorkouts: recentWorkouts.map(workout => ({
          type: workout.type,
          duration: workout.duration,
          exercises: workout.exercises.length,
          date: workout.startTime,
        })),
        seasonalPhase: seasonalPhase
          ? {
              phase: seasonalPhase.phase,
              name: seasonalPhase.details?.name,
              focus: seasonalPhase.details?.focus,
            }
          : null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to build user context', error);
      return {};
    }
  }

  /**
   * Generate workout recommendations
   * @param {Object} userProfile - User profile
   * @returns {Object} Workout recommendations
   */
  generateWorkoutRecommendations(userProfile) {
    try {
      const recommendations = {
        exercises: [],
        duration: 60,
        intensity: 'moderate',
        focus: 'general',
        notes: '',
      };

      // Get seasonal recommendations if available
      if (this.seasonalTraining) {
        const phaseRecommendations = this.seasonalTraining.getPhaseRecommendations();
        if (phaseRecommendations.length > 0) {
          recommendations.notes = phaseRecommendations[0].message;
          recommendations.focus = phaseRecommendations[0].category;
        }
      }

      // Get pattern-based recommendations
      if (this.patternDetector && this.authManager?.isUserLoggedIn()) {
        const user = this.authManager.getCurrentUser();
        const analysis = this.patternDetector.analyzePatterns(user.data || {}, userProfile);

        if (analysis.recommendations && analysis.recommendations.length > 0) {
          recommendations.notes += ` ${analysis.recommendations[0].message}`;
        }
      }

      // Generate exercise recommendations based on goals
      recommendations.exercises = this.getExerciseRecommendations(userProfile);

      this.logger.debug('Workout recommendations generated', {
        exerciseCount: recommendations.exercises.length,
      });

      return recommendations;
    } catch (error) {
      this.logger.error('Failed to generate workout recommendations', error);
      return {
        exercises: [],
        duration: 60,
        intensity: 'moderate',
        focus: 'general',
        notes: 'Unable to generate recommendations at this time.',
      };
    }
  }

  /**
   * Get exercise recommendations based on user profile
   * @param {Object} userProfile - User profile
   * @returns {Array} Exercise recommendations
   */
  getExerciseRecommendations(userProfile) {
    const goal = userProfile.goals?.primary || 'strength';
    const experience = userProfile.personalData?.experience || 'beginner';

    const exerciseSets = {
      strength: {
        beginner: ['Push-ups', 'Squats', 'Plank', 'Lunges', 'Glute Bridges'],
        intermediate: ['Bench Press', 'Squats', 'Deadlifts', 'Overhead Press', 'Rows'],
        advanced: [
          'Bench Press',
          'Squats',
          'Deadlifts',
          'Overhead Press',
          'Rows',
          'Pull-ups',
          'Dips',
        ],
      },
      endurance: {
        beginner: ['Push-ups', 'Squats', 'Plank', 'Lunges', 'Burpees'],
        intermediate: [
          'Push-ups',
          'Squats',
          'Lunges',
          'Burpees',
          'Mountain Climbers',
          'Jumping Jacks',
        ],
        advanced: [
          'Burpees',
          'Mountain Climbers',
          'Jumping Jacks',
          'High Knees',
          'Jump Squats',
          'Plank Jacks',
        ],
      },
      speed: {
        beginner: ['Sprints', 'Agility Ladder', 'Jump Rope', 'High Knees', 'Butt Kicks'],
        intermediate: [
          'Sprints',
          'Agility Ladder',
          'Jump Rope',
          'High Knees',
          'Butt Kicks',
          'Lateral Shuffles',
        ],
        advanced: [
          'Sprints',
          'Agility Ladder',
          'Jump Rope',
          'High Knees',
          'Butt Kicks',
          'Lateral Shuffles',
          'Plyometric Jumps',
        ],
      },
    };

    return exerciseSets[goal]?.[experience] || exerciseSets.strength.beginner;
  }

  /**
   * Analyze user patterns and provide insights
   * @returns {Object} Pattern analysis and insights
   */
  analyzeUserPatterns() {
    try {
      if (!this.patternDetector || !this.authManager?.isUserLoggedIn()) {
        return {
          success: false,
          message: 'Pattern analysis not available',
        };
      }

      const user = this.authManager.getCurrentUser();
      const userProfile = this.buildUserProfile(user);

      const analysis = this.patternDetector.analyzePatterns(user.data || {}, userProfile);

      // Store analysis results
      if (!user.analysis) {
        user.analysis = {};
      }
      user.analysis.patterns = analysis.patterns;
      user.analysis.insights = analysis.insights;
      user.analysis.recommendations = analysis.recommendations;

      // Save updated user data
      this.authManager.updateUserData(user);

      this.logger.audit('PATTERN_ANALYSIS_COMPLETED', {
        insights: analysis.insights?.length || 0,
        recommendations: analysis.recommendations?.length || 0,
      });

      return {
        success: true,
        analysis,
        message: 'Pattern analysis completed successfully',
      };
    } catch (error) {
      this.logger.error('Pattern analysis failed', error);
      return {
        success: false,
        message: 'Pattern analysis failed. Please try again.',
      };
    }
  }

  /**
   * Build user profile for analysis
   * @param {Object} user - User data
   * @returns {Object} User profile
   */
  buildUserProfile(user) {
    return {
      goals: user.goals || {},
      experience: user.personalData?.experience || 'beginner',
      personalData: user.personalData || {},
      currentPhase: this.seasonalTraining?.getCurrentPhase()?.phase || 'off-season',
      recentWorkouts: user.data?.sessions || [],
      preferences: {
        preferredTimes: [],
        favoriteExercises: [],
        intensityPreference: 'moderate',
        sessionLength: 'medium',
        restDayPattern: {},
      },
    };
  }

  /**
   * Get seasonal training recommendations
   * @returns {Object} Seasonal recommendations
   */
  getSeasonalRecommendations() {
    try {
      if (!this.seasonalTraining) {
        return {
          success: false,
          message: 'Seasonal training not available',
        };
      }

      const currentPhase = this.seasonalTraining.getCurrentPhase();
      const recommendations = this.seasonalTraining.getPhaseRecommendations();
      const upcomingGames = this.seasonalTraining.getUpcomingGames(3);

      return {
        success: true,
        currentPhase,
        recommendations,
        upcomingGames,
      };
    } catch (error) {
      this.logger.error('Failed to get seasonal recommendations', error);
      return {
        success: false,
        message: 'Failed to get seasonal recommendations',
      };
    }
  }

  /**
   * Generate personalized coaching message
   * @param {string} context - Coaching context
   * @returns {string} Coaching message
   */
  generateCoachingMessage(context) {
    try {
      const user = this.authManager?.getCurrentUser();
      if (!user) {
        return 'Please log in to receive personalized coaching.';
      }

      const messages = {
        welcome: `Welcome back, ${user.athleteName || user.username}! Ready to crush your goals today?`,
        motivation: 'Every workout brings you closer to your goals. Keep pushing!',
        recovery: 'Rest and recovery are just as important as training. Listen to your body.',
        progress: 'Consistency is key. Small improvements add up to big results.',
        seasonal: this.getSeasonalMessage(),
      };

      return messages[context] || messages.motivation;
    } catch (error) {
      this.logger.error('Failed to generate coaching message', error);
      return 'Stay focused and keep working towards your goals!';
    }
  }

  /**
   * Get seasonal coaching message
   * @returns {string} Seasonal message
   */
  getSeasonalMessage() {
    try {
      if (!this.seasonalTraining) {
        return 'Focus on consistent training and gradual improvement.';
      }

      const phase = this.seasonalTraining.getCurrentPhase();
      const phaseMessages = {
        'off-season':
          'Perfect time to build strength and work on weaknesses. Focus on fundamentals.',
        'pre-season':
          'Time to ramp up intensity and sport-specific training. Get ready for competition!',
        'in-season': 'Maintain your fitness while managing game load. Quality over quantity.',
        playoffs: 'Peak performance time! Focus on recovery and mental preparation.',
      };

      return phaseMessages[phase.phase] || 'Stay consistent with your training routine.';
    } catch (error) {
      return 'Focus on consistent training and gradual improvement.';
    }
  }

  /**
   * Get quick action responses
   * @param {string} action - Quick action type
   * @returns {string} Response message
   */
  getQuickActionResponse(action) {
    const responses = {
      injury:
        "I understand you're dealing with an injury. Let's adjust your workout to focus on safe, modified exercises that won't aggravate the injury. What specific area is affected?",
      fatigue:
        "Feeling fatigued is normal, especially after intense training. Let's focus on recovery - light movement, proper nutrition, and adequate sleep. Consider taking an extra rest day.",
      goals:
        'Great! Changing goals is part of the journey. What new goals are you considering? I can help adjust your training plan accordingly.',
      schedule:
        "Let's work on your workout schedule. What days work best for you? I can help create a realistic plan that fits your lifestyle.",
    };

    return responses[action] || 'How can I help you with your training today?';
  }

  /**
   * Get AI system status
   * @returns {Object} System status
   */
  getSystemStatus() {
    return {
      contextAwareAI: !!this.contextAwareAI,
      seasonalTraining: !!this.seasonalTraining,
      patternDetector: !!this.patternDetector,
      userLoggedIn: this.authManager?.isUserLoggedIn() || false,
    };
  }
}

// Create global instance
window.CoachingEngine = new CoachingEngine();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CoachingEngine;
}
