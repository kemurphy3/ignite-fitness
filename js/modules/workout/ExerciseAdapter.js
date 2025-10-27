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