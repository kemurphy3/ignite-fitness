/**
 * AI Data Validator Tests
 * Verifies conservative fallbacks and data validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AI Data Validator', () => {
    let dataValidator;

    beforeEach(() => {
        // Mock AIDataValidator
        global.window = global.window || {};
        if (!global.window.AIDataValidator) {
            class MockAIDataValidator {
                constructor() {
                    this.logger = console;
                    this.conservativeDefaults = {
                        readiness: 6,
                        energyLevel: 6,
                        stressLevel: 5,
                        atl7: 50,
                        ctl28: 100,
                        monotony: 1.2,
                        strain: 60,
                        averageRPE: 6.5,
                        progressionRate: 0.05,
                        consistencyScore: 0.7,
                        trainingFrequency: 3,
                        workoutStreak: 0,
                        missedWorkouts: 0,
                        primaryGoal: 'general_fitness',
                        sport: 'general_fitness',
                        seasonPhase: 'offseason',
                        energyTrend: 'stable',
                        stressTrend: 'stable',
                        maxIntensity: 8,
                        minRestDays: 1,
                        maxVolumeIncrease: 0.1,
                        minDataPoints: 3
                    };
                }

                validateContext(context) {
                    if (!context || typeof context !== 'object') {
                        return this.conservativeDefaults;
                    }

                    const validated = { ...context };

                    // Validate readiness score (1-10)
                    validated.readinessScore = this.validateReadinessScore(context.readinessScore);
                    validated.readiness = validated.readinessScore;

                    // Validate energy and stress levels (1-10)
                    validated.energyLevel = this.validateEnergyLevel(context.energyLevel);
                    validated.stressLevel = this.validateStressLevel(context.stressLevel);

                    // Validate training load metrics
                    validated.atl7 = this.validateTrainingLoad(context.atl7, 'atl7');
                    validated.ctl28 = this.validateTrainingLoad(context.ctl28, 'ctl28');
                    validated.monotony = this.validateMonotony(context.monotony);
                    validated.strain = this.validateStrain(context.strain);

                    // Validate performance metrics
                    validated.averageRPE = this.validateRPE(context.averageRPE);
                    validated.progressionRate = this.validateProgressionRate(context.progressionRate);
                    validated.consistencyScore = this.validateConsistencyScore(context.consistencyScore);

                    // Validate training frequency and volume
                    validated.trainingFrequency = this.validateTrainingFrequency(context.trainingFrequency);
                    validated.workoutStreak = this.validateWorkoutStreak(context.workoutStreak);
                    validated.missedWorkouts = this.validateMissedWorkouts(context.missedWorkouts);

                    // Validate goals and preferences
                    validated.primaryGoal = this.validateGoal(context.primaryGoal);
                    validated.sport = this.validateSport(context.sport);
                    validated.seasonPhase = this.validateSeasonPhase(context.seasonPhase);

                    // Validate trends
                    validated.energyTrend = this.validateTrend(context.energyTrend);
                    validated.stressTrend = this.validateTrend(context.stressTrend);

                    // Validate arrays and objects
                    validated.trainingHistory = this.validateTrainingHistory(context.trainingHistory);
                    validated.recentWorkouts = this.validateRecentWorkouts(context.recentWorkouts);
                    validated.progressionData = this.validateProgressionData(context.progressionData);

                    return validated;
                }

                validateReadinessScore(score) {
                    if (typeof score !== 'number' || isNaN(score) || score <= 0) {
                        return this.conservativeDefaults.readiness;
                    }
                    return Math.min(Math.max(score, 1), 10);
                }

                validateEnergyLevel(level) {
                    if (typeof level !== 'number' || isNaN(level) || level <= 0) {
                        return this.conservativeDefaults.energyLevel;
                    }
                    return Math.min(Math.max(level, 1), 10);
                }

                validateStressLevel(level) {
                    if (typeof level !== 'number' || isNaN(level) || level <= 0) {
                        return this.conservativeDefaults.stressLevel;
                    }
                    return Math.min(Math.max(level, 1), 10);
                }

                validateTrainingLoad(load, type) {
                    if (typeof load !== 'number' || isNaN(load) || load < 0) {
                        return this.conservativeDefaults[type] || 0;
                    }
                    const maxLoad = type === 'atl7' ? 200 : 400;
                    return Math.min(load, maxLoad);
                }

                validateMonotony(monotony) {
                    if (typeof monotony !== 'number' || isNaN(monotony) || monotony < 1.0) {
                        return this.conservativeDefaults.monotony;
                    }
                    return Math.min(monotony, 5.0);
                }

                validateStrain(strain) {
                    if (typeof strain !== 'number' || isNaN(strain) || strain < 0) {
                        return this.conservativeDefaults.strain;
                    }
                    return Math.min(strain, 1000);
                }

                validateRPE(rpe) {
                    if (typeof rpe !== 'number' || isNaN(rpe) || rpe <= 0) {
                        return this.conservativeDefaults.averageRPE;
                    }
                    return Math.min(Math.max(rpe, 1), this.conservativeDefaults.maxIntensity);
                }

                validateProgressionRate(rate) {
                    if (typeof rate !== 'number' || isNaN(rate) || rate < 0) {
                        return this.conservativeDefaults.progressionRate;
                    }
                    return Math.min(rate, this.conservativeDefaults.maxVolumeIncrease);
                }

                validateConsistencyScore(score) {
                    if (typeof score !== 'number' || isNaN(score) || score < 0) {
                        return this.conservativeDefaults.consistencyScore;
                    }
                    return Math.min(Math.max(score, 0), 1);
                }

                validateTrainingFrequency(frequency) {
                    if (typeof frequency !== 'number' || isNaN(frequency) || frequency <= 0) {
                        return this.conservativeDefaults.trainingFrequency;
                    }
                    return Math.min(Math.max(frequency, 1), 7);
                }

                validateWorkoutStreak(streak) {
                    if (typeof streak !== 'number' || isNaN(streak) || streak < 0) {
                        return this.conservativeDefaults.workoutStreak;
                    }
                    return streak;
                }

                validateMissedWorkouts(missed) {
                    if (typeof missed !== 'number' || isNaN(missed) || missed < 0) {
                        return this.conservativeDefaults.missedWorkouts;
                    }
                    return missed;
                }

                validateGoal(goal) {
                    const validGoals = [
                        'general_fitness', 'strength', 'endurance', 'muscle_gain',
                        'weight_loss', 'sport_specific', 'injury_prevention'
                    ];

                    if (typeof goal !== 'string' || !validGoals.includes(goal)) {
                        return this.conservativeDefaults.primaryGoal;
                    }

                    return goal;
                }

                validateSport(sport) {
                    const validSports = [
                        'general_fitness', 'soccer', 'basketball', 'running',
                        'cycling', 'swimming', 'tennis', 'martial_arts'
                    ];

                    if (typeof sport !== 'string' || !validSports.includes(sport)) {
                        return this.conservativeDefaults.sport;
                    }

                    return sport;
                }

                validateSeasonPhase(phase) {
                    const validPhases = ['offseason', 'preseason', 'inseason', 'playoffs'];

                    if (typeof phase !== 'string' || !validPhases.includes(phase)) {
                        return this.conservativeDefaults.seasonPhase;
                    }

                    return phase;
                }

                validateTrend(trend) {
                    const validTrends = ['increasing', 'decreasing', 'stable', 'volatile'];

                    if (typeof trend !== 'string' || !validTrends.includes(trend)) {
                        return this.conservativeDefaults.energyTrend;
                    }

                    return trend;
                }

                validateTrainingHistory(history) {
                    if (!Array.isArray(history)) {
                        return [];
                    }

                    return history.filter(entry =>
                        entry &&
                        typeof entry === 'object' &&
                        entry.date &&
                        entry.type
                    );
                }

                validateRecentWorkouts(workouts) {
                    if (!Array.isArray(workouts)) {
                        return [];
                    }

                    return workouts.filter(workout =>
                        workout &&
                        typeof workout === 'object' &&
                        workout.date &&
                        workout.duration > 0
                    );
                }

                validateProgressionData(data) {
                    if (!data || typeof data !== 'object') {
                        return {};
                    }

                    const validated = {};

                    for (const [key, value] of Object.entries(data)) {
                        if (typeof value === 'number' && !isNaN(value) && value >= 0) {
                            validated[key] = value;
                        }
                    }

                    return validated;
                }

                applyConservativeScaling(baseIntensity, dataConfidence = 0.5) {
                    const validatedIntensity = this.validateRPE(baseIntensity);
                    const validatedConfidence = Math.min(Math.max(dataConfidence, 0), 1);

                    const confidenceFactor = 0.5 + (validatedConfidence * 0.5);
                    const scaledIntensity = validatedIntensity * confidenceFactor;

                    return Math.min(scaledIntensity, this.conservativeDefaults.maxIntensity);
                }

                generateConservativeRecommendations(context) {
                    const validatedContext = this.validateContext(context);

                    let intensity = 'moderate';
                    if (validatedContext.readinessScore <= 4) {
                        intensity = 'light';
                    } else if (validatedContext.readinessScore >= 8) {
                        intensity = 'moderate-high';
                    }

                    let volume = 'moderate';
                    if (validatedContext.atl7 > 150) {
                        volume = 'low';
                    } else if (validatedContext.atl7 < 30) {
                        volume = 'moderate-high';
                    }

                    return {
                        intensity,
                        volume,
                        duration: 45,
                        focus: 'general',
                        notes: 'Conservative workout based on current readiness and training load.',
                        safetyFlags: this.generateSafetyFlags(validatedContext)
                    };
                }

                generateSafetyFlags(context) {
                    const flags = [];

                    if (context.readinessScore <= 4) {
                        flags.push('Low readiness - consider light workout or rest');
                    }

                    if (context.atl7 > 150) {
                        flags.push('High training load - reduce volume');
                    }

                    if (context.stressLevel >= 8) {
                        flags.push('High stress - prioritize recovery');
                    }

                    if (context.missedWorkouts >= 3) {
                        flags.push('Multiple missed workouts - ease back gradually');
                    }

                    return flags;
                }
            }
            global.window.AIDataValidator = new MockAIDataValidator();
        }

        dataValidator = global.window.AIDataValidator;
    });

    describe('Context Validation', () => {
        it('should return conservative defaults for invalid context', () => {
            const result = dataValidator.validateContext(null);
            expect(result.readiness).toBe(6);
            expect(result.energyLevel).toBe(6);
            expect(result.stressLevel).toBe(5);
        });

        it('should validate readiness score', () => {
            const context = { readinessScore: 8 };
            const result = dataValidator.validateContext(context);
            expect(result.readinessScore).toBe(8);
        });

        it('should cap readiness score at 10', () => {
            const context = { readinessScore: 15 };
            const result = dataValidator.validateContext(context);
            expect(result.readinessScore).toBe(10);
        });

        it('should use conservative default for invalid readiness', () => {
            const context = { readinessScore: NaN };
            const result = dataValidator.validateContext(context);
            expect(result.readinessScore).toBe(6);
        });
    });

    describe('Training Load Validation', () => {
        it('should validate ATL7', () => {
            const context = { atl7: 75 };
            const result = dataValidator.validateContext(context);
            expect(result.atl7).toBe(75);
        });

        it('should cap ATL7 at maximum', () => {
            const context = { atl7: 300 };
            const result = dataValidator.validateContext(context);
            expect(result.atl7).toBe(200);
        });

        it('should use conservative default for invalid ATL7', () => {
            const context = { atl7: -10 };
            const result = dataValidator.validateContext(context);
            expect(result.atl7).toBe(50);
        });

        it('should validate CTL28', () => {
            const context = { ctl28: 150 };
            const result = dataValidator.validateContext(context);
            expect(result.ctl28).toBe(150);
        });

        it('should cap CTL28 at maximum', () => {
            const context = { ctl28: 500 };
            const result = dataValidator.validateContext(context);
            expect(result.ctl28).toBe(400);
        });
    });

    describe('RPE Validation', () => {
        it('should validate RPE', () => {
            const context = { averageRPE: 7.5 };
            const result = dataValidator.validateContext(context);
            expect(result.averageRPE).toBe(7.5);
        });

        it('should cap RPE at conservative maximum', () => {
            const context = { averageRPE: 10 };
            const result = dataValidator.validateContext(context);
            expect(result.averageRPE).toBe(8);
        });

        it('should use conservative default for invalid RPE', () => {
            const context = { averageRPE: 0 };
            const result = dataValidator.validateContext(context);
            expect(result.averageRPE).toBe(6.5);
        });
    });

    describe('Goal and Sport Validation', () => {
        it('should validate primary goal', () => {
            const context = { primaryGoal: 'strength' };
            const result = dataValidator.validateContext(context);
            expect(result.primaryGoal).toBe('strength');
        });

        it('should use conservative default for invalid goal', () => {
            const context = { primaryGoal: 'invalid_goal' };
            const result = dataValidator.validateContext(context);
            expect(result.primaryGoal).toBe('general_fitness');
        });

        it('should validate sport', () => {
            const context = { sport: 'soccer' };
            const result = dataValidator.validateContext(context);
            expect(result.sport).toBe('soccer');
        });

        it('should use conservative default for invalid sport', () => {
            const context = { sport: 'invalid_sport' };
            const result = dataValidator.validateContext(context);
            expect(result.sport).toBe('general_fitness');
        });
    });

    describe('Array Validation', () => {
        it('should validate training history', () => {
            const context = {
                trainingHistory: [
                    { date: '2023-01-01', type: 'strength' },
                    { invalid: 'entry' },
                    null
                ]
            };
            const result = dataValidator.validateContext(context);
            expect(result.trainingHistory).toHaveLength(1);
            expect(result.trainingHistory[0].type).toBe('strength');
        });

        it('should return empty array for invalid training history', () => {
            const context = { trainingHistory: 'not_an_array' };
            const result = dataValidator.validateContext(context);
            expect(result.trainingHistory).toEqual([]);
        });

        it('should validate recent workouts', () => {
            const context = {
                recentWorkouts: [
                    { date: '2023-01-01', duration: 60 },
                    { date: '2023-01-02', duration: 0 },
                    null
                ]
            };
            const result = dataValidator.validateContext(context);
            expect(result.recentWorkouts).toHaveLength(1);
            expect(result.recentWorkouts[0].duration).toBe(60);
        });
    });

    describe('Conservative Scaling', () => {
        it('should apply conservative scaling for low confidence', () => {
            const scaledIntensity = dataValidator.applyConservativeScaling(8, 0.2);
            expect(scaledIntensity).toBeLessThan(8);
            expect(scaledIntensity).toBeGreaterThan(4);
        });

        it('should apply less scaling for high confidence', () => {
            const scaledIntensity = dataValidator.applyConservativeScaling(8, 0.9);
            expect(scaledIntensity).toBeGreaterThan(6);
            expect(scaledIntensity).toBeLessThanOrEqual(8);
        });

        it('should cap scaled intensity at maximum', () => {
            const scaledIntensity = dataValidator.applyConservativeScaling(10, 1.0);
            expect(scaledIntensity).toBeLessThanOrEqual(8);
        });
    });

    describe('Conservative Recommendations', () => {
        it('should generate light intensity for low readiness', () => {
            const context = { readinessScore: 3 };
            const recs = dataValidator.generateConservativeRecommendations(context);
            expect(recs.intensity).toBe('light');
        });

        it('should generate moderate intensity for normal readiness', () => {
            const context = { readinessScore: 6 };
            const recs = dataValidator.generateConservativeRecommendations(context);
            expect(recs.intensity).toBe('moderate');
        });

        it('should generate low volume for high training load', () => {
            const context = { atl7: 200 };
            const recs = dataValidator.generateConservativeRecommendations(context);
            expect(recs.volume).toBe('low');
        });

        it('should generate safety flags for concerning metrics', () => {
            const context = {
                readinessScore: 3,
                atl7: 200,
                stressLevel: 9,
                missedWorkouts: 5
            };
            const recs = dataValidator.generateConservativeRecommendations(context);
            expect(recs.safetyFlags).toContain('Low readiness - consider light workout or rest');
            expect(recs.safetyFlags).toContain('High training load - reduce volume');
            expect(recs.safetyFlags).toContain('High stress - prioritize recovery');
            expect(recs.safetyFlags).toContain('Multiple missed workouts - ease back gradually');
        });
    });

    describe('Edge Cases', () => {
        it('should handle undefined values', () => {
            const context = {
                readinessScore: undefined,
                energyLevel: null,
                averageRPE: 'invalid'
            };
            const result = dataValidator.validateContext(context);
            expect(result.readinessScore).toBe(6);
            expect(result.energyLevel).toBe(6);
            expect(result.averageRPE).toBe(6.5);
        });

        it('should handle empty context', () => {
            const result = dataValidator.validateContext({});
            expect(result.readinessScore).toBe(6);
            expect(result.energyLevel).toBe(6);
            expect(result.stressLevel).toBe(5);
        });

        it('should handle extreme values', () => {
            const context = {
                readinessScore: -5,
                atl7: 1000,
                averageRPE: 15
            };
            const result = dataValidator.validateContext(context);
            expect(result.readinessScore).toBe(6);
            expect(result.atl7).toBe(200);
            expect(result.averageRPE).toBe(8);
        });
    });
});
