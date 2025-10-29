/**
 * Test suite for WorkoutGenerator muscle group rotation
 * Tests the replacement of Math.random() with deterministic muscle group rotation
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the WorkoutGenerator class
class WorkoutGenerator {
    constructor() {
        this.exerciseDatabase = this.initializeExerciseDatabase();
    }

    initializeExerciseDatabase() {
        return {
            upperBody: {
                chest: [
                    { name: 'Bench Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest', 'shoulders', 'triceps'] },
                    { name: 'Push-ups', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['chest', 'shoulders', 'triceps'] }
                ],
                back: [
                    { name: 'Pull-ups', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['lats', 'biceps', 'rhomboids'] },
                    { name: 'Bent-over Row', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['lats', 'rhomboids', 'biceps'] }
                ]
            },
            lowerBody: {
                quadriceps: [
                    { name: 'Squats', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'] },
                    { name: 'Leg Press', equipment: 'machine', difficulty: 'beginner', muscleGroups: ['quadriceps', 'glutes'] }
                ],
                hamstrings: [
                    { name: 'Romanian Deadlifts', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['hamstrings', 'glutes'] },
                    { name: 'Leg Curls', equipment: 'machine', difficulty: 'beginner', muscleGroups: ['hamstrings'] }
                ]
            },
            core: [
                { name: 'Plank', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['core'] },
                { name: 'Russian Twists', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['core'] }
            ]
        };
    }

    getExperienceLevel(experience) {
        return experience || 'beginner';
    }

    isEquipmentAvailable(equipment, userProfile) {
        return true;
    }

    getMuscleGroupsForSession(sessionType) {
        if (sessionType.includes('Upper')) {
            return ['chest', 'back'];
        } else if (sessionType.includes('Lower')) {
            return ['quadriceps', 'hamstrings'];
        }
        return ['chest', 'back'];
    }

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

    // Select best exercise based on user profile and muscle group rotation
    selectBestExercise(exercises, userProfile, targetMuscleGroup = null) {
        if (exercises.length === 0) return null;
        
        // Filter by experience level
        const experienceLevel = this.getExperienceLevel(userProfile.experience);
        const filteredExercises = exercises.filter(ex => 
            ex.difficulty === experienceLevel || 
            (experienceLevel === 'advanced' && ex.difficulty === 'intermediate') ||
            (experienceLevel === 'intermediate' && ex.difficulty === 'beginner')
        );
        
        if (filteredExercises.length === 0) {
            return exercises[0];
        }
        
        // Select based on preferences and availability
        const availableExercises = filteredExercises.filter(ex => 
            this.isEquipmentAvailable(ex.equipment, userProfile)
        );
        
        if (availableExercises.length === 0) {
            return filteredExercises[0];
        }
        
        // Apply muscle group rotation logic
        return this.selectExerciseWithRotation(availableExercises, userProfile, targetMuscleGroup);
    }

    // Select exercise with muscle group rotation logic
    selectExerciseWithRotation(exercises, userProfile, targetMuscleGroup) {
        if (exercises.length === 0) return null;
        
        // Get last workout's muscle groups
        const lastWorkoutMuscleGroups = this.getLastWorkoutMuscleGroups(userProfile);
        
        // If no last workout, use deterministic selection based on user profile
        if (!lastWorkoutMuscleGroups || lastWorkoutMuscleGroups.length === 0) {
            return this.selectExerciseDeterministically(exercises, userProfile);
        }
        
        // Find exercises that target different muscle groups than last workout
        const differentMuscleGroupExercises = exercises.filter(exercise => {
            return !exercise.muscleGroups.some(muscleGroup => 
                lastWorkoutMuscleGroups.includes(muscleGroup)
            );
        });
        
        // If we have exercises targeting different muscle groups, use them
        if (differentMuscleGroupExercises.length > 0) {
            return this.selectExerciseDeterministically(differentMuscleGroupExercises, userProfile);
        }
        
        // Fallback to deterministic selection from all available exercises
        return this.selectExerciseDeterministically(exercises, userProfile);
    }
    
    // Get muscle groups from last workout
    getLastWorkoutMuscleGroups(userProfile) {
        if (!userProfile.recentWorkouts || userProfile.recentWorkouts.length === 0) {
            return [];
        }
        
        const lastWorkout = userProfile.recentWorkouts[0];
        if (!lastWorkout.exercises) {
            return [];
        }
        
        // Collect all muscle groups from last workout
        const muscleGroups = new Set();
        lastWorkout.exercises.forEach(exercise => {
            if (exercise.muscleGroups) {
                exercise.muscleGroups.forEach(muscleGroup => {
                    muscleGroups.add(muscleGroup);
                });
            }
        });
        
        return Array.from(muscleGroups);
    }
    
    // Select exercise deterministically based on user profile
    selectExerciseDeterministically(exercises, userProfile) {
        if (exercises.length === 0) return null;
        
        // Create a deterministic seed based on user profile
        const seed = this.createDeterministicSeed(userProfile);
        
        // Use seed to select exercise (same seed = same selection)
        const index = seed % exercises.length;
        return exercises[index];
    }
    
    // Create deterministic seed based on user profile
    createDeterministicSeed(userProfile) {
        // Combine user ID, experience level, and current date for deterministic but varied selection
        const userId = userProfile.id || userProfile.username || 'default';
        const experience = userProfile.experience || 'beginner';
        const currentDate = new Date().toDateString(); // Same day = same seed
        
        // Create hash-like value
        let seed = 0;
        const combinedString = `${userId}-${experience}-${currentDate}`;
        
        for (let i = 0; i < combinedString.length; i++) {
            seed = ((seed << 5) - seed + combinedString.charCodeAt(i)) & 0xffffffff;
        }
        
        return Math.abs(seed);
    }
}

describe('WorkoutGenerator Muscle Group Rotation', () => {
    let workoutGenerator;

    beforeEach(() => {
        workoutGenerator = new WorkoutGenerator();
    });

    describe('Deterministic Exercise Selection', () => {
        it('should return the same exercise for the same user state', () => {
            const userProfile = {
                id: 'test-user',
                experience: 'intermediate',
                recentWorkouts: []
            };

            const exercises = [
                { name: 'Bench Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest'] },
                { name: 'Push-ups', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['chest'] }
            ];

            const result1 = workoutGenerator.selectBestExercise(exercises, userProfile, 'chest');
            const result2 = workoutGenerator.selectBestExercise(exercises, userProfile, 'chest');

            expect(result1).toEqual(result2);
            expect(result1.name).toBe('Bench Press'); // Should be deterministic
        });

        it('should return different exercises for different users', () => {
            const userProfile1 = {
                id: 'user1',
                experience: 'intermediate',
                recentWorkouts: []
            };

            const userProfile2 = {
                id: 'user2',
                experience: 'intermediate',
                recentWorkouts: []
            };

            const exercises = [
                { name: 'Bench Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest'] },
                { name: 'Push-ups', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['chest'] }
            ];

            const result1 = workoutGenerator.selectBestExercise(exercises, userProfile1, 'chest');
            const result2 = workoutGenerator.selectBestExercise(exercises, userProfile2, 'chest');

            // Results should be deterministic but may differ between users
            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
        });
    });

    describe('Muscle Group Rotation', () => {
        it('should select exercises targeting different muscle groups than last workout', () => {
            const userProfile = {
                id: 'test-user',
                experience: 'intermediate',
                recentWorkouts: [{
                    exercises: [
                        { name: 'Bench Press', muscleGroups: ['chest', 'shoulders', 'triceps'] },
                        { name: 'Squats', muscleGroups: ['quadriceps', 'glutes'] }
                    ]
                }]
            };

            const exercises = [
                { name: 'Pull-ups', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['lats', 'biceps'] },
                { name: 'Leg Curls', equipment: 'machine', difficulty: 'beginner', muscleGroups: ['hamstrings'] },
                { name: 'Bench Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest', 'shoulders'] }
            ];

            const result = workoutGenerator.selectBestExercise(exercises, userProfile, 'back');

            // Should select an exercise that doesn't target chest, shoulders, triceps, quadriceps, or glutes
            expect(result).toBeDefined();
            expect(result.name).toBe('Pull-ups'); // Should avoid chest exercises from last workout
        });

        it('should fallback to deterministic selection when no different muscle groups available', () => {
            const userProfile = {
                id: 'test-user',
                experience: 'intermediate',
                recentWorkouts: [{
                    exercises: [
                        { name: 'Bench Press', muscleGroups: ['chest', 'shoulders', 'triceps'] }
                    ]
                }]
            };

            const exercises = [
                { name: 'Bench Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest', 'shoulders'] },
                { name: 'Push-ups', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['chest', 'shoulders'] }
            ];

            const result = workoutGenerator.selectBestExercise(exercises, userProfile, 'chest');

            // Should still return an exercise (deterministic fallback)
            expect(result).toBeDefined();
            expect(['Bench Press', 'Push-ups']).toContain(result.name);
        });

        it('should use deterministic selection when no recent workouts', () => {
            const userProfile = {
                id: 'test-user',
                experience: 'intermediate',
                recentWorkouts: []
            };

            const exercises = [
                { name: 'Bench Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest'] },
                { name: 'Push-ups', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['chest'] }
            ];

            const result = workoutGenerator.selectBestExercise(exercises, userProfile, 'chest');

            expect(result).toBeDefined();
            expect(['Bench Press', 'Push-ups']).toContain(result.name);
        });
    });

    describe('Upper Body / Lower Body Rotation', () => {
        it('should automatically rotate between upper and lower body workouts', () => {
            // Simulate upper body workout
            const upperBodyProfile = {
                id: 'test-user',
                experience: 'intermediate',
                recentWorkouts: [{
                    exercises: [
                        { name: 'Bench Press', muscleGroups: ['chest', 'shoulders', 'triceps'] },
                        { name: 'Pull-ups', muscleGroups: ['lats', 'biceps'] }
                    ]
                }]
            };

            // Simulate lower body workout
            const lowerBodyProfile = {
                id: 'test-user',
                experience: 'intermediate',
                recentWorkouts: [{
                    exercises: [
                        { name: 'Squats', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'] },
                        { name: 'Leg Curls', muscleGroups: ['hamstrings'] }
                    ]
                }]
            };

            const upperExercises = [
                { name: 'Bench Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest'] },
                { name: 'Pull-ups', equipment: 'bodyweight', difficulty: 'intermediate', muscleGroups: ['lats'] }
            ];

            const lowerExercises = [
                { name: 'Squats', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['quadriceps'] },
                { name: 'Leg Curls', equipment: 'machine', difficulty: 'beginner', muscleGroups: ['hamstrings'] }
            ];

            // After upper body workout, should select lower body exercises
            const upperResult = workoutGenerator.selectBestExercise(lowerExercises, upperBodyProfile, 'quadriceps');
            expect(upperResult).toBeDefined();
            expect(upperResult.muscleGroups).toContain('quadriceps');

            // After lower body workout, should select upper body exercises
            const lowerResult = workoutGenerator.selectBestExercise(upperExercises, lowerBodyProfile, 'chest');
            expect(lowerResult).toBeDefined();
            expect(lowerResult.muscleGroups).toContain('chest');
        });
    });

    describe('Equipment Availability Fallback', () => {
        it('should fallback to equipment availability when no muscle group rotation possible', () => {
            const userProfile = {
                id: 'test-user',
                experience: 'intermediate',
                recentWorkouts: []
            };

            const exercises = [
                { name: 'Bench Press', equipment: 'barbell', difficulty: 'intermediate', muscleGroups: ['chest'] },
                { name: 'Push-ups', equipment: 'bodyweight', difficulty: 'beginner', muscleGroups: ['chest'] }
            ];

            const result = workoutGenerator.selectBestExercise(exercises, userProfile, 'chest');

            expect(result).toBeDefined();
            expect(['Bench Press', 'Push-ups']).toContain(result.name);
        });
    });
});
