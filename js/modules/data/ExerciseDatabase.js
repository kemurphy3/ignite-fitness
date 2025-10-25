/**
 * ExerciseDatabase - Exercise library and management
 * Handles exercise data, categories, and search functionality
 */
class ExerciseDatabase {
    constructor() {
        this.exercises = [];
        this.categories = [];
        this.muscleGroups = [];
        this.equipment = [];
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        
        this.initializeDatabase();
    }

    /**
     * Initialize exercise database
     */
    async initializeDatabase() {
        try {
            // Load from localStorage first
            this.loadFromStorage();
            
            // Try to load from server
            await this.loadFromServer();
            
            this.logger.info('Exercise database initialized', { 
                exercises: this.exercises.length,
                categories: this.categories.length 
            });
        } catch (error) {
            this.logger.error('Failed to initialize exercise database', error);
        }
    }

    /**
     * Load exercises from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('ignitefitness_exercises');
            if (stored) {
                const data = JSON.parse(stored);
                this.exercises = data.exercises || [];
                this.categories = data.categories || [];
                this.muscleGroups = data.muscleGroups || [];
                this.equipment = data.equipment || [];
            }
        } catch (error) {
            this.logger.error('Failed to load exercises from storage', error);
        }
    }

    /**
     * Load exercises from server
     */
    async loadFromServer() {
        try {
            if (window.ApiClient) {
                const response = await window.ApiClient.get('/exercises');
                if (response.success && response.data) {
                    this.exercises = response.data.exercises || [];
                    this.categories = response.data.categories || [];
                    this.muscleGroups = response.data.muscleGroups || [];
                    this.equipment = response.data.equipment || [];
                    
                    // Save to localStorage
                    this.saveToStorage();
                }
            }
        } catch (error) {
            this.logger.warn('Failed to load exercises from server', error);
        }
    }

    /**
     * Save exercises to localStorage
     */
    saveToStorage() {
        try {
            const data = {
                exercises: this.exercises,
                categories: this.categories,
                muscleGroups: this.muscleGroups,
                equipment: this.equipment,
                lastUpdated: Date.now()
            };
            localStorage.setItem('ignitefitness_exercises', JSON.stringify(data));
        } catch (error) {
            this.logger.error('Failed to save exercises to storage', error);
        }
    }

    /**
     * Get all exercises
     * @returns {Array} Exercises
     */
    getAllExercises() {
        return this.exercises;
    }

    /**
     * Get exercise by ID
     * @param {string} id - Exercise ID
     * @returns {Object|null} Exercise
     */
    getExerciseById(id) {
        return this.exercises.find(exercise => exercise.id === id) || null;
    }

    /**
     * Search exercises
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @returns {Array} Matching exercises
     */
    searchExercises(query, filters = {}) {
        let results = this.exercises;

        // Apply text search
        if (query && query.trim()) {
            const searchTerm = query.toLowerCase();
            results = results.filter(exercise => 
                exercise.name.toLowerCase().includes(searchTerm) ||
                exercise.description?.toLowerCase().includes(searchTerm) ||
                exercise.instructions?.toLowerCase().includes(searchTerm)
            );
        }

        // Apply filters
        if (filters.category) {
            results = results.filter(exercise => 
                exercise.category === filters.category
            );
        }

        if (filters.muscleGroup) {
            results = results.filter(exercise => 
                exercise.muscleGroups?.includes(filters.muscleGroup)
            );
        }

        if (filters.equipment) {
            results = results.filter(exercise => 
                exercise.equipment === filters.equipment
            );
        }

        if (filters.difficulty) {
            results = results.filter(exercise => 
                exercise.difficulty === filters.difficulty
            );
        }

        return results;
    }

    /**
     * Get exercises by category
     * @param {string} category - Category name
     * @returns {Array} Exercises
     */
    getExercisesByCategory(category) {
        return this.exercises.filter(exercise => exercise.category === category);
    }

    /**
     * Get exercises by muscle group
     * @param {string} muscleGroup - Muscle group name
     * @returns {Array} Exercises
     */
    getExercisesByMuscleGroup(muscleGroup) {
        return this.exercises.filter(exercise => 
            exercise.muscleGroups?.includes(muscleGroup)
        );
    }

    /**
     * Get exercises by equipment
     * @param {string} equipment - Equipment name
     * @returns {Array} Exercises
     */
    getExercisesByEquipment(equipment) {
        return this.exercises.filter(exercise => exercise.equipment === equipment);
    }

    /**
     * Get all categories
     * @returns {Array} Categories
     */
    getCategories() {
        return this.categories;
    }

    /**
     * Get all muscle groups
     * @returns {Array} Muscle groups
     */
    getMuscleGroups() {
        return this.muscleGroups;
    }

    /**
     * Get all equipment
     * @returns {Array} Equipment
     */
    getEquipment() {
        return this.equipment;
    }

