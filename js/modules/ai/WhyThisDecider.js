/**
 * WhyThisDecider - Generates clear, concise explanations for each decision
 * Provides 1-2 sentence rationale for each choice in the session plan
 */
class WhyThisDecider {
    constructor() {
        this.logger = window.SafeLogger || console;
    }

    /**
     * Generate rationale for session plan
     * @param {Object} plan - Resolved session plan
     * @param {Object} proposals - All expert proposals
     * @param {Object} context - User context
     * @returns {Array<string>} Rationale strings
     */
    generateRationales(plan, proposals, context) {
        const rationales = [];
        
        // Why this warmup?
        rationales.push(this.rationaleWarmup(plan.warmup));
        
        // Why this main movement?
        if (plan.mainSets.length > 0) {
            rationales.push(this.rationaleMainSets(plan.mainSets[0], context));
        }
        
        // Why these accessories?
        if (plan.accessories && plan.accessories.length > 0) {
            rationales.push(this.rationaleAccessories(plan.accessories, context.preferences?.aestheticFocus));
        }
        
        // Why these finishers?
        if (plan.finishers && plan.finishers.length > 0) {
            rationales.push(this.rationaleFinishers(plan.finishers));
        }
        
        // Why these substitutions?
        if (plan.substitutions && plan.substitutions.length > 0) {
            rationales.push(...plan.substitutions.map(sub => this.rationaleSubstitution(sub)));
        }
        
        // Overall session rationale
        rationales.push(this.rationaleOverall(context));

        return rationales;
    }
    
    /**
     * Generate "Why This Today?" reason for an exercise block
     * @param {Object} block - Exercise block
     * @param {Object} context - User context
     * @returns {string} Reason for this exercise today
     */
    generateWhyToday(block, context) {
        const reasons = [];
        
        // Game timing
        if (context.schedule?.isGameDay) {
            reasons.push(`Game tomorrow - ${this.getGameDayModification(block.exercise)}`);
        } else if (context.schedule?.daysFromGame === 1) {
            reasons.push('Rest before game - lower intensity');
        } else if (context.schedule?.daysFromGame === 2) {
            reasons.push('Game -2 days - no heavy legs');
        }
        
        // Readiness
        if (context.readiness && context.readiness <= 4) {
            reasons.push(`Low readiness (${context.readiness}/10) - reduced volume`);
        } else if (context.readiness && context.readiness >= 8) {
            reasons.push(`High readiness (${context.readiness}/10) - progressive load`);
        }
        
        // Injury flags
        if (context.injuryFlags && context.injuryFlags.length > 0) {
            const lastFlag = context.injuryFlags[context.injuryFlags.length - 1];
            if (this.isRelevantToExercise(lastFlag, block.exercise)) {
                reasons.push(`Avoiding ${lastFlag.location} stress from recent flag`);
            }
        }
        
        // Goal priorities
        if (context.goals && context.goals.length > 0) {
            const primaryGoal = context.goals[0];
            if (this.isGoalRelevant(primaryGoal, block.exercise)) {
                reasons.push(`Priority: ${primaryGoal.replace('_', ' ')}`);
            }
        }
        
        // Time limits
        if (context.constraints?.sessionLength) {
            reasons.push(`Limited time (${context.constraints.sessionLength}min) - focused selection`);
        }
        
        // User dislikes
        if (context.preferences?.exerciseDislikes && context.preferences.exerciseDislikes.length > 0) {
            const dislikes = context.preferences.exerciseDislikes;
            if (dislikes.some(d => block.exercise.toLowerCase().includes(d.toLowerCase()))) {
                reasons.push('Replaced disliked exercise');
            }
        }
        
        // If no specific reasons, provide default
        if (reasons.length === 0) {
            reasons.push('Standard progression aligned with your goals');
        }
        
        return reasons.join('. ') + '.';
    }
    
    /**
     * Get game day modification for exercise type
     * @param {string} exercise - Exercise name
     * @returns {string} Modification description
     */
    getGameDayModification(exercise) {
        const exerciseLower = exercise.toLowerCase();
        
        if (exerciseLower.includes('squat') || exerciseLower.includes('lunge')) {
            return 'upper body focus only';
        }
        if (exerciseLower.includes('deadlift') || exerciseLower.includes('sprint')) {
            return 'light movement prep';
        }
        if (exerciseLower.includes('press') || exerciseLower.includes('pull')) {
            return 'moderate intensity';
        }
        
        return 'game-day appropriate load';
    }
    
