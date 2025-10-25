/**
 * ProgressionEngine - Handles workout progression and tracking
 * Manages weight progression, rep progression, and performance tracking
 */
class ProgressionEngine {
    constructor() {
        this.progressionRules = {
            strength: {
                weightIncrease: 2.5, // kg
                repIncrease: 1,
                maxReps: 12,
                minReps: 5
            },
            endurance: {
                weightIncrease: 1.25, // kg
                repIncrease: 2,
                maxReps: 20,
                minReps: 8
            },
            hypertrophy: {
                weightIncrease: 2.5, // kg
                repIncrease: 1,
                maxReps: 15,
                minReps: 6
            }
        };
        
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.workoutTracker = window.WorkoutTracker;
    }

    /**
     * Calculate next workout progression
     * @param {string} exerciseName - Exercise name
     * @param {Object} lastWorkout - Last workout data
     * @param {string} goal - Training goal
     * @returns {Object} Progression recommendation
     */
    calculateProgression(exerciseName, lastWorkout, goal = 'strength') {
        try {
            if (!lastWorkout || !lastWorkout.sets || lastWorkout.sets.length === 0) {
                return this.getInitialProgression(exerciseName, goal);
            }

            const rules = this.progressionRules[goal] || this.progressionRules.strength;
            const lastSet = lastWorkout.sets[lastWorkout.sets.length - 1];
            const avgReps = this.calculateAverageReps(lastWorkout.sets);
            const maxWeight = Math.max(...lastWorkout.sets.map(set => set.weight || 0));

            let recommendation = {
                exercise: exerciseName,
                sets: lastWorkout.sets.length,
                reps: lastSet.reps,
                weight: lastSet.weight,
                progression: 'maintain',
                reason: ''
            };

            // Check if all sets were completed successfully
            if (avgReps >= lastSet.reps * 0.9) {
                // Increase weight
                recommendation.weight = maxWeight + rules.weightIncrease;
                recommendation.progression = 'increase_weight';
                recommendation.reason = 'All sets completed successfully';
            } else if (avgReps < lastSet.reps * 0.7) {
                // Decrease weight
                recommendation.weight = Math.max(maxWeight - rules.weightIncrease, 0);
                recommendation.progression = 'decrease_weight';
                recommendation.reason = 'Sets were too difficult';
            } else {
                // Maintain weight, increase reps
                recommendation.reps = Math.min(lastSet.reps + rules.repIncrease, rules.maxReps);
                recommendation.progression = 'increase_reps';
                recommendation.reason = 'Maintain weight, increase reps';
            }

            // Ensure reps are within bounds
            recommendation.reps = Math.max(recommendation.reps, rules.minReps);
            recommendation.reps = Math.min(recommendation.reps, rules.maxReps);

            this.logger.debug('Progression calculated', { 
                exercise: exerciseName, 
                progression: recommendation.progression 
            });

            return recommendation;
        } catch (error) {
            this.logger.error('Failed to calculate progression', error);
            return this.getInitialProgression(exerciseName, goal);
        }
    }

    /**
     * Get initial progression for new exercise
     * @param {string} exerciseName - Exercise name
     * @param {string} goal - Training goal
     * @returns {Object} Initial progression
     */
    getInitialProgression(exerciseName, goal = 'strength') {
        const rules = this.progressionRules[goal] || this.progressionRules.strength;
        
        return {
            exercise: exerciseName,
            sets: 3,
            reps: Math.round((rules.minReps + rules.maxReps) / 2),
            weight: this.getEstimatedStartingWeight(exerciseName),
            progression: 'initial',
            reason: 'Starting progression for new exercise'
        };
    }

    /**
     * Get estimated starting weight for exercise
     * @param {string} exerciseName - Exercise name
     * @returns {number} Estimated weight
     */
    getEstimatedStartingWeight(exerciseName) {
        const estimates = {
            'Bench Press': 20,
            'Squat': 30,
            'Deadlift': 40,
            'Overhead Press': 15,
            'Row': 20,
            'Pull-up': 0, // Bodyweight
            'Push-up': 0, // Bodyweight
            'Dip': 0 // Bodyweight
        };

        return estimates[exerciseName] || 10; // Default 10kg
    }

