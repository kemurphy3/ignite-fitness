/**
 * ExpertCoordinator - Central engine that reconciles expert recommendations
 * Merges Strength, Sports, Physio, Nutrition, and Aesthetics coaches into unified session
 * Uses MemoizedCoordinator for performance optimization
 */
class ExpertCoordinator {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.whyDecider = new WhyThisDecider();
        this.readinessInference = window.ReadinessInference;
        this.seasonalPrograms = window.SeasonalPrograms;
        this.coordinatorContext = window.CoordinatorContext;
        this.dataValidator = window.AIDataValidator;
        this.errorAlert = window.ErrorAlert;
        
        // Initialize memoized coordinator for performance
        this.memoizedCoordinator = new MemoizedCoordinator();
        
        this.experts = {
            strength: new StrengthCoach(),
            sports: new SportsCoach(),
            physio: new PhysioCoach(),
            nutrition: new NutritionCoach(),
            aesthetics: new AestheticsCoach()
        };
        
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
        try {
            // Validate and sanitize context data with conservative fallbacks
            if (this.dataValidator) {
                context = this.dataValidator.validateContext(context);
                this.logger.info('Context validated with conservative fallbacks', {
                    readiness: context.readinessScore,
                    atl7: context.atl7,
                    dataConfidence: context.dataConfidence
                });
            }
            
            // Build enhanced context with load metrics and confidence
            if (this.coordinatorContext) {
                const enhancedContext = await this.coordinatorContext.buildContext(context);
                context = enhancedContext;
            }
            
            // Check if we need to infer readiness
            let readiness = context.readiness;
            let isInferred = false;
            let inferenceRationale = '';
            
            // If no explicit check-in, infer readiness
            if (!readiness || isNaN(readiness)) {
                if (this.readinessInference && typeof this.readinessInference.inferReadiness === 'function') {
                    const lastSessions = context.history?.lastSessions || [];
                    const schedule = context.schedule || {};
                    
                    const inferenceResult = await this.readinessInference.inferReadiness({ lastSessions, schedule });
                    readiness = inferenceResult.score;
                    isInferred = inferenceResult.inferred;
                    inferenceRationale = inferenceResult.rationale;
                    
                    this.logger.info('Readiness inferred', { score: readiness, rationale: inferenceRationale });
                } else {
                    // Fallback if inference not available
                    readiness = 7;
                }
            }
            
            // Update context with readiness (possibly inferred)
            context.readiness = readiness;
            
            // Apply load-based adjustments
            this.applyLoadBasedAdjustments(context);
            
            // Get seasonal context
            let seasonalContext = null;
            if (this.seasonalPrograms && typeof this.seasonalPrograms.getSeasonContext === 'function') {
                const userProfile = context.profile || {};
                const calendar = context.calendar || {};
                
                seasonalContext = this.seasonalPrograms.getSeasonContext(new Date(), userProfile, calendar);
                
                // Apply seasonal rules
                if (seasonalContext.deloadThisWeek) {
                    context.deloadWeek = true;
                }
                
                // Apply game proximity rules in-season
                if (seasonalContext.phaseKey === 'in' && seasonalContext.gameProximity.suppressHeavyLower) {
                    context.suppressHeavyLower = true;
                    context.gameTomorrow = seasonalContext.gameProximity.isTomorrow;
                }
                
                this.logger.info('Season context', seasonalContext);
            }
            
            this.logger.info('Coordinator decision', { 
                readiness,
                inferred: isInferred,
                mode: context.preferences?.trainingMode,
                gameDay: context.schedule?.isGameDay,
                phase: seasonalContext?.phase
            });
            
            // Get proposals from all experts
            const proposals = this.gatherProposals(context);
            
            // CRITICAL FIX: Check for empty proposals and return fallback plan
            if (proposals._empty || Object.values(proposals).every(p => !p || !p.blocks || p.blocks.length === 0)) {
                this.logger.warn('All expert proposals are empty - using fallback plan');
                return this.getFallbackPlanStructured(context);
            }
            
            // Merge and resolve
            const mergedPlan = this.mergeProposals(proposals, context);
            const resolvedPlan = this.resolveConflicts(mergedPlan, proposals, context);
            
            // Convert to required structure
            const structuredPlan = this.structurePlan(resolvedPlan, context);
            
            // Add inference note if applicable
            if (isInferred && inferenceRationale) {
                structuredPlan.why.push(`Readiness inferred (${readiness}/10): ${inferenceRationale}`);
            }
            
            // Add load-based adjustments to rationale
            if (context.loadAdjustments && context.loadAdjustments.length > 0) {
                for (const adjustment of context.loadAdjustments) {
                    structuredPlan.why.push(adjustment);
                }
            }

            // Add seasonal context to rationale
            if (seasonalContext) {
                structuredPlan.why.push(`${seasonalContext.phase} (Week ${seasonalContext.weekOfBlock} of 4)`);
                
                if (seasonalContext.deloadThisWeek) {
                    structuredPlan.why.push('Deload week: -20% volume for recovery');
                }
                
                if (seasonalContext.gameProximity.hasGame) {
                    if (seasonalContext.gameProximity.isTomorrow) {
                        structuredPlan.why.push('Game tomorrow: Reduced lower body volume');
                    } else {
                        structuredPlan.why.push(`Game in ${seasonalContext.gameProximity.daysUntil} days: Lightening load`);
                    }
                }
                
                // Add phase emphasis
                if (seasonalContext.emphasis) {
                    structuredPlan.why.push(`Focus: ${seasonalContext.emphasis.replace(/_/g, ' ')}`);
                }
            }
            
            // Apply conservative scaling based on data confidence
            if (this.dataValidator && context.dataConfidence) {
                const originalIntensity = structuredPlan.targetRPE || 7;
                const scaledIntensity = this.dataValidator.applyConservativeScaling(
                    originalIntensity, 
                    context.dataConfidence.recent7days || 0.5
                );
                
                if (scaledIntensity < originalIntensity) {
                    structuredPlan.intensityScale *= (scaledIntensity / originalIntensity);
                    structuredPlan.why.push(`Intensity scaled down due to low data confidence (${Math.round(context.dataConfidence.recent7days * 100)}%)`);
                }
            }
            
            // Apply intensity scaling for inferred readiness
            if (isInferred && readiness < 7) {
                structuredPlan.intensityScale *= 0.85; // Scale down 15% for safety
                structuredPlan.why.push('Intensity reduced due to inferred low readiness');
            }
            
            // Apply deload volume modifier
            if (seasonalContext && seasonalContext.deloadThisWeek) {
                structuredPlan.intensityScale *= seasonalContext.volumeModifier;
            }
            
            return structuredPlan;
        } catch (error) {
            this.logger.error('Failed to generate session plan', error);
            return this.getFallbackPlanStructured(context);
        }
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
        