    /**
     * Check if injury flag is relevant to exercise
     * @param {Object} injuryFlag - Injury flag
     * @param {string} exercise - Exercise name
     * @returns {boolean} Is relevant
     */
    isRelevantToExercise(injuryFlag, exercise) {
        const exLower = exercise.toLowerCase();
        const locLower = injuryFlag.location.toLowerCase();
        
        const mappings = {
            'knee': ['squat', 'lunge', 'step', 'jump'],
            'lower back': ['deadlift', 'squat', 'row', 'hinge'],
            'shoulder': ['press', 'push', 'lateral', 'overhead'],
            'ankle': ['squat', 'lunge', 'jump', 'sprint'],
            'hip': ['squat', 'lunge', 'deadlift', 'hinge']
        };
        
        const relevantPatterns = mappings[locLower];
        if (!relevantPatterns) return false;
        
        return relevantPatterns.some(pattern => exLower.includes(pattern));
    }
    
    /**
     * Check if goal is relevant to exercise
     * @param {string} goal - Goal type
     * @param {string} exercise - Exercise name
     * @returns {boolean} Is relevant
     */
    isGoalRelevant(goal, exercise) {
        const exLower = exercise.toLowerCase();
        
        const goalMappings = {
            'muscle_building': ['squat', 'deadlift', 'press', 'pull'],
            'fat_loss': ['squat', 'deadlift', 'compound'],
            'athletic_performance': ['jump', 'sprint', 'plyo', 'explosive'],
            'v_taper': ['pull', 'row', 'lat', 'shoulder'],
            'glutes': ['squat', 'lunge', 'hip', 'glute'],
            'toned': ['cardio', 'circuit', 'conditioning']
        };
        
        const relevantPatterns = goalMappings[goal];
        if (!relevantPatterns) return true; // Default to relevant
        
        return relevantPatterns.some(pattern => exLower.includes(pattern));
    }

    rationaleWarmup(warmup) {
        if (warmup.length === 0) {
            return 'Light general mobility to prepare for training.';
        }
        
        const description = warmup.join(', ');
        return `Warmup focuses on ${description} to prepare specific movement patterns and prevent injury.`;
    }

    rationaleMainSets(mainSet, context) {
        const parts = [];
        
        if (mainSet.exercise) {
            parts.push(`${mainSet.exercise} as main movement`);
        }
        
        if (mainSet.load) {
            parts.push(`${mainSet.load > 100 ? '+' : ''}${Math.round((mainSet.load - 100))}% load`);
        }
        
        if (context.readiness <= 4) {
            return `${mainSet.exercise} at reduced intensity (${mainSet.load}% of normal) due to low readiness - prioritize safe adaptation.`;
        }
        
        if (mainSet.rationale) {
            return mainSet.rationale;
        }
        
        return `Main set: ${parts.join(', ')} for progressive overload.`;
    }

    rationaleAccessories(accessories, aestheticFocus) {
        if (!aestheticFocus || aestheticFocus === 'functional') {
            return `Accessories support main movement performance and muscular balance.`;
        }
        
        const count = accessories.length;
        return `${count} ${aestheticFocus} accessories added (30% of session) - main work prioritized at 70%.`;
    }

    rationaleFinishers(finishers) {
        const types = finishers.map(f => f.type || 'work');
        if (types.includes('prehab')) {
            return 'Finishers include prehab work to prevent common injury patterns in your sport.';
        }
        
        if (types.includes('conditioning')) {
            return 'Finishers include sport-specific conditioning to maintain athletic performance.';
        }
        
        return 'Finishers complement main work for complete development.';
    }

    rationaleSubstitution(substitution) {
        return `${substitution.original} replaced with ${substitution.alternative}: ${substitution.reason}`;
    }

    rationaleOverall(context) {
        const factors = [];
        
        if (context.readiness <= 4) {
            factors.push('low readiness');
        }
        
        if (context.schedule?.isGameDay) {
            factors.push('game day');
        }
        
        if (context.history?.injuryFlags?.length > 0) {
            factors.push('injury prevention focus');
        }
        
        if (factors.length === 0) {
            return `Session optimized for readiness ${context.readiness}/10 with full performance focus.`;
        }
        
        return `Session adjusted for ${factors.join(', ')} - training modified to ensure safety and effectiveness.`;
    }
}

window.WhyThisDecider = WhyThisDecider;
