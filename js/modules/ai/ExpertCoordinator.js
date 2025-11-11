/**
 * ExpertCoordinator - Central engine that reconciles expert recommendations
 * Merges Strength, Sports, Physio, Nutrition, and Aesthetics coaches into unified session
 * Uses MemoizedCoordinator for performance optimization
 */
class ExpertCoordinator {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.whyDecider = this.instantiateOrFallback(window.WhyThisDecider, () => ({
            generateRationales: () => []
        }));
        this.readinessInference = window.ReadinessInference;
        this.seasonalPrograms = window.SeasonalPrograms;
        this.coordinatorContext = window.CoordinatorContext;
        this.dataValidator = window.AIDataValidator;
        this.errorAlert = window.ErrorAlert;

        // Initialize memoized coordinator for performance
        this.memoizedCoordinator = this.instantiateOrFallback(
            window.MemoizedCoordinator,
            () => this.createDefaultMemoizedCoordinator()
        );

        // T2B-3: Initialize validation cache for performance optimization
        this.validationCache = new Map();
        this.validationCacheMaxSize = 100;

        this.experts = {
            strength: this.instantiateOrFallback(window.StrengthCoach, () => this.createDefaultExpert('strength')),
            sports: this.instantiateOrFallback(window.SportsCoach, () => this.createDefaultExpert('sports')),
            physio: this.instantiateOrFallback(window.PhysioCoach, () => this.createDefaultExpert('physio')),
            nutrition: this.instantiateOrFallback(window.NutritionCoach, () => this.createDefaultExpert('nutrition')),
            aesthetics: this.instantiateOrFallback(window.AestheticsCoach, () => this.createDefaultExpert('aesthetics')),
            climbing: this.instantiateOrFallback(window.ClimbingCoach, () => this.createDefaultExpert('climbing'))
        };

        // Personal AI learning modules
        this.personalLearner = this.instantiatePersonalModule(window.PersonalAILearner);
        this.feedbackCollector = this.instantiatePersonalModule(window.FeedbackCollector);
        this.adaptiveRecommender = this.instantiateAdaptiveRecommender(
            window.AdaptiveRecommender,
            this.personalLearner,
            this.feedbackCollector
        );

