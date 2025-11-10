/**
 * AestheticsCoach - AI expert for physique development recommendations
 * Provides accessory work for aesthetic goals while maintaining performance
 */
class AestheticsCoach {
    constructor() {
        this.logger = window.SafeLogger || console;
    }

    /**
     * Propose session plan based on aesthetic goals
     * @param {Object} context - User context
     * @returns {Object} Aesthetics coach proposal
     */
    propose({ user, season, schedule, history, readiness, preferences }) {
        const proposal = {
            blocks: [],
            constraints: [],
            priorities: []
        };

        const aestheticFocus = preferences?.aestheticFocus || 'functional';

        // Do not override main program; only suggest accessories
        if (aestheticFocus === 'functional') {
            return proposal; // No aesthetic work if functional focus
        }

        // Generate accessories based on focus
        const accessories = this.generateAccessories(aestheticFocus, readiness);

        proposal.blocks = accessories;

        proposal.constraints = [
            {
                type: 'volume',
                rule: 'Accessories limited to 30% of total session volume'
            },
            {
                type: 'readiness',
                rule: readiness <= 6 ? 'Reduce accessory volume by 30%' : 'Normal volume'
            }
        ];

        proposal.priorities = [
            { priority: 1, goal: 'Aesthetic preferences', weight: 0.20 },
            { priority: 2, goal: 'Performance maintenance', weight: 0.15 }
        ];

        return proposal;
    }

    generateAccessories(aestheticFocus, readiness) {
        const accessoryMap = {
            'v_taper': [
                { name: 'lateral_raises', sets: 3, reps: '15-20', rationale: 'Wide shoulders for V-taper' },
                { name: 'lat_pulldowns', sets: 4, reps: '10-12', rationale: 'Wide back for V-taper' },
                { name: 'overhead_press', sets: 3, reps: '8-10', rationale: 'Broad shoulder development' }
            ],
            'glutes': [
                { name: 'hip_thrusts', sets: 4, reps: '12-15', rationale: 'Maximize glute hypertrophy' },
                { name: 'bulgarian_split_squats', sets: 3, reps: '10-12', rationale: 'Unilateral glute strength' },
                { name: 'romanian_deadlift', sets: 3, reps: '10-12', rationale: 'Posterior chain development' }
            ],
            'toned': [
                { name: 'higher_rep_accessories', sets: 3, reps: '15-20', rationale: 'Muscle endurance and tone' },
                { name: 'cable_flies', sets: 3, reps: '15-20', rationale: 'Chest definition' },
                { name: 'tricep_extensions', sets: 3, reps: '15-20', rationale: 'Arm definition' }
            ],
            'functional': [] // No aesthetic work
        };

        let accessories = accessoryMap[aestheticFocus] || [];

        // Reduce volume if readiness low
        if (readiness <= 6) {
            accessories = accessories.map(acc => ({
                ...acc,
                sets: Math.max(2, Math.floor(acc.sets * 0.7)),
                rationale: `${acc.rationale} (reduced volume due to moderate readiness)`
            }));
        }

        return accessories.map(acc => ({
            type: 'accessory',
            exercise: acc.name,
            sets: acc.sets,
            reps: acc.reps,
            rationale: acc.rationale
        }));
    }
}

window.AestheticsCoach = AestheticsCoach;