    /**
     * Calculate average reps from sets
     * @param {Array} sets - Sets data
     * @returns {number} Average reps
     */
    calculateAverageReps(sets) {
        if (!sets || sets.length === 0) return 0;
        
        const totalReps = sets.reduce((sum, set) => sum + (set.reps || 0), 0);
        return totalReps / sets.length;
    }

    /**
     * Track exercise progress over time
     * @param {string} exerciseName - Exercise name
     * @param {number} days - Number of days to look back
     * @returns {Object} Progress data
     */
    trackExerciseProgress(exerciseName, days = 30) {
        try {
            const progress = this.workoutTracker?.getExerciseProgress(exerciseName, days) || [];
            
            if (progress.length === 0) {
                return {
                    exercise: exerciseName,
                    progress: [],
                    trend: 'no_data',
                    improvement: 0
                };
            }

            const trend = this.calculateTrend(progress);
            const improvement = this.calculateImprovement(progress);

            return {
                exercise: exerciseName,
                progress,
                trend,
                improvement,
                dataPoints: progress.length
            };
        } catch (error) {
            this.logger.error('Failed to track exercise progress', error);
            return {
                exercise: exerciseName,
                progress: [],
                trend: 'error',
                improvement: 0
            };
        }
    }

    /**
     * Calculate trend from progress data
     * @param {Array} progress - Progress data
     * @returns {string} Trend direction
     */
    calculateTrend(progress) {
        if (progress.length < 2) return 'insufficient_data';

        const weights = progress.map(p => p.maxWeight);
        const firstHalf = weights.slice(0, Math.floor(weights.length / 2));
        const secondHalf = weights.slice(Math.floor(weights.length / 2));

        const firstAvg = firstHalf.reduce((sum, w) => sum + w, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, w) => sum + w, 0) / secondHalf.length;

        const change = ((secondAvg - firstAvg) / firstAvg) * 100;

