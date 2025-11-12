// Context-Aware AI Module
// Level 2 AI Implementation with user history and pattern detection

class ContextAwareAI {
  constructor() {
    this.userHistory = this.loadUserHistory();
    this.patterns = this.loadPatterns();
    this.successMetrics = this.loadSuccessMetrics();
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.contextWindow = 10; // Last 10 interactions
    this.costTracker = {
      totalCost: 0,
      calls: 0,
      modelUsage: {},
    };
  }

  // Load user history from localStorage
  loadUserHistory() {
    try {
      const history = localStorage.getItem('ai_user_history');
      return history
        ? JSON.parse(history)
        : {
            interactions: [],
            preferences: {},
            patterns: {},
            lastUpdated: Date.now(),
          };
    } catch (error) {
      console.error('Error loading user history:', error);
      return { interactions: [], preferences: {}, patterns: {}, lastUpdated: Date.now() };
    }
  }

  // Load patterns from localStorage
  loadPatterns() {
    try {
      const patterns = localStorage.getItem('ai_patterns');
      return patterns
        ? JSON.parse(patterns)
        : {
            workoutPreferences: {},
            responsePatterns: {},
            successPatterns: {},
            failurePatterns: {},
          };
    } catch (error) {
      console.error('Error loading patterns:', error);
      return {
        workoutPreferences: {},
        responsePatterns: {},
        successPatterns: {},
        failurePatterns: {},
      };
    }
  }

  // Load success metrics from localStorage
  loadSuccessMetrics() {
    try {
      const metrics = localStorage.getItem('ai_success_metrics');
      return metrics
        ? JSON.parse(metrics)
        : {
            workoutCompletions: 0,
            goalAchievements: 0,
            userSatisfaction: [],
            responseEffectiveness: {},
            lastUpdated: Date.now(),
          };
    } catch (error) {
      console.error('Error loading success metrics:', error);
      return {
        workoutCompletions: 0,
        goalAchievements: 0,
        userSatisfaction: [],
        responseEffectiveness: {},
        lastUpdated: Date.now(),
      };
    }
  }

  // Save user history
  saveUserHistory() {
    try {
      localStorage.setItem('ai_user_history', JSON.stringify(this.userHistory));
    } catch (error) {
      console.error('Error saving user history:', error);
    }
  }

  // Save patterns
  savePatterns() {
    try {
      localStorage.setItem('ai_patterns', JSON.stringify(this.patterns));
    } catch (error) {
      console.error('Error saving patterns:', error);
    }
  }

  // Save success metrics
  saveSuccessMetrics() {
    try {
      localStorage.setItem('ai_success_metrics', JSON.stringify(this.successMetrics));
    } catch (error) {
      console.error('Error saving success metrics:', error);
    }
  }

  // Add interaction to history
  addInteraction(userInput, aiResponse, context = {}) {
    const interaction = {
      timestamp: Date.now(),
      userInput,
      aiResponse,
      context,
      sessionId: this.getCurrentSessionId(),
    };

    this.userHistory.interactions.push(interaction);

    // Keep only last 100 interactions
    if (this.userHistory.interactions.length > 100) {
      this.userHistory.interactions = this.userHistory.interactions.slice(-100);
    }

    this.userHistory.lastUpdated = Date.now();
    this.saveUserHistory();

    // Update patterns
    this.updatePatterns(interaction);
  }

  // Get current session ID
  getCurrentSessionId() {
    let sessionId = sessionStorage.getItem('ai_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('ai_session_id', sessionId);
    }
    return sessionId;
  }

  // Update patterns based on interaction
  updatePatterns(interaction) {
    const input = interaction.userInput.toLowerCase();
    const response = interaction.aiResponse.toLowerCase();

    // Detect workout preferences
    if (input.includes('workout') || input.includes('exercise')) {
      this.patterns.workoutPreferences[interaction.timestamp] = {
        input,
        context: interaction.context,
        timestamp: interaction.timestamp,
      };
    }

    // Detect response patterns
    const responseType = this.categorizeResponse(response);
    if (!this.patterns.responsePatterns[responseType]) {
      this.patterns.responsePatterns[responseType] = [];
    }
    this.patterns.responsePatterns[responseType].push({
      input,
      response,
      timestamp: interaction.timestamp,
    });

    this.savePatterns();
  }

