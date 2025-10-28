/**
 * StrengthCoach - AI expert for strength training recommendations
 * Provides progressive overload and movement quality guidance
 */
class StrengthCoach {
    constructor() {
        this.logger = window.SafeLogger || console;
    }

    /**
     * Propose session plan based on strength training principles
     * @param {Object} context - User context
     * @returns {Object} Strength coach proposal
     */
    propose({ user, season, schedule, history, readiness, preferences }) {
        const proposal = {
            blocks: [],
            constraints: [],
            priorities: []
        };

        // Determine main movement focus
        const mainMovement = this.determineMainMovement(user, history, season);
        
        // Progressive overload based on readiness
        const loadAdjustment = this.calculateLoadAdjustment(readiness, history);
        
        proposal.blocks = [
            {
                type: 'warmup',
                exercises: this.generateWarmup(mainMovement),
                duration: 10
            },
            {
                type: 'main_sets',
                exercise: mainMovement,
                sets: this.calculateSets(readiness),
                reps: this.calculateReps(user, season),
                load: loadAdjustment,
                rpe: this.targetRPE(readiness),
                rationale: 'Primary strength builder with progressive overload'
            }
        ];

        proposal.constraints = [
            { type: 'exercise_order', rule: 'Compound movements first' },
            { type: 'volume', rule: 'Total volume matches readiness' }
        ];

        proposal.priorities = [
            { priority: 1, goal: 'Progressive overload', weight: 0.25 },
            { priority: 2, goal: 'Movement quality', weight: 0.20 }
        ];

        return proposal;
    }

    determineMainMovement(user, history, season) {
        // Rotation logic: squat, deadlift, bench, overhead press
        const lastMainMovement = history?.lastSession?.mainMovement || 'squat';
        const rotation = { 'squat': 'deadlift', 'deadlift': 'bench', 'bench': 'overhead', 'overhead': 'squat' };
        
        return rotation[lastMainMovement] || 'squat';
    }

    calculateLoadAdjustment(readiness, history) {
        const baseLoad = history?.averageLoad || 100;
        
        if (readiness >= 8) {
            return baseLoad * 1.05; // +5% if excellent readiness
        } else if (readiness >= 5) {
            return baseLoad; // Maintain if moderate
        } else {
            return baseLoad * 0.90; // -10% if low readiness
        }
    }

    calculateSets(readiness) {
        if (readiness >= 8) return 4;
        if (readiness >= 5) return 3;
        return 3; // Minimum viable sets
    }

    calculateReps(user, season) {
        if (season === 'in-season') return '5-8'; // Strength maintenance
        if (season === 'off-season') return '8-12'; // Hypertrophy focus
        return '6-10'; // Default
    }

    targetRPE(readiness) {
        if (readiness >= 8) return { target: 8, range: '7-9' };
        if (readiness >= 5) return { target: 7, range: '6-8' };
        return { target: 6, range: '5-7' };
    }

    generateWarmup(mainMovement) {
        const movementGroup = {
            'squat': ['leg_swings', 'bodyweight_squats', 'leg_press_light'],
            'deadlift': ['cat_cow', 'rack_pulls_light', 'hip_hinges'],
            'bench': ['shoulder_circles', 'pushups', 'db_press_light'],
            'overhead': ['wall_slides', 'band_pull_aparts', 'db_press_light']
        };

        return movementGroup[mainMovement] || movementGroup['squat'];
    }
}

window.StrengthCoach = StrengthCoach;