        // Log summary of failed experts
        if (failedExperts.length > 0) {
            this.logger.error('Expert system failures', {
                failedCount: failedExperts.length,
                failedExperts: failedExperts.map(f => f.name),
                totalExperts: Object.keys(this.experts).length
            });
        }
        
        // CRITICAL FIX: Prevent empty workouts by validating proposals
        // If all expert proposals have no blocks, this will be handled by the calling method
        // We mark proposals as empty so generateWorkout can detect and use fallback
        if (Object.values(proposals).every(p => !p.blocks || p.blocks.length === 0)) {
            this.logger.warn('All expert proposals are empty - empty workout prevented');
            proposals._empty = true; // Mark as empty for detection by calling method
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
            aesthetics: 'Aesthetics'
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
            // Get safe alternatives from ExerciseAdapter
            // CRITICAL FIX: Check for ExerciseAdapter availability before use
            if (!window.ExerciseAdapter) {
                // ExerciseAdapter not available - skip substitution, log warning
                this.logger.warn('ExerciseAdapter not available, skipping exercise substitution for knee pain');
                plan.notes.push({
                    source: 'system',
                    text: 'Knee pain detected, but exercise substitution unavailable. Please modify exercises manually if needed.'
                });
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
            
            plan.notes.push({
                source: 'load',
                text: 'Recovery day recommended due to load spike - focus on mobility and light movement'
            });
        }

        // Simple mode: limit to 1-2 blocks
        const isSimpleMode = context.preferences?.trainingMode === 'simple';
        if (isSimpleMode) {
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
        
        return notes.join('. ') + '.';
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
        if (readiness >= 8) return 1.0;
        if (readiness >= 6) return 0.9;
        if (readiness >= 4) return 0.8;
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
        const recommendations = loadStatus.recommendations;
        
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
}

window.ExpertCoordinator = ExpertCoordinator;
