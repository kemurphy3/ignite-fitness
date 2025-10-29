/**
 * PersonalizedCoaching - Context-aware AI coaching with personality
 * Provides personalized coaching responses based on user history, goals, and patterns
 */
class PersonalizedCoaching {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.authManager = window.AuthManager;
        this.storageManager = window.StorageManager;
        this.progressionEngine = window.ProgressionEngine;
        this.dailyCheckIn = window.DailyCheckIn;
        this.dataValidator = window.AIDataValidator;
        
        this.coachingTemplates = this.initializeCoachingTemplates();
        this.contextCache = null;
        this.personalityTraits = this.initializePersonalityTraits();
        this.guardrails = this.initializeGuardrails();
    }

    /**
     * Initialize coaching response templates
     * @returns {Object} Coaching templates
     */
    initializeCoachingTemplates() {
        return {
            progression: {
                strength_gain: "Nice! Your {exercise} has gone up {percentage}% in {weeks} weeks. That's solid progress for someone training {frequency} times per week.",
                plateau: "Your {exercise} has plateaued around {weight}lbs. This is normal after {weeks} weeks of gains. Let's try a deload week - drop to 85% weight but focus on perfect form.",
                breakthrough: "Wow! You just hit a new PR on {exercise} - {weight}lbs! That's {percentage}% stronger than last month. Your consistency is paying off!",
                regression: "I noticed your {exercise} weight dropped a bit. No worries - this happens when life gets busy or stress is high. Let's focus on getting back to your baseline first."
            },
            motivation: {
                streak: "Week {number} in the books. You are building a real habit here. Consistency like this is what separates people who see results from those who do not.",
                return: "Welcome back! Taking {days} days off wasn't a setback - sometimes your body needs that reset. Let's ease back in with a lighter session.",
                consistency: "You've been crushing it with {frequency} workouts per week! This kind of consistency is where the magic happens.",
                comeback: "I love seeing you back in the gym! That break actually might have done you some good - fresh start, renewed motivation."
            },
            performance: {
                high_rpe: "You've been pushing hard lately (average RPE of {rpe}+). Your dedication is awesome, but let's add an extra recovery day this week to avoid burnout.",
                low_energy: "I noticed your energy levels have been lower. Let's focus on sleep quality and maybe try some lighter, more enjoyable workouts.",
                plateau: "Your progress has leveled off - this is totally normal! It means your body has adapted. Time to switch things up with some new challenges.",
                breakthrough: "Your recent workouts show you're getting stronger! That extra effort is translating into real gains."
            },
            recovery: {
                soreness: "High soreness detected - let's focus on mobility and recovery today. Your muscles are telling you they need some TLC.",
                stress: "I see you're dealing with some stress. Exercise is great for that, but let's keep the intensity moderate - we want to help, not add to the stress.",
                fatigue: "Your energy levels suggest you might be overreaching. Let's dial it back and focus on quality over quantity today.",
                readiness: "Your readiness score is {score}/10. Based on how you're feeling, let's adjust today's workout to match your current state."
            },
            seasonal: {
                preseason: "Since {sport} season starts in {weeks} weeks, we're focusing on explosive power and agility. Today's plyometrics will help your first step quickness - think of it as training your muscles to fire faster when you need to beat a defender.",
                in_season: "You're in the middle of {sport} season, so we're maintaining your strength while keeping you fresh for games. Today's session will support your performance without wearing you out.",
                offseason: "Perfect time to build that strength base! With no games to worry about, we can focus on getting you stronger for next season.",
                transition: "Great time to try something new! Let's explore some different training methods while you're between seasons."
            },
            nutrition: {
                energy: "Your energy levels suggest we should look at your nutrition timing. Try having a small snack 30-60 minutes before your workout - it can make a huge difference.",
                recovery: "Your recovery seems slower than usual. Make sure you're getting enough protein and staying hydrated - your muscles need fuel to rebuild.",
                performance: "Your performance has been solid, which suggests your nutrition is on point. Keep doing what you're doing!"
            },
            injury: {
                concern: "I'm not a doctor, but if you're experiencing pain during {exercise}, let's skip it today and try {alternative}. When in doubt, it's always better to be safe.",
                prevention: "Let's focus on proper form and controlled movements today. Good technique is your best injury prevention.",
                recovery: "Take it easy and listen to your body. If something doesn't feel right, we can always modify or skip it."
            }
        };
    }

    /**
     * Initialize personality traits
     * @returns {Object} Personality configuration
     */
    initializePersonalityTraits() {
        return {
            tone: 'casual_competent',
            style: 'encouraging_supportive',
            technical_level: 'explanatory',
            enthusiasm: 'moderate',
            empathy: 'high',
            expertise: 'knowledgeable'
        };
    }

    /**
     * Initialize safety guardrails
     * @returns {Object} Safety guardrails
     */
    initializeGuardrails() {
        return {
            medical_advice: false,
            injury_diagnosis: false,
            diet_prescription: false,
            supplement_recommendations: false,
            defer_to_human: [
                'injury', 'pain', 'medical', 'health_concern'
            ]
        };
    }

    /**
     * Generate personalized coaching response with transparency indicators
     * @param {string} userMessage - User's message
     * @param {Object} context - User context data
     * @returns {Object} Coaching response with transparency data
     */
    generateResponse(userMessage, context = null) {
        try {
            // Get or create context
            const userContext = context || this.getUserContext();
            
            // Analyze user message for intent and sentiment
            const messageAnalysis = this.analyzeUserMessage(userMessage);
            
            // Determine coaching scenario
            const scenario = this.determineCoachingScenario(userContext, messageAnalysis);
            
            // Generate personalized response
            const response = this.createPersonalizedResponse(scenario, userContext, messageAnalysis);
            
            // Apply personality traits
            const personalizedResponse = this.applyPersonalityTraits(response, userContext);
            
            // Apply safety guardrails
            const safeResponse = this.applyGuardrails(personalizedResponse, messageAnalysis);
            
            // Determine response type and confidence
            const transparencyData = this.analyzeResponseTransparency(scenario, userContext, messageAnalysis);
            
            this.logger.debug('Coaching response generated', {
                scenario,
                context: userContext,
                response: safeResponse,
                transparency: transparencyData
            });
            
            return {
                success: true,
                response: safeResponse,
                responseType: transparencyData.responseType,
                confidence: transparencyData.confidence,
                rationale: transparencyData.rationale,
                scenario,
                context: userContext,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Failed to generate coaching response', error);
            return {
                success: false,
                response: "I'm having trouble processing that right now. Can you try rephrasing your question?",
                responseType: "template",
                confidence: 0,
                rationale: "System error - using fallback template",
                error: error.message
            };
        }
    }

    /**
     * Get coaching message with transparency indicators (legacy method for backward compatibility)
     * @param {string} userMessage - User's message
     * @param {Object} context - User context data
     * @returns {Object} Coaching response with transparency data
     */
    getCoachingMessage(userMessage, context = null) {
        return this.generateResponse(userMessage, context);
    }

    /**
     * Analyze response transparency to determine type, confidence, and rationale
     * @param {string} scenario - Coaching scenario
     * @param {Object} context - User context
     * @param {Object} messageAnalysis - Message analysis
     * @returns {Object} Transparency data
     */
    analyzeResponseTransparency(scenario, context, messageAnalysis) {
        // Determine response type based on scenario and data quality
        let responseType = "template";
        let confidence = 0;
        let rationale = "";

        // Check data quality for confidence scoring
        const dataQuality = this.assessDataQuality(context);
        
        switch (scenario) {
            case 'injury':
                responseType = "rule-based";
                confidence = Math.min(95, 60 + dataQuality);
                rationale = "Based on safety protocols and injury prevention guidelines";
                break;
                
            case 'return':
                responseType = "rule-based";
                confidence = Math.min(90, 70 + dataQuality);
                rationale = `Based on ${context.missedWorkouts} missed workouts and return-to-training protocols`;
                break;
                
            case 'recovery':
                responseType = "rule-based";
                confidence = Math.min(85, 65 + dataQuality);
                rationale = `Based on readiness score (${context.readinessScore}/10) and recovery indicators`;
                break;
                
            case 'plateau':
                responseType = "rule-based";
                confidence = Math.min(80, 60 + dataQuality);
                rationale = `Based on progression rate (${(context.progressionRate * 100).toFixed(1)}%) and workout streak (${context.workoutStreak} weeks)`;
                break;
                
            case 'seasonal':
                responseType = "rule-based";
                confidence = Math.min(90, 75 + dataQuality);
                rationale = `Based on ${context.sport} season phase (${context.seasonPhase}) and training periodization`;
                break;
                
            case 'performance':
                responseType = "rule-based";
                confidence = Math.min(85, 70 + dataQuality);
                rationale = `Based on average RPE (${context.averageRPE.toFixed(1)}) and performance metrics`;
                break;
                
            case 'motivation':
                responseType = "template";
                confidence = Math.min(75, 50 + dataQuality);
                rationale = "Based on motivational templates and user engagement patterns";
                break;
                
            default:
                responseType = "template";
                confidence = Math.min(60, 40 + dataQuality);
                rationale = "Based on general coaching templates and limited user data";
        }

        // Adjust confidence based on data availability
        if (dataQuality < 30) {
            responseType = "template";
            confidence = Math.max(20, confidence - 20);
            rationale += " (Limited user data available)";
        }

        return {
            responseType,
            confidence: Math.round(confidence),
            rationale
        };
    }

    /**
     * Assess data quality for confidence scoring
     * @param {Object} context - User context
     * @returns {number} Data quality score (0-100)
     */
    assessDataQuality(context) {
        let qualityScore = 0;
        
        // Check for recent workout data
        if (context.recentWorkouts && context.recentWorkouts.length > 0) {
            qualityScore += 20;
        }
        
        // Check for progression data
        if (context.progressionData && Object.keys(context.progressionData).length > 0) {
            qualityScore += 15;
        }
        
        // Check for daily check-in data
        if (context.readinessScore !== 5 || context.energyLevel !== 5 || context.stressLevel !== 5) {
            qualityScore += 15;
        }
        
        // Check for training history
        if (context.trainingHistory && context.trainingHistory.length > 0) {
            qualityScore += 10;
        }
        
        // Check for user preferences
        if (context.preferences && Object.keys(context.preferences).length > 0) {
            qualityScore += 10;
        }
        
        // Check for workout streak data
        if (context.workoutStreak > 0) {
            qualityScore += 10;
        }
        
        // Check for sport-specific data
        if (context.sport && context.sport !== 'general_fitness') {
            qualityScore += 10;
        }
        
        // Check for goal-specific data
        if (context.primaryGoal && context.primaryGoal !== 'general_fitness') {
            qualityScore += 10;
        }
        
        return Math.min(100, qualityScore);
    }

    /**
     * Get comprehensive user context
     * @returns {Object} User context data
     */
    getUserContext() {
        try {
            if (this.contextCache && this.isContextValid()) {
                return this.contextCache;
            }
            
            const user = this.authManager?.getCurrentUser();
            if (!user) {
                return this.getDefaultContext();
            }
            
            const context = {
                // Basic info
                username: user.username,
                athleteName: user.athleteName,
                preferences: user.preferences || {},
                
                // Training data
                trainingHistory: this.getTrainingHistory(),
                recentWorkouts: this.getRecentWorkouts(7),
                progressionData: this.getProgressionData(),
                missedWorkouts: this.getMissedWorkouts(14),
                
                // Current state
                readinessScore: this.getCurrentReadinessScore(),
                energyLevel: this.getCurrentEnergyLevel(),
                stressLevel: this.getCurrentStressLevel(),
                
                // Goals and preferences
                primaryGoal: user.preferences?.primary_goal || 'general_fitness',
                sport: user.preferences?.primary_sport || 'general_fitness',
                seasonPhase: this.getSeasonPhase(),
                trainingFrequency: this.getTrainingFrequency(),
                
                // Performance metrics
                averageRPE: this.getAverageRPE(14),
                progressionRate: this.getProgressionRate(),
                consistencyScore: this.getConsistencyScore(),
                
                // Recent patterns
                workoutStreak: this.getWorkoutStreak(),
                lastWorkout: this.getLastWorkout(),
                energyTrend: this.getEnergyTrend(7),
                stressTrend: this.getStressTrend(7)
            };
            
            // Validate context with conservative fallbacks
            if (this.dataValidator) {
                const validatedContext = this.dataValidator.validateContext(context);
                this.contextCache = validatedContext;
                this.contextCache.timestamp = Date.now();
                return validatedContext;
            }
            
            // Cache context for performance
            this.contextCache = context;
            this.contextCache.timestamp = Date.now();
            
            return context;
        } catch (error) {
            this.logger.error('Failed to get user context', error);
            return this.getDefaultContext();
        }
    }

    /**
     * Analyze user message for intent and sentiment
     * @param {string} message - User message
     * @returns {Object} Message analysis
     */
    analyzeUserMessage(message) {
        const messageLower = message.toLowerCase();
        
        return {
            intent: this.detectIntent(messageLower),
            sentiment: this.detectSentiment(messageLower),
            keywords: this.extractKeywords(messageLower),
            urgency: this.detectUrgency(messageLower),
            topics: this.detectTopics(messageLower)
        };
    }

    /**
     * Detect user intent from message
     * @param {string} message - Lowercase message
     * @returns {string} Detected intent
     */
    detectIntent(message) {
        if (message.includes('help') || message.includes('what should')) return 'help';
        if (message.includes('how') || message.includes('why')) return 'explanation';
        if (message.includes('hurt') || message.includes('pain')) return 'concern';
        if (message.includes('easy') || message.includes('hard')) return 'feedback';
        if (message.includes('motivation') || message.includes('motivate')) return 'motivation';
        if (message.includes('plateau') || message.includes('stuck')) return 'plateau';
        if (message.includes('tired') || message.includes('exhausted')) return 'fatigue';
        if (message.includes('stress') || message.includes('stressed')) return 'stress';
        return 'general';
    }

    /**
     * Detect sentiment from message
     * @param {string} message - Lowercase message
     * @returns {string} Detected sentiment
     */
    detectSentiment(message) {
        const positiveWords = ['great', 'awesome', 'love', 'amazing', 'excellent', 'perfect'];
        const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'worst', 'sucks'];
        const neutralWords = ['okay', 'fine', 'alright', 'decent'];
        
        const positiveCount = positiveWords.filter(word => message.includes(word)).length;
        const negativeCount = negativeWords.filter(word => message.includes(word)).length;
        const neutralCount = neutralWords.filter(word => message.includes(word)).length;
        
        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        if (neutralCount > 0) return 'neutral';
        return 'neutral';
    }

    /**
     * Extract keywords from message
     * @param {string} message - Lowercase message
     * @returns {Array} Extracted keywords
     */
    extractKeywords(message) {
        const keywords = [];
        const commonTerms = [
            'workout', 'exercise', 'weight', 'strength', 'cardio', 'recovery',
            'sleep', 'energy', 'stress', 'nutrition', 'form', 'technique',
            'plateau', 'progress', 'motivation', 'consistency', 'injury',
            'away', 'back', 'tired', 'exhausted', 'stuck', 'same', 'season',
            'basketball', 'football', 'soccer', 'hard', 'difficult', 'intense',
            'motivate', 'hurt', 'pain', 'knee', 'shoulder', 'back'
        ];
        
        commonTerms.forEach(term => {
            if (message.includes(term)) {
                keywords.push(term);
            }
        });
        
        return keywords;
    }

    /**
     * Detect urgency level
     * @param {string} message - Lowercase message
     * @returns {string} Urgency level
     */
    detectUrgency(message) {
        if (message.includes('urgent') || message.includes('emergency')) return 'high';
        if (message.includes('asap') || message.includes('quickly')) return 'medium';
        return 'low';
    }

    /**
     * Detect topics in message
     * @param {string} message - Lowercase message
     * @returns {Array} Detected topics
     */
    detectTopics(message) {
        const topics = [];
        
        if (message.includes('injury') || message.includes('pain') || message.includes('hurt')) {
            topics.push('injury');
        }
        if (message.includes('nutrition') || message.includes('diet') || message.includes('food')) {
            topics.push('nutrition');
        }
        if (message.includes('sleep') || message.includes('rest') || message.includes('recovery')) {
            topics.push('recovery');
        }
        if (message.includes('form') || message.includes('technique') || message.includes('proper')) {
            topics.push('technique');
        }
        
        return topics;
    }

    /**
     * Determine coaching scenario based on context and message
     * @param {Object} context - User context
     * @param {Object} messageAnalysis - Message analysis
     * @returns {string} Coaching scenario
     */
    determineCoachingScenario(context, messageAnalysis) {
        // Check for urgent concerns first
        if (messageAnalysis.topics.includes('injury') || messageAnalysis.intent === 'concern') {
            return 'injury';
        }
        
        // Check for missed workouts based on message content
        if (messageAnalysis.intent === 'return' || 
            messageAnalysis.keywords.includes('away') || 
            messageAnalysis.keywords.includes('back')) {
            return 'return';
        }
        
        // Check for high stress/energy issues based on message content
        if (messageAnalysis.intent === 'fatigue' || 
            messageAnalysis.intent === 'stress' ||
            messageAnalysis.keywords.includes('tired') ||
            messageAnalysis.keywords.includes('exhausted') ||
            messageAnalysis.keywords.includes('stress')) {
            return 'recovery';
        }
        
        // Check for plateau based on message content
        if (messageAnalysis.intent === 'plateau' || 
            messageAnalysis.keywords.includes('plateau') ||
            messageAnalysis.keywords.includes('stuck') ||
            messageAnalysis.keywords.includes('same')) {
            return 'plateau';
        }
        
        // Check for seasonal training based on message content
        if (messageAnalysis.keywords.includes('season') ||
            messageAnalysis.keywords.includes('basketball') ||
            messageAnalysis.keywords.includes('football') ||
            messageAnalysis.keywords.includes('soccer')) {
            return 'seasonal';
        }
        
        // Check for high RPE based on message content
        if (messageAnalysis.keywords.includes('hard') ||
            messageAnalysis.keywords.includes('difficult') ||
            messageAnalysis.keywords.includes('intense')) {
            return 'performance';
        }
        
        // Check for motivation requests
        if (messageAnalysis.intent === 'motivation' ||
            messageAnalysis.keywords.includes('motivation') ||
            messageAnalysis.keywords.includes('motivate')) {
            return 'motivation';
        }
        
        // Default to general coaching
        return 'general';
    }

    /**
     * Create personalized response based on scenario
     * @param {string} scenario - Coaching scenario
     * @param {Object} context - User context
     * @param {Object} messageAnalysis - Message analysis
     * @returns {string} Personalized response
     */
    createPersonalizedResponse(scenario, context, messageAnalysis) {
        const templates = this.coachingTemplates;
        
        switch (scenario) {
            case 'injury':
                return this.createInjuryResponse(context, messageAnalysis);
            case 'return':
                return this.createReturnResponse(context);
            case 'recovery':
                return this.createRecoveryResponse(context);
            case 'plateau':
                return this.createPlateauResponse(context);
            case 'seasonal':
                return this.createSeasonalResponse(context);
            case 'performance':
                return this.createPerformanceResponse(context);
            case 'motivation':
                return this.createMotivationResponse(context);
            default:
                return this.createGeneralResponse(context, messageAnalysis);
        }
    }

    /**
     * Create injury response with safety guardrails
     * @param {Object} context - User context
     * @param {Object} messageAnalysis - Message analysis
     * @returns {string} Injury response
     */
    createInjuryResponse(context, messageAnalysis) {
        if (messageAnalysis.urgency === 'high') {
            return "I'm not a doctor, but if you're experiencing significant pain, please consult a healthcare professional. For now, let's focus on gentle movement and avoid anything that causes discomfort.";
        }
        
        return "I'm not qualified to give medical advice, but if something doesn't feel right during your workout, it's always better to be safe. Let's modify today's exercises to avoid any discomfort.";
    }

    /**
     * Create return response for missed workouts
     * @param {Object} context - User context
     * @returns {string} Return response
     */
    createReturnResponse(context) {
        const days = context.missedWorkouts;
        const template = this.coachingTemplates.motivation.return;
        
        return template
            .replace('{days}', days)
            + " Let's start with a lighter session to ease back in - maybe 25-30 minutes to get your body moving again.";
    }

    /**
     * Create recovery response for high stress/low energy
     * @param {Object} context - User context
     * @returns {string} Recovery response
     */
    createRecoveryResponse(context) {
        if (context.stressLevel > 7) {
            return this.coachingTemplates.recovery.stress;
        }
        
        if (context.energyLevel < 4) {
            return this.coachingTemplates.recovery.fatigue;
        }
        
        return this.coachingTemplates.recovery.readiness
            .replace('{score}', context.readinessScore);
    }

    /**
     * Create plateau response
     * @param {Object} context - User context
     * @returns {string} Plateau response
     */
    createPlateauResponse(context) {
        const template = this.coachingTemplates.progression.plateau;
        const exercise = this.getPrimaryExercise(context);
        const weight = this.getCurrentWeight(exercise);
        const weeks = Math.floor(context.workoutStreak / 3);
        
        return template
            .replace('{exercise}', exercise)
            .replace('{weight}', weight)
            .replace('{weeks}', weeks);
    }

    /**
     * Create seasonal response
     * @param {Object} context - User context
     * @returns {string} Seasonal response
     */
    createSeasonalResponse(context) {
        const sport = context.sport;
        const phase = context.seasonPhase;
        const weeks = this.getWeeksToSeason(sport);
        
        if (phase === 'preseason') {
            return this.coachingTemplates.seasonal.preseason
                .replace('{sport}', sport)
                .replace('{weeks}', weeks);
        }
        
        if (phase === 'in_season') {
            return this.coachingTemplates.seasonal.in_season
                .replace('{sport}', sport);
        }
        
        return this.coachingTemplates.seasonal.offseason;
    }

    /**
     * Create performance response
     * @param {Object} context - User context
     * @returns {string} Performance response
     */
    createPerformanceResponse(context) {
        if (context.averageRPE > 8.5) {
            return this.coachingTemplates.performance.high_rpe
                .replace('{rpe}', context.averageRPE.toFixed(1));
        }
        
        return this.coachingTemplates.performance.breakthrough;
    }

    /**
     * Create motivation response
     * @param {Object} context - User context
     * @returns {string} Motivation response
     */
    createMotivationResponse(context) {
        if (context.workoutStreak > 7) {
            return this.coachingTemplates.motivation.streak
                .replace('{number}', Math.floor(context.workoutStreak / 7));
        }
        
        return this.coachingTemplates.motivation.consistency
            .replace('{frequency}', context.trainingFrequency);
    }

    /**
     * Create general response
     * @param {Object} context - User context
     * @param {Object} messageAnalysis - Message analysis
     * @returns {string} General response
     */
    createGeneralResponse(context, messageAnalysis) {
        // Base response on user's current state and goals
        if (context.primaryGoal === 'strength') {
            return "I see you're focused on building strength - that's awesome! Your consistency with {frequency} workouts per week is exactly what you need to see progress.";
        }
        
        if (context.primaryGoal === 'sport_performance') {
            return "Since you're training for {sport}, let's make sure every workout supports your performance goals. What specific aspect of your game are you looking to improve?";
        }
        
        return "I'm here to help you reach your fitness goals! What's on your mind today?";
    }

    /**
     * Apply personality traits to response
     * @param {string} response - Base response
     * @param {Object} context - User context
     * @returns {string} Personalized response
     */
    applyPersonalityTraits(response, context) {
        // Add casual but competent tone
        let personalizedResponse = response;
        
        // Add encouraging elements
        if (context.workoutStreak > 3) {
            personalizedResponse = "Hey there! " + personalizedResponse;
        }
        
        // Add technical explanations where appropriate
        if (personalizedResponse.includes('deload')) {
            personalizedResponse += " A deload week gives your nervous system a chance to recover while maintaining your movement patterns.";
        }
        
        return personalizedResponse;
    }

    /**
     * Apply safety guardrails to response
     * @param {string} response - Response to check
     * @param {Object} messageAnalysis - Message analysis
     * @returns {string} Safe response
     */
    applyGuardrails(response, messageAnalysis) {
        // Check for medical advice
        if (this.guardrails.medical_advice && this.containsMedicalAdvice(response)) {
            return "I'm not qualified to give medical advice. Please consult a healthcare professional for any health concerns.";
        }
        
        // Check for injury-related content
        if (messageAnalysis.topics.includes('injury') && this.guardrails.injury_diagnosis) {
            return "I am not a doctor, so I cannot diagnose injuries. If you are experiencing pain, please consult a healthcare professional.";
        }
        
        return response;
    }

    /**
     * Check if response contains medical advice
     * @param {string} response - Response to check
     * @returns {boolean} Contains medical advice
     */
    containsMedicalAdvice(response) {
        const medicalTerms = ['diagnose', 'treatment', 'medication', 'therapy', 'surgery'];
        return medicalTerms.some(term => response.toLowerCase().includes(term));
    }

    /**
     * Get training history
     * @returns {Array} Training history
     */
    getTrainingHistory() {
        // This would typically fetch from database
        return [];
    }

    /**
     * Get recent workouts
     * @param {number} days - Number of days to look back
     * @returns {Array} Recent workouts
     */
    getRecentWorkouts(days) {
        // This would typically fetch from database
        return [];
    }

    /**
     * Get progression data
     * @returns {Object} Progression data
     */
    getProgressionData() {
        // This would typically fetch from database
        return {};
    }

    /**
     * Get missed workouts count
     * @param {number} days - Number of days to check
     * @returns {number} Missed workouts
     */
    getMissedWorkouts(days) {
        // This would typically calculate from workout history
        return 0;
    }

    /**
     * Get current readiness score
     * @returns {number} Readiness score
     */
    getCurrentReadinessScore() {
        const todayCheckIn = this.dailyCheckIn?.getTodayCheckIn();
        return todayCheckIn?.readinessScore || 5;
    }

    /**
     * Get current energy level
     * @returns {number} Energy level
     */
    getCurrentEnergyLevel() {
        const todayCheckIn = this.dailyCheckIn?.getTodayCheckIn();
        return todayCheckIn?.energyLevel || 5;
    }

    /**
     * Get current stress level
     * @returns {number} Stress level
     */
    getCurrentStressLevel() {
        const todayCheckIn = this.dailyCheckIn?.getTodayCheckIn();
        return todayCheckIn?.stressLevel || 5;
    }

    /**
     * Get season phase
     * @returns {string} Season phase
     */
    getSeasonPhase() {
        // This would typically be calculated based on sport and date
        return 'offseason';
    }

    /**
     * Get training frequency
     * @returns {number} Training frequency
     */
    getTrainingFrequency() {
        // This would typically be calculated from workout history
        return 3;
    }

    /**
     * Get average RPE
     * @param {number} days - Number of days to average
     * @returns {number} Average RPE
     */
    getAverageRPE(days) {
        // This would typically be calculated from workout data
        return 7.5;
    }

    /**
     * Get progression rate
     * @returns {number} Progression rate
     */
    getProgressionRate() {
        // This would typically be calculated from progression data
        return 0.1;
    }

    /**
     * Get consistency score
     * @returns {number} Consistency score
     */
    getConsistencyScore() {
        // This would typically be calculated from workout history
        return 0.8;
    }

    /**
     * Get workout streak
     * @returns {number} Workout streak
     */
    getWorkoutStreak() {
        // This would typically be calculated from workout history
        return 5;
    }

    /**
     * Get last workout
     * @returns {Object} Last workout
     */
    getLastWorkout() {
        // This would typically fetch from database
        return null;
    }

    /**
     * Get energy trend
     * @param {number} days - Number of days to analyze
     * @returns {string} Energy trend
     */
    getEnergyTrend(days) {
        // This would typically be calculated from daily check-ins
        return 'stable';
    }

    /**
     * Get stress trend
     * @param {number} days - Number of days to analyze
     * @returns {string} Stress trend
     */
    getStressTrend(days) {
        // This would typically be calculated from daily check-ins
        return 'stable';
    }

    /**
     * Get primary exercise
     * @param {Object} context - User context
     * @returns {string} Primary exercise
     */
    getPrimaryExercise(context) {
        // This would typically be determined from user's most common exercise
        return 'Squat';
    }

    /**
     * Get current weight for exercise
     * @param {string} exercise - Exercise name
     * @returns {number} Current weight
     */
    getCurrentWeight(exercise) {
        // This would typically fetch from progression data
        return 135;
    }

    /**
     * Get weeks to season
     * @param {string} sport - Sport name
     * @returns {number} Weeks to season
     */
    getWeeksToSeason(sport) {
        // This would typically be calculated based on sport and date
        return 6;
    }

    /**
     * Check if context cache is valid
     * @returns {boolean} Context is valid
     */
    isContextValid() {
        if (!this.contextCache || !this.contextCache.timestamp) {
            return false;
        }
        
        const cacheAge = Date.now() - this.contextCache.timestamp;
        return cacheAge < 300000; // 5 minutes
    }

    /**
     * Get default context
     * @returns {Object} Default context
     */
    getDefaultContext() {
        return {
            username: 'user',
            athleteName: 'Athlete',
            preferences: {},
            trainingHistory: [],
            recentWorkouts: [],
            progressionData: {},
            missedWorkouts: 0,
            readinessScore: 5,
            energyLevel: 5,
            stressLevel: 5,
            primaryGoal: 'general_fitness',
            sport: 'general_fitness',
            seasonPhase: 'offseason',
            trainingFrequency: 3,
            averageRPE: 7.5,
            progressionRate: 0.1,
            consistencyScore: 0.8,
            workoutStreak: 0,
            lastWorkout: null,
            energyTrend: 'stable',
            stressTrend: 'stable'
        };
    }
}

// Create global instance
window.PersonalizedCoaching = new PersonalizedCoaching();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersonalizedCoaching;
}