        if (change > 5) return 'improving';
        if (change < -5) return 'declining';
        return 'stable';
    }

    /**
     * Calculate improvement percentage
     * @param {Array} progress - Progress data
     * @returns {number} Improvement percentage
     */
    calculateImprovement(progress) {
        if (progress.length < 2) return 0;

        const first = progress[0].maxWeight;
        const last = progress[progress.length - 1].maxWeight;

        return ((last - first) / first) * 100;
    }

    /**
     * Generate workout recommendations
     * @param {Object} userProfile - User profile data
     * @param {Array} recentWorkouts - Recent workout data
     * @returns {Object} Recommendations
     */
    generateWorkoutRecommendations(userProfile, recentWorkouts) {
        try {
            const recommendations = {
                exercises: [],
                volume: 'moderate',
                intensity: 'moderate',
                rest: 'normal'
            };

            // Analyze recent performance
            const performanceAnalysis = this.analyzeRecentPerformance(recentWorkouts);
            
            // Adjust recommendations based on performance
            if (performanceAnalysis.fatigue > 0.7) {
                recommendations.intensity = 'low';
                recommendations.rest = 'extended';
            } else if (performanceAnalysis.fatigue < 0.3) {
                recommendations.intensity = 'high';
                recommendations.volume = 'high';
            }

            // Get exercise recommendations
            recommendations.exercises = this.getExerciseRecommendations(userProfile, performanceAnalysis);

            this.logger.debug('Workout recommendations generated', { 
                intensity: recommendations.intensity,
                volume: recommendations.volume 
            });

            return recommendations;
        } catch (error) {
            this.logger.error('Failed to generate workout recommendations', error);
            return {
                exercises: [],
                volume: 'moderate',
                intensity: 'moderate',
                rest: 'normal'
            };
        }
    }

    /**
     * Analyze recent performance
     * @param {Array} recentWorkouts - Recent workout data
     * @returns {Object} Performance analysis
     */
    analyzeRecentPerformance(recentWorkouts) {
        if (!recentWorkouts || recentWorkouts.length === 0) {
            return { fatigue: 0.5, consistency: 0.5, improvement: 0 };
        }

        // Calculate fatigue based on recent workout frequency and intensity
        const recentDays = 7;
        const recentWorkouts = recentWorkouts.filter(workout => {
            const workoutDate = new Date(workout.startTime);
            const daysSince = (Date.now() - workoutDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysSince <= recentDays;
        });

        const fatigue = Math.min(recentWorkouts.length / 5, 1); // Max fatigue at 5 workouts per week
        const consistency = this.calculateConsistency(recentWorkouts);
        const improvement = this.calculateOverallImprovement(recentWorkouts);

        return { fatigue, consistency, improvement };
    }

    /**
     * Calculate workout consistency
     * @param {Array} workouts - Workout data
     * @returns {number} Consistency score (0-1)
     */
    calculateConsistency(workouts) {
        if (workouts.length < 2) return 0.5;

        const intervals = [];
        for (let i = 1; i < workouts.length; i++) {
            const prev = new Date(workouts[i-1].startTime);
            const curr = new Date(workouts[i].startTime);
            intervals.push(curr - prev);
        }

        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const consistency = 1 - (Math.sqrt(variance) / avgInterval);

        return Math.max(0, Math.min(1, consistency));
    }

    /**
     * Calculate overall improvement
     * @param {Array} workouts - Workout data
     * @returns {number} Improvement percentage
     */
    calculateOverallImprovement(workouts) {
        if (workouts.length < 2) return 0;

        const firstWorkout = workouts[workouts.length - 1];
        const lastWorkout = workouts[0];

        const firstTotalVolume = this.calculateWorkoutVolume(firstWorkout);
        const lastTotalVolume = this.calculateWorkoutVolume(lastWorkout);

        return ((lastTotalVolume - firstTotalVolume) / firstTotalVolume) * 100;
    }

    /**
     * Calculate workout volume
     * @param {Object} workout - Workout data
     * @returns {number} Total volume
     */
    calculateWorkoutVolume(workout) {
        if (!workout.exercises) return 0;

        return workout.exercises.reduce((total, exercise) => {
            const exerciseVolume = exercise.sets.reduce((sum, set) => {
                return sum + ((set.weight || 0) * (set.reps || 0));
            }, 0);
            return total + exerciseVolume;
        }, 0);
    }

    /**
     * Get exercise recommendations
     * @param {Object} userProfile - User profile
     * @param {Object} performanceAnalysis - Performance analysis
     * @returns {Array} Exercise recommendations
     */
    getExerciseRecommendations(userProfile, performanceAnalysis) {
        const recommendations = [];

        // Base exercises for different goals
        const baseExercises = {
            strength: ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Row'],
            endurance: ['Push-ups', 'Pull-ups', 'Lunges', 'Plank', 'Burpees'],
            hypertrophy: ['Bench Press', 'Squat', 'Deadlift', 'Bicep Curls', 'Tricep Extensions']
        };

        const goal = userProfile.goals?.primary || 'strength';
        const exercises = baseExercises[goal] || baseExercises.strength;

        // Adjust based on performance
        if (performanceAnalysis.fatigue > 0.7) {
            // Reduce intensity
            recommendations.push(...exercises.slice(0, 3));
        } else if (performanceAnalysis.fatigue < 0.3) {
            // Increase variety
            recommendations.push(...exercises);
        } else {
            // Normal selection
            recommendations.push(...exercises.slice(0, 5));
        }

        return recommendations;
    }

    /**
     * Get progression summary
     * @param {string} exerciseName - Exercise name
     * @returns {Object} Progression summary
     */
    getProgressionSummary(exerciseName) {
        try {
            const progress = this.trackExerciseProgress(exerciseName, 30);
            const lastWorkout = this.workoutTracker?.getWorkoutHistory(1)[0];
            
            if (!lastWorkout) {
                return {
                    exercise: exerciseName,
                    status: 'no_data',
                    message: 'No workout data available'
                };
            }

            const lastExercise = lastWorkout.exercises.find(ex => ex.name === exerciseName);
            if (!lastExercise) {
                return {
                    exercise: exerciseName,
                    status: 'not_performed',
                    message: 'Exercise not performed recently'
                };
            }

            const recommendation = this.calculateProgression(exerciseName, lastExercise);
            
            return {
                exercise: exerciseName,
                status: 'active',
                lastWeight: Math.max(...lastExercise.sets.map(set => set.weight || 0)),
                lastReps: lastExercise.sets[lastExercise.sets.length - 1].reps,
                recommendation: recommendation,
                progress: progress
            };
        } catch (error) {
            this.logger.error('Failed to get progression summary', error);
            return {
                exercise: exerciseName,
                status: 'error',
                message: 'Failed to analyze progression'
            };
        }
    }
}

// Create global instance
window.ProgressionEngine = new ProgressionEngine();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressionEngine;
}
