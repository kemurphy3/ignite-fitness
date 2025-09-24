# Cursor Prompt: Level 2 AI Implementation (Context-Aware System)

## Overview
Implement a context-aware AI system that includes user history in every LLM call, making the AI feel like it "remembers" users without actual learning. This is the sweet spot for cost vs intelligence.

## Task 1: Create Context Management System

### Core Context Manager
Add this context management system (around line 1600):

```javascript
// Level 2: Context-Aware AI System
class ContextAwareAI {
  constructor() {
    this.contextCache = new Map(); // Cache contexts for 5 minutes
    this.patternDetector = new PatternDetector();
    this.contextBuilder = new ContextBuilder();
    this.modelSelector = new ModelSelector();
  }
  
  // Build comprehensive user context for AI
  async buildUserContext(userId, includeLevel = 'standard') {
    // Check cache first
    const cacheKey = `${userId}_${includeLevel}`;
    const cached = this.contextCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
      return cached.context;
    }
    
    // Build fresh context
    const context = {
      // User Profile
      profile: await this.getUserProfile(userId),
      
      // Current Training Phase
      currentPhase: await this.getCurrentPhase(userId),
      
      // Recent Performance
      recentWorkouts: await this.getRecentWorkouts(userId, 10),
      lastWorkout: await this.getLastWorkout(userId),
      
      // Detected Patterns
      patterns: await this.patternDetector.detectPatterns(userId),
      
      // What Works/Doesn't
      successfulApproaches: await this.getSuccesses(userId),
      failedApproaches: await this.getFailures(userId),
      
      // Current Stats & Trends
      currentLifts: await this.getCurrentMaxes(userId),
      progressionRates: await this.getProgressionRates(userId),
      
      // Contextual Factors
      upcomingGames: await this.getUpcomingGames(userId),
      recentInjuries: await this.getInjuryHistory(userId, 30), // Last 30 days
      energyTrend: await this.getEnergyTrend(userId, 7), // Last 7 days
      
      // Preferences Learned
      exercisePreferences: await this.getExercisePreferences(userId),
      timePreferences: await this.getTimePreferences(userId)
    };
    
    // Cache it
    this.contextCache.set(cacheKey, {
      context,
      timestamp: Date.now()
    });
    
    return context;
  }
  
  // Format context for LLM prompt
  formatContextForPrompt(context, question) {
    return `
## User Context

### Current Status
- Training Phase: ${context.currentPhase}
- Current Maxes: Bench ${context.currentLifts.bench}, Squat ${context.currentLifts.squat}, Dead ${context.currentLifts.deadlift}
- Recent Energy: ${context.energyTrend.average}/10 (${context.energyTrend.direction})
- Upcoming Games: ${context.upcomingGames.map(g => g.date).join(', ') || 'None scheduled'}

### Observed Patterns
${context.patterns.map(p => `- ${p.insight}: ${p.recommendation}`).join('\n')}

### What Works for This User
${context.successfulApproaches.map(s => `- ${s.approach}: ${s.outcome}`).join('\n')}

### What to Avoid
${context.failedApproaches.map(f => `- ${f.approach}: ${f.problem}`).join('\n')}

### Recent Workout Performance
${context.recentWorkouts.map(w => 
  `- ${w.date}: ${w.type}, RPE ${w.rpe}, ${w.completed ? '✓' : '✗'}`
).join('\n')}

### User Question
${question}