        // Register experts with memoized coordinator
        this.registerExperts();
    }

    /**
     * Register experts with memoized coordinator
     */
    registerExperts() {
        Object.entries(this.experts).forEach(([name, expert]) => {
            this.memoizedCoordinator.registerExpert(name, expert);
        });
    }

    /**
     * Create cache key for context
     * @param {Object} context - User context
     * @returns {string} Cache key
     */
    createCacheKey(context) {
        const keyData = {
            userId: context.user?.id,
            readiness: context.readiness,
            goals: context.goals,
            preferences: context.preferences,
            timestamp: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute buckets
        };

        return JSON.stringify(keyData, Object.keys(keyData).sort());
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance stats
     */
    getPerformanceStats() {
        return this.memoizedCoordinator.getStats();
    }

    /**
     * Clear memoization cache
     */
    clearCache() {
        this.memoizedCoordinator.clearCaches();
    }

    /**
     * Plan today's workout with full structure
     * @param {Object} context - User context
     * @returns {Promise<Object>} Complete workout plan
     */
    async planToday(context) {
        const startTime = performance.now();

        try {
            // Use memoized coordinator for performance
            const plan = await this.memoizedCoordinator.planToday(context, {
                useMemoization: true,
                cacheKey: this.createCacheKey(context)
            });

            const responseTime = performance.now() - startTime;
            this.logger.info(`Plan generated in ${responseTime.toFixed(2)}ms`);

            return plan;

        } catch (error) {
            this.logger.error('Plan generation failed:', error);

            // Fallback to non-memoized approach
            return await this.planTodayFallback(context);
        }
    }

    /**
     * Fallback plan generation without memoization
     * @param {Object} context - User context
     * @returns {Promise<Object>} Complete workout plan
     */
    async planTodayFallback(context) {
        const workingContext = context || {};
        const cacheKey = this.generateValidationCacheKey(workingContext);
        let validationResult;

        if (this.validationCache?.has(cacheKey)) {
            validationResult = this.validationCache.get(cacheKey);
            if (validationResult?.validatedContext) {
                Object.assign(workingContext, validationResult.validatedContext);
            }
            this.logger.debug('Using cached validation result');
        } else {
            validationResult = this.validateContextSafely(workingContext);
            this.storeValidationResult(cacheKey, validationResult);
        }

        workingContext._validationMetadata = {
            isValid: validationResult?.isValid ?? false,
            errors: validationResult?.errors ?? [],
            warnings: validationResult?.warnings ?? [],
            cached: this.validationCache?.has(cacheKey) ?? false
        };

        this.applyDefaultUserContext(workingContext);
        const readiness = this.normalizeReadiness(workingContext);

        const basePlan = this.buildBasePlan(workingContext, readiness);
        const mergedPlan = this.mergePriorityPlans(basePlan, workingContext);
        this.applyReadinessAdjustments(mergedPlan, readiness);
        this.applyHeartRateInfluence(mergedPlan, workingContext);
        this.applyPersonalAIAdjustments(mergedPlan, workingContext);

        mergedPlan.metadata = mergedPlan.metadata || {};
        mergedPlan.metadata.generatedAt = new Date().toISOString();
        mergedPlan.metadata.readiness = readiness;

        if (workingContext._conservativeDefaults) {
            mergedPlan.notes.push('Conservative defaults applied due to incomplete context data.');
            mergedPlan.why.push('Fallback safeguards engaged to keep session safe.');
        }

        this.logger.info('Expert coordination fallback plan generated', {
            readiness,
            intensityScale: mergedPlan.intensityScale,
            source: mergedPlan.metadata.source
        });

        return mergedPlan;
    }

    /**
     * Get unified session plan for today (legacy method)
     * @param {Object} context - User context
     * @returns {Object} Unified session plan
     */
    getSessionPlan(context) {
        try {
            // Get proposals from all experts
            const proposals = this.gatherProposals(context);

            // CRITICAL FIX: Check for empty proposals and return fallback plan
            if (proposals._empty || Object.values(proposals).every(p => !p || !p.blocks || p.blocks.length === 0)) {
                this.logger.warn('All expert proposals are empty - using fallback plan');
                return this.getFallbackPlan(context);
            }

            // Merge with priority order
            const mergedPlan = this.mergeProposals(proposals, context);

            // Resolve conflicts
            const resolvedPlan = this.resolveConflicts(mergedPlan, proposals, context);

            // Generate rationale
            const rationales = this.whyDecider.generateRationales(resolvedPlan, proposals, context);

            return {
                ...resolvedPlan,
                rationale: rationales,
                generatedAt: new Date().toISOString(),
                experts: Object.keys(proposals)
            };
        } catch (error) {
            this.logger.error('Failed to generate session plan', error);
            return this.getFallbackPlan(context);
        }
    }

    /**
     * Gather proposals from all experts
     * @param {Object} context - User context
     * @returns {Object} All expert proposals
     */
    gatherProposals(context) {
        const proposals = {};
        const failedExperts = [];

        for (const [name, expert] of Object.entries(this.experts)) {
            try {
                proposals[name] = expert.propose(context);
            } catch (error) {
                this.logger.warn(`Expert ${name} failed to propose`, error);
                proposals[name] = { blocks: [], constraints: [], priorities: [] };
                failedExperts.push({ name, error: error.message });

                // Show error alert for expert failure
                if (this.errorAlert) {
                    const userFriendlyMessage = this.getUserFriendlyErrorMessage(error, name);
                    this.errorAlert.showExpertFailureAlert({
                        expertType: name,
                        errorMessage: userFriendlyMessage,
                        fallbackMessage: `Using conservative fallback plan for ${this.getExpertDisplayName(name)}`,
                        severity: this.getExpertSeverity(name),
                        duration: 15000
                    });
                }
            }
        }

        // CRITICAL FIX: Prevent empty workout sessions when all 5 experts fail
        // Check immediately after gathering all proposals - catch before logging
        // If all proposals have empty blocks, user would get blank workout screen
        if (Object.values(proposals).every(p => !p || !p.blocks || p.blocks.length === 0)) {
            this.logger.warn('All expert proposals are empty - marking for fallback plan');
            proposals._empty = true; // Mark as empty for detection by calling method
            // Note: Cannot return getFallbackPlanStructured here as gatherProposals returns proposals
            // Calling methods will detect _empty flag and return fallback plan
        }

        // Log summary of failed experts
        if (failedExperts.length > 0) {
            this.logger.error('Expert system failures', {
                failedCount: failedExperts.length,
                failedExperts: failedExperts.map(f => f.name),
                totalExperts: Object.keys(this.experts).length
            });
        }

        return proposals;
    }

    /**
     * Get expert display name
     * @param {string} expertName - Expert name
     * @returns {string} Display name
     */
    getExpertDisplayName(expertName) {
        const names = {
            strength: 'Strength',
            sports: 'Sports',
            physio: 'Physio',
            nutrition: 'Nutrition',
            aesthetics: 'Aesthetics',
            climbing: 'Climbing'
        };
        return names[expertName] || expertName;
    }

    /**
     * Get user-friendly error message
     * @param {Error} error - Technical error
     * @param {string} expertName - Expert name
     * @returns {string} User-friendly message
     */
    getUserFriendlyErrorMessage(error, expertName) {
        const expertDisplayName = this.getExpertDisplayName(expertName);

        // Map common technical errors to user-friendly messages
        const errorMessage = error.message || error.toString();

        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            return `${expertDisplayName} expert is temporarily unavailable due to connection issues`;
        }

        if (errorMessage.includes('timeout')) {
            return `${expertDisplayName} expert is taking longer than expected to respond`;
        }

        if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
            return `${expertDisplayName} expert needs more information to make recommendations`;
        }

        if (errorMessage.includes('memory') || errorMessage.includes('allocation')) {
            return `${expertDisplayName} expert is experiencing high load, using simplified recommendations`;
        }

        if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
            return `${expertDisplayName} expert access is temporarily restricted`;
        }

        // Default user-friendly message
        return `${expertDisplayName} expert is temporarily unavailable`;
    }

    /**
     * Merge proposals with priority order
     * Priority: Safety > Sport > Strength > Aesthetics
     * @param {Object} proposals - All expert proposals
     * @param {Object} context - User context
     * @returns {Object} Merged plan
     */
    mergeProposals(proposals, context) {
        const plan = {
            warmup: [],
            mainSets: [],
            accessories: [],
            finishers: [],
            substitutions: [],
            notes: [],
            sessionNotes: ''
        };

        // 1. Physio recommendations (highest priority - safety first)
        if (proposals.physio?.blocks) {
            const correctiveWork = proposals.physio.blocks.filter(b => b.type === 'corrective');
            const prehabWork = proposals.physio.blocks.filter(b => b.type === 'prehab');

            plan.warmup.push(...correctiveWork);
            plan.finishers.push(...prehabWork);

            if (correctiveWork.length > 0 || prehabWork.length > 0) {
                plan.notes.push({
                    source: 'physio',
                    text: 'Corrective and prehab work included based on movement quality assessment'
                });
            }
        }

        // 2. Sports coach recommendations (game day adjustments)
        if (proposals.sports?.blocks) {
            const powerWork = proposals.sports.blocks.filter(b => b.type === 'power');
            const conditioning = proposals.sports.blocks.filter(b => b.type === 'conditioning');

            plan.mainSets.push(...powerWork);
            plan.finishers.push(...conditioning);

            // Check for game day constraints
            const gameDayConstraints = proposals.sports?.constraints?.find(c => c.type === 'game_day_safety');
            if (gameDayConstraints && gameDayConstraints.daysUntilGame <= 2) {
                plan.substitutions.push({
                    original: 'heavy_lower_body_work',
                    alternative: 'upper_body_light_or_power_maintenance',
                    reason: gameDayConstraints.rule
                });
            }
        }

        // 2a. Climbing coach recommendations (if user's sport is climbing)
        if (context.user?.sport === 'climbing' && proposals.climbing?.blocks) {
            const mainTraining = proposals.climbing.blocks.filter(b => b.type === 'main_training');
            const antagonist = proposals.climbing.blocks.filter(b => b.type === 'antagonist');

            // Add climbing-specific training to main sets
            plan.mainSets.push(...mainTraining);

            // Add antagonist work to finishers
            plan.finishers.push(...antagonist);

            // Add finger recovery constraints
            const fingerRecovery = proposals.climbing?.constraints?.find(c => c.type === 'finger_recovery');
            if (fingerRecovery) {
                plan.notes.push({
                    source: 'climbing',
                    text: 'Finger recovery period: Minimum 48 hours between intense finger work'
                });
            }

            if (mainTraining.length > 0 || antagonist.length > 0) {
                plan.notes.push({
                    source: 'climbing',
                    text: `Climbing-specific training included for ${context.user.climbingStyle || 'mixed'} style`
                });
            }
        }

        // 3. Strength coach recommendations (core lifting)
        if (proposals.strength?.blocks) {
            const mainSets = proposals.strength.blocks.filter(b => b.type === 'main_sets');
            plan.mainSets.push(...mainSets);

            const warmupFromStrength = proposals.strength.blocks.filter(b => b.type === 'warmup');
            plan.warmup = [...warmupFromStrength, ...plan.warmup]; // Strength warmup first
        }

        // 4. Aesthetics coach recommendations (accessories - 30% of session)
        if (proposals.aesthetics?.blocks) {
            const accessories = proposals.aesthetics.blocks.filter(b => b.type === 'accessory');
            plan.accessories.push(...accessories);

            if (accessories.length > 0) {
                plan.notes.push({
                    source: 'aesthetics',
                    text: `Accessories selected for ${context.preferences?.aestheticFocus} aesthetic goal`
                });
            }
        }

        // 5. Nutrition recommendations (timing guidance)
        if (proposals.nutrition?.blocks) {
            plan.nutrition = proposals.nutrition.blocks[0];
        }

        // Generate session notes
        plan.sessionNotes = this.generateSessionNotes(plan, context);

        return plan;
    }

    /**
     * Resolve conflicts between expert recommendations
     * @param {Object} plan - Merged plan
     * @param {Object} proposals - All expert proposals
     * @param {Object} context - User context
     * @returns {Object} Resolved plan
     */
    resolveConflicts(plan, proposals, context) {
        // Track original sets before any modifications to prevent compound scaling issues
        plan.mainSets = plan.mainSets.map(main => ({
            ...main,
            _originalSets: main.sets || 3 // Store original for compound reduction tracking
        }));

        // SAFETY PRIORITY: Check for knee pain or knee flags FIRST (before performance concerns)
        // This ensures safety constraints override game-day performance concerns
        const kneePain = proposals.physio?.blocks?.find(b =>
            b.exercise?.rationale?.toLowerCase().includes('knee')
        ) || context.constraints?.flags?.includes('knee_pain');

        if (kneePain) {
            // CRITICAL FIX: Check for ExerciseAdapter availability BEFORE instantiation
            // Prevents app crash if dependency is missing - graceful degradation pattern
            if (!window.ExerciseAdapter) {
                // Early return pattern: skip substitution if dependency missing
                // This prevents crash while maintaining workout plan integrity
                this.logger.warn('ExerciseAdapter not available, skipping exercise substitution for knee pain');
                plan.notes = plan.notes || [];
                plan.notes.push({
                    source: 'system',
                    text: 'Knee pain detected, but exercise substitution unavailable. Please modify exercises manually if needed.'
                });
                // Early exit - plan.mainSets remain unchanged (safe fallback)
                // Flow continues with original exercises rather than crashing
            } else {
                const exerciseAdapter = new window.ExerciseAdapter();

                plan.mainSets = plan.mainSets.map(main => {
                    const exerciseName = main.exercise || main.name;

                    // Check for Bulgarian Split Squats specifically
                    if (exerciseName && exerciseName.toLowerCase().includes('bulgarian split squat')) {
                        const alternates = exerciseAdapter.getAlternates(exerciseName);
                        if (alternates.length > 0) {
                            return {
                                ...main,
                                exercise: alternates[0].name,
                                name: alternates[0].name,
                                rationale: alternates[0].rationale,
                                constraintSource: 'physio'
                            };
                        }
                    }

                    // Check for other squat variations
                    if (exerciseName && exerciseName.includes('squat') && !exerciseName.includes('goblet')) {
                        const alternates = exerciseAdapter.getAlternates(exerciseName);
                        if (alternates.length > 0) {
                            return {
                                ...main,
                                exercise: alternates[0].name,
                                name: alternates[0].name,
                                rationale: alternates[0].rationale,
                                constraintSource: 'physio'
                            };
                        }
                    }

                    return main;
                });

                // Add note about substitutions if any were made
                plan.notes = plan.notes || [];
                plan.notes.push({
                    source: 'physio',
                    text: 'Exercises modified due to knee concerns. Safe alternatives provided.'
                });
            }
        }

        // Check for game -1 day conflicts (PERFORMANCE - applied after safety)
        // Note: Safety constraints (knee pain) already handled above, so game-day adjustments
        // will work with already-substituted safe exercises
        const gameDayConstraint = proposals.sports?.constraints?.find(c => c.type === 'game_day_safety');
        if (gameDayConstraint?.daysUntilGame <= 1) {
            // Remove heavy leg work
            plan.mainSets = plan.mainSets.filter(main =>
                !main.exercise?.includes('squat') && !main.exercise?.includes('deadlift')
            );

            plan.substitutions.push({
                original: 'lower_body_work',
                alternative: 'upper_body_light + power_maintenance',
                reason: 'Game tomorrow - upper body maintenance only'
            });
        }

        // Check for low readiness
        if (context.readiness <= 4) {
            // Reduce volume across the board
            plan.mainSets = plan.mainSets.map(main => ({
                ...main,
                sets: Math.max(2, Math.floor((main._originalSets || main.sets || 3) * 0.7)),
                load: main.load ? main.load * 0.7 : main.load,
                _readinessReduced: true // Track that readiness reduction was applied
            }));

            plan.notes.push({
                source: 'readiness',
                text: 'Reduced volume due to low readiness (≤4). Prioritize recovery.'
            });
        }

        // Apply load-based volume adjustments
        // CRITICAL FIX: Prevent compound scaling that creates 1-set workouts
        if (context.volumeScale && context.volumeScale < 1.0) {
            const volumeMultiplier = context.volumeScale;

            // Calculate maximum allowed reduction (cap at 60% total reduction = 40% minimum)
            const maxTotalReduction = 0.6; // Maximum 60% reduction
            const minEffectiveVolume = 1.0 - maxTotalReduction; // At least 40% of original

            // Reduce sets and reps across all exercises
            plan.mainSets = plan.mainSets.map(main => {
                // Use original sets if available, otherwise current sets
                const baseSets = main._originalSets || main.sets || 3;

                // If readiness reduction was already applied, calculate cumulative effect
                let effectiveSets;
                if (main._readinessReduced) {
                    // Apply volumeScale to the already-reduced sets, but track from original
                    const readinessReducedSets = Math.floor(baseSets * 0.7);
                    const afterVolumeScale = Math.floor(readinessReducedSets * volumeMultiplier);
                    // Ensure we never go below 40% of original (60% max reduction)
                    const minSetsFromOriginal = Math.max(2, Math.floor(baseSets * minEffectiveVolume));
                    effectiveSets = Math.max(minSetsFromOriginal, afterVolumeScale);
                } else {
                    // Only volumeScale reduction, ensure at least 2 sets and respect max reduction
                    const afterVolumeScale = Math.floor(baseSets * volumeMultiplier);
                    const minSetsFromOriginal = Math.max(2, Math.floor(baseSets * minEffectiveVolume));
                    effectiveSets = Math.max(minSetsFromOriginal, afterVolumeScale);
                }

                // Final safety guard: Always ensure at least 2 sets
                effectiveSets = Math.max(2, effectiveSets);

                return {
                    ...main,
                    sets: effectiveSets,
                    reps: this.adjustRepsForVolume(main.reps, volumeMultiplier)
                };
            });

            // Apply same protection to accessories (allow more flexibility, but still cap at 60% reduction)
            plan.accessories = plan.accessories.map(accessory => {
                const baseSets = accessory.sets || 3;
                const afterVolumeScale = Math.floor(baseSets * volumeMultiplier);
                const minSetsFromOriginal = Math.max(1, Math.floor(baseSets * minEffectiveVolume));
                const effectiveSets = Math.max(minSetsFromOriginal, afterVolumeScale);

                return {
                    ...accessory,
                    sets: effectiveSets,
                    reps: this.adjustRepsForVolume(accessory.reps, volumeMultiplier)
                };
            });

            plan.notes.push({
                source: 'load',
                text: `Reduced volume due to high training load (${Math.round((1 - volumeMultiplier) * 100)}% reduction)`
            });
        }

        // Apply recovery day recommendations
        const isSimpleMode = context.preferences?.trainingMode === 'simple';
        let isRecoveryDayMinimal = false;

        if (context.recommendRecoveryDay) {
            // Replace main sets with recovery exercises
            plan.mainSets = [{
                exercise: 'Light Mobility Work',
                sets: 1,
                reps: '10-15',
                rationale: 'Recovery day due to high training load'
            }];

            plan.accessories = [];
            plan.finishers = [{
                exercise: 'Gentle Stretching',
                sets: 1,
                reps: '5-10',
                rationale: 'Promote recovery and mobility'
            }];

            // T2B-4: Detect when recovery day creates minimal workout in Simple Mode
            isRecoveryDayMinimal = isSimpleMode && plan.mainSets.length <= 1;

            plan.notes.push({
                source: 'load',
                text: 'Recovery day recommended due to load spike - focus on mobility and light movement'
            });

            // T2B-4: Add user notification and override option for Simple Mode + Recovery Day collision
            if (isRecoveryDayMinimal) {
                // Task 2: Check user preference for recovery day handling
                const simpleModeManager = window.SimpleModeManager;
                const userPreference = simpleModeManager?.getRecoveryDayPreference?.() || 'ask';

                // Auto-handle if user has set preference
                if (userPreference === 'accept') {
                    // User prefers to accept recovery days - no notification needed
                    plan.notes.push({
                        source: 'recovery_simple_mode',
                        type: 'info',
                        text: 'Recovery day recommended - light activity planned'
                    });
                } else if (userPreference === 'override') {
                    // User prefers normal workouts - regenerate without recovery day
                    context.recommendRecoveryDay = false;
                    context.recoveryDayOverride = true;
                    // Note: This will cause plan to regenerate without recovery day recommendation
                    // For now, we'll still show notification but allow override
                    plan.notes.push({
                        source: 'recovery_simple_mode',
                        type: 'notification',
                        text: 'Recovery day recommended - light activity planned',
                        overrideAvailable: true,
                        overrideMessage: 'You can override with a normal workout if preferred'
                    });
                } else {
                    // Default: ask user each time
                    plan.notes.push({
                        source: 'recovery_simple_mode',
                        type: 'notification',
                        text: 'Recovery day recommended - light activity planned',
                        overrideAvailable: true,
                        overrideMessage: 'You can override with a normal workout if preferred'
                    });
                }

                // Store recovery day preference prompt flag
                context.showRecoveryDayPreference = true;
                context.recoveryDayPreference = userPreference;

                this.logger.info('RECOVERY_DAY_SIMPLE_MODE_COLLISION', {
                    isSimpleMode,
                    isRecoveryDay: true,
                    workoutMinimal: isRecoveryDayMinimal,
                    userPreference,
                    message: 'Recovery day creates minimal workout in Simple Mode'
                });
            }
        }

        // Simple mode: limit to 1-2 blocks
        if (isSimpleMode && !context.recommendRecoveryDay) {
            // Keep only warmup and main in simple mode
            plan.accessories = [];
            plan.finishers = plan.finishers?.slice(0, 1) || []; // One finisher only

            plan.notes.push({
                source: 'mode',
                text: 'Simple mode. Streamlined plan for quick execution.'
            });
        }

        // Time-crunched: trim and superset
        const timeLimit = context.constraints?.timeLimit;
        if (timeLimit && timeLimit <= 25) {
            // Reduce accessories and finishers
            plan.accessories = plan.accessories?.slice(0, 1) || [];
            plan.finishers = plan.finishers?.slice(0, 1) || [];

            // Mark for supersets
            plan.mainSets = plan.mainSets.map(ex => ({
                ...ex,
                notes: `${ex.notes || ''} (superset to save time)`.trim(),
                superset: true
            }));

            plan.notes.push({
                source: 'time',
                text: `Time-crunched plan (${timeLimit} min). Superset main work for efficiency.`
            });
        }

        // Clean up internal tracking fields before returning plan
        plan.mainSets = plan.mainSets.map(main => {
            const { _originalSets, _readinessReduced, ...cleanMain } = main;
            return cleanMain;
        });

        return plan;
    }

    /**
     * Generate session notes summary
     * @param {Object} plan - Session plan
     * @param {Object} context - User context
     * @returns {string} Session notes
     */
    generateSessionNotes(plan, context) {
        const notes = [];

        notes.push(`Today's readiness: ${context.readiness}/10`);

        if (plan.substitutions.length > 0) {
            notes.push(`Modifications: ${plan.substitutions.map(s => s.reason).join(', ')}`);
        }

        if (plan.accessories.length > 0) {
            notes.push(`Accessories: ${context.preferences?.aestheticFocus} focus (${plan.accessories.length} exercises)`);
        }

        return `${notes.join('. ') }.`;
    }

    /**
     * Structure plan into required format
     * @param {Object} plan - Resolved plan
     * @param {Object} context - User context
     * @returns {Object} Structured plan
     */
    structurePlan(plan, context) {
        const blocks = [];
        const warnings = [];
        const why = [];

        // Calculate intensity scale based on readiness
        const intensityScale = this.calculateIntensityScale(context.readiness);

        // Build warm-up block
        if (plan.warmup && plan.warmup.length > 0) {
            blocks.push({
                name: 'Warm-up',
                items: plan.warmup.map(item => this.createExerciseItem(item)),
                durationMin: 10
            });
            why.push('Dynamic warm-up prepares movement patterns');
        }

        // Build main block
        if (plan.mainSets && plan.mainSets.length > 0) {
            blocks.push({
                name: 'Main',
                items: plan.mainSets.map(item => this.createExerciseItem(item)),
                durationMin: this.calculateMainDuration(plan.mainSets, context)
            });
            why.push('Main movements target strength and power');
        }

        // Build accessories block
        if (plan.accessories && plan.accessories.length > 0) {
            blocks.push({
                name: 'Accessories',
                items: plan.accessories.map(item => this.createExerciseItem(item)),
                durationMin: 15
            });
            why.push('Accessory work supports main movements');
        }

        // Build recovery block
        if (plan.finishers && plan.finishers.length > 0) {
            blocks.push({
                name: 'Recovery',
                items: plan.finishers.map(item => this.createExerciseItem(item)),
                durationMin: 10
            });
            why.push('Recovery work promotes adaptation');
        }

        // Add rationale from notes
        if (plan.notes) {
            plan.notes.forEach(note => {
                why.push(note.text);
            });
        }

        // Add game day warning if applicable
        if (context.schedule?.daysUntilGame <= 1) {
            warnings.push('Game tomorrow. Reduced volume and intensity for performance.');
            why.push('Lower intensity due to upcoming game');
        }

        // Add low readiness warning
        if (context.readiness <= 4) {
            warnings.push('Low readiness. Focus on recovery and form.');
            why.push('Volume reduced due to low readiness');
        }

        return {
            blocks,
            intensityScale,
            why,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }

    /**
     * Create exercise item in required format
     * @param {Object} exercise - Exercise data
     * @returns {Object} Formatted exercise item
     */
    createExerciseItem(exercise) {
        return {
            name: exercise.name || exercise.exercise || 'Unknown Exercise',
            sets: exercise.sets || 3,
            reps: exercise.reps || '8-12',
            targetRPE: exercise.rpe?.target || exercise.targetRPE || 7,
            notes: exercise.rationale || exercise.notes,
            category: exercise.category
        };
    }

    /**
     * Calculate intensity scale
     * @param {number} readiness - Readiness score (1-10)
     * @returns {number} Intensity scale (0.6-1.1)
     */
    calculateIntensityScale(readiness) {
        if (readiness >= 8) {return 1.0;}
        if (readiness >= 6) {return 0.9;}
        if (readiness >= 4) {return 0.8;}
        return 0.6;
    }

    /**
     * Calculate main duration based on exercises
     * @param {Array} exercises - Main exercises
     * @param {Object} context - Context
     * @returns {number} Duration in minutes
     */
    calculateMainDuration(exercises, context) {
        const baseDuration = exercises.length * 8; // 8 min per exercise
        const sessionLength = context.preferences?.sessionLength || 45;
        const timeLimit = context.constraints?.timeLimit || sessionLength;

        // If time-crunched, reduce duration
        if (timeLimit <= 25) {
            return Math.min(baseDuration * 0.6, 20);
        }

        return Math.min(baseDuration, 40);
    }

    /**
     * Get structured fallback plan
     * @param {Object} context - User context
     * @returns {Object} Fallback plan
     */
    getFallbackPlanStructured(context) {
        // Show error alert for fallback plan usage
        if (this.errorAlert) {
            this.errorAlert.showErrorAlert({
                errorMessage: 'AI planning system is temporarily unavailable',
                fallbackMessage: 'Using a safe, conservative workout plan to ensure your safety',
                duration: 20000
            });
        }

        // Use conservative recommendations if data validator is available
        if (this.dataValidator) {
            const conservativeRecs = this.dataValidator.generateConservativeRecommendations(context);
            const safetyFlags = this.dataValidator.generateSafetyFlags(context);

            return {
                blocks: [
                    {
                        name: 'Warm-up',
                        items: [
                            {
                                name: 'General Mobility',
                                sets: 1,
                                reps: '5-10',
                                targetRPE: 5,
                                notes: 'Conservative warm-up due to limited data',
                                category: 'warmup'
                            }
                        ],
                        durationMin: 10
                    },
                    {
                        name: 'Main',
                        items: [
                            {
                                name: 'Bodyweight Circuit',
                                sets: conservativeRecs.volume === 'low' ? 2 : 3,
                                reps: '10-15',
                                targetRPE: conservativeRecs.intensity === 'light' ? 6 : 7,
                                notes: `Conservative ${conservativeRecs.intensity} intensity session`,
                                category: 'circuit'
                            }
                        ],
                        durationMin: conservativeRecs.duration || 30
                    }
                ],
                intensityScale: conservativeRecs.intensity === 'light' ? 0.7 : 0.8,
                why: [
                    'Using conservative recommendations due to limited data availability',
                    'Focusing on safety and basic movement patterns',
                    'This plan ensures you can still train effectively'
                ],
                warnings: safetyFlags.length > 0 ? safetyFlags : ['Using a safe, simplified workout plan']
            };
        }

        // Original fallback if no data validator
        return {
            blocks: [
                {
                    name: 'Warm-up',
                    items: [
                        {
                            name: 'General Mobility',
                            sets: 1,
                            reps: '5-10',
                            targetRPE: 5,
                            notes: 'Light movement preparation',
                            category: 'warmup'
                        }
                    ],
                    durationMin: 10
                },
                {
                    name: 'Main',
                    items: [
                        {
                            name: 'Bodyweight Circuit',
                            sets: 3,
                            reps: '10-15',
                            targetRPE: 7,
                            notes: 'Fallback session due to planning error',
                            category: 'circuit'
                        }
                    ],
                    durationMin: 20
                }
            ],
            intensityScale: 0.8,
            why: ['Simplified session due to technical issue'],
            warnings: ['Using fallback plan']
        };
    }

    /**
     * Get fallback plan if coordination fails
     * @param {Object} context - User context
     * @returns {Object} Fallback plan
     */
    getFallbackPlan(context) {
        return {
            warmup: ['general_mobility', 'light_cardio'],
            mainSets: [{
                exercise: 'bodyweight_circuit',
                sets: 3,
                reps: '10-15',
                rationale: 'Safe fallback session while system recovers'
            }],
            accessories: [],
            finishers: [],
            substitutions: [],
            rationale: ['Simplified session due to temporary system issue'],
            sessionNotes: 'Using a safe fallback plan while the system recovers',
            isFallback: true
        };
    }

    /**
     * Apply load-based adjustments to context
     * @param {Object} context - User context with load metrics
     */
    applyLoadBasedAdjustments(context) {
        const load = context.load || {};
        const yesterday = context.yesterday || {};
        const dataConfidence = context.dataConfidence || {};

        // Track adjustments for why panel
        context.loadAdjustments = [];

        // Get current load status from LoadCalculator
        const loadCalculator = window.LoadCalculator;
        if (loadCalculator) {
            const loadStatus = loadCalculator.getCurrentLoadStatus();
            this.applyLoadBasedWorkoutAdjustments(context, loadStatus);
        }

        // High-intensity yesterday (Z4/Z5) → cap lower-body volume today
        if (yesterday.z4_min >= 20 || yesterday.z5_min >= 10) {
            context.suppressHeavyLower = true;
            context.loadAdjustments.push(`Synced HR shows ${yesterday.z4_min} min in Z4 and ${yesterday.z5_min} min in Z5 yesterday → dialing back lower-body volume.`);
            this.logger.info('Suppressing heavy lower due to high-intensity yesterday', { z4_min: yesterday.z4_min, z5_min: yesterday.z5_min });
        }

        // High strain → recommend deload or mobility
        if (load.strain > 150 || (load.monotony > 2.0 && load.atl7 > load.ctl28 * 1.2)) {
            context.recommendDeload = true;
            context.loadAdjustments.push(`High weekly strain detected (${load.strain}) or monotony > 2.0 → adding mobility emphasis.`);
            this.logger.info('Recommending deload due to high strain/monotony', { strain: load.strain, monotony: load.monotony });
        }

        // Scale intensity by readiness proxy from rolling load
        const readinessProxy = this.calculateReadinessProxy(load, yesterday, dataConfidence);
        if (readinessProxy < 0.8) {
            context.intensityScale *= readinessProxy;
            context.loadAdjustments.push(`Rolling load suggests lower readiness → scaling intensity to ${(readinessProxy * 100).toFixed(0)}%.`);
            this.logger.info('Scaling intensity based on readiness proxy', { proxy: readinessProxy, scaledIntensity: context.intensityScale });
        }

        // Low data confidence → conservative recommendations
        if (dataConfidence.recent7days < 0.5) {
            context.conservativeMode = true;
            context.loadAdjustments.push(`Limited HR data this week (confidence ${(dataConfidence.recent7days * 100).toFixed(0)}%) → conservative recommendation.`);
            this.logger.info('Using conservative mode due to low data confidence', { confidence: dataConfidence.recent7days });
        }
    }

    /**
     * Apply load-based workout adjustments
     * @param {Object} context - User context
     * @param {Object} loadStatus - Load status from LoadCalculator
     */
    applyLoadBasedWorkoutAdjustments(context, loadStatus) {
        const {recommendations} = loadStatus;

        // Apply intensity and volume adjustments
        if (recommendations.intensity < 1.0) {
            context.intensityScale *= recommendations.intensity;
            context.loadAdjustments.push(`Load-based intensity reduction: ${recommendations.adjustments.intensityReduction}%`);
        }

        if (recommendations.volume < 1.0) {
            context.volumeScale = recommendations.volume;
            context.loadAdjustments.push(`Load-based volume reduction: ${recommendations.adjustments.volumeReduction}%`);
        }

        // Add load rationale to context
        if (recommendations.message) {
            context.loadAdjustments.push(recommendations.message);
        }

        // Set recovery recommendation flag
        if (recommendations.recoveryRecommended) {
            context.recommendRecoveryDay = true;
            context.loadAdjustments.push('Recovery day recommended due to load spike');
        }

        // Store load status for use in workout generation
        context.loadStatus = loadStatus;

        this.logger.info('Applied load-based workout adjustments', {
            intensity: recommendations.intensity,
            volume: recommendations.volume,
            loadRatio: recommendations.loadRatio,
            recoveryRecommended: recommendations.recoveryRecommended
        });
    }

    /**
     * Adjust reps for volume scaling
     * @param {string|number} reps - Original reps
     * @param {number} volumeMultiplier - Volume multiplier
     * @returns {string|number} Adjusted reps
     */
    adjustRepsForVolume(reps, volumeMultiplier) {
        if (typeof reps === 'string') {
            // Handle range strings like "8-12"
            const match = reps.match(/(\d+)-(\d+)/);
            if (match) {
                const min = Math.max(1, Math.floor(parseInt(match[1]) * volumeMultiplier));
                const max = Math.max(1, Math.floor(parseInt(match[2]) * volumeMultiplier));
                return `${min}-${max}`;
            }

            // Handle single number strings
            const numMatch = reps.match(/(\d+)/);
            if (numMatch) {
                const adjusted = Math.max(1, Math.floor(parseInt(numMatch[1]) * volumeMultiplier));
                return adjusted.toString();
            }

            return reps; // Return as-is if no numbers found
        }

        if (typeof reps === 'number') {
            return Math.max(1, Math.floor(reps * volumeMultiplier));
        }

        return reps;
    }

    /**
     * Calculate readiness proxy from rolling load
     * @param {Object} load - Load metrics
     * @param {Object} yesterday - Yesterday's activity
     * @param {Object} dataConfidence - Data confidence metrics
     * @returns {number} Readiness proxy (0.0-1.0)
     */
    calculateReadinessProxy(load, yesterday, dataConfidence) {
        let proxy = 1.0;

        // High ATL relative to CTL suggests fatigue
        if (load.ctl28 > 0) {
            const atlCtlRatio = load.atl7 / load.ctl28;
            if (atlCtlRatio > 1.2) {
                proxy *= 0.8; // Fatigue detected
            } else if (atlCtlRatio < 0.8) {
                proxy *= 1.1; // Fresh
            }
        }

        // Yesterday's high-intensity work reduces today's readiness
        if (yesterday.z4_min >= 20) {
            proxy *= 0.85;
        } else if (yesterday.z5_min >= 10) {
            proxy *= 0.9;
        }

        // High monotony suggests accumulated fatigue
        if (load.monotony > 2.0) {
            proxy *= 0.85;
        }

        // Scale by data confidence
        proxy *= (0.5 + dataConfidence.recent7days * 0.5);

        return Math.max(0.5, Math.min(1.2, proxy));
    }

    instantiateOrFallback(ConstructorRef, fallbackFactory) {
        if (typeof ConstructorRef === 'function') {
            try {
                const instance = new ConstructorRef();
                if (instance) {
                    return instance;
                }
            } catch (error) {
                this.logger?.warn?.('Failed to instantiate dependency', error);
            }
        }
        return typeof fallbackFactory === 'function' ? fallbackFactory() : fallbackFactory;
    }

    createDefaultExpert(label = 'expert') {
        return {
            name: label,
            propose: () => null
        };
    }

    createDefaultMemoizedCoordinator() {
        return {
            registerExpert: () => {},
            clearCaches: () => {},
            planToday: async () => {
                throw new Error('memoized coordinator unavailable');
            },
            getStats: () => ({ hits: 0, misses: 0 })
        };
    }

    validateContextSafely(context) {
        if (this.dataValidator && typeof this.dataValidator.validateContext === 'function') {
            try {
                const validated = this.dataValidator.validateContext(context) || context;
                if (validated && validated !== context) {
                    Object.assign(context, validated);
                }
                return {
                    validatedContext: { ...context },
                    isValid: true,
                    errors: [],
                    warnings: []
                };
            } catch (error) {
                this.logger.warn('Validation failed, applying conservative defaults', error);
                const conservative = this.applyConservativeDefaults(context);
                Object.assign(context, conservative);
                return {
                    validatedContext: { ...context },
                    isValid: false,
                    errors: [error.message || 'Validation error'],
                    warnings: ['Using conservative defaults due to validation failure']
                };
            }
        }

        this.logger.warn('DataValidator unavailable, applying conservative defaults');
        const conservative = this.applyConservativeDefaults(context);
        Object.assign(context, conservative);
        return {
            validatedContext: { ...context },
            isValid: false,
            errors: [],
            warnings: ['Validation unavailable, using conservative defaults']
        };
    }

    storeValidationResult(cacheKey, validationResult) {
        if (!this.validationCache) {
            this.validationCache = new Map();
        }
        this.validationCache.set(cacheKey, validationResult);
        if (this.validationCache.size > this.validationCacheMaxSize) {
            const firstKey = this.validationCache.keys().next().value;
            this.validationCache.delete(firstKey);
        }
    }

    applyDefaultUserContext(context) {
        context.user = context.user || {
            id: context.userId || 'anonymous',
            experience: context.experience || 'intermediate'
        };
        context.goals = context.goals || { primary: 'balanced_strength' };
        context.preferences = context.preferences || {};
    }

    normalizeReadiness(context) {
        const readinessValue = Number(
            context.readiness ?? context.readinessScore ?? 7
        );
        const readiness = Math.max(1, Math.min(10, Number.isFinite(readinessValue) ? readinessValue : 7));
        context.readiness = readiness;
        context.readinessScore = readiness;
        return readiness;
    }

    buildBasePlan(context, readiness) {
        const strengthFocus = readiness >= 7 ? 'compound_strength' : 'technique';
        const mainSets = readiness >= 8 ? 4 : 3;
        const accessoryDuration = readiness >= 8 ? 15 : 12;

        return {
            sessionType: context.goals?.primary || 'balanced_strength',
            intensityScale: 1,
            blocks: [
                { name: 'Prep & Mobility', focus: 'mobility', duration: 8, intensity: 'Z1' },
                { name: 'Activation', focus: 'movement_prep', duration: 6, intensity: 'Z2' },
                { name: 'Main Session', focus: strengthFocus, sets: mainSets, reps: readiness >= 8 ? '5-7' : '8-10', intensity: 'Z3' },
                { name: 'Accessory', focus: 'conditioning', duration: accessoryDuration, intensity: 'Z3' },
                { name: 'Cool Down', focus: 'recovery', duration: 6, intensity: 'Z1' }
            ],
            notes: [],
            why: [
                'Base plan assembled from core expert templates',
                `Readiness input: ${readiness}/10`
            ],
            metadata: {
                source: 'base'
            }
        };
    }

    mergePriorityPlans(basePlan, context) {
        const plan = this.clonePlan(basePlan);
        const priorityExperts = ['physio', 'sports', 'strength'];

        for (const expertName of priorityExperts) {
            const proposal = this.invokeExpertPlan(expertName, context);
            if (proposal) {
                plan.blocks = this.cloneBlocks(proposal.blocks);
                if (proposal.notes?.length) {
                    plan.notes.push(...proposal.notes);
                }
                if (proposal.why?.length) {
                    plan.why.push(...proposal.why);
                }
                plan.notes.push(`${expertName} recommendations applied`);
                plan.metadata.source = expertName;
                break;
            }
        }

        return plan;
    }

    invokeExpertPlan(expertName, context) {
        try {
            const expert = this.experts?.[expertName];
            if (!expert || typeof expert.propose !== 'function') {
                return null;
            }
            const proposal = expert.propose(context);
            if (!proposal || !proposal.blocks || proposal.blocks.length === 0) {
                return null;
            }
            return {
                blocks: this.cloneBlocks(proposal.blocks),
                notes: proposal.notes ? [...proposal.notes] : [],
                why: proposal.why ? [...proposal.why] : []
            };
        } catch (error) {
            this.logger.warn(`Expert proposal failed for ${expertName}`, error);
            return null;
        }
    }

    clonePlan(plan) {
        return {
            sessionType: plan.sessionType,
            intensityScale: plan.intensityScale,
            blocks: this.cloneBlocks(plan.blocks),
            notes: [...(plan.notes || [])],
            why: [...(plan.why || [])],
            metadata: { ...(plan.metadata || {}) }
        };
    }

    cloneBlocks(blocks = []) {
        return blocks.map(block => JSON.parse(JSON.stringify(block)));
    }

    applyReadinessAdjustments(plan, readiness) {
        const multiplier = readiness < 6 ? 0.8 : readiness > 8 ? 1.1 : 1;
        plan.intensityScale = Number((plan.intensityScale * multiplier).toFixed(2));
        plan.blocks = this.scaleBlocks(plan.blocks, multiplier);

        if (multiplier < 1) {
            plan.notes.push('Reduced intensity for recovery focus.');
            plan.why.push(`Readiness ${readiness}/10 → intensity reduced by ${(1 - multiplier) * 100}%`);
        } else if (multiplier > 1) {
            plan.notes.push('Increased intensity to leverage high readiness.');
            plan.why.push(`Readiness ${readiness}/10 → intensity increased by ${(multiplier - 1) * 100}%`);
        } else {
            plan.why.push('Maintaining standard intensity based on readiness.');
        }

        plan.metadata.readinessMultiplier = multiplier;
    }

    scaleBlocks(blocks, multiplier) {
        if (!Array.isArray(blocks)) {
            return [];
        }
        const minDuration = 5;
        return blocks.map(block => {
            const updated = { ...block };
            if (typeof block.duration === 'number') {
                updated.duration = Math.max(minDuration, Math.round(block.duration * multiplier));
            }
            if (typeof block.sets === 'number') {
                updated.sets = Math.max(1, Math.round(block.sets * multiplier));
            }
            if (typeof block.reps === 'number') {
                updated.reps = Math.max(1, Math.round(block.reps * multiplier));
            }
            if (typeof block.intensity === 'string') {
                updated.intensity = this.adjustZoneIntensity(block.intensity, multiplier);
            }
            return updated;
        });
    }

    adjustZoneIntensity(intensity, multiplier) {
        if (typeof intensity !== 'string' || !intensity.startsWith('Z')) {
            return intensity;
        }
        const level = parseInt(intensity.replace('Z', ''), 10);
        if (Number.isNaN(level)) {
            return intensity;
        }
        let adjusted = level;
        if (multiplier > 1 && level < 5) {
            adjusted = level + 1;
        } else if (multiplier < 1 && level > 1) {
            adjusted = level - 1;
        }
        return `Z${Math.max(1, Math.min(5, adjusted))}`;
    }

    /**
     * T2B-3: Generate cache key for validation result caching
     * @param {Object} context - User context
     * @returns {string} Cache key
     */
    generateValidationCacheKey(context) {
        // Create deterministic key from context fields that affect validation
        const keyFields = {
            readiness: context.readiness || context.readinessScore,
            atl7: context.atl7,
            ctl28: context.ctl28,
            dataConfidence: context.dataConfidence?.recent7days || 0,
            goals: context.goals,
            userId: context.user?.id || context.userId
        };

        // Create hash-like string from key fields
        return JSON.stringify(keyFields);
    }

    /**
     * T2B-3: Apply conservative defaults when validation fails or is unavailable
     * @param {Object} context - Original context
     * @returns {Object} Context with conservative defaults
     */
    applyConservativeDefaults(context) {
        const safeContext = { ...context };

        // Ensure readiness is valid (default to moderate 7)
        if (!safeContext.readiness || isNaN(safeContext.readiness) || safeContext.readiness < 1 || safeContext.readiness > 10) {
            safeContext.readiness = 7;
            safeContext.readinessScore = 7;
        }

        // Ensure load values are non-negative
        safeContext.atl7 = Math.max(0, safeContext.atl7 || 0);
        safeContext.ctl28 = Math.max(0, safeContext.ctl28 || 0);

        // Set conservative data confidence if missing
        if (!safeContext.dataConfidence || typeof safeContext.dataConfidence !== 'object') {
            safeContext.dataConfidence = {
                recent7days: 0.5, // Moderate confidence
                recent30days: 0.6
            };
        }

        // Set conservative intensity scale
        safeContext.intensityScale = safeContext.intensityScale || 0.8;

        // Ensure volume scale is reasonable
        safeContext.volumeScale = Math.max(0.5, Math.min(1.0, safeContext.volumeScale || 0.8));

        // Mark as using conservative defaults
        safeContext._conservativeDefaults = true;

        return safeContext;
    }

    applyHeartRateInfluence(plan, context) {
        const hrData = context.heartRate || {};
        const {baselineHRV} = context;

        if (hrData.hrv && baselineHRV) {
            if (hrData.hrv > baselineHRV * 1.1) {
                plan.intensityScale = Number((plan.intensityScale * 1.05).toFixed(2));
                plan.notes.push('HRV indicates strong recovery – intensity increased.');
            } else if (hrData.hrv < baselineHRV * 0.9) {
                plan.intensityScale = Number((plan.intensityScale * 0.85).toFixed(2));
                plan.notes.push('HRV below baseline – reducing intensity for recovery.');
            }
        }

        if (hrData.zoneDistribution) {
            const highIntensityMinutes = (hrData.zoneDistribution.Z4 || 0) + (hrData.zoneDistribution.Z5 || 0);
            const plannedHighIntensity = (plan.metadata?.plannedZoneMinutes?.high || 0) * 1.2;
            if (plannedHighIntensity && highIntensityMinutes > plannedHighIntensity) {
                plan.notes.push('Recent training skewed toward high intensity – scheduling deload elements.');
                plan.flags = plan.flags || [];
                plan.flags.push('potential_overreaching');
                plan.intensityScale = Number((plan.intensityScale * 0.9).toFixed(2));
            }
        }

        if (hrData.average && hrData.resting) {
            const elevatedResting = hrData.resting > (context.baselineRestingHR || hrData.resting) + 5;
            if (elevatedResting) {
                plan.notes.push('Resting heart rate elevated – inserting additional recovery block.');
                plan.blocks.push({
                    type: 'recovery',
                    duration: 15,
                    intensity: 'Z1',
                    focus: 'active_recovery'
                });
            }
        }
    }

    applyPersonalAIAdjustments(plan, context) {
        const userId = context?.user?.id;
        if (!userId || !this.adaptiveRecommender || !this.personalLearner) {
            return;
        }

        try {
            plan.notes = plan.notes || [];
            plan.why = plan.why || [];
            plan.metadata = plan.metadata || {};

            const mainCandidates = (plan.mainSets || []).map((item, index) => ({
                name: item.exercise || item.name,
                baseRate: 0.65 + (index * 0.05),
                generalLikelihood: item.successRate || 0.6,
                exposures: item.completedSessions || 0
            })).filter(candidate => !!candidate.name);

            if (mainCandidates.length > 0) {
                const recommendation = this.adaptiveRecommender.recommend({
                    userId,
                    candidates: mainCandidates,
                    baseConfidence: plan.metadata?.combinedConfidence || 0.65
                });

                if (recommendation?.choice) {
                    plan.metadata.personalAI = recommendation.metadata;
                    plan.metadata.combinedConfidence = Number(
                        ((plan.metadata.baseConfidence || 0.6) * 0.7 + recommendation.metadata.combinedConfidence * 0.3).toFixed(2)
                    );
                    plan.notes.push(`Personal AI weighting applied (${Math.round(plan.metadata.personalAI.combinedConfidence * 100)}% confidence).`);
                    plan.why.push('Prioritized exercises that historically perform well for you.');

                    // Bubble preferred exercise to top if different
                    const preferredIndex = plan.mainSets.findIndex(item =>
                        (item.exercise || item.name) === recommendation.choice.name
                    );
                    if (preferredIndex > 0) {
                        const [preferred] = plan.mainSets.splice(preferredIndex, 1);
                        plan.mainSets.unshift(preferred);
                    }
                }
            }

            // Adjust accessory volume based on volume tolerance pattern
            const volumeInsights = this.personalLearner.getVolumeInsights(userId);
            if (volumeInsights.baseline > 0 && volumeInsights.movingAverage > 0) {
                const toleranceRatio = volumeInsights.movingAverage / volumeInsights.baseline;
                if (toleranceRatio >= 1.2) {
                    plan.accessories = (plan.accessories || []).map(accessory => ({
                        ...accessory,
                        sets: Math.ceil((accessory.sets || 2) * Math.min(toleranceRatio, 1.4))
                    }));
                    plan.notes.push('Accessory volume increased due to high personal tolerance.');
                } else if (toleranceRatio <= 0.8) {
                    plan.accessories = (plan.accessories || []).map(accessory => ({
                        ...accessory,
                        sets: Math.max(1, Math.round((accessory.sets || 2) * toleranceRatio))
                    }));
                    plan.notes.push('Accessory volume reduced based on recent tolerance patterns.');
                }
            }
        } catch (error) {
            this.logger.warn('Personal AI adjustments failed', error);
        }
    }

    instantiatePersonalModule(ConstructorRef) {
        if (ConstructorRef && typeof ConstructorRef === 'function') {
            try {
                return new ConstructorRef();
            } catch (error) {
                this.logger.warn('Failed to instantiate personal AI module', error);
            }
        }
        return null;
    }

    instantiateAdaptiveRecommender(ConstructorRef, personalLearner, feedbackCollector) {
        if (ConstructorRef && typeof ConstructorRef === 'function') {
            try {
                return new ConstructorRef({
                    personalLearner: personalLearner || undefined,
                    feedbackCollector: feedbackCollector || undefined,
                    randomFn: () => {
                        // deterministic fallback for server-side environments without Math.random
                        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                            const buffer = new Uint32Array(1);
                            crypto.getRandomValues(buffer);
                            return buffer[0] / (0xFFFFFFFF + 1);
                        }
                        return Math.random();
                    }
                });
            } catch (error) {
                this.logger.warn('Failed to instantiate adaptive recommender', error);
            }
        }
        return null;
    }
}

if (typeof window !== 'undefined') {
    window.ExpertCoordinator = ExpertCoordinator;
}

export default ExpertCoordinator;

