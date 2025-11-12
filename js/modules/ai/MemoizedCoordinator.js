/**
 * MemoizedCoordinator - Optimized AI coordination with memoization
 * Caches expert proposals and context calculations to avoid recomputation
 */
class MemoizedCoordinator {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.experts = new Map();
    this.memoCache = new Map();
    this.contextCache = new Map();

    // Performance tracking
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      contextBuildTime: 0,
    };

    // Cache configuration
    this.cacheConfig = {
      maxSize: 1000,
      ttl: 5 * 60 * 1000, // 5 minutes
      contextTtl: 2 * 60 * 1000, // 2 minutes
      cleanupInterval: 60 * 1000, // 1 minute
    };

    this.startCleanupTimer();
  }

  /**
   * Register an expert system
   * @param {string} name - Expert name
   * @param {Object} expert - Expert instance
   */
  registerExpert(name, expert) {
    this.experts.set(name, expert);
    this.logger.debug(`Registered expert: ${name}`);
  }

  /**
   * Generate workout plan with memoization
   * @param {Object} context - User context
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated plan
   */
  async planToday(context, options = {}) {
    const startTime = performance.now();
    this.stats.totalRequests++;

    try {
      // Create cache key
      const cacheKey = this.createCacheKey(context, options);

      // Check memoization cache
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.stats.cacheHits++;
        this.logger.debug('Cache hit for plan generation');
        return cachedResult;
      }

      this.stats.cacheMisses++;

      // Build context with memoization
      const builtContext = await this.buildContext(context);

      // Gather expert proposals with memoization
      const proposals = await this.gatherProposals(builtContext, options);

      // Generate plan
      const plan = await this.generatePlan(proposals, builtContext, options);

      // Cache result
      this.setCache(cacheKey, plan);

      // Update performance stats
      const responseTime = performance.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      this.logger.debug(`Plan generated in ${responseTime.toFixed(2)}ms`);

      return plan;
    } catch (error) {
      this.logger.error('Plan generation failed:', error);
      throw error;
    }
  }

  /**
   * Build context with memoization
   * @param {Object} rawContext - Raw user context
   * @returns {Promise<Object>} Built context
   */
  async buildContext(rawContext) {
    const startTime = performance.now();

    // Create context cache key
    const contextKey = this.createContextKey(rawContext);

    // Check context cache
    const cachedContext = this.getFromContextCache(contextKey);
    if (cachedContext) {
      this.logger.debug('Context cache hit');
      return cachedContext;
    }

    // Build context
    const context = {
      user: rawContext.user,
      preferences: rawContext.preferences,
      recentWorkouts: rawContext.recentWorkouts || [],
      readiness: rawContext.readiness || 7,
      goals: rawContext.goals || {},
      constraints: rawContext.constraints || {},
      timestamp: Date.now(),
    };

    // Add computed fields
    context.workoutHistory = this.analyzeWorkoutHistory(context.recentWorkouts);
    context.readinessScore = this.calculateReadinessScore(context);
    context.goalProgress = this.calculateGoalProgress(context);
    context.recommendedIntensity = this.calculateRecommendedIntensity(context);

    // Cache context
    this.setContextCache(contextKey, context);

    const buildTime = performance.now() - startTime;
    this.stats.contextBuildTime = buildTime;

    this.logger.debug(`Context built in ${buildTime.toFixed(2)}ms`);

    return context;
  }

  /**
   * Gather expert proposals with memoization
   * @param {Object} context - Built context
   * @param {Object} options - Options
   * @returns {Promise<Array>} Expert proposals
   */
  async gatherProposals(context, options) {
    const proposals = [];
    const expertPromises = [];

    // Create proposal cache key
    const proposalKey = this.createProposalKey(context, options);

    // Check proposal cache
    const cachedProposals = this.getFromCache(proposalKey);
    if (cachedProposals) {
      this.logger.debug('Proposal cache hit');
      return cachedProposals;
    }

    // Gather proposals from experts
    for (const [name, expert] of this.experts) {
      const expertPromise = this.getExpertProposal(name, expert, context, options);
      expertPromises.push(expertPromise);
    }

    const results = await Promise.allSettled(expertPromises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        proposals.push(result.value);
      } else {
        this.logger.error(
          `Expert ${Array.from(this.experts.keys())[index]} failed:`,
          result.reason
        );
      }
    });

    // Cache proposals
    this.setCache(proposalKey, proposals);

    return proposals;
  }

  /**
   * Get expert proposal with memoization
   * @param {string} name - Expert name
   * @param {Object} expert - Expert instance
   * @param {Object} context - Context
   * @param {Object} options - Options
   * @returns {Promise<Object>} Expert proposal
   */
  async getExpertProposal(name, expert, context, options) {
    const expertKey = `${name}_${this.createCacheKey(context, options)}`;

    // Check expert cache
    const cachedProposal = this.getFromCache(expertKey);
    if (cachedProposal) {
      this.logger.debug(`Expert ${name} cache hit`);
      return cachedProposal;
    }

    // Get proposal from expert
    const proposal = await expert.generateProposal(context, options);

    // Cache proposal
    this.setCache(expertKey, proposal);

    return proposal;
  }

  /**
   * Generate plan from proposals
   * @param {Array} proposals - Expert proposals
   * @param {Object} context - Context
   * @param {Object} options - Options
   * @returns {Promise<Object>} Generated plan
   */
  async generatePlan(proposals, context, _options) {
    // Merge proposals
    const mergedPlan = this.mergeProposals(proposals, context);

    // Validate plan
    const validatedPlan = this.validatePlan(mergedPlan, context);

    // Add metadata
    validatedPlan.metadata = {
      generatedAt: Date.now(),
      contextHash: this.createContextKey(context),
      expertCount: proposals.length,
      cacheHit: false,
    };

    return validatedPlan;
  }

  /**
   * Create cache key
   * @param {Object} context - Context
   * @param {Object} options - Options
   * @returns {string} Cache key
   */
  createCacheKey(context, options) {
    const keyData = {
      userId: context.user?.id,
      readiness: context.readiness,
      goals: context.goals,
      constraints: context.constraints,
      options,
    };

    return this.hashObject(keyData);
  }

  /**
   * Create context cache key
   * @param {Object} rawContext - Raw context
   * @returns {string} Context key
   */
  createContextKey(rawContext) {
    const keyData = {
      userId: rawContext.user?.id,
      recentWorkouts: rawContext.recentWorkouts?.length || 0,
      preferences: rawContext.preferences,
      readiness: rawContext.readiness,
    };

    return this.hashObject(keyData);
  }

  /**
   * Create proposal cache key
   * @param {Object} context - Context
   * @param {Object} options - Options
   * @returns {string} Proposal key
   */
  createProposalKey(context, options) {
    return `proposals_${this.createCacheKey(context, options)}`;
  }

  /**
   * Hash object to string
   * @param {Object} obj - Object to hash
   * @returns {string} Hash string
   */
  hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Get from cache
   * @param {string} key - Cache key
   * @returns {Object|null} Cached value
   */
  getFromCache(key) {
    const entry = this.memoCache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.cacheConfig.ttl) {
      this.memoCache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set cache
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   */
  setCache(key, value) {
    // Check cache size
    if (this.memoCache.size >= this.cacheConfig.maxSize) {
      this.evictOldest();
    }

    this.memoCache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Get from context cache
   * @param {string} key - Context key
   * @returns {Object|null} Cached context
   */
  getFromContextCache(key) {
    const entry = this.contextCache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.cacheConfig.contextTtl) {
      this.contextCache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set context cache
   * @param {string} key - Context key
   * @param {Object} value - Context value
   */
  setContextCache(key, value) {
    // Check cache size
    if (this.contextCache.size >= this.cacheConfig.maxSize) {
      this.evictOldestContext();
    }

    this.contextCache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Evict oldest cache entry
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memoCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoCache.delete(oldestKey);
    }
  }

  /**
   * Evict oldest context cache entry
   */
  evictOldestContext() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.contextCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.contextCache.delete(oldestKey);
    }
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanupExpired();
    }, this.cacheConfig.cleanupInterval);
  }

  /**
   * Cleanup expired entries
   */
  cleanupExpired() {
    const now = Date.now();

    // Cleanup memo cache
    for (const [key, entry] of this.memoCache) {
      if (now - entry.timestamp > this.cacheConfig.ttl) {
        this.memoCache.delete(key);
      }
    }

    // Cleanup context cache
    for (const [key, entry] of this.contextCache) {
      if (now - entry.timestamp > this.cacheConfig.contextTtl) {
        this.contextCache.delete(key);
      }
    }
  }

  /**
   * Analyze workout history
   * @param {Array} workouts - Recent workouts
   * @returns {Object} Analysis
   */
  analyzeWorkoutHistory(workouts) {
    if (!workouts || workouts.length === 0) {
      return { volume: 0, intensity: 0, frequency: 0 };
    }

    const lastWeek = workouts.slice(0, 7);
    const volume = lastWeek.reduce((sum, w) => sum + (w.volume || 0), 0);
    const intensity = lastWeek.reduce((sum, w) => sum + (w.intensity || 0), 0) / lastWeek.length;
    const frequency = lastWeek.length;

    return { volume, intensity, frequency };
  }

  /**
   * Calculate readiness score
   * @param {Object} context - Context
   * @returns {number} Readiness score
   */
  calculateReadinessScore(context) {
    const baseReadiness = context.readiness || 7;
    const history = context.workoutHistory;

    // Adjust based on recent volume
    if (history.volume > 1000) {
      return Math.max(1, baseReadiness - 2);
    } else if (history.volume < 500) {
      return Math.min(10, baseReadiness + 1);
    }

    return baseReadiness;
  }

  /**
   * Calculate goal progress
   * @param {Object} context - Context
   * @returns {Object} Goal progress
   */
  calculateGoalProgress(_context) {
    // Placeholder implementation
    return {
      strength: 0.6,
      endurance: 0.4,
      flexibility: 0.8,
    };
  }

  /**
   * Calculate recommended intensity
   * @param {Object} context - Context
   * @returns {number} Recommended intensity
   */
  calculateRecommendedIntensity(context) {
    const readiness = context.readinessScore;
    const history = context.workoutHistory;

    // Base intensity on readiness
    let intensity = readiness / 10;

    // Adjust based on recent volume
    if (history.volume > 1000) {
      intensity *= 0.8; // Reduce intensity if high volume
    } else if (history.volume < 500) {
      intensity *= 1.2; // Increase intensity if low volume
    }

    return Math.max(0.3, Math.min(1.0, intensity));
  }

  /**
   * Merge expert proposals
   * @param {Array} proposals - Proposals
   * @param {Object} context - Context
   * @returns {Object} Merged plan
   */
  mergeProposals(proposals, context) {
    // Placeholder implementation
    return {
      exercises: [],
      duration: 60,
      intensity: context.recommendedIntensity,
      rationale: 'Generated from expert proposals',
    };
  }

  /**
   * Validate plan
   * @param {Object} plan - Plan to validate
   * @param {Object} context - Context
   * @returns {Object} Validated plan
   */
  validatePlan(plan, _context) {
    // Placeholder implementation
    return plan;
  }

  /**
   * Update average response time
   * @param {number} responseTime - Response time
   */
  updateAverageResponseTime(responseTime) {
    const alpha = 0.1; // Smoothing factor
    this.stats.averageResponseTime =
      (1 - alpha) * this.stats.averageResponseTime + alpha * responseTime;
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getStats() {
    const hitRate =
      this.stats.totalRequests > 0 ? (this.stats.cacheHits / this.stats.totalRequests) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      cacheSize: this.memoCache.size,
      contextCacheSize: this.contextCache.size,
      expertCount: this.experts.size,
    };
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.memoCache.clear();
    this.contextCache.clear();
    this.logger.info('All caches cleared');
  }

  /**
   * Destroy coordinator
   */
  destroy() {
    this.clearCaches();
    this.experts.clear();
  }
}

// Export for use in other modules
window.MemoizedCoordinator = MemoizedCoordinator;