Based on this user's specific history and patterns, provide personalized advice.
Remember:
- They respond well to: ${context.patterns.filter(p => p.positive).map(p => p.factor).join(', ')}
- They struggle with: ${context.patterns.filter(p => !p.positive).map(p => p.factor).join(', ')}
- Current goal: ${context.profile.primaryGoal}
`;
  }
  
  // Main AI interaction with context
  async askAI(userId, question, options = {}) {
    try {
      // Build context
      const context = await this.buildUserContext(userId);
      
      // Format prompt with context
      const contextualPrompt = this.formatContextForPrompt(context, question);
      
      // Call LLM with context
      const response = await this.callLLM(contextualPrompt, options);
      
      // Store the interaction for pattern detection
      await this.storeInteraction(userId, question, response, context);
      
      // Return response
      return response;
      
    } catch (error) {
      console.error('AI Context Error:', error);
      // Fallback to basic response without context
      return this.basicAIResponse(question);
    }
  }
  
  // LLM caller (configurable)
  async callLLM(prompt, options = {}) {
    const model = options.model || 'gpt-3.5-turbo'; // Start cheap
    
    if (model === 'claude-3.5-sonnet') {
      return await this.callClaude(prompt);
    } else {
      return await this.callOpenAI(prompt, model);
    }
  }
  
  async callOpenAI(prompt, model) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fitness coach specializing in hybrid athletes who both lift weights and play sports.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

### Pattern Detection System

```javascript
// Pattern Detection for Level 2
class PatternDetector {
  async detectPatterns(userId) {
    const patterns = [];
    const workouts = await this.getWorkoutHistory(userId, 30); // Last 30 days
    
    // Pattern 1: Day of week performance
    const dayPatterns = this.analyzeDayPatterns(workouts);
    if (dayPatterns.strongDay) {
      patterns.push({
        type: 'weekly_rhythm',
        insight: `Performs best on ${dayPatterns.strongDay}s`,
        recommendation: `Schedule heavy lifts on ${dayPatterns.strongDay}`,
        positive: true,
        factor: `${dayPatterns.strongDay} training`
      });
    }
    
    if (dayPatterns.weakDay) {
      patterns.push({
        type: 'weekly_rhythm',
        insight: `Struggles on ${dayPatterns.weakDay}s`,
        recommendation: `Keep ${dayPatterns.weakDay}s light or rest`,
        positive: false,
        factor: `${dayPatterns.weakDay} fatigue`
      });
    }
    
    // Pattern 2: Exercise response
    const exercisePatterns = this.analyzeExerciseProgress(workouts);
    exercisePatterns.forEach(pattern => {
      if (pattern.improvementRate > 0.05) { // 5% improvement
        patterns.push({
          type: 'exercise_response',
          insight: `${pattern.exercise} improving rapidly (${pattern.improvementRate}% per week)`,
          recommendation: `Continue current ${pattern.exercise} programming`,
          positive: true,
          factor: pattern.exercise
        });
      } else if (pattern.improvementRate < -0.02) { // Regression
        patterns.push({
          type: 'exercise_response',
          insight: `${pattern.exercise} regressing`,
          recommendation: `Reduce ${pattern.exercise} volume or deload`,
          positive: false,
          factor: `${pattern.exercise} overload`
        });
      }
    });
    
    // Pattern 3: Volume tolerance
    const volumePattern = this.analyzeVolumeTolerance(workouts);
    if (volumePattern.optimalSets) {
      patterns.push({
        type: 'volume_tolerance',
        insight: `Best results with ${volumePattern.optimalSets} sets per exercise`,
        recommendation: `Program ${volumePattern.optimalSets} working sets`,
        positive: true,
        factor: `${volumePattern.optimalSets}-set protocols`
      });
    }
    
    // Pattern 4: Recovery needs
    const recoveryPattern = this.analyzeRecoveryNeeds(workouts);
    if (recoveryPattern.minDaysBetween) {
      patterns.push({
        type: 'recovery',
        insight: `Needs ${recoveryPattern.minDaysBetween} days between heavy sessions`,
        recommendation: `Space heavy workouts ${recoveryPattern.minDaysBetween} days apart`,
        positive: true,
        factor: `${recoveryPattern.minDaysBetween}-day recovery`
      });
    }
    
    // Pattern 5: RPE accuracy
    const rpePattern = this.analyzeRPEAccuracy(workouts);
    if (rpePattern.tendency) {
      patterns.push({
        type: 'rpe_calibration',
        insight: `Tends to ${rpePattern.tendency} RPE by ${rpePattern.offset}`,
        recommendation: `Adjust programmed RPE ${rpePattern.adjustment}`,
        positive: false,
        factor: `RPE ${rpePattern.tendency}`
      });
    }
    
    // Pattern 6: Game performance correlation
    const gamePattern = await this.analyzeGamePerformance(userId);
    if (gamePattern.correlation) {
      patterns.push({
        type: 'game_performance',
        insight: gamePattern.insight,
        recommendation: gamePattern.recommendation,
        positive: gamePattern.positive,
        factor: gamePattern.factor
      });
    }
    
    return patterns;
  }
  
