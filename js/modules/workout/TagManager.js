/**
 * TagManager - Manages workout tags and filtering
 * Provides tag validation, intensity scoring, and filtering capabilities
 */
class TagManager {
    constructor() {
        this.exerciseDatabase = window.ExerciseDatabase;
        this.logger = window.SafeLogger || console;
    }

    /**
     * Get all available tags with metadata
     * @returns {Object} All tags with metadata
     */
    getAllTags() {
        const baseTags = this.getBaseTags();
        const soccerTags = this.exerciseDatabase?.getSoccerShapeTags() || {};

        return { ...baseTags, ...soccerTags };
    }

    /**
     * Get base tags (non-soccer-specific)
     * @returns {Object} Base tag definitions
     */
    getBaseTags() {
        return {
            endurance: {
                name: 'Endurance',
                description: 'Long-duration aerobic capacity',
                color: '#4caf50',
                adaptations: ['aerobic_base', 'mitochondrial_density', 'fat_oxidation']
            },
            strength: {
                name: 'Strength',
                description: 'Muscular strength and power',
                color: '#ff9800',
                adaptations: ['muscular_strength', 'neural_drive', 'motor_unit_recruitment']
            },
            recovery: {
                name: 'Recovery',
                description: 'Active recovery and regeneration',
                color: '#9e9e9e',
                adaptations: ['recovery', 'blood_flow', 'mobility']
            },
            aerobic_base: {
                name: 'Aerobic Base',
                description: 'Foundation aerobic capacity',
                color: '#2196f3',
                adaptations: ['aerobic_capacity', 'mitochondrial_density']
            },
            strength_endurance: {
                name: 'Strength Endurance',
                description: 'Muscular endurance under load',
                color: '#ff5722',
                adaptations: ['muscular_endurance', 'lactate_tolerance']
            }
        };
    }

    /**
     * Validate tag combination for workout coherence
     * @param {Array} tags - Tags to validate
     * @returns {Object} Validation result
     */
    validateTagCombination(tags) {
        if (!Array.isArray(tags) || tags.length === 0) {
            return { valid: true };
        }

        const conflicts = {
            'acceleration': ['endurance', 'recovery'],
            'anaerobic_capacity': ['aerobic_base', 'recovery'],
            'neuromotor': ['strength_endurance'],
            'recovery': ['acceleration', 'anaerobic_capacity', 'VO2']
        };

        for (const tag of tags) {
            const conflictingTags = conflicts[tag] || [];
            const hasConflict = conflictingTags.some(conflict => tags.includes(conflict));

            if (hasConflict) {
                const conflictingFound = conflictingTags.filter(c => tags.includes(c));
                return {
                    valid: false,
                    reason: `${tag} conflicts with ${conflictingFound.join(', ')}`,
                    conflictingTags: conflictingFound
                };
            }
        }

        return { valid: true };
    }

    /**
     * Calculate tag intensity score
     * @param {Array} tags - Tags to score
     * @returns {number} Intensity score (1-10)
     */
    calculateTagIntensity(tags) {
        if (!Array.isArray(tags) || tags.length === 0) {
            return 5; // Default moderate intensity
        }

        const intensityScores = {
            acceleration: 9,
            anaerobic_capacity: 8,
            VO2: 8,
            COD: 7,
            strength: 7,
            neuromotor: 5,
            endurance: 4,
            aerobic_base: 3,
            recovery: 2,
            strength_endurance: 6
        };

        const scores = tags.map(tag => intensityScores[tag] || 5);
        return scores.length > 0 ? Math.max(...scores) : 5;
    }

    /**
     * Get tags by intensity level
     * @param {string} level - Intensity level ('low', 'moderate', 'high')
     * @returns {Array} Tags matching intensity level
     */
    getTagsByIntensity(level) {
        const intensityRanges = {
            low: [1, 4],
            moderate: [5, 7],
            high: [8, 10]
        };

        const range = intensityRanges[level] || [5, 7];
        const allTags = this.getAllTags();

        return Object.keys(allTags).filter(tag => {
            const intensity = this.calculateTagIntensity([tag]);
            return intensity >= range[0] && intensity <= range[1];
        });
    }