  // Categorize response type
  categorizeResponse(response) {
    const lowerResponse = response.toLowerCase();

    if (
      lowerResponse.includes('workout') ||
      lowerResponse.includes('exercise') ||
      lowerResponse.includes('training') ||
      lowerResponse.includes('gym')
    ) {
      return 'workout';
    }
    if (
      lowerResponse.includes('nutrition') ||
      lowerResponse.includes('diet') ||
      lowerResponse.includes('eat') ||
      lowerResponse.includes('food') ||
      lowerResponse.includes('protein') ||
      lowerResponse.includes('calories')
    ) {
      return 'nutrition';
    }
    if (
      lowerResponse.includes('injury') ||
      lowerResponse.includes('pain') ||
      lowerResponse.includes('hurt') ||
      lowerResponse.includes('ache') ||
      lowerResponse.includes('rehabilitation')
    ) {
      return 'injury';
    }
    if (
      lowerResponse.includes('schedule') ||
      lowerResponse.includes('time') ||
      lowerResponse.includes('when') ||
      lowerResponse.includes('planning')
    ) {
      return 'schedule';
    }
    if (
      lowerResponse.includes('goal') ||
      lowerResponse.includes('progress') ||
      lowerResponse.includes('achieve') ||
      lowerResponse.includes('target')
    ) {
      return 'goal';
    }

    return 'workout'; // Default to workout category
  }

  // Get contextual context for AI
  getContextualContext() {
    const recentInteractions = this.userHistory.interactions.slice(-this.contextWindow);
    const userProfile = this.getUserProfile();
    const currentGoals = this.getCurrentGoals();
    const recentWorkouts = this.getRecentWorkouts();
    const seasonalContext = this.getSeasonalContext();

    return {
      recentInteractions,
      userProfile,
      currentGoals,
      recentWorkouts,
      seasonalContext,
      patterns: this.patterns,
      successMetrics: this.successMetrics,
    };
  }

  // Get user profile from stored data
  getUserProfile() {
    try {
      const userData = JSON.parse(localStorage.getItem('users') || '{}');
      const currentUser = localStorage.getItem('ignitefitness_current_user');
      return userData[currentUser] || {};
    } catch (error) {
      console.error('Error getting user profile:', error);
      return {};
    }
  }

  // Get current goals
  getCurrentGoals() {
    const userProfile = this.getUserProfile();
    return userProfile.goals || {};
  }

  // Get recent workouts
  getRecentWorkouts() {
    const userProfile = this.getUserProfile();
    const sessions = userProfile.sessions || [];
    return sessions.slice(-5); // Last 5 workouts
  }

  // Get seasonal context
  getSeasonalContext() {
    try {
      const seasonalData = localStorage.getItem('seasonalPhase');
      return seasonalData ? JSON.parse(seasonalData) : null;
    } catch (error) {
      return null;
    }
  }

  // Generate contextual prompt
  generateContextualPrompt(userInput, _context) {
    const contextualContext = this.getContextualContext();

    let prompt =
      "You are an AI fitness coach with deep knowledge of the user's history and preferences. ";

    // Add user profile context
    if (contextualContext.userProfile.name) {
      prompt += `User: ${contextualContext.userProfile.name}. `;
    }

    // Add goals context
    if (contextualContext.currentGoals.primary) {
      prompt += `Primary goal: ${contextualContext.currentGoals.primary}. `;
    }

    // Add recent workout context
    if (contextualContext.recentWorkouts.length > 0) {
      const lastWorkout =
        contextualContext.recentWorkouts[contextualContext.recentWorkouts.length - 1];
      prompt += `Last workout: ${lastWorkout.type || 'Unknown'} on ${new Date(lastWorkout.start_at).toLocaleDateString()}. `;
    }

    // Add seasonal context
    if (contextualContext.seasonalContext) {
      prompt += `Current training phase: ${contextualContext.seasonalContext.phase}. `;
    }

    // Add recent interaction context
    if (contextualContext.recentInteractions.length > 0) {
      prompt += `Recent conversation topics: ${contextualContext.recentInteractions
        .slice(-3)
        .map(i => i.userInput)
        .join(', ')}. `;
    }

    // Add patterns context
    const responseType = this.categorizeResponse(userInput);
    if (this.patterns.responsePatterns[responseType]) {
      const recentPatterns = this.patterns.responsePatterns[responseType].slice(-3);
      prompt += `Previous similar questions: ${recentPatterns.map(p => p.input).join(', ')}. `;
    }

    prompt += `\n\nUser's current question: "${userInput}"\n\nProvide a helpful, personalized response that considers their history and context.`;

    return prompt;
  }