  analyzeDayPatterns(workouts) {
    const dayStats = {};
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    days.forEach(day => {
      const dayWorkouts = workouts.filter(w => w.dayOfWeek === day);
      if (dayWorkouts.length > 0) {
        dayStats[day] = {
          avgRPE: average(dayWorkouts.map(w => w.rpe)),
          completion: dayWorkouts.filter(w => w.completed).length / dayWorkouts.length
        };
      }
    });
    
    // Find best and worst days
    const sortedDays = Object.entries(dayStats).sort((a, b) => b[1].avgRPE - a[1].avgRPE);
    
    return {
      strongDay: sortedDays[0]?.[0],
      weakDay: sortedDays[sortedDays.length - 1]?.[0]
    };
  }
}
```

### Success/Failure Tracking

```javascript
// Track what works and what doesn't
class SuccessTracker {
  async trackWorkoutOutcome(userId, workout, outcome) {
    const success = outcome.rpe <= 8 && outcome.completedAllSets;
    
    const record = {
      userId,
      date: new Date(),
      workout: {
        type: workout.type,
        exercises: workout.exercises.map(e => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight
        })),
        volume: workout.totalVolume,
        intensity: workout.avgIntensity
      },
      outcome: {
        rpe: outcome.rpe,
        completedAllSets: outcome.completedAllSets,
        notes: outcome.notes,
        nextDayEnergy: null // Will be filled tomorrow
      },
      success,
      context: {
        dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        hourOfDay: new Date().getHours(),
        daysSinceLastWorkout: await this.getDaysSinceLastWorkout(userId),
        daysSinceLastGame: await this.getDaysSinceLastGame(userId),
        sleepNight: outcome.sleepHours,
        stress: outcome.stressLevel
      }
    };
    
    // Store in database
    await db.collection('workout_outcomes').add(record);
    
    // Update patterns if this is notably successful or unsuccessful
    if (success && outcome.rpe <= 7) {
      await this.recordSuccessPattern(userId, record);
    } else if (!success || outcome.rpe >= 9) {
      await this.recordFailurePattern(userId, record);
    }
  }
  
  async recordSuccessPattern(userId, record) {
    const pattern = {
      userId,
      type: 'success',
      approach: `${record.workout.type} with ${record.workout.volume} volume`,
      outcome: `RPE ${record.outcome.rpe}, all sets completed`,
      context: record.context,
      timestamp: new Date()
    };
    
    await db.collection('success_patterns').add(pattern);
  }
  
  async getSuccessPatterns(userId, limit = 5) {
    const patterns = await db.collection('success_patterns')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    return patterns.docs.map(doc => doc.data());
  }
}
```

### Smart Caching System

```javascript
// Cache common queries to reduce API costs
class AICache {
  constructor() {
    this.cache = new Map();
    this.ttl = 3600000; // 1 hour cache
  }
  
  getCacheKey(userId, question, context) {
    // Create a hash of relevant context
    const contextKey = JSON.stringify({
      phase: context.currentPhase,
      lifts: context.currentLifts,
      patterns: context.patterns.map(p => p.type)
    });
    
    return `${userId}_${question}_${this.hashString(contextKey)}`;
  }
  
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
  
  async getCachedOrGenerate(userId, question, generator) {
    const context = await contextAwareAI.buildUserContext(userId);
    const cacheKey = this.getCacheKey(userId, question, context);
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      console.log('Cache hit! Saving API call');
      return cached.response;
    }
    