    /**
     * Filter workouts by tags
     * @param {Array} workouts - Workouts to filter
     * @param {Object} options - Filter options
     * @returns {Array} Filtered workouts
     */
    filterWorkoutsByTags(workouts, options = {}) {
        const { requiredTags = [], excludedTags = [], minIntensity = 0, maxIntensity = 10 } = options;

        return workouts.filter(workout => {
            const workoutTags = workout.tags || [];

            // Check required tags
            if (requiredTags.length > 0) {
                const hasRequired = requiredTags.every(tag => workoutTags.includes(tag));
                if (!hasRequired) return false;
            }

            // Check excluded tags
            if (excludedTags.length > 0) {
                const hasExcluded = excludedTags.some(tag => workoutTags.includes(tag));
                if (hasExcluded) return false;
            }

            // Check intensity range
            const intensity = this.calculateTagIntensity(workoutTags);
            if (intensity < minIntensity || intensity > maxIntensity) {
                return false;
            }

            return true;
        });
    }

    /**
     * Get tag recommendations for a training phase
     * @param {string} phase - Training phase ('base', 'build', 'peak', 'recovery')
     * @returns {Array} Recommended tags
     */
    getTagsForPhase(phase) {
        const phaseTags = {
            base: ['aerobic_base', 'endurance', 'strength'],
            build: ['VO2', 'anaerobic_capacity', 'strength_endurance'],
            peak: ['acceleration', 'COD', 'neuromotor'],
            recovery: ['recovery', 'aerobic_base']
        };

        return phaseTags[phase] || [];
    }

    /**
     * Get complementary tags
     * @param {Array} tags - Base tags
     * @returns {Array} Complementary tags
     */
    getComplementaryTags(tags) {
        const complementaryMap = {
            'acceleration': ['COD', 'neuromotor'],
            'COD': ['acceleration', 'neuromotor'],
            'VO2': ['anaerobic_capacity', 'endurance'],
            'anaerobic_capacity': ['VO2', 'strength'],
            'neuromotor': ['COD', 'acceleration'],
            'endurance': ['aerobic_base', 'recovery'],
            'strength': ['strength_endurance', 'anaerobic_capacity']
        };

        const complementary = new Set();
        tags.forEach(tag => {
            const comps = complementaryMap[tag] || [];
            comps.forEach(comp => complementary.add(comp));
        });

        // Remove tags that are already in the base set
        tags.forEach(tag => complementary.delete(tag));

        return Array.from(complementary);
    }

    /**
     * Validate workout tag coherence
     * @param {Object} workout - Workout object
     * @returns {Object} Validation result
     */
    validateWorkoutTags(workout) {
        const tags = workout.tags || [];
        
        // Validate tag combination
        const validation = this.validateTagCombination(tags);
        if (!validation.valid) {
            return {
                valid: false,
                errors: [validation.reason],
                warnings: []
            };
        }

        // Check for missing essential tags
        const warnings = [];
        const intensity = this.calculateTagIntensity(tags);
        
        if (intensity >= 8 && !tags.includes('recovery') && !tags.includes('endurance')) {
            warnings.push('High intensity workout may benefit from recovery or endurance tags');
        }

        return {
            valid: true,
            errors: [],
            warnings,
            intensity,
            recommendations: this.getComplementaryTags(tags)
        };
    }

    /**
     * Get tag statistics for a set of workouts
     * @param {Array} workouts - Workouts to analyze
     * @returns {Object} Tag statistics
     */
    getTagStatistics(workouts) {
        const tagCounts = {};
        const tagIntensities = {};

        workouts.forEach(workout => {
            const tags = workout.tags || [];
            tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                
                if (!tagIntensities[tag]) {
                    tagIntensities[tag] = [];
                }
                tagIntensities[tag].push(this.calculateTagIntensity([tag]));
            });
        });

        const tagStats = Object.keys(tagCounts).map(tag => ({
            tag,
            count: tagCounts[tag],
            frequency: tagCounts[tag] / workouts.length,
            avgIntensity: tagIntensities[tag].reduce((a, b) => a + b, 0) / tagIntensities[tag].length
        }));

        return {
            totalWorkouts: workouts.length,
            uniqueTags: Object.keys(tagCounts).length,
            tagStats: tagStats.sort((a, b) => b.count - a.count),
            mostCommonTags: tagStats.slice(0, 5).map(s => s.tag)
        };
    }
}

// Create global instance
window.TagManager = new TagManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TagManager;
}

