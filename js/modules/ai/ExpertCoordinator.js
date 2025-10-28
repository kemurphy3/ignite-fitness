/**
 * ExpertCoordinator - Central engine that reconciles expert recommendations
 * Merges Strength, Sports, Physio, Nutrition, and Aesthetics coaches into unified session
 */
class ExpertCoordinator {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.whyDecider = new WhyThisDecider();
        
        this.experts = {
            strength: new StrengthCoach(),
            sports: new SportsCoach(),
            physio: new PhysioCoach(),
            nutrition: new NutritionCoach(),
            aesthetics: new AestheticsCoach()
        };
    }

    /**
     * Get unified session plan for today
     * @param {Object} context - User context
     * @returns {Object} Unified session plan
     */
    getSessionPlan(context) {
        try {
            // Get proposals from all experts
            const proposals = this.gatherProposals(context);
            
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
        
        for (const [name, expert] of Object.entries(this.experts)) {
            try {
                proposals[name] = expert.propose(context);
            } catch (error) {
                this.logger.warn(`Expert ${name} failed to propose`, error);
                proposals[name] = { blocks: [], constraints: [], priorities: [] };
            }
        }
        
        return proposals;
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
        // Check for knee pain with squats
        const kneePain = proposals.physio?.blocks?.find(b => 
            b.exercise?.rationale?.toLowerCase().includes('knee')
        );
        
        if (kneePain) {
            // Remove heavy squats, substitute with safer alternative
            plan.mainSets = plan.mainSets.map(main => {
                if (main.exercise && main.exercise.includes('squat') && !main.exercise.includes('goblet')) {
                    return {
                        ...main,
                        exercise: 'goblet_squat',
                        rationale: 'Switched to goblet squat due to knee discomfort - safer biomechanics',
                        constraintSource: 'physio'
                    };
                }
                return main;
            });
        }

        // Check for game -1 day conflicts
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
                sets: Math.max(2, Math.floor((main.sets || 3) * 0.7)),
                load: main.load ? main.load * 0.7 : main.load
            }));
            
            plan.notes.push({
                source: 'readiness',
                text: 'Reduced volume due to low readiness (≤4) - prioritize recovery'
            });
        }

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
                rationale: 'Fallback session due to planning error'
            }],
            accessories: [],
            finishers: [],
            substitutions: [],
            rationale: ['Simplified session due to technical issue'],
            sessionNotes: 'Error generating custom plan - using fallback protocol',
            isFallback: true
        };
    }
}

window.ExpertCoordinator = ExpertCoordinator;