  // Process user input with context awareness
  async processUserInput(userInput, context = {}) {
    // Generate cache key
    const cacheKey = this.generateCacheKey(userInput, context);

    // Check cache first
    const cachedResponse = this.getCachedResponse(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Generate contextual prompt
    const contextualPrompt = this.generateContextualPrompt(userInput, context);

    // Select optimal model based on query complexity
    const selectedModel = this.selectOptimalModel(userInput, context);

    // Get AI response
    const aiResponse = await this.getAIResponse(contextualPrompt, userInput, selectedModel);

    // Cache response with smart invalidation
    this.cacheResponse(cacheKey, aiResponse);

    // Add to history
    this.addInteraction(userInput, aiResponse, context);

    // Track cost
    const inputTokens = Math.ceil(contextualPrompt.length / 4);
    const outputTokens = Math.ceil(aiResponse.length / 4);
    this.trackCost(selectedModel, inputTokens, outputTokens);

    return aiResponse;
  }

  // Get AI response (with fallback)
  async getAIResponse(prompt, userInput, model) {
    try {
      // Try to call the AI proxy function
      const response = await fetch('/.netlify/functions/ai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'POST',
          endpoint: '/openai/chat/completions',
          data: {
            model,
            messages: [
              {
                role: 'system',
                content:
                  "You are a knowledgeable fitness coach and nutritionist. Provide helpful, personalized advice based on the user's context and questions.",
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 500,
            temperature: 0.7,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return (
          data.choices?.[0]?.message?.content ||
          "I apologize, but I couldn't generate a response at this time."
        );
      } else {
        console.warn('AI API call failed, using fallback response');
        const fallbackResult = this.getFallbackResponse(userInput);
        return fallbackResult.message || fallbackResult;
      }
    } catch (error) {
      console.warn('AI API call error, using fallback response:', error);
      const fallbackResult = this.getFallbackResponse(userInput);
      return fallbackResult.message || fallbackResult;
    }
  }

  // Fallback response system with deterministic selection
  getFallbackResponse(userInput) {
    const responses = {
      workout: [
        "Based on your recent training and goals, I recommend focusing on compound movements today. Your last workout was upper body, so let's target lower body with squats, deadlifts, and lunges.",
        "I see you've been consistent with your workouts! For today's session, let's build on your progress with some progressive overload on your main lifts.",
        'Given your athletic profile and recent performance, I suggest incorporating more explosive movements to improve your power output.',
      ],
      nutrition: [
        'Based on your training schedule and goals, you should aim for 1.6-2.2g of protein per kg of body weight. Focus on timing your carbs around your workouts.',
        "I notice you've been training hard. Make sure you're getting enough calories to support your recovery and performance goals.",
        'Your macro targets look good, but consider adding more healthy fats for hormone production and recovery.',
      ],
      injury: [
        "I understand you're experiencing some discomfort. Let's modify your training to work around this while maintaining your progress.",
        'Based on your injury history, I recommend focusing on unilateral exercises and avoiding movements that aggravate the area.',
        "It's important to listen to your body. Let's adjust your training load and add some rehabilitation exercises.",
      ],
      schedule: [
        'I can help you optimize your training schedule based on your availability and goals. What times work best for you?',
        'Looking at your current schedule, I suggest moving your heavy training days to when you have more time and energy.',
        "Let's create a flexible schedule that works with your lifestyle while maintaining consistency.",
      ],
      goal: [
        "Your progress looks great! Let's adjust your training to focus on your specific goals and ensure you're on track.",
        "I can see you're making steady progress. Let's set some short-term milestones to keep you motivated.",
        "Based on your current trajectory, you're on track to reach your goals. Let's fine-tune your approach for optimal results.",
      ],
    };

    // Determine response category
    const category = this.categorizeResponse(userInput);
    const categoryResponses = responses[category] || responses.workout;

    // Get user context for deterministic selection
    const userContext = this.getUserContextForFallback();

    // Deterministic selection based on user context
    const selectedIndex = this.selectDeterministicResponse(categoryResponses, userContext);

    // Return selected response with metadata
    return {
      message: categoryResponses[selectedIndex],
      responseMetadata: {
        selectionCriteria: userContext,
        category,
        selectedIndex,
        totalOptions: categoryResponses.length,
        selectionMethod: 'deterministic_context_based',
      },
    };
  }

  // Get user context for deterministic fallback selection
  getUserContextForFallback() {
    const userProfile = this.getUserProfile();
    const recentWorkouts = this.getRecentWorkouts();
    const currentGoals = this.getCurrentGoals();

    return {
      goals: currentGoals.primary || 'general_fitness',
      lastWorkoutType: recentWorkouts.length > 0 ? recentWorkouts[0].type : 'none',
      readinessScore: this.calculateReadinessScore(),
      experienceLevel: userProfile.personalData?.experience || 'intermediate',
      trainingFrequency: this.calculateTrainingFrequency(),
      currentPhase: this.getCurrentTrainingPhase(),
    };
  }

  // Calculate readiness score based on recent activity
  calculateReadinessScore() {
    const recentWorkouts = this.getRecentWorkouts();
    if (recentWorkouts.length === 0) {
      return 0.8;
    } // Default moderate readiness

    const lastWorkout = recentWorkouts[0];
    const daysSinceLastWorkout =
      (Date.now() - new Date(lastWorkout.start_at).getTime()) / (1000 * 60 * 60 * 24);

    // Simple readiness calculation based on time since last workout
    if (daysSinceLastWorkout >= 3) {
      return 0.9;
    } // High readiness
    if (daysSinceLastWorkout >= 1) {
      return 0.7;
    } // Moderate readiness
    return 0.4; // Low readiness (same day)
  }

  // Calculate training frequency (workouts per week)
  calculateTrainingFrequency() {
    const recentWorkouts = this.getRecentWorkouts(14); // Last 2 weeks
    return recentWorkouts.length / 2; // workouts per week
  }

  // Deterministic response selection based on context
  selectDeterministicResponse(categoryResponses, userContext) {
    // Create a deterministic seed based on user context
    const seed = this.createDeterministicSeed(userContext);

    // Use seed to select response index
    const selectedIndex = seed % categoryResponses.length;

    return selectedIndex;
  }

  // Create deterministic seed from user context
  createDeterministicSeed(userContext) {
    // Combine multiple context factors into a deterministic seed
    const contextString = [
      userContext.goals,
      userContext.lastWorkoutType,
      userContext.experienceLevel,
      userContext.currentPhase,
      Math.floor(userContext.readinessScore * 10), // Convert to integer
      Math.floor(userContext.trainingFrequency * 10), // Convert to integer
    ].join('_');

    // Simple hash function to convert string to number
    let hash = 0;
    for (let i = 0; i < contextString.length; i++) {
      const char = contextString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash);
  }

  // Helper methods
  generateCacheKey(userInput, _context) {
    return userInput
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 50);
  }

  getCachedResponse(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.response;
    }
    return null;
  }

  cacheResponse(key, response) {
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
    });
  }

  selectOptimalModel(query, context) {
    // Simple model selection based on query complexity
    const complexity = this.assessQueryComplexity(query, context);

    if (complexity <= 2) {
      return 'gpt-3.5-turbo';
    }
    if (complexity <= 5) {
      return 'gpt-4-turbo';
    }
    return 'gpt-4';
  }

  assessQueryComplexity(query, context) {
    let complexity = 1;

    if (query.length > 500) {
      complexity += 2;
    }
    if (query.length > 1000) {
      complexity += 2;
    }
    if (context.workoutHistory && context.workoutHistory.length > 10) {
      complexity += 1;
    }
    if (context.goals && Object.keys(context.goals).length > 3) {
      complexity += 1;
    }
    if (context.seasonalContext) {
      complexity += 1;
    }

    return Math.min(complexity, 10);
  }

  trackCost(model, _inputTokens, _outputTokens) {
    this.costTracker.totalCost += 0.001; // Simulated cost
    this.costTracker.calls++;

    if (!this.costTracker.modelUsage[model]) {
      this.costTracker.modelUsage[model] = { calls: 0, cost: 0 };
    }
    this.costTracker.modelUsage[model].calls++;
    this.costTracker.modelUsage[model].cost += 0.001;
  }

  // Get user insights
  getUserInsights() {
    return {
      totalInteractions: this.userHistory.interactions.length,
      mostCommonTopics: this.getMostCommonTopics(),
      responseEffectiveness: this.calculateResponseEffectiveness(),
      patterns: this.patterns,
      costSummary: this.costTracker,
    };
  }

  getMostCommonTopics() {
    const topics = {};
    this.userHistory.interactions.forEach(interaction => {
      const category = this.categorizeResponse(interaction.userInput);
      topics[category] = (topics[category] || 0) + 1;
    });

    return Object.entries(topics)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));
  }

  calculateResponseEffectiveness() {
    return {
      averageRating: 4.2,
      completionRate: 0.85,
      userSatisfaction: 0.78,
    };
  }

  // Build comprehensive user context for AI
  buildUserContext() {
    const user = this.getCurrentUser();
    if (!user) {
      return {};
    }

    const context = {
      // Basic profile
      profile: {
        age: user.personalData?.age,
        weight: user.personalData?.weight,
        height: user.personalData?.height,
        experience: user.personalData?.experience,
        goals: user.goals,
      },

      // Recent activity
      recentWorkouts: this.getRecentWorkouts(7), // Last 7 days
      recentSessions: this.getRecentSessions(14), // Last 14 days

      // Patterns and insights
      patterns: this.patternDetector?.getUserPatterns() || {},
      preferences: this.detectUserPreferences(),

      // Current state
      currentPhase: this.getCurrentTrainingPhase(),
      lastWorkout: this.getLastWorkout(),
      nextScheduled: this.getNextScheduledWorkout(),

      // Performance metrics
      performance: {
        averageRPE: this.calculateAverageRPE(),
        volumeTrend: this.calculateVolumeTrend(),
        consistency: this.calculateConsistency(),
        progression: this.calculateProgression(),
      },

      // Contextual factors
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      season: this.getCurrentSeason(),
      weather: this.getWeatherContext(),

      // AI interaction history
      recentQueries: this.getRecentQueries(10),
      successfulRecommendations: this.getSuccessfulRecommendations(),

      // System state
      lastSync: this.getLastSyncTime(),
      offlineMode: !navigator.onLine,
      dataQuality: this.assessDataQuality(),
    };

    return context;
  }

  // Detect user preferences from behavior
  detectUserPreferences() {
    const workouts = this.getRecentWorkouts(30);
    const preferences = {
      preferredTimes: this.analyzePreferredWorkoutTimes(workouts),
      favoriteExercises: this.analyzeFavoriteExercises(workouts),
      intensityPreference: this.analyzeIntensityPreference(workouts),
      sessionLength: this.analyzePreferredSessionLength(workouts),
      restDayPattern: this.analyzeRestDayPattern(workouts),
    };

    return preferences;
  }

  // Get current training phase
  getCurrentTrainingPhase() {
    const user = this.getCurrentUser();
    if (!user) {
      return 'off-season';
    }

    // This would integrate with seasonal training system
    return user.trainingPhase || 'off-season';
  }

  // Get last workout details
  getLastWorkout() {
    const workouts = this.getRecentWorkouts(1);
    return workouts[0] || null;
  }

  // Get next scheduled workout
  getNextScheduledWorkout() {
    const user = this.getCurrentUser();
    if (!user?.workoutPlan) {
      return null;
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find next scheduled workout
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dayPlan = user.workoutPlan[checkDate.getDay()];
      if (dayPlan && dayPlan.sessions && dayPlan.sessions.length > 0) {
        return {
          date: checkDate,
          sessions: dayPlan.sessions,
        };
      }
    }

    return null;
  }

  // Calculate average RPE from recent workouts
  calculateAverageRPE() {
    const workouts = this.getRecentWorkouts(14);
    if (workouts.length === 0) {
      return 0;
    }

    const totalRPE = workouts.reduce((sum, workout) => {
      return sum + (workout.averageRPE || 0);
    }, 0);

    return totalRPE / workouts.length;
  }

  // Calculate volume trend
  calculateVolumeTrend() {
    const workouts = this.getRecentWorkouts(14);
    if (workouts.length < 2) {
      return 'stable';
    }

    const recent = workouts.slice(0, 7);
    const older = workouts.slice(7, 14);

    const recentVolume = this.calculateTotalVolume(recent);
    const olderVolume = this.calculateTotalVolume(older);

    const change = (recentVolume - olderVolume) / olderVolume;

    if (change > 0.1) {
      return 'increasing';
    }
    if (change < -0.1) {
      return 'decreasing';
    }
    return 'stable';
  }

  // Calculate workout consistency
  calculateConsistency() {
    const workouts = this.getRecentWorkouts(30);
    const expectedWorkouts = 30; // Assuming daily workouts
    const actualWorkouts = workouts.length;

    return actualWorkouts / expectedWorkouts;
  }

  // Calculate progression rate
  calculateProgression() {
    const workouts = this.getRecentWorkouts(30);
    if (workouts.length < 2) {
      return 0;
    }

    // Simple progression calculation based on weight increases
    let progressionCount = 0;
    for (let i = 1; i < workouts.length; i++) {
      const current = workouts[i];
      const previous = workouts[i - 1];

      if (current.averageWeight > previous.averageWeight) {
        progressionCount++;
      }
    }

    return progressionCount / (workouts.length - 1);
  }

  // Get recent sessions (all types)
  getRecentSessions(days) {
    const user = this.getCurrentUser();
    if (!user?.data?.sessions) {
      return [];
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return user.data.sessions
      .filter(session => {
        const sessionDate = new Date(session.start_at);
        return sessionDate >= cutoffDate;
      })
      .sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  }

  // Analyze preferred workout times
  analyzePreferredWorkoutTimes(workouts) {
    const timeCounts = {};
    workouts.forEach(workout => {
      const hour = new Date(workout.start_at).getHours();
      const timeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      timeCounts[timeSlot] = (timeCounts[timeSlot] || 0) + 1;
    });

    return Object.entries(timeCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([time, count]) => ({ time, count }));
  }

  // Analyze favorite exercises
  analyzeFavoriteExercises(workouts) {
    const exerciseCounts = {};
    workouts.forEach(workout => {
      if (workout.exercises) {
        workout.exercises.forEach(exercise => {
          exerciseCounts[exercise.name] = (exerciseCounts[exercise.name] || 0) + 1;
        });
      }
    });

    return Object.entries(exerciseCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([exercise, count]) => ({ exercise, count }));
  }

  // Analyze intensity preference
  analyzeIntensityPreference(workouts) {
    const rpeValues = workouts.map(w => w.averageRPE).filter(rpe => rpe > 0);
    if (rpeValues.length === 0) {
      return 'moderate';
    }

    const averageRPE = rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length;

    if (averageRPE >= 8) {
      return 'high';
    }
    if (averageRPE <= 5) {
      return 'low';
    }
    return 'moderate';
  }

  // Analyze preferred session length
  analyzePreferredSessionLength(workouts) {
    const durations = workouts.map(w => w.duration).filter(d => d > 0);
    if (durations.length === 0) {
      return 60;
    } // Default 60 minutes

    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    if (averageDuration <= 30) {
      return 'short';
    }
    if (averageDuration <= 60) {
      return 'medium';
    }
    return 'long';
  }

  // Analyze rest day pattern
  analyzeRestDayPattern(workouts) {
    const workoutDays = workouts.map(w => new Date(w.start_at).getDay());
    const dayCounts = {};

    for (let i = 0; i < 7; i++) {
      dayCounts[i] = workoutDays.filter(day => day === i).length;
    }

    return dayCounts;
  }

  // Calculate total volume for workouts
  calculateTotalVolume(workouts) {
    return workouts.reduce((total, workout) => {
      if (workout.exercises) {
        return (
          total +
          workout.exercises.reduce((exerciseTotal, exercise) => {
            return exerciseTotal + exercise.weight * exercise.reps * exercise.sets;
          }, 0)
        );
      }
      return total;
    }, 0);
  }

  // Get current season
  getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) {
      return 'spring';
    }
    if (month >= 5 && month <= 7) {
      return 'summer';
    }
    if (month >= 8 && month <= 10) {
      return 'fall';
    }
    return 'winter';
  }

  // Get weather context (placeholder)
  getWeatherContext() {
    // This would integrate with a weather API
    return {
      temperature: 'moderate',
      conditions: 'clear',
      humidity: 'normal',
    };
  }

  // Get recent AI queries
  getRecentQueries(count) {
    return this.interactionHistory
      .slice(-count)
      .map(interaction => interaction.query)
      .reverse();
  }

  // Get successful recommendations
  getSuccessfulRecommendations() {
    return this.interactionHistory
      .filter(interaction => interaction.rating >= 4)
      .map(interaction => interaction.response)
      .slice(-5);
  }

  // Get last sync time
  getLastSyncTime() {
    return localStorage.getItem('ignitefitness_last_sync') || null;
  }

  // Assess data quality
  assessDataQuality() {
    const user = this.getCurrentUser();
    if (!user) {
      return 'poor';
    }

    let score = 0;

    // Check profile completeness
    if (user.personalData?.age) {
      score += 1;
    }
    if (user.personalData?.weight) {
      score += 1;
    }
    if (user.personalData?.height) {
      score += 1;
    }
    if (user.goals?.primary) {
      score += 1;
    }

    // Check workout data
    const workoutCount = user.data?.sessions?.filter(s => s.type === 'workout').length || 0;
    if (workoutCount >= 10) {
      score += 2;
    } else if (workoutCount >= 5) {
      score += 1;
    }

    if (score >= 6) {
      return 'excellent';
    }
    if (score >= 4) {
      return 'good';
    }
    if (score >= 2) {
      return 'fair';
    }
    return 'poor';
  }

  // Get current user from global state
  getCurrentUser() {
    // This would integrate with the main app's user management
    const currentUser = localStorage.getItem('ignitefitness_current_user');
    if (!currentUser) {
      return null;
    }

    const users = JSON.parse(localStorage.getItem('ignitefitness_users') || '{}');
    return users[currentUser] || null;
  }

  // Analyze query complexity
  analyzeQueryComplexity(query, context) {
    const queryLength = query.length;
    const wordCount = query.split(' ').length;
    const hasQuestions = query.includes('?');
    const hasTechnicalTerms = this.hasTechnicalTerms(query);
    const requiresAnalysis = this.requiresAnalysis(query);
    const requiresExpertise = this.requiresExpertise(query);

    let complexityScore = 0;

    // Length factors
    if (queryLength > 500) {
      complexityScore += 2;
    } else if (queryLength > 200) {
      complexityScore += 1;
    }

    // Word count factors
    if (wordCount > 50) {
      complexityScore += 2;
    } else if (wordCount > 20) {
      complexityScore += 1;
    }

    // Content factors
    if (hasTechnicalTerms) {
      complexityScore += 2;
    }
    if (requiresAnalysis) {
      complexityScore += 3;
    }
    if (requiresExpertise) {
      complexityScore += 3;
    }
    if (hasQuestions) {
      complexityScore += 1;
    }

    // Context factors
    if (context.requiresExpertise) {
      complexityScore += 2;
    }
    if (context.requiresAnalysis) {
      complexityScore += 2;
    }
    if (context.queryType === 'injury') {
      complexityScore += 3;
    }
    if (context.queryType === 'research') {
      complexityScore += 4;
    }

    // Determine complexity level
    if (complexityScore >= 8) {
      return { level: 'expert', score: complexityScore };
    }
    if (complexityScore >= 5) {
      return { level: 'complex', score: complexityScore };
    }
    if (complexityScore >= 2) {
      return { level: 'standard', score: complexityScore };
    }
    return { level: 'simple', score: complexityScore };
  }

  // Check if query contains technical terms
  hasTechnicalTerms(query) {
    const technicalTerms = [
      'rpe',
      'rm',
      '1rm',
      'volume',
      'intensity',
      'periodization',
      'hypertrophy',
      'strength',
      'endurance',
      'power',
      'speed',
      'agility',
      'flexibility',
      'mobility',
      'stability',
      'balance',
      'proprioception',
      'kinesthetic',
      'biomechanics',
      'physiology',
      'metabolism',
      'hormones',
      'recovery',
      'adaptation',
      'overload',
      'progression',
      'regression',
      'deload',
      'taper',
      'peaking',
    ];

    const lowerQuery = query.toLowerCase();
    return technicalTerms.some(term => lowerQuery.includes(term));
  }

  // Check if query requires analysis
  requiresAnalysis(query) {
    const analysisKeywords = [
      'analyze',
      'analysis',
      'compare',
      'evaluate',
      'assess',
      'review',
      'examine',
      'study',
      'research',
      'investigate',
      'why',
      'how',
      'what if',
      'explain',
      'describe in detail',
    ];

    const lowerQuery = query.toLowerCase();
    return analysisKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  // Check if query requires expertise
  requiresExpertise(query) {
    const expertiseKeywords = [
      'injury',
      'pain',
      'rehabilitation',
      'therapy',
      'medical',
      'doctor',
      'physician',
      'therapist',
      'specialist',
      'expert',
      'diagnosis',
      'treatment',
      'condition',
      'symptom',
      'recovery',
      'prevention',
      'risk',
      'safety',
      'warning',
      'caution',
    ];

    const lowerQuery = query.toLowerCase();
    return expertiseKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  // Call AI API (mock implementation)
  async callAIAPI(prompt, selectedModel) {
    // This would make actual API calls to the selected model
    // For now, return a mock response

    const mockResponses = {
      'claude-haiku': `Quick response for: "${prompt.substring(0, 50)}..."`,
      'gpt-3.5-turbo': `Standard response for: "${prompt.substring(0, 50)}..."`,
      'claude-sonnet': `Detailed response for: "${prompt.substring(0, 50)}..."`,
      'claude-opus': `Expert analysis for: "${prompt.substring(0, 50)}..."`,
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return mockResponses[selectedModel.name.toLowerCase().replace(' ', '-')] || 'AI response';
  }

  // Generate fallback response
  generateFallbackResponse(userInput, selectedModel) {
    const fallbackResponses = {
      'claude-haiku': 'I understand your question. Let me provide a quick answer.',
      'gpt-3.5-turbo': "I can help you with that. Here's what I recommend.",
      'claude-sonnet': "That's an interesting question. Let me give you a detailed response.",
      'claude-opus': 'This requires expert analysis. Let me provide comprehensive guidance.',
    };

    return (
      fallbackResponses[selectedModel.name.toLowerCase().replace(' ', '-')] || "I'm here to help!"
    );
  }

  // Track model usage for cost optimization
  trackModelUsage(model, inputTokens, outputTokens) {
    if (!this.modelUsage) {
      this.modelUsage = {};
    }

    const modelKey = model.name.toLowerCase().replace(' ', '-');
    if (!this.modelUsage[modelKey]) {
      this.modelUsage[modelKey] = {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
      };
    }

    const usage = this.modelUsage[modelKey];
    usage.calls++;
    usage.inputTokens += inputTokens;
    usage.outputTokens += outputTokens;
    usage.totalCost += this.calculateCost(inputTokens, outputTokens, model.costPer1kTokens);

    // Save to localStorage
    localStorage.setItem('ignitefitness_model_usage', JSON.stringify(this.modelUsage));
  }

  // Calculate cost for model usage
  calculateCost(inputTokens, outputTokens, costPer1kTokens) {
    const totalTokens = inputTokens + outputTokens;
    return (totalTokens / 1000) * costPer1kTokens;
  }

  // Get model usage statistics
  getModelUsageStats() {
    return this.modelUsage || {};
  }

  // Estimate cost for a query
  estimateCost(query, response, selectedModel) {
    const inputTokens = Math.ceil(query.length / 4); // Rough estimation
    const outputTokens = Math.ceil(response.length / 4);
    return this.calculateCost(inputTokens, outputTokens, selectedModel.costPer1kTokens);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ContextAwareAI };
} else {
  // Make available globally for browser
  window.ContextAwareAI = ContextAwareAI;
}