    /**
     * Add custom exercise
     * @param {Object} exercise - Exercise data
     * @returns {Object} Add result
     */
    addCustomExercise(exercise) {
        try {
            const customExercise = {
                id: `custom_${Date.now()}`,
                name: exercise.name,
                description: exercise.description || '',
                instructions: exercise.instructions || '',
                category: exercise.category || 'Custom',
                muscleGroups: exercise.muscleGroups || [],
                equipment: exercise.equipment || 'Bodyweight',
                difficulty: exercise.difficulty || 'Beginner',
                isCustom: true,
                createdAt: Date.now()
            };

            this.exercises.push(customExercise);
            this.saveToStorage();
            
            this.logger.audit('CUSTOM_EXERCISE_ADDED', { name: exercise.name });
            this.eventBus?.emit('exercise:added', customExercise);
            
            return { success: true, exercise: customExercise };
        } catch (error) {
            this.logger.error('Failed to add custom exercise', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update custom exercise
     * @param {string} id - Exercise ID
     * @param {Object} updates - Updates to apply
     * @returns {Object} Update result
     */
    updateCustomExercise(id, updates) {
        try {
            const exerciseIndex = this.exercises.findIndex(ex => ex.id === id);
            if (exerciseIndex === -1) {
                return { success: false, error: 'Exercise not found' };
            }

            const exercise = this.exercises[exerciseIndex];
            if (!exercise.isCustom) {
                return { success: false, error: 'Cannot update built-in exercise' };
            }

            this.exercises[exerciseIndex] = {
                ...exercise,
                ...updates,
                updatedAt: Date.now()
            };

            this.saveToStorage();
            
            this.logger.audit('CUSTOM_EXERCISE_UPDATED', { id, name: exercise.name });
            this.eventBus?.emit('exercise:updated', this.exercises[exerciseIndex]);
            
            return { success: true, exercise: this.exercises[exerciseIndex] };
        } catch (error) {
            this.logger.error('Failed to update custom exercise', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete custom exercise
     * @param {string} id - Exercise ID
     * @returns {Object} Delete result
     */
    deleteCustomExercise(id) {
        try {
            const exerciseIndex = this.exercises.findIndex(ex => ex.id === id);
            if (exerciseIndex === -1) {
                return { success: false, error: 'Exercise not found' };
            }

            const exercise = this.exercises[exerciseIndex];
            if (!exercise.isCustom) {
                return { success: false, error: 'Cannot delete built-in exercise' };
            }

            this.exercises.splice(exerciseIndex, 1);
            this.saveToStorage();
            
            this.logger.audit('CUSTOM_EXERCISE_DELETED', { id, name: exercise.name });
            this.eventBus?.emit('exercise:deleted', { id, name: exercise.name });
            
            return { success: true };
        } catch (error) {
            this.logger.error('Failed to delete custom exercise', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get exercise suggestions based on workout type
     * @param {string} workoutType - Type of workout
     * @param {number} count - Number of suggestions
     * @returns {Array} Exercise suggestions
     */
    getExerciseSuggestions(workoutType, count = 5) {
        const suggestions = {
            'Upper Body': ['Push-ups', 'Pull-ups', 'Bench Press', 'Shoulder Press', 'Rows'],
            'Lower Body': ['Squats', 'Lunges', 'Deadlifts', 'Leg Press', 'Calf Raises'],
            'Full Body': ['Burpees', 'Mountain Climbers', 'Jumping Jacks', 'Plank', 'Kettlebell Swings'],
            'Cardio': ['Running', 'Cycling', 'Rowing', 'Elliptical', 'Jump Rope'],
            'Core': ['Plank', 'Crunches', 'Russian Twists', 'Leg Raises', 'Bicycle Crunches']
        };

        const suggestedNames = suggestions[workoutType] || [];
        return this.exercises.filter(exercise => 
            suggestedNames.includes(exercise.name)
        ).slice(0, count);
    }

    /**
     * Get random exercises
     * @param {number} count - Number of exercises
     * @param {Object} filters - Filters to apply
     * @returns {Array} Random exercises
     */
    getRandomExercises(count = 5, filters = {}) {
        let exercises = this.exercises;

        // Apply filters
        if (filters.category) {
            exercises = exercises.filter(ex => ex.category === filters.category);
        }
        if (filters.muscleGroup) {
            exercises = exercises.filter(ex => ex.muscleGroups?.includes(filters.muscleGroup));
        }
        if (filters.equipment) {
            exercises = exercises.filter(ex => ex.equipment === filters.equipment);
        }

        // Shuffle and return requested count
        const shuffled = exercises.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    /**
     * Get exercise statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        return {
            totalExercises: this.exercises.length,
            customExercises: this.exercises.filter(ex => ex.isCustom).length,
            categories: this.categories.length,
            muscleGroups: this.muscleGroups.length,
            equipment: this.equipment.length
        };
    }
}

// Create global instance
window.ExerciseDatabase = new ExerciseDatabase();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExerciseDatabase;
}
