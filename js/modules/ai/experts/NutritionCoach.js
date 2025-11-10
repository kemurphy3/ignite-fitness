/**
 * NutritionCoach - AI expert for fuel and recovery recommendations
 * Provides timing and macro guidance for performance
 */
class NutritionCoach {
    constructor() {
        this.logger = window.SafeLogger || console;
    }

    /**
     * Propose nutrition recommendations
     * @param {Object} context - User context
     * @returns {Object} Nutrition coach proposal
     */
    propose({ user, season, schedule, history, readiness, preferences }) {
        const proposal = {
            blocks: [],
            constraints: [],
            priorities: []
        };

        // Day type detection
        const dayType = this.detectDayType(schedule, readiness);

        // Pre-workout fueling
        const preWorkout = this.generatePreWorkoutFuel(dayType);

        // Post-workout recovery
        const postWorkout = this.generatePostWorkoutFuel(dayType, readiness);

        proposal.blocks = [
            {
                type: 'nutrition_timing',
                pre: preWorkout,
                post: postWorkout,
                dayType,
                rationale: `Fueling strategy for ${dayType} day based on readiness ${readiness}/10`
            }
        ];

        proposal.constraints = [
            { type: 'timing', rule: 'Pre-workout: 1-2h before, Post-workout: within 30min' }
        ];

        proposal.priorities = [
            { priority: 1, goal: 'Performance fuel', weight: 0.30 },
            { priority: 2, goal: 'Recovery nutrition', weight: 0.25 }
        ];

        return proposal;
    }

    detectDayType(schedule, readiness) {
        if (schedule?.isGameDay) {return 'game';}
        if (schedule?.isRestDay) {return 'rest';}
        if (readiness >= 8) {return 'training_high_intensity';}
        if (readiness >= 5) {return 'training_moderate';}
        return 'training_recovery';
    }

    generatePreWorkoutFuel(dayType) {
        const fuelMap = {
            'game': {
                carbs: '60-80g',
                timing: '2-3 hours before',
                examples: ['Oats + banana', 'Rice + chicken'],
                rationale: 'Maximum performance - high carb intake'
            },
            'training_high_intensity': {
                carbs: '40-60g',
                timing: '1-2 hours before',
                examples: ['Banana + PB', 'Toast + jam'],
                rationale: 'Fuel for high-intensity session'
            },
            'training_moderate': {
                carbs: '30-45g',
                timing: '1-2 hours before',
                examples: ['Apple + almonds', 'Greek yogurt'],
                rationale: 'Moderate fueling for moderate effort'
            },
            'rest': {
                carbs: 'minimal',
                timing: 'Not needed',
                examples: [],
                rationale: 'Rest day - focus on protein and vegetables'
            }
        };

        return fuelMap[dayType] || fuelMap.training_moderate;
    }

    generatePostWorkoutFuel(dayType, readiness) {
        const baseRecovery = {
            protein: '30-40g',
            carbs: '40-60g',
            timing: 'within 30 minutes',
            examples: ['Chocolate milk', 'Protein shake + banana', 'Greek yogurt + berries']
        };

        if (readiness < 5) {
            return {
                ...baseRecovery,
                rationale: 'Enhanced recovery due to low readiness - extra carbs and protein'
            };
        }

        return {
            ...baseRecovery,
            rationale: 'Standard recovery meal to replenish glycogen and support muscle repair'
        };
    }
}

window.NutritionCoach = NutritionCoach;
