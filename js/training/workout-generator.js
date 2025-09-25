// Workout Generation System
// Generates personalized workouts based on user profile, goals, and seasonal training

class WorkoutGenerator {
    constructor() {
        this.exerciseDatabase = this.initializeExerciseDatabase();
        this.templateLibrary = this.initializeTemplateLibrary();
    }

    // Initialize comprehensive exercise database
    initializeExerciseDatabase() {
        return {
            // Upper Body Exercises
            upperBody: {
                chest: [
                    { name: 'Bench Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest', 'shoulders', 'triceps'] },
                    { name: 'Incline Dumbbell Press', equipment: 'dumbbell', difficulty: 'intermediate', muscleGroups: ['chest', 'shoulders'] },
                    { name: 'Push-ups', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['chest', 'shoulders', 'triceps'] },
                    { name: 'Dumbbell Flyes', equipment: 'dumbbell', difficulty: 'intermediate', muscleGroups: ['chest'] },
                    { name: 'Cable Crossover', equipment: 'cable', difficulty: 'intermediate', muscleGroups: ['chest'] }
                ],
                back: [
                    { name: 'Pull-ups', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['lats', 'biceps', 'rhomboids'] },
                    { name: 'Bent-over Row', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['lats', 'rhomboids', 'biceps'] },
                    { name: 'Lat Pulldown', equipment: 'cable', difficulty: 'beginner', muscleGroups: ['lats', 'biceps'] },
                    { name: 'Seated Row', equipment: 'cable', difficulty: 'beginner', muscleGroups: ['rhomboids', 'lats', 'biceps'] },
                    { name: 'T-Bar Row', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['rhomboids', 'lats', 'biceps'] }
                ],
                shoulders: [
                    { name: 'Overhead Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['shoulders', 'triceps'] },
                    { name: 'Lateral Raises', equipment: 'dumbbell', difficulty: 'beginner', muscleGroups: ['shoulders'] },
                    { name: 'Rear Delt Flyes', equipment: 'dumbbell', difficulty: 'beginner', muscleGroups: ['shoulders'] },
                    { name: 'Face Pulls', equipment: 'cable', difficulty: 'beginner', muscleGroups: ['shoulders', 'rhomboids'] },
                    { name: 'Arnold Press', equipment: 'dumbbell', difficulty: 'intermediate', muscleGroups: ['shoulders'] }
                ],
                arms: [
                    { name: 'Bicep Curls', equipment: 'dumbbell', difficulty: 'beginner', muscleGroups: ['biceps'] },
                    { name: 'Hammer Curls', equipment: 'dumbbell', difficulty: 'beginner', muscleGroups: ['biceps', 'forearms'] },
                    { name: 'Tricep Dips', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['triceps', 'chest'] },
                    { name: 'Close-Grip Bench Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['triceps', 'chest'] },
                    { name: 'Cable Tricep Pushdown', equipment: 'cable', difficulty: 'beginner', muscleGroups: ['triceps'] }
                ]
            },
            
            // Lower Body Exercises
            lowerBody: {
                quadriceps: [
                    { name: 'Squats', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'] },
                    { name: 'Front Squats', equipment: 'barbell', difficulty: 'advanced', muscleGroups: ['quadriceps', 'core'] },
                    { name: 'Bulgarian Split Squats', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['quadriceps', 'glutes'] },
                    { name: 'Leg Press', equipment: 'machine', difficulty: 'beginner', muscleGroups: ['quadriceps', 'glutes'] },
                    { name: 'Walking Lunges', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['quadriceps', 'glutes'] }
                ],
                hamstrings: [
                    { name: 'Romanian Deadlifts', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['hamstrings', 'glutes'] },
                    { name: 'Leg Curls', equipment: 'machine', difficulty: 'beginner', muscleGroups: ['hamstrings'] },
                    { name: 'Good Mornings', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['hamstrings', 'glutes'] },
                    { name: 'Single-leg Deadlifts', equipment: 'dumbbell', difficulty: 'intermediate', muscleGroups: ['hamstrings', 'glutes'] }
                ],
                glutes: [
                    { name: 'Hip Thrusts', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['glutes', 'hamstrings'] },
                    { name: 'Glute Bridges', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['glutes', 'hamstrings'] },
                    { name: 'Clamshells', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['glutes'] },
                    { name: 'Lateral Band Walks', equipment: 'band', difficulty: 'beginner', muscleGroups: ['glutes'] }
                ],
                calves: [
                    { name: 'Calf Raises', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['calves'] },
                    { name: 'Seated Calf Raises', equipment: 'machine', difficulty: 'beginner', muscleGroups: ['calves'] },
                    { name: 'Single-leg Calf Raises', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['calves'] }
                ]
            },
            
            // Core Exercises
            core: [
                { name: 'Plank', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['core'] },
                { name: 'Dead Bug', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['core'] },
                { name: 'Russian Twists', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['core'] },
                { name: 'Mountain Climbers', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['core', 'cardio'] },
                { name: 'Hanging Leg Raises', equipment: 'bodyweight', difficulty: 'advanced', muscleGroups: ['core'] },
                { name: 'Pallof Press', equipment: 'cable', difficulty: 'intermediate', muscleGroups: ['core'] }
            ],
            
            // Cardio Exercises
            cardio: [
                { name: 'Treadmill Running', equipment: 'treadmill', difficulty: 'beginner', muscleGroups: ['cardio'] },
                { name: 'Rowing Machine', equipment: 'rower', difficulty: 'intermediate', muscleGroups: ['cardio', 'back'] },
                { name: 'Stationary Bike', equipment: 'bike', difficulty: 'beginner', muscleGroups: ['cardio'] },
                { name: 'Burpees', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['cardio', 'full-body'] },
                { name: 'Jump Rope', equipment: 'rope', difficulty: 'intermediate', muscleGroups: ['cardio'] }
            ],
            
            // Sport-Specific Exercises
            soccer: [
                { name: 'Lateral Bounds', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['glutes', 'adductors'] },
                { name: 'Single-leg Hops', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['quadriceps', 'calves'] },
                { name: 'Carioca', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['adductors', 'abductors'] },
                { name: 'High Knees', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['quadriceps', 'cardio'] },
                { name: 'Butt Kicks', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['hamstrings', 'cardio'] }
            ]
        };
    }

    // Initialize workout templates
    initializeTemplateLibrary() {
        return {
            strength: {
                beginner: {
                    duration: 45,
                    exercises: 6,
                    sets: 3,
                    reps: '8-12',
                    rest: 60
                },
                intermediate: {
                    duration: 60,
                    exercises: 8,
                    sets: 4,
                    reps: '6-10',
                    rest: 90
                },
                advanced: {
                    duration: 75,
                    exercises: 10,
                    sets: 5,
                    reps: '4-8',
                    rest: 120
                }
            },
            hypertrophy: {
                beginner: {
                    duration: 50,
                    exercises: 7,
                    sets: 3,
                    reps: '10-15',
                    rest: 45
                },
                intermediate: {
                    duration: 65,
                    exercises: 9,
                    sets: 4,
                    reps: '8-12',
                    rest: 60
                },
                advanced: {
                    duration: 80,
                    exercises: 11,
                    sets: 5,
                    reps: '6-10',
                    rest: 75
                }
            },
            endurance: {
                beginner: {
                    duration: 30,
                    exercises: 5,
                    sets: 2,
                    reps: '15-20',
                    rest: 30
                },
                intermediate: {
                    duration: 40,
                    exercises: 6,
                    sets: 3,
                    reps: '12-18',
                    rest: 45
                },
                advanced: {
                    duration: 50,
                    exercises: 8,
                    sets: 4,
                    reps: '10-15',
                    rest: 60
                }
            }
        };
    }

    // Generate workout based on user profile and goals
    generateWorkout(userProfile, sessionType, availableTime = 60) {
        const {
            goals,
            experience,
            personalData,
            currentPhase,
            recentWorkouts,
            preferences
        } = userProfile;

        // Determine workout focus based on goals
        const workoutFocus = this.determineWorkoutFocus(goals, sessionType);
        
        // Get appropriate template
        const template = this.getTemplate(workoutFocus, experience);
        
        // Adjust for available time
        const adjustedTemplate = this.adjustForTime(template, availableTime);
        
        // Generate exercises
        const exercises = this.selectExercises(adjustedTemplate, workoutFocus, sessionType, userProfile);
        
        // Apply seasonal adjustments
        const seasonalExercises = this.applySeasonalAdjustments(exercises, currentPhase);
        
        // Generate warmup and cooldown
        const warmup = this.generateWarmup(sessionType, availableTime);
        const cooldown = this.generateCooldown(sessionType, availableTime);
        
        return {
            type: sessionType,
            focus: workoutFocus,
            duration: availableTime,
            warmup: warmup,
            exercises: seasonalExercises,
            cooldown: cooldown,
            notes: this.generateWorkoutNotes(workoutFocus, currentPhase, preferences)
        };
    }

    // Determine workout focus based on goals
    determineWorkoutFocus(goals, sessionType) {
        if (sessionType.includes('Upper')) {
            return goals.primary === 'strength' ? 'strength' : 'hypertrophy';
        } else if (sessionType.includes('Lower')) {
            return goals.primary === 'strength' ? 'strength' : 'hypertrophy';
        } else if (sessionType.includes('Cardio')) {
            return 'endurance';
        } else if (sessionType.includes('Soccer')) {
            return 'sport-specific';
        }
        
        return goals.primary === 'strength' ? 'strength' : 'hypertrophy';
    }

    // Get appropriate template
    getTemplate(focus, experience) {
        const experienceLevel = this.getExperienceLevel(experience);
        return this.templateLibrary[focus][experienceLevel];
    }

    // Get experience level
    getExperienceLevel(experience) {
        if (experience === 'beginner') return 'beginner';
        if (experience === 'intermediate') return 'intermediate';
        return 'advanced';
    }

    // Adjust template for available time
    adjustForTime(template, availableTime) {
        const timeRatio = availableTime / template.duration;
        
        return {
            ...template,
            duration: availableTime,
            exercises: Math.max(3, Math.floor(template.exercises * timeRatio)),
            sets: Math.max(2, Math.floor(template.sets * timeRatio)),
            rest: Math.max(30, Math.floor(template.rest * timeRatio))
        };
    }

    // Select exercises for the workout
    selectExercises(template, focus, sessionType, userProfile) {
        const exercises = [];
        const muscleGroups = this.getMuscleGroupsForSession(sessionType);
        
        // Select primary exercises
        for (const muscleGroup of muscleGroups) {
            const muscleExercises = this.getExercisesForMuscleGroup(muscleGroup);
            const selectedExercise = this.selectBestExercise(muscleExercises, userProfile);
            
            if (selectedExercise) {
                exercises.push(this.createExerciseEntry(selectedExercise, template, userProfile));
            }
        }
        
        // Add core exercises
        if (!sessionType.includes('Core')) {
            const coreExercise = this.selectBestExercise(this.exerciseDatabase.core, userProfile);
            if (coreExercise) {
                exercises.push(this.createExerciseEntry(coreExercise, template, userProfile, true));
            }
        }
        
        // Add sport-specific exercises if applicable
        if (sessionType.includes('Soccer') || userProfile.goals?.secondary === 'athletic_performance') {
            const sportExercise = this.selectBestExercise(this.exerciseDatabase.soccer, userProfile);
            if (sportExercise) {
                exercises.push(this.createExerciseEntry(sportExercise, template, userProfile, true));
            }
        }
        
        return exercises.slice(0, template.exercises);
    }

    // Get muscle groups for session type
    getMuscleGroupsForSession(sessionType) {
        if (sessionType.includes('Upper')) {
            return ['chest', 'back', 'shoulders', 'arms'];
        } else if (sessionType.includes('Lower')) {
            return ['quadriceps', 'hamstrings', 'glutes', 'calves'];
        } else if (sessionType.includes('Full')) {
            return ['chest', 'back', 'quadriceps', 'hamstrings'];
        } else if (sessionType.includes('Core')) {
            return ['core'];
        }
        
        return ['chest', 'back', 'quadriceps', 'hamstrings'];
    }

    // Get exercises for muscle group
    getExercisesForMuscleGroup(muscleGroup) {
        if (muscleGroup === 'core') {
            return this.exerciseDatabase.core;
        }
        
        for (const category in this.exerciseDatabase.upperBody) {
            if (this.exerciseDatabase.upperBody[category].some(ex => ex.muscleGroups.includes(muscleGroup))) {
                return this.exerciseDatabase.upperBody[category];
            }
        }
        
        for (const category in this.exerciseDatabase.lowerBody) {
            if (this.exerciseDatabase.lowerBody[category].some(ex => ex.muscleGroups.includes(muscleGroup))) {
                return this.exerciseDatabase.lowerBody[category];
            }
        }
        
        return [];
    }

    // Select best exercise based on user profile
    selectBestExercise(exercises, userProfile) {
        if (exercises.length === 0) return null;
        
        // Filter by experience level
        const experienceLevel = this.getExperienceLevel(userProfile.experience);
        const filteredExercises = exercises.filter(ex => 
            ex.difficulty === experienceLevel || 
            (experienceLevel === 'advanced' && ex.difficulty === 'intermediate') ||
            (experienceLevel === 'intermediate' && ex.difficulty === 'beginner')
        );
        
        if (filteredExercises.length === 0) {
            return exercises[0]; // Fallback to first exercise
        }
        
        // Select based on preferences and availability
        const availableExercises = filteredExercises.filter(ex => 
            this.isEquipmentAvailable(ex.equipment, userProfile)
        );
        
        if (availableExercises.length > 0) {
            return availableExercises[Math.floor(Math.random() * availableExercises.length)];
        }
        
        return filteredExercises[Math.floor(Math.random() * filteredExercises.length)];
    }

    // Check if equipment is available
    isEquipmentAvailable(equipment, userProfile) {
        // This would check against user's available equipment
        // For now, assume all equipment is available
        return true;
    }

    // Create exercise entry
    createExerciseEntry(exercise, template, userProfile, isSecondary = false) {
        const sets = isSecondary ? Math.max(2, template.sets - 1) : template.sets;
        const reps = this.calculateReps(template.reps, userProfile);
        const weight = this.calculateStartingWeight(exercise, userProfile);
        
        return {
            name: exercise.name,
            equipment: exercise.equipment,
            muscleGroups: exercise.muscleGroups,
            sets: sets,
            reps: reps,
            weight: weight,
            rpe: this.calculateRPE(template, userProfile),
            rest: template.rest,
            notes: this.generateExerciseNotes(exercise, userProfile)
        };
    }

    // Calculate reps based on template
    calculateReps(templateReps, userProfile) {
        if (typeof templateReps === 'string') {
            const [min, max] = templateReps.split('-').map(Number);
            return `${min}-${max}`;
        }
        return templateReps;
    }

    // Calculate starting weight
    calculateStartingWeight(exercise, userProfile) {
        const baselineLifts = userProfile.personalData?.baselineLifts || {};
        const exerciseKey = exercise.name.toLowerCase().replace(/\s+/g, '_');
        
        if (baselineLifts[exerciseKey]) {
            return baselineLifts[exerciseKey];
        }
        
        // Default weights based on exercise and equipment
        const defaultWeights = {
            'barbell': 45,
            'dumbbell': 20,
            'bodyweight': 0,
            'machine': 50,
            'cable': 30,
            'band': 0
        };
        
        return defaultWeights[exercise.equipment] || 0;
    }

    // Calculate RPE (Rate of Perceived Exertion)
    calculateRPE(template, userProfile) {
        const baseRPE = template.sets >= 4 ? 8 : 7;
        const experienceBonus = userProfile.experience === 'advanced' ? 1 : 0;
        return Math.min(10, baseRPE + experienceBonus);
    }

    // Generate exercise notes
    generateExerciseNotes(exercise, userProfile) {
        const notes = [];
        
        if (exercise.difficulty === 'advanced') {
            notes.push('Focus on proper form and controlled movement');
        }
        
        if (exercise.equipment === 'barbell') {
            notes.push('Use a spotter for safety');
        }
        
        if (exercise.muscleGroups.includes('core')) {
            notes.push('Engage your core throughout the movement');
        }
        
        return notes.join('. ');
    }

    // Apply seasonal adjustments
    applySeasonalAdjustments(exercises, currentPhase) {
        if (!currentPhase) return exercises;
        
        const phaseAdjustments = {
            'off-season': { volumeMultiplier: 1.2, intensityMultiplier: 0.9 },
            'pre-season': { volumeMultiplier: 1.0, intensityMultiplier: 1.1 },
            'in-season': { volumeMultiplier: 0.8, intensityMultiplier: 0.9 },
            'playoffs': { volumeMultiplier: 0.6, intensityMultiplier: 1.0 }
        };
        
        const adjustments = phaseAdjustments[currentPhase] || { volumeMultiplier: 1.0, intensityMultiplier: 1.0 };
        
        return exercises.map(exercise => ({
            ...exercise,
            sets: Math.max(2, Math.floor(exercise.sets * adjustments.volumeMultiplier)),
            rpe: Math.min(10, Math.floor(exercise.rpe * adjustments.intensityMultiplier))
        }));
    }

    // Generate warmup
    generateWarmup(sessionType, availableTime) {
        const warmupDuration = Math.min(10, Math.floor(availableTime * 0.15));
        
        return {
            duration: warmupDuration,
            exercises: [
                { name: 'Dynamic Stretching', duration: 3, description: 'Arm circles, leg swings, hip circles' },
                { name: 'Light Cardio', duration: 5, description: 'Treadmill walk or bike' },
                { name: 'Movement Prep', duration: 2, description: 'Bodyweight squats, push-ups' }
            ]
        };
    }

    // Generate cooldown
    generateCooldown(sessionType, availableTime) {
        const cooldownDuration = Math.min(8, Math.floor(availableTime * 0.1));
        
        return {
            duration: cooldownDuration,
            exercises: [
                { name: 'Static Stretching', duration: 5, description: 'Hold stretches for 30-60 seconds' },
                { name: 'Deep Breathing', duration: 3, description: 'Focus on recovery and relaxation' }
            ]
        };
    }

    // Generate workout notes
    generateWorkoutNotes(focus, currentPhase, preferences) {
        const notes = [];
        
        if (focus === 'strength') {
            notes.push('Focus on progressive overload and proper form');
        } else if (focus === 'hypertrophy') {
            notes.push('Focus on muscle contraction and time under tension');
        } else if (focus === 'endurance') {
            notes.push('Maintain steady pace throughout the workout');
        }
        
        if (currentPhase === 'in-season') {
            notes.push('Reduce intensity if feeling fatigued');
        } else if (currentPhase === 'playoffs') {
            notes.push('Peak performance focus - listen to your body');
        }
        
        return notes.join('. ');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WorkoutGenerator };
} else {
    // Make available globally for browser
    window.WorkoutGenerator = WorkoutGenerator;
}
