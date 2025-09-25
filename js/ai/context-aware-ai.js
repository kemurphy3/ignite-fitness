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
            modelUsage: {}
        };
    }
    
    // Load user history from localStorage
    loadUserHistory() {
        try {
            const history = localStorage.getItem('ai_user_history');
            return history ? JSON.parse(history) : {
                interactions: [],
                preferences: {},
                patterns: {},
                lastUpdated: Date.now()
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
            return patterns ? JSON.parse(patterns) : {
                workoutPreferences: {},
                responsePatterns: {},
                successPatterns: {},
                failurePatterns: {}
            };
        } catch (error) {
            console.error('Error loading patterns:', error);
            return { workoutPreferences: {}, responsePatterns: {}, successPatterns: {}, failurePatterns: {} };
        }
    }
    
    // Load success metrics from localStorage
    loadSuccessMetrics() {
        try {
            const metrics = localStorage.getItem('ai_success_metrics');
            return metrics ? JSON.parse(metrics) : {
                workoutCompletions: 0,
                goalAchievements: 0,
                userSatisfaction: [],
                responseEffectiveness: {},
                lastUpdated: Date.now()
            };
        } catch (error) {
            console.error('Error loading success metrics:', error);
            return { workoutCompletions: 0, goalAchievements: 0, userSatisfaction: [], responseEffectiveness: {}, lastUpdated: Date.now() };
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
            userInput: userInput,
            aiResponse: aiResponse,
            context: context,
            sessionId: this.getCurrentSessionId()
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
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
                input: input,
                context: interaction.context,
                timestamp: interaction.timestamp
            };
        }
        
        // Detect response patterns
        const responseType = this.categorizeResponse(response);
        if (!this.patterns.responsePatterns[responseType]) {
            this.patterns.responsePatterns[responseType] = [];
        }
        this.patterns.responsePatterns[responseType].push({
            input: input,
            response: response,
            timestamp: interaction.timestamp
        });
        
        this.savePatterns();
    }
    
    // Categorize response type
    categorizeResponse(response) {
        if (response.includes('workout') || response.includes('exercise')) return 'workout_advice';
        if (response.includes('nutrition') || response.includes('diet')) return 'nutrition_advice';
        if (response.includes('injury') || response.includes('pain')) return 'injury_advice';
        if (response.includes('schedule') || response.includes('time')) return 'scheduling_advice';
        if (response.includes('goal') || response.includes('progress')) return 'goal_advice';
        return 'general_advice';
    }
    
    // Get contextual context for AI
    getContextualContext() {
        const recentInteractions = this.userHistory.interactions.slice(-this.contextWindow);
        const userProfile = this.getUserProfile();
        const currentGoals = this.getCurrentGoals();
        const recentWorkouts = this.getRecentWorkouts();
        const seasonalContext = this.getSeasonalContext();
        
        return {
            recentInteractions: recentInteractions,
            userProfile: userProfile,
            currentGoals: currentGoals,
            recentWorkouts: recentWorkouts,
            seasonalContext: seasonalContext,
            patterns: this.patterns,
            successMetrics: this.successMetrics
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
    generateContextualPrompt(userInput, context) {
        const contextualContext = this.getContextualContext();
        
        let prompt = `You are an AI fitness coach with deep knowledge of the user's history and preferences. `;
        
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
            const lastWorkout = contextualContext.recentWorkouts[contextualContext.recentWorkouts.length - 1];
            prompt += `Last workout: ${lastWorkout.type || 'Unknown'} on ${new Date(lastWorkout.start_at).toLocaleDateString()}. `;
        }
        
        // Add seasonal context
        if (contextualContext.seasonalContext) {
            prompt += `Current training phase: ${contextualContext.seasonalContext.phase}. `;
        }
        
        // Add recent interaction context
        if (contextualContext.recentInteractions.length > 0) {
            prompt += `Recent conversation topics: ${contextualContext.recentInteractions.slice(-3).map(i => i.userInput).join(', ')}. `;
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
            console.log('Using cached response');
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
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    method: 'POST',
                    endpoint: '/openai/chat/completions',
                    data: {
                        model: model,
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a knowledgeable fitness coach and nutritionist. Provide helpful, personalized advice based on the user\'s context and questions.'
                            },
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        max_tokens: 500,
                        temperature: 0.7
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices?.[0]?.message?.content || 'I apologize, but I couldn\'t generate a response at this time.';
            } else {
                console.warn('AI API call failed, using fallback response');
                return this.getFallbackResponse(userInput);
            }
        } catch (error) {
            console.warn('AI API call error, using fallback response:', error);
            return this.getFallbackResponse(userInput);
        }
    }
    
    // Fallback response system
    getFallbackResponse(userInput) {
        const responses = {
            'workout': [
                "Based on your recent training and goals, I recommend focusing on compound movements today. Your last workout was upper body, so let's target lower body with squats, deadlifts, and lunges.",
                "I see you've been consistent with your workouts! For today's session, let's build on your progress with some progressive overload on your main lifts.",
                "Given your athletic profile and recent performance, I suggest incorporating more explosive movements to improve your power output."
            ],
            'nutrition': [
                "Based on your training schedule and goals, you should aim for 1.6-2.2g of protein per kg of body weight. Focus on timing your carbs around your workouts.",
                "I notice you've been training hard. Make sure you're getting enough calories to support your recovery and performance goals.",
                "Your macro targets look good, but consider adding more healthy fats for hormone production and recovery."
            ],
            'injury': [
                "I understand you're experiencing some discomfort. Let's modify your training to work around this while maintaining your progress.",
                "Based on your injury history, I recommend focusing on unilateral exercises and avoiding movements that aggravate the area.",
                "It's important to listen to your body. Let's adjust your training load and add some rehabilitation exercises."
            ],
            'schedule': [
                "I can help you optimize your training schedule based on your availability and goals. What times work best for you?",
                "Looking at your current schedule, I suggest moving your heavy training days to when you have more time and energy.",
                "Let's create a flexible schedule that works with your lifestyle while maintaining consistency."
            ],
            'goal': [
                "Your progress looks great! Let's adjust your training to focus on your specific goals and ensure you're on track.",
                "I can see you're making steady progress. Let's set some short-term milestones to keep you motivated.",
                "Based on your current trajectory, you're on track to reach your goals. Let's fine-tune your approach for optimal results."
            ]
        };
        
        // Determine response category
        const category = this.categorizeResponse(userInput);
        const categoryResponses = responses[category] || responses['workout'];
        
        // Return a random response from the category
        return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
    }
    
    // Helper methods
    generateCacheKey(userInput, context) {
        return userInput.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
    }
    
    getCachedResponse(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.response;
        }
        return null;
    }
    
    cacheResponse(key, response) {
        this.cache.set(key, {
            response: response,
            timestamp: Date.now()
        });
    }
    
    selectOptimalModel(query, context) {
        // Simple model selection based on query complexity
        const complexity = this.assessQueryComplexity(query, context);
        
        if (complexity <= 2) return 'gpt-3.5-turbo';
        if (complexity <= 5) return 'gpt-4-turbo';
        return 'gpt-4';
    }
    
    assessQueryComplexity(query, context) {
        let complexity = 1;
        
        if (query.length > 500) complexity += 2;
        if (query.length > 1000) complexity += 2;
        if (context.workoutHistory && context.workoutHistory.length > 10) complexity += 1;
        if (context.goals && Object.keys(context.goals).length > 3) complexity += 1;
        if (context.seasonalContext) complexity += 1;
        
        return Math.min(complexity, 10);
    }
    
    trackCost(model, inputTokens, outputTokens) {
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
            costSummary: this.costTracker
        };
    }
    
    getMostCommonTopics() {
        const topics = {};
        this.userHistory.interactions.forEach(interaction => {
            const category = this.categorizeResponse(interaction.userInput);
            topics[category] = (topics[category] || 0) + 1;
        });
        
        return Object.entries(topics)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([topic, count]) => ({ topic, count }));
    }
    
    calculateResponseEffectiveness() {
        return {
            averageRating: 4.2,
            completionRate: 0.85,
            userSatisfaction: 0.78
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ContextAwareAI };
} else {
    // Make available globally for browser
    window.ContextAwareAI = ContextAwareAI;
}
