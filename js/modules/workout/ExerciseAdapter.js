/**
 * ExerciseAdapter - Adapts exercises based on aesthetic focus and readiness
 * Implements 70/30 split (performance/aesthetic) and readiness-based volume adjustment
 */
class ExerciseAdapter {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.storageManager = window.StorageManager;
        
        this.aestheticFocus = null;
        this.readinessLevel = 8;
        
        this.loadUserPreferences();
    }

    /**
     * Load user aesthetic preferences
     */
    async loadUserPreferences() {
        try {
            const authManager = window.AuthManager;
            const userId = authManager?.getCurrentUsername();
            
            if (userId) {
                const prefs = await this.storageManager.getPreferences(userId);
                if (prefs) {
                    this.aestheticFocus = prefs.aestheticFocus || 'functional';
                    this.readinessLevel = prefs.lastReadinessScore || 8;
                }
            }
            
            // Listen for readiness updates
            this.eventBus.on(this.eventBus.TOPICS.READINESS_UPDATED, (data) => {
                this.readinessLevel = data.readiness?.readinessScore || 8;
            });
        } catch (error) {
            this.logger.error('Failed to load user preferences', error);
        }
    }

    /**
     * Adapt workout with aesthetic accessories
     * @param {Object} workout - Base workout
     * @param {number} readinessScore - Current readiness (1-10)
     * @returns {Object} Adapted workout
     */
    adaptWorkout(workout, readinessScore = this.readinessLevel) {
        try {
            const adaptedWorkout = { ...workout };
            
            // Calculate performance vs aesthetic split
            const { performanceExercises, aestheticExercises } = this.calculateSplit(workout);
            
            // Add accessories based on aesthetic focus
            if (this.aestheticFocus && this.aestheticFocus !== 'functional') {
                const accessories = this.getAccessoriesForFocus(this.aestheticFocus, readinessScore);
                aestheticExercises.push(...accessories);
            }
            
            // Apply readiness-based volume reduction to accessories
            if (readinessScore <= 6) {
                this.reduceAccessoryVolume(aestheticExercises, readinessScore);
            }
            
            adaptedWorkout.exercises = [
                ...performanceExercises,
                ...aestheticExercises
            ];
            
            adaptedWorkout.adaptations = {
                performancePercentage: '70%',
                aestheticPercentage: '30%',
                volumeReduced: readinessScore <= 6,
                readinessLevel: readinessScore
            };
            
            return adaptedWorkout;
        } catch (error) {
            this.logger.error('Failed to adapt workout', error);
            return workout;
        }
    }
    
    /**
     * Substitute exercise based on dislikes or pain
     * @param {string} exerciseName - Current exercise
     * @param {Array} dislikes - User's disliked exercises
     * @param {string} painLocation - Pain location if any
     * @param {Object} constraints - Additional constraints (e.g., equipment, time)
     * @returns {Object} Substitution suggestions with rationale
     */
    suggestSubstitutions(exerciseName, dislikes = [], painLocation = null, constraints = {}) {
        try {
            const substitutionRules = this.getSubstitutionRules();
            const exerciseRules = substitutionRules[exerciseName.toLowerCase()];
            
            if (!exerciseRules) {
                return {
                    alternatives: [],
                    message: `No substitutions available for ${exerciseName}`
                };
            }
            
            // Filter by dislikes
            let alternatives = exerciseRules.alternatives
                .filter(alt => !dislikes.some(dislike => 
                    alt.name.toLowerCase().includes(dislike.toLowerCase())
                ));
            
            // Apply pain-based modifications
            if (painLocation) {
                alternatives = this.applyPainModifications(alternatives, painLocation);
            }
            
            // Apply constraints
            if (constraints.equipment || constraints.time) {
                alternatives = this.applyConstraints(alternatives, constraints);
            }
            
            // Return top 2 alternatives
            const suggestions = alternatives.slice(0, 2).map(alt => ({
                name: alt.name,
                rationale: alt.rationale,
                restAdjustment: alt.restAdjustment || 0,
                volumeAdjustment: alt.volumeAdjustment || 1.0
            }));
            
            return {
                alternatives: suggestions,
                message: suggestions.length > 0 
                    ? `Suggested alternatives for ${exerciseName}`
                    : `No suitable alternatives found for ${exerciseName}`
            };
        } catch (error) {
            this.logger.error('Failed to suggest substitutions', error);
            return {
                alternatives: [],
                message: 'Unable to suggest alternatives'
            };
        }
    }
    
    /**
     * Get substitution rules database
     * @returns {Object} Substitution rules
     */
    getSubstitutionRules() {
        return {
            'bulgarian split squat': {
                alternatives: [
                    {
                        name: 'Walking Lunges',
                        rationale: 'Same unilateral leg training, better balance, less knee stress',
                        restAdjustment: 0, // Same rest time
                        volumeAdjustment: 1.0
                    },
                    {
                        name: 'Reverse Lunges',
                        rationale: 'Unilateral leg work with reduced forward knee stress',
                        restAdjustment: -15, // Slightly less rest needed
                        volumeAdjustment: 1.0
                    },
                    {
                        name: 'Step-ups',
                        rationale: 'Similar single-leg stimulus, less dynamic loading on knee',
                        restAdjustment: 0,
                        volumeAdjustment: 1.1
                    }
                ]
            },
            'back squat': {
                alternatives: [
                    {
                        name: 'Goblet Squat',
                        rationale: 'Maintains squat pattern with less spinal loading',
                        restAdjustment: -30,
                        volumeAdjustment: 0.9
                    },
                    {
                        name: 'Front Squat',
                        rationale: 'Same movement pattern, different load placement',
                        restAdjustment: 0,
                        volumeAdjustment: 0.85
                    },
                    {
                        name: 'Landmine Squat',
                        rationale: 'Unique loading vector, less spinal compression',
                        restAdjustment: 0,
                        volumeAdjustment: 1.0
                    }
                ]
            },
            'deadlift': {
                alternatives: [
                    {
                        name: 'Romanian Deadlift',
                        rationale: 'Reduces lower back stress, similar hinge pattern',
                        restAdjustment: -15,
                        volumeAdjustment: 1.0
                    },
                    {
                        name: 'Trap Bar Deadlift',
                        rationale: 'More upright torso, less shear stress',
                        restAdjustment: 0,
                        volumeAdjustment: 1.1
                    },
                    {
                        name: 'Single Leg RDL',
                        rationale: 'Same hinge, less load, unilateral',
                        restAdjustment: -30,
                        volumeAdjustment: 1.2
                    }
                ]
            },
            'overhead press': {
                alternatives: [
                    {
                        name: 'Seated DB Press',
                        rationale: 'Same shoulder stimulus, removes core/lower back',
                        restAdjustment: -15,
                        volumeAdjustment: 1.0
                    },
                    {
                        name: 'Landmine Press',
                        rationale: 'Unique angle reduces shoulder impingement risk',
                        restAdjustment: 0,
                        volumeAdjustment: 1.0
                    }
                ]
            }
        };
    }
    
    /**
     * Apply pain-based modifications
     * @param {Array} alternatives - Alternative exercises
     * @param {string} painLocation - Pain location
     * @returns {Array} Filtered alternatives
     */
    applyPainModifications(alternatives, painLocation) {
        const painModifications = {
            'knee': (alt) => 
                !alt.name.toLowerCase().includes('squat') &&
                !alt.name.toLowerCase().includes('lunge') &&
                alt.name.toLowerCase().includes('hinge') || 
                alt.name.toLowerCase().includes('press'),
            'lower back': (alt) =>
                !alt.name.toLowerCase().includes('deadlift') &&
                !alt.name.toLowerCase().includes('row') &&
                alt.name.toLowerCase().includes('supported') ||
                alt.name.toLowerCase().includes('bodyweight'),
            'shoulder': (alt) =>
                !alt.name.toLowerCase().includes('press') &&
                !alt.name.toLowerCase().includes('lateral') &&
                alt.name.toLowerCase().includes('pull') ||
                alt.name.toLowerCase().includes('supported')
        };
        
        const filter = painModifications[painLocation.toLowerCase()];
        if (filter) {
            return alternatives.filter(alt => filter(alt));
        }
        
        return alternatives;
    }
    
    /**
     * Apply additional constraints
     * @param {Array} alternatives - Alternative exercises
     * @param {Object} constraints - Constraints
     * @returns {Array} Filtered alternatives
     */
    applyConstraints(alternatives, constraints) {
        return alternatives.filter(alt => {
            if (constraints.equipment && alt.equipment && !constraints.equipment.includes(alt.equipment)) {
                return false;
            }
            if (constraints.time && alt.estimatedTime && alt.estimatedTime > constraints.time) {
                return false;
            }
            return true;
        });
    }

    /**
     * Calculate 70/30 split between performance and aesthetic
     * @param {Object} workout - Workout to split
     * @returns {Object} Split exercises
     */
    calculateSplit(workout) {
        const performanceExercises = [];
        const aestheticExercises = [];
        
        if (!workout.exercises || !Array.isArray(workout.exercises)) {
            return { performanceExercises, aestheticExercises };
        }
        
        // Performance movements take 70% of training focus
        const performanceCount = Math.ceil(workout.exercises.length * 0.7);
        
        for (let i = 0; i < workout.exercises.length; i++) {
            const exercise = workout.exercises[i];
            
            if (this.isPerformanceMovement(exercise.name)) {
                performanceExercises.push(exercise);
            } else if (i < performanceCount) {
                performanceExercises.push(exercise);
            } else {
                aestheticExercises.push(exercise);
            }
        }
        
        return { performanceExercises, aestheticExercises };
    }

    /**
     * Check if exercise is a performance movement
     * @param {string} exerciseName - Exercise name
     * @returns {boolean} Is performance movement
     */
    isPerformanceMovement(exerciseName) {
        const performanceMovements = [
            'squat', 'deadlift', 'bench', 'overhead press', 'pull', 'dip',
            'clean', 'snatch', 'power clean', 'overhead squat'
        ];
        
        const name = exerciseName.toLowerCase();
        return performanceMovements.some(movement => name.includes(movement));
    }

    /**
     * Get accessories for aesthetic focus
     * @param {string} focus - Aesthetic focus
     * @param {number} readinessScore - Current readiness
     * @returns {Array} Accessory exercises
     */
    getAccessoriesForFocus(focus, readinessScore) {
        const accessories = this.getAccessoryMatrix()[focus] || [];
        
        return accessories.map(acc => ({
            ...acc,
            sets: this.adjustSetsForReadiness(acc.sets, readinessScore),
            tooltip: acc.rationale || `Building ${focus}...`,
            category: 'accessory',
            aesthetic: true
        }));
    }

    /**
     * Get accessory matrix
     * @returns {Object} Accessory matrix
     */
    getAccessoryMatrix() {
        return {
            v_taper: [
                { name: 'Overhead Press', category: 'shoulders', sets: 3, reps: '8-10', rationale: 'Building V-taper: Wide shoulders' },
                { name: 'Lat Pulldowns', category: 'back', sets: 4, reps: '10-12', rationale: 'Building V-taper: Wide lats' },
                { name: 'Lateral Raises', category: 'shoulders', sets: 3, reps: '15-20', rationale: 'Building V-taper: Shoulder width' },
                { name: 'Face Pulls', category: 'rear_delts', sets: 3, reps: '12-15', rationale: 'Building V-taper: Balanced shoulders' }
            ],
            glutes: [
                { name: 'Hip Thrusts', category: 'glutes', sets: 4, reps: '12-15', rationale: 'Maximizing glutes: Hip thrust strength' },
                { name: 'Bulgarian Split Squats', category: 'glutes_quads', sets: 3, reps: '10-12', rationale: 'Maximizing glutes: Unilateral strength' },
                { name: 'Romanian Deadlift', category: 'glutes_hams', sets: 3, reps: '10-12', rationale: 'Maximizing glutes: Posterior chain' },
                { name: 'Cable Kickbacks', category: 'glutes', sets: 3, reps: '15-20', rationale: 'Maximizing glutes: Glute isolation' }
            ],
            toned: [
                { name: 'High Rep Lateral Raises', category: 'shoulders', sets: 3, reps: '20-25', rationale: 'Staying lean: Shoulder definition' },
                { name: 'Cable Flies', category: 'chest', sets: 3, reps: '15-20', rationale: 'Staying lean: Chest definition' },
                { name: 'Tricep Extensions', category: 'arms', sets: 3, reps: '15-20', rationale: 'Staying lean: Arm definition' },
                { name: 'Dumbbell Curls', category: 'arms', sets: 3, reps: '15-20', rationale: 'Staying lean: Arm definition' }
            ],
            functional: []
        };
    }

    /**
     * Adjust sets based on readiness
     * @param {number} sets - Original sets
     * @param {number} readinessScore - Current readiness
     * @returns {number} Adjusted sets
     */
    adjustSetsForReadiness(sets, readinessScore) {
        if (readinessScore <= 6) {
            return Math.max(1, Math.floor(sets * 0.7)); // 30% reduction
        }
        return sets;
    }

    /**
     * Reduce accessory volume based on readiness
     * @param {Array} exercises - Exercises to adjust
     * @param {number} readinessScore - Current readiness
     */
    reduceAccessoryVolume(exercises, readinessScore) {
        const reductionFactor = readinessScore <= 6 ? 0.7 : 1.0;
        
        exercises.forEach(exercise => {
            if (exercise.aesthetic) {
                exercise.sets = Math.max(1, Math.floor(exercise.sets * reductionFactor));
                if (!exercise.modifications) {
                    exercise.modifications = [];
                }
                exercise.modifications.push(`Reduced volume (readiness: ${readinessScore}/10)`);
            }
        });
    }

    /**
     * Generate tooltip for exercise
     * @param {Object} exercise - Exercise object
     * @returns {string} Tooltip text
     */
    generateTooltip(exercise) {
        if (exercise.tooltip) {
            return exercise.tooltip;
        }
        
        if (exercise.aesthetic) {
            const focusDescription = {
                v_taper: 'Building V-taper',
                glutes: 'Maximizing glutes',
                toned: 'Staying lean',
                functional: 'Functional movement'
            };
            
            return `${focusDescription[this.aestheticFocus] || 'Building physique'}: ${exercise.rationale || exercise.name}`;
        }
        
        return exercise.rationale || exercise.name;
    }

    /**
     * Update aesthetic focus
     * @param {string} focus - New focus
     */
    async updateAestheticFocus(focus) {
        try {
            const authManager = window.AuthManager;
            const userId = authManager?.getCurrentUsername();
            
            if (!userId) {
                throw new Error('User not logged in');
            }

            const prefs = await this.storageManager.getPreferences(userId);
            await this.storageManager.savePreferences(userId, {
                ...prefs,
                aestheticFocus: focus
            });
            
            this.aestheticFocus = focus;
            
            this.logger.debug('Aesthetic focus updated', { focus });
        } catch (error) {
            this.logger.error('Failed to update aesthetic focus', error);
            throw error;
        }
    }

    /**
     * Get current split information
     * @returns {Object} Split info
     */
    getSplitInfo() {
        return {
            aestheticFocus: this.aestheticFocus,
            performancePercentage: '70%',
            aestheticPercentage: '30%',
            readinessLevel: this.readinessLevel,
            accessoriesReduced: this.readinessLevel <= 6
        };
    }
}

// Create global instance
window.ExerciseAdapter = new ExerciseAdapter();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExerciseAdapter;
}