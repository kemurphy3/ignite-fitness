/**
 * ExerciseAdapter - Exercise modification and alternative suggestions
 * Handles exercise substitutions, regressions, and user feedback
 */
class ExerciseAdapter {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.storageManager = window.StorageManager;
        this.progressionEngine = window.ProgressionEngine;
        
        this.exerciseDatabase = this.initializeExerciseDatabase();
        this.alternativeMappings = this.initializeAlternativeMappings();
        this.regressionMappings = this.initializeRegressionMappings();
    }

    /**
     * Initialize exercise database with alternatives
     * @returns {Object} Exercise database
     */
    initializeExerciseDatabase() {
        return {
            'squat': {
                primary: 'Barbell Back Squat',
                alternatives: [
                    { name: 'Goblet Squat', difficulty: 'easier', equipment: 'dumbbell' },
                    { name: 'Front Squat', difficulty: 'harder', equipment: 'barbell' },
                    { name: 'Bulgarian Split Squat', difficulty: 'similar', equipment: 'bodyweight' },
                    { name: 'Leg Press', difficulty: 'easier', equipment: 'machine' }
                ],
                regressions: [
                    { name: 'Bodyweight Squat', difficulty: 'beginner' },
                    { name: 'Wall Sit', difficulty: 'beginner' },
                    { name: 'Chair Squat', difficulty: 'beginner' }
                ],
                progressions: [
                    { name: 'Pause Squat', difficulty: 'advanced' },
                    { name: 'Jump Squat', difficulty: 'advanced' },
                    { name: 'Single Leg Squat', difficulty: 'expert' }
                ]
            },
            'deadlift': {
                primary: 'Conventional Deadlift',
                alternatives: [
                    { name: 'Romanian Deadlift', difficulty: 'easier', equipment: 'barbell' },
                    { name: 'Sumo Deadlift', difficulty: 'similar', equipment: 'barbell' },
                    { name: 'Trap Bar Deadlift', difficulty: 'easier', equipment: 'trap_bar' },
                    { name: 'RDL with Dumbbells', difficulty: 'easier', equipment: 'dumbbell' }
                ],
                regressions: [
                    { name: 'Hip Hinge', difficulty: 'beginner' },
                    { name: 'Good Morning', difficulty: 'beginner' },
                    { name: 'Romanian Deadlift', difficulty: 'intermediate' }
                ],
                progressions: [
                    { name: 'Deficit Deadlift', difficulty: 'advanced' },
                    { name: 'Rack Pull', difficulty: 'advanced' },
                    { name: 'Single Leg RDL', difficulty: 'expert' }
                ]
            },
            'bench_press': {
                primary: 'Barbell Bench Press',
                alternatives: [
                    { name: 'Dumbbell Press', difficulty: 'similar', equipment: 'dumbbell' },
                    { name: 'Incline Press', difficulty: 'similar', equipment: 'barbell' },
                    { name: 'Push-ups', difficulty: 'easier', equipment: 'bodyweight' },
                    { name: 'Machine Press', difficulty: 'easier', equipment: 'machine' }
                ],
                regressions: [
                    { name: 'Push-ups', difficulty: 'beginner' },
                    { name: 'Incline Push-ups', difficulty: 'beginner' },
                    { name: 'Wall Push-ups', difficulty: 'beginner' }
                ],
                progressions: [
                    { name: 'Close Grip Bench', difficulty: 'advanced' },
                    { name: 'Spoto Press', difficulty: 'advanced' },
                    { name: 'Floor Press', difficulty: 'advanced' }
                ]
            },
            'overhead_press': {
                primary: 'Barbell Overhead Press',
                alternatives: [
                    { name: 'Dumbbell Press', difficulty: 'similar', equipment: 'dumbbell' },
                    { name: 'Seated Press', difficulty: 'easier', equipment: 'barbell' },
                    { name: 'Pike Push-ups', difficulty: 'easier', equipment: 'bodyweight' },
                    { name: 'Lateral Raises', difficulty: 'easier', equipment: 'dumbbell' }
                ],
                regressions: [
                    { name: 'Pike Push-ups', difficulty: 'beginner' },
                    { name: 'Wall Slides', difficulty: 'beginner' },
                    { name: 'Lateral Raises', difficulty: 'beginner' }
                ],
                progressions: [
                    { name: 'Push Press', difficulty: 'advanced' },
                    { name: 'Behind Neck Press', difficulty: 'advanced' },
                    { name: 'Handstand Push-ups', difficulty: 'expert' }
                ]
            },
            'pull_up': {
                primary: 'Pull-up',
                alternatives: [
                    { name: 'Lat Pulldown', difficulty: 'easier', equipment: 'machine' },
                    { name: 'Assisted Pull-ups', difficulty: 'easier', equipment: 'assistance_band' },
                    { name: 'Cable Rows', difficulty: 'similar', equipment: 'cable' },
                    { name: 'Inverted Rows', difficulty: 'easier', equipment: 'bodyweight' }
                ],
                regressions: [
                    { name: 'Assisted Pull-ups', difficulty: 'beginner' },
                    { name: 'Negative Pull-ups', difficulty: 'beginner' },
                    { name: 'Hanging', difficulty: 'beginner' }
                ],
                progressions: [
                    { name: 'Weighted Pull-ups', difficulty: 'advanced' },
                    { name: 'L-Sit Pull-ups', difficulty: 'advanced' },
                    { name: 'One Arm Pull-ups', difficulty: 'expert' }
                ]
            }
        };
    }

    /**
     * Initialize alternative exercise mappings
     * @returns {Object} Alternative mappings
     */
    initializeAlternativeMappings() {
        return {
            'pain': ['safer', 'easier'],
            'hurt': ['safer', 'easier'],
            'injury': ['safer', 'easier'],
            'easy': ['harder', 'progression'],
            'too_light': ['harder', 'progression'],
            'boring': ['variation', 'alternative'],
            'hate': ['alternative', 'preference'],
            "don't_like": ['alternative', 'preference'],
            'can\'t': ['regression', 'easier'],
            'too_hard': ['regression', 'easier'],
            'impossible': ['regression', 'easier']
        };
    }

    /**
     * Initialize regression mappings
     * @returns {Object} Regression mappings
     */
    initializeRegressionMappings() {
        return {
            'beginner': ['bodyweight', 'assisted', 'machine'],
            'intermediate': ['dumbbell', 'cable', 'variation'],
            'advanced': ['barbell', 'weighted', 'complex']
        };
    }

    /**
     * Process exercise feedback and suggest alternatives
     * @param {string} exerciseName - Name of the exercise
     * @param {string} feedback - User feedback
     * @param {Object} currentExercise - Current exercise data
     * @returns {Object} Suggested alternatives and adjustments
     */
    processExerciseFeedback(exerciseName, feedback, currentExercise) {
        try {
            const exerciseKey = exerciseName.toLowerCase().replace(/\s+/g, '_');
            const exerciseData = this.exerciseDatabase[exerciseKey];
            
            if (!exerciseData) {
                return {
                    success: false,
                    message: 'Exercise not found in database',
                    alternatives: []
                };
            }

            const feedbackLower = feedback.toLowerCase();
            const suggestions = this.analyzeFeedback(feedbackLower);
            
            let alternatives = [];
            let message = '';
            let recommendedAction = 'maintain';

            // Determine appropriate alternatives based on feedback
            if (suggestions.includes('safer') || suggestions.includes('easier')) {
                alternatives = this.getSaferAlternatives(exerciseData, currentExercise);
                message = 'Here are some safer alternatives for you:';
                recommendedAction = 'substitute';
            } else if (suggestions.includes('harder') || suggestions.includes('progression')) {
                alternatives = this.getProgressionAlternatives(exerciseData, currentExercise);
                message = 'Ready for a challenge? Here are some harder variations:';
                recommendedAction = 'progress';
            } else if (suggestions.includes('regression')) {
                alternatives = this.getRegressionAlternatives(exerciseData, currentExercise);
                message = 'Let\'s build up to this exercise with some regressions:';
                recommendedAction = 'regress';
            } else if (suggestions.includes('alternative') || suggestions.includes('preference')) {
                alternatives = this.getPreferenceAlternatives(exerciseData, currentExercise);
                message = 'Here are some alternative exercises you might enjoy:';
                recommendedAction = 'substitute';
            }

            const result = {
                success: true,
                message,
                recommendedAction,
                alternatives,
                originalExercise: currentExercise,
                feedback: feedback
            };

            this.logger.debug('Exercise feedback processed', {
                exercise: exerciseName,
                feedback,
                alternatives: alternatives.length,
                action: recommendedAction
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to process exercise feedback', error);
            return {
                success: false,
                message: 'Unable to process feedback',
                alternatives: []
            };
        }
    }

    /**
     * Analyze feedback to determine suggestions
     * @param {string} feedback - Lowercase feedback
     * @returns {Array} Suggestions
     */
    analyzeFeedback(feedback) {
        const suggestions = [];
        
        for (const [keyword, types] of Object.entries(this.alternativeMappings)) {
            if (feedback.includes(keyword)) {
                suggestions.push(...types);
            }
        }
        
        return [...new Set(suggestions)]; // Remove duplicates
    }

    /**
     * Get safer alternatives for an exercise
     * @param {Object} exerciseData - Exercise database entry
     * @param {Object} currentExercise - Current exercise data
     * @returns {Array} Safer alternatives
     */
    getSaferAlternatives(exerciseData, currentExercise) {
        return exerciseData.alternatives
            .filter(alt => alt.difficulty === 'easier')
            .map(alt => ({
                ...alt,
                weight: this.calculateAlternativeWeight(currentExercise.weight, alt.difficulty),
                reps: this.calculateAlternativeReps(currentExercise.reps, alt.difficulty),
                sets: currentExercise.sets,
                reason: 'Safer alternative'
            }));
    }

    /**
     * Get progression alternatives for an exercise
     * @param {Object} exerciseData - Exercise database entry
     * @param {Object} currentExercise - Current exercise data
     * @returns {Array} Progression alternatives
     */
    getProgressionAlternatives(exerciseData, currentExercise) {
        return exerciseData.progressions
            .map(prog => ({
                ...prog,
                weight: this.calculateAlternativeWeight(currentExercise.weight, prog.difficulty),
                reps: this.calculateAlternativeReps(currentExercise.reps, prog.difficulty),
                sets: currentExercise.sets,
                reason: 'Progression variation'
            }));
    }

    /**
     * Get regression alternatives for an exercise
     * @param {Object} exerciseData - Exercise database entry
     * @param {Object} currentExercise - Current exercise data
     * @returns {Array} Regression alternatives
     */
    getRegressionAlternatives(exerciseData, currentExercise) {
        return exerciseData.regressions
            .map(reg => ({
                ...reg,
                weight: this.calculateAlternativeWeight(currentExercise.weight, reg.difficulty),
                reps: this.calculateAlternativeReps(currentExercise.reps, reg.difficulty),
                sets: currentExercise.sets,
                reason: 'Regression to build strength'
            }));
    }

    /**
     * Get preference alternatives for an exercise
     * @param {Object} exerciseData - Exercise database entry
     * @param {Object} currentExercise - Current exercise data
     * @returns {Array} Preference alternatives
     */
    getPreferenceAlternatives(exerciseData, currentExercise) {
        return exerciseData.alternatives
            .map(alt => ({
                ...alt,
                weight: this.calculateAlternativeWeight(currentExercise.weight, alt.difficulty),
                reps: this.calculateAlternativeReps(currentExercise.reps, alt.difficulty),
                sets: currentExercise.sets,
                reason: 'Alternative exercise'
            }));
    }

    /**
     * Calculate weight for alternative exercise
     * @param {number} currentWeight - Current exercise weight
     * @param {string} difficulty - Difficulty level
     * @returns {number} Alternative weight
     */
    calculateAlternativeWeight(currentWeight, difficulty) {
        const adjustments = {
            'beginner': 0.5,
            'easier': 0.7,
            'similar': 1.0,
            'harder': 1.2,
            'advanced': 1.3,
            'expert': 1.5
        };
        
        return Math.round(currentWeight * (adjustments[difficulty] || 1.0) * 2.5) / 2.5;
    }

    /**
     * Calculate reps for alternative exercise
     * @param {number} currentReps - Current exercise reps
     * @param {string} difficulty - Difficulty level
     * @returns {number} Alternative reps
     */
    calculateAlternativeReps(currentReps, difficulty) {
        const adjustments = {
            'beginner': 1.5,
            'easier': 1.2,
            'similar': 1.0,
            'harder': 0.8,
            'advanced': 0.7,
            'expert': 0.6
        };
        
        return Math.round(currentReps * (adjustments[difficulty] || 1.0));
    }

    /**
     * Suggest exercise based on user preferences and history
     * @param {string} targetMuscle - Target muscle group
     * @param {string} difficulty - Desired difficulty
     * @param {Array} availableEquipment - Available equipment
     * @returns {Object} Suggested exercise
     */
    suggestExercise(targetMuscle, difficulty, availableEquipment = []) {
        try {
            const muscleGroups = {
                'chest': ['bench_press', 'push_up', 'dumbbell_press'],
                'back': ['pull_up', 'deadlift', 'barbell_row'],
                'legs': ['squat', 'deadlift', 'leg_press'],
                'shoulders': ['overhead_press', 'lateral_raise', 'dumbbell_press'],
                'arms': ['dumbbell_curl', 'tricep_extension', 'close_grip_bench']
            };
            
            const exercises = muscleGroups[targetMuscle] || [];
            const preferences = this.getExercisePreferences();
            
            // Filter out avoided exercises
            const availableExercises = exercises.filter(exercise => 
                !preferences.some(pref => 
                    pref.exerciseName === exercise && pref.preference === 'avoid'
                )
            );
            
            if (availableExercises.length === 0) {
                return {
                    success: false,
                    message: 'No suitable exercises found for this muscle group',
                    exercise: null
                };
            }
            
            // Select exercise based on difficulty and equipment
            const selectedExercise = this.selectBestExercise(
                availableExercises, 
                difficulty, 
                availableEquipment
            );
            
            return {
                success: true,
                exercise: selectedExercise,
                message: `Suggested ${selectedExercise.name} for ${targetMuscle}`
            };
        } catch (error) {
            this.logger.error('Failed to suggest exercise', error);
            return {
                success: false,
                message: 'Unable to suggest exercise',
                exercise: null
            };
        }
    }

    /**
     * Select best exercise from available options
     * @param {Array} exercises - Available exercises
     * @param {string} difficulty - Desired difficulty
     * @param {Array} equipment - Available equipment
     * @returns {Object} Selected exercise
     */
    selectBestExercise(exercises, difficulty, equipment) {
        // This would typically use more sophisticated logic
        // For now, return the first available exercise with basic setup
        const exerciseName = exercises[0];
        const exerciseData = this.exerciseDatabase[exerciseName];
        
        return {
            name: exerciseData?.primary || exerciseName,
            weight: this.getDefaultWeight(exerciseName, difficulty),
            reps: this.getDefaultReps(exerciseName, difficulty),
            sets: 3,
            equipment: equipment[0] || 'barbell',
            difficulty: difficulty
        };
    }

    /**
     * Get default weight for exercise and difficulty
     * @param {string} exerciseName - Name of exercise
     * @param {string} difficulty - Difficulty level
     * @returns {number} Default weight
     */
    getDefaultWeight(exerciseName, difficulty) {
        const defaults = {
            'squat': { beginner: 45, intermediate: 135, advanced: 225 },
            'deadlift': { beginner: 45, intermediate: 185, advanced: 315 },
            'bench_press': { beginner: 45, intermediate: 135, advanced: 185 },
            'overhead_press': { beginner: 20, intermediate: 65, advanced: 95 }
        };
        
        return defaults[exerciseName]?.[difficulty] || 45;
    }

    /**
     * Get default reps for exercise and difficulty
     * @param {string} exerciseName - Name of exercise
     * @param {string} difficulty - Difficulty level
     * @returns {number} Default reps
     */
    getDefaultReps(exerciseName, difficulty) {
        const defaults = {
            'beginner': 12,
            'intermediate': 8,
            'advanced': 5
        };
        
        return defaults[difficulty] || 8;
    }

    /**
     * Get exercise preferences
     * @returns {Array} Exercise preferences
     */
    getExercisePreferences() {
        try {
            return this.storageManager?.get('exercise_preferences', []);
        } catch (error) {
            this.logger.error('Failed to get exercise preferences', error);
            return [];
        }
    }

    /**
     * Save exercise preference
     * @param {string} exerciseName - Name of exercise
     * @param {string} preference - User preference
     * @param {string} reason - Reason for preference
     * @returns {Object} Save result
     */
    saveExercisePreference(exerciseName, preference, reason = '') {
        try {
            const preferenceData = {
                exerciseName,
                preference,
                reason,
                timestamp: new Date().toISOString()
            };
            
            const preferences = this.getExercisePreferences();
            const existingIndex = preferences.findIndex(p => p.exerciseName === exerciseName);
            
            if (existingIndex >= 0) {
                preferences[existingIndex] = preferenceData;
            } else {
                preferences.push(preferenceData);
            }
            
            this.storageManager?.set('exercise_preferences', preferences);
            
            this.logger.audit('EXERCISE_PREFERENCE_SAVED', {
                exerciseName,
                preference,
                reason
            });
            
            return { success: true, preference: preferenceData };
        } catch (error) {
            this.logger.error('Failed to save exercise preference', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get exercise alternatives for a given exercise
     * @param {string} exerciseName - Name of exercise
     * @returns {Array} Exercise alternatives
     */
    getExerciseAlternatives(exerciseName) {
        try {
            const exerciseKey = exerciseName.toLowerCase().replace(/\s+/g, '_');
            const exerciseData = this.exerciseDatabase[exerciseKey];
            
            if (!exerciseData) {
                return [];
            }
            
            return exerciseData.alternatives || [];
        } catch (error) {
            this.logger.error('Failed to get exercise alternatives', error);
            return [];
        }
    }
}

// Create global instance
window.ExerciseAdapter = new ExerciseAdapter();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExerciseAdapter;
}