    // Generate new response
    const response = await generator();
    
    // Cache it
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });
    
    return response;
  }
  
  // Pre-cache common queries during off-peak
  async preCacheCommon() {
    const commonQueries = [
      "What should I do today?",
      "How should I warm up?",
      "I'm tired, should I workout?",
      "Can I skip accessories?",
      "Should I increase weight?"
    ];
    
    const activeUsers = await this.getActiveUsers();
    
    for (const user of activeUsers) {
      for (const query of commonQueries) {
        await this.getCachedOrGenerate(user.id, query, async () => {
          return await contextAwareAI.askAI(user.id, query);
        });
      }
    }
  }
}
```

## Task 2: Integration Points

### Update Workout Logging to Feed Context

```javascript
// After each workout, update patterns
async function logWorkout(userId, workoutData) {
  // Save workout
  const workoutId = await db.saveWorkout(userId, workoutData);
  
  // Track outcome for patterns
  await successTracker.trackWorkoutOutcome(userId, workoutData, {
    rpe: workoutData.rpe,
    completedAllSets: workoutData.completedAllSets,
    notes: workoutData.notes,
    sleepHours: workoutData.sleepLastNight,
    stressLevel: workoutData.currentStress
  });
  
  // Clear context cache to include new workout
  contextAwareAI.contextCache.delete(`${userId}_standard`);
  
  // Check for emerging patterns
  const patterns = await patternDetector.detectPatterns(userId);
  
  // Alert user to new patterns
  const newPatterns = patterns.filter(p => p.isNew);
  if (newPatterns.length > 0) {
    showNotification({
      title: '💡 Pattern Detected',
      message: newPatterns[0].insight,
      action: newPatterns[0].recommendation
    });
  }
  
  return workoutId;
}
```

### Intelligent Model Selection

```javascript
// Smart model selector that chooses the right AI for the task
class ModelSelector {
  constructor() {
    this.modelCosts = {
      'gpt-3.5-turbo': 0.002,       // per 1k tokens (cheap, fast, good for simple)
      'gpt-4-turbo': 0.03,          // per 1k tokens (expensive, smart)
      'claude-3-haiku': 0.0008,     // per 1k tokens (cheapest, ultra-fast)
      'claude-3.5-sonnet': 0.015,   // per 1k tokens (balanced, creative)
      'claude-3-opus': 0.075        // per 1k tokens (most expensive, best reasoning)
    };
  }
  
  // Select model based on query complexity and context
  selectModel(question, context, userPreference = null) {
    // User can override if they want
    if (userPreference) return userPreference;
    
    // Categorize the query
    const queryType = this.categorizeQuery(question);
    const complexity = this.assessComplexity(question, context);
    
    // Model selection logic
    switch(queryType) {
      case 'simple_question':
        // "What's my next workout?" "How many sets today?"
        return 'claude-3-haiku'; // Cheapest, fastest for simple lookups
        
      case 'form_check':
        // "Is my squat form correct?" "How do I deadlift?"
        return 'gpt-3.5-turbo'; // Good at instructions, cheap
        
      case 'workout_generation':
        // "Create a workout for tomorrow"
        if (complexity === 'high') {
          // Complex periodization, multiple constraints
          return 'claude-3.5-sonnet'; // Great at creative programming
        }
        return 'gpt-3.5-turbo'; // Standard workout generation
        
      case 'injury_assessment':
        // "My knee hurts during squats"
        return 'claude-3.5-sonnet'; // Balanced, careful with health advice
        
      case 'nutrition_planning':
        // "Plan my meals for game week"
        return 'gpt-3.5-turbo'; // Good enough for basic nutrition
        
      case 'complex_analysis':
        // "Analyze my 6-month progress and suggest adjustments"
        if (context.recentWorkouts?.length > 50) {
          return 'claude-3-opus'; // Best for complex reasoning with lots of data
        }
        return 'claude-3.5-sonnet'; // Good for moderate analysis
        
      case 'conversation':
        // Multi-turn coaching conversation
        if (this.isFollowUp(question, context)) {
          // Use same model as previous turn for consistency
          return context.lastModel || 'gpt-3.5-turbo';
        }
        return 'gpt-3.5-turbo'; // Default conversational
        
      default:
        return 'gpt-3.5-turbo'; // Safe default
    }
  }
  
  categorizeQuery(question) {
    const q = question.toLowerCase();
    
    // Simple lookups
    if (q.includes('next') || q.includes('today') || q.includes('how many')) {
      return 'simple_question';
    }
    
    // Form and technique
    if (q.includes('form') || q.includes('technique') || q.includes('how to')) {
      return 'form_check';
    }
    
    // Workout creation
    if (q.includes('create') || q.includes('design') || q.includes('workout for')) {
      return 'workout_generation';
    }
    
    // Injury/pain
    if (q.includes('hurt') || q.includes('pain') || q.includes('injury')) {
      return 'injury_assessment';
    }
    
    // Nutrition
    if (q.includes('eat') || q.includes('nutrition') || q.includes('meal') || q.includes('calories')) {
      return 'nutrition_planning';
    }
    
    // Complex analysis
    if (q.includes('analyze') || q.includes('progress') || q.includes('trend') || q.includes('pattern')) {
      return 'complex_analysis';
    }
    
    return 'conversation';
  }
  
  assessComplexity(question, context) {
    let complexityScore = 0;
    
    // Length indicates complexity
    if (question.length > 100) complexityScore += 2;
    if (question.length > 200) complexityScore += 3;
    
    // Multiple questions
    if ((question.match(/\?/g) || []).length > 1) complexityScore += 2;
    
    // Requires historical analysis
    if (question.includes('trend') || question.includes('over time')) complexityScore += 3;
    
    // Multiple constraints
    const constraints = ['but', 'except', 'avoid', 'without', 'only', 'must'];
    constraints.forEach(c => {
      if (question.includes(c)) complexityScore += 1;
    });
    
    // Context richness
    if (context.recentWorkouts?.length > 20) complexityScore += 2;
    if (context.patterns?.length > 5) complexityScore += 2;
    
    return complexityScore > 5 ? 'high' : 'low';
  }
  
  isFollowUp(question, context) {
    // Check if this is part of ongoing conversation
    return context.conversationHistory?.length > 0 && 
           question.includes('it') || question.includes('that') || question.includes('this');
  }
  
  // Estimate cost before making call
  estimateCost(model, estimatedTokens = 1000) {
    const tokensInK = estimatedTokens / 1000;
    return this.modelCosts[model] * tokensInK;
  }
  
  // Log model usage for optimization
  logUsage(model, actualTokens, responseQuality) {
    // Track which models work best for which queries
    // This data helps optimize future selections
    console.log(`Model: ${model}, Tokens: ${actualTokens}, Quality: ${responseQuality}`);
  }
}
```

### Update AI Chat Interface

```javascript
// Replace basic AI calls with context-aware calls
async function sendToAI() {
  const input = document.getElementById('ai-input');
  const question = input.value.trim();
  
  if (!question) return;
  
  // Show typing indicator
  showTypingIndicator();
  
  try {
    // Build context first
    const context = await contextAwareAI.buildUserContext(currentUser.id);
    
    // Select optimal model
    const model = contextAwareAI.modelSelector.selectModel(question, context);
    console.log(`Using ${model} for this query`);
    
    // Show user which model if they care
    if (window.debugMode) {
      showModelIndicator(model);
    }
    
    // Use context-aware AI with selected model
    const response = await contextAwareAI.askAI(currentUser.id, question, {
      model: model,
      includeWorkoutHistory: true,
      includePatterns: true
    });
    
    // Display response
    displayAIResponse(response);
    
    // Learn from interaction
    await trackInteraction(currentUser.id, question, response, model);
    
  } catch (error) {
    console.error('AI Error:', error);
    
    // Fallback to cheaper model if expensive one fails
    if (error.message.includes('rate limit')) {
      const fallbackResponse = await contextAwareAI.askAI(currentUser.id, question, {
        model: 'claude-3-haiku', // Cheapest fallback
        includeWorkoutHistory: false // Reduce context to save tokens
      });
      displayAIResponse(fallbackResponse);
    } else {
      displayAIResponse("I'm having trouble connecting. Try again in a moment.");
    }
  }
  
  hideTypingIndicator();
  input.value = '';
}
```

## Task 3: Level 3 RAG System (DO NOT BUILD YET)

### Future Enhancement - Vector Database Integration

```javascript
/* 
 * LEVEL 3 ENHANCEMENT - DO NOT IMPLEMENT YET
 * Only implement when you have:
 * - 100+ paying users
 * - 10,000+ workouts in database
 * - Users requesting better pattern matching
 * - Revenue > $500/month
 */

// THIS IS FOR FUTURE REFERENCE ONLY
class RAGSystem {
  constructor() {
    this.vectorDB = null; // Will be Pinecone/Weaviate/Supabase Vector
  }
  
  // Convert workout to embedding for similarity search
  async createWorkoutEmbedding(workout) {
    const description = this.workoutToText(workout);
    
    // Call OpenAI embeddings API
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: description
      })
    });
    
    const data = await response.json();
    return data.data[0].embedding;
  }
  
  // Find similar workouts from other users
  async findSimilarWorkouts(currentContext, limit = 5) {
    const queryEmbedding = await this.createWorkoutEmbedding(currentContext);
    
    // Search vector database
    const results = await this.vectorDB.search({
      vector: queryEmbedding,
      topK: limit,
      filter: {
        success: true, // Only find successful workouts
        rpe: { $lte: 8 } // That weren't too hard
      }
    });
    
    return results.matches.map(match => ({
      workout: match.metadata.workout,
      outcome: match.metadata.outcome,
      similarity: match.score,
      userId: match.metadata.userId // Anonymous
    }));
  }
  
  // Enhanced AI call with RAG
  async askAIWithRAG(userId, question) {
    // Get user context (Level 2)
    const userContext = await contextAwareAI.buildUserContext(userId);
    
    // Find similar successful patterns from community (Level 3)
    const similarPatterns = await this.findSimilarWorkouts(userContext);
    
    // Build enhanced prompt
    const ragPrompt = `
      User Context: ${JSON.stringify(userContext)}
      
      Similar Successful Patterns from Community:
      ${similarPatterns.map(p => 
        `- User with similar profile: ${p.workout} led to ${p.outcome}`
      ).join('\n')}
      
      Question: ${question}
      
      Provide advice based on both personal history and community success patterns.
    `;
    
    return await this.callLLM(ragPrompt);
  }
  
  // Store all workouts as embeddings (run nightly)
  async indexAllWorkouts() {
    console.log('DO NOT RUN YET - This is for future implementation');
    return;
    
    // const allWorkouts = await db.collection('workouts').get();
    // 
    // for (const workout of allWorkouts) {
    //   const embedding = await this.createWorkoutEmbedding(workout);
    //   await this.vectorDB.upsert({
    //     id: workout.id,
    //     values: embedding,
    //     metadata: {
    //       userId: workout.userId,
    //       success: workout.success,
    //       rpe: workout.rpe,
    //       date: workout.date
    //     }
    //   });
    // }
  }
}

// DON'T INITIALIZE YET
// const ragSystem = new RAGSystem();
```

## Implementation Checklist

### Phase 1: Level 2 Implementation (DO THIS NOW)
- [ ] Set up ContextAwareAI class
- [ ] Implement ModelSelector class with intelligent model routing
- [ ] Implement PatternDetector
- [ ] Add SuccessTracker
- [ ] Create AICache for cost optimization
- [ ] Update workout logging to feed patterns
- [ ] Update AI chat to use context
- [ ] Test with your personal account
- [ ] Test with team (10 users)

### Phase 2: Optimization (After 50 Users)
- [ ] Implement smart caching
- [ ] Add pre-caching for common queries
- [ ] Route queries to optimal model based on complexity:
  - Claude Haiku ($0.0008/1k): Simple lookups ("What's next?")  
  - GPT-3.5 ($0.002/1k): Form checks, basic workouts, nutrition
  - Claude Sonnet ($0.015/1k): Creative programming, injury assessment
  - Claude Opus ($0.075/1k): Complex multi-month analysis (rarely used)
- [ ] Add context level selection (minimal/standard/full)
- [ ] Monitor API costs per user

### Phase 3: Level 3 RAG (After 100+ Users) - DO NOT BUILD YET
- [ ] Choose vector database (Pinecone/Weaviate)
- [ ] Implement embedding generation
- [ ] Create nightly indexing job
- [ ] Add similarity search
- [ ] A/B test RAG vs context-only
- [ ] Monitor improvement in recommendations

## Cost Management

```javascript
// Route queries to appropriate model based on complexity
function selectModel(question, userValue) {
  // High-value users get better models
  if (userValue === 'premium' || userValue === 'team') {
    return 'claude-3.5-sonnet';
  }
  
  // Complex questions need better models
  const complexKeywords = ['program', 'plan', 'injury', 'plateau', 'periodization'];
  if (complexKeywords.some(kw => question.toLowerCase().includes(kw))) {
    return 'gpt-4-turbo';
  }
  
  // Simple questions use cheap model
  const simpleKeywords = ['weight', 'reps', 'sets', 'rest', 'warm'];
  if (simpleKeywords.some(kw => question.toLowerCase().includes(kw))) {
    return 'gpt-3.5-turbo';
  }
  
  // Default to mid-tier
  return 'gpt-3.5-turbo';
}

// Track costs per user
async function trackAPIUsage(userId, model, tokens) {
  const costs = {
    'gpt-3.5-turbo': 0.002,      // per 1k tokens
    'gpt-4-turbo': 0.03,          // per 1k tokens  
    'claude-3.5-sonnet': 0.015    // per 1k tokens
  };
  
  const cost = (tokens / 1000) * costs[model];
  
  await db.collection('api_usage').add({
    userId,
    model,
    tokens,
    cost,
    timestamp: new Date()
  });
  
  // Alert if user is costing more than they pay
  const monthlyUsage = await getMonthlyUsage(userId);
  const monthlyPayment = 5; // $5/month
  
  if (monthlyUsage > monthlyPayment * 0.8) {
    console.warn(`User ${userId} approaching cost limit: $${monthlyUsage}/$${monthlyPayment}`);
  }
}
```

## Testing Your Level 2 System

```javascript
// Test context building
async function testContext() {
  const context = await contextAwareAI.buildUserContext('test-user');
  console.log('Context:', context);
  
  // Should include:
  // - Recent workouts
  // - Detected patterns  
  // - Success/failure history
  // - Current phase
}

// Test pattern detection
async function testPatterns() {
  const patterns = await patternDetector.detectPatterns('test-user');
  console.log('Patterns:', patterns);
  
  // Should detect:
  // - Best/worst training days
  // - Exercise responses
  // - Recovery needs
}

// Test AI with context
async function testAI() {
  const response = await contextAwareAI.askAI(
    'test-user',
    'Should I train hard today?'
  );
  console.log('AI Response:', response);
  
  // Should consider:
  // - Recent training load
  // - Upcoming games
  // - Energy trends
  // - Past patterns
}
```

## Success Metrics

Track these to know if Level 2 is working:

1. **User Engagement**: Sessions per week increase
2. **AI Accuracy**: RPE predictions within 1 point
3. **Pattern Detection**: 3-5 meaningful patterns per user
4. **Cost Efficiency**: < $5 per user per month
5. **User Feedback**: "The app knows me" comments

When these metrics plateau, consider Level 3 RAG implementation.