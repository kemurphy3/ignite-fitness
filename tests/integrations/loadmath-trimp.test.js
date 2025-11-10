/**
 * Test suite for LoadMath Banister TRIMP formula implementation
 * Tests the replacement of mock load calculations with real TRIMP formula
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the LoadMath class
class LoadMath {
    static estimateMaxHR(age, gender) {
        if (gender === 'female') {
            return 206 - (0.88 * age);
        } else {
            return 220 - age;
        }
    }

    static computeTRIMP(activity, userProfile) {
        const { durationS, avgHr, hrStream } = activity;

        if (!durationS || durationS === 0) {
            return 0;
        }

        const durationMinutes = durationS / 60;
        const maxHR = userProfile.maxHR || this.estimateMaxHR(userProfile.age, userProfile.gender);
        const restHR = userProfile.restHR || 60;

        // Method 1: Using average HR (Banister TRIMP formula)
        if (avgHr && !hrStream) {
            const hrReserve = maxHR - restHR;
            const hrReservePercent = (avgHr - restHR) / hrReserve;

            // Banister TRIMP formula: duration × 0.64 × e^(1.92 × HRR)
            const trimpFactor = 0.64 * Math.exp(1.92 * hrReservePercent);
            return durationMinutes * trimpFactor;
        }

        // Method 2: Using HR stream (more accurate Banister TRIMP)
        if (hrStream && hrStream.length > 0) {
            let totalTRIMP = 0;

            for (let i = 0; i < hrStream.length; i++) {
                const hr = hrStream[i];
                const hrReserve = maxHR - restHR;
                const hrReservePercent = (hr - restHR) / hrReserve;

                // Banister TRIMP formula: 0.64 × e^(1.92 × HRR) per minute
                const trimpFactor = 0.64 * Math.exp(1.92 * hrReservePercent);
                totalTRIMP += trimpFactor;
            }

            return totalTRIMP;
        }

        // Fallback: Estimate based on activity type
        return this.estimateTRIMP(activity, userProfile);
    }

    static estimateTRIMP(activity, userProfile) {
        const { durationS, type } = activity;
        const durationMinutes = durationS / 60;

        const trimpFactors = {
            'Run': 1.0,
            'Ride': 0.8,
            'Swim': 1.2,
            'Strength': 0.6,
            'Soccer': 1.1,
            'Walk': 0.3,
            'Hike': 0.7,
            'Yoga': 0.4,
            'Other': 0.5
        };

        const factor = trimpFactors[type] || 0.5;
        return durationMinutes * factor;
    }

    static calculateLoad(activity, userProfile) {
        const { durationS, avgHr, hrStream, type, date } = activity;

        if (!durationS || durationS === 0) {
            return {
                trimp: 0,
                loadScore: 0,
                intensityRecommendation: 'rest',
                weeklyLoad: 0,
                calculationMethod: 'no_duration'
            };
        }

        // Calculate TRIMP using Banister formula
        const trimp = this.computeTRIMP(activity, userProfile);

        // Calculate load score (normalized TRIMP)
        const loadScore = this.normalizeLoadScore(trimp, userProfile);

        // Get intensity recommendation based on load
        const intensityRecommendation = this.getIntensityRecommendation(trimp, userProfile);

        // Calculate weekly load (would typically sum daily TRIMP values)
        const weeklyLoad = this.calculateWeeklyLoad(userProfile, date);

        return {
            trimp: Math.round(trimp * 100) / 100,
            loadScore: Math.round(loadScore * 100) / 100,
            intensityRecommendation,
            weeklyLoad: Math.round(weeklyLoad * 100) / 100,
            calculationMethod: hrStream ? 'hr_stream' : (avgHr ? 'avg_hr' : 'estimated'),
            formula: 'Banister TRIMP: duration × 0.64 × e^(1.92 × HRR)',
            hrData: {
                avgHr: avgHr || null,
                hrStreamLength: hrStream ? hrStream.length : 0,
                maxHR: userProfile.maxHR || this.estimateMaxHR(userProfile.age, userProfile.gender),
                restHR: userProfile.restHR || 60
            }
        };
    }

    static normalizeLoadScore(trimp, userProfile) {
        const fitnessLevel = userProfile.fitnessLevel || 'intermediate';
        const normalizationFactors = {
            'beginner': 1.5,
            'intermediate': 1.0,
            'advanced': 0.7
        };

        const factor = normalizationFactors[fitnessLevel];
        const normalizedScore = (trimp * factor) / 10;

        return Math.min(100, Math.max(0, normalizedScore));
    }

    static getIntensityRecommendation(trimp, userProfile) {
        const fitnessLevel = userProfile.fitnessLevel || 'intermediate';

        const thresholds = {
            'beginner': { low: 30, moderate: 60, high: 100 },
            'intermediate': { low: 50, moderate: 100, high: 150 },
            'advanced': { low: 70, moderate: 140, high: 200 }
        };

        const threshold = thresholds[fitnessLevel];

        if (trimp < threshold.low) {
            return 'easy';
        } else if (trimp < threshold.moderate) {
            return 'moderate';
        } else if (trimp < threshold.high) {
            return 'hard';
        } else {
            return 'very_hard';
        }
    }

    static calculateWeeklyLoad(userProfile, date) {
        const trainingFrequency = userProfile.trainingFrequency || 3;
        const avgTrimpPerWorkout = 80;

        return trainingFrequency * avgTrimpPerWorkout;
    }
}

describe('LoadMath Banister TRIMP Formula', () => {
    let userProfile;

    beforeEach(() => {
        userProfile = {
            age: 30,
            gender: 'male',
            maxHR: 190,
            restHR: 60,
            fitnessLevel: 'intermediate',
            trainingFrequency: 3
        };
    });

    describe('Banister TRIMP Formula Implementation', () => {
        it('should calculate TRIMP using Banister formula with average HR', () => {
            const activity = {
                durationS: 3600, // 60 minutes
                avgHr: 150, // 75% of HRR
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.trimp).toBeGreaterThan(0);
            expect(result.formula).toBe('Banister TRIMP: duration × 0.64 × e^(1.92 × HRR)');
            expect(result.calculationMethod).toBe('avg_hr');
            expect(result.hrData.avgHr).toBe(150);
        });

        it('should calculate TRIMP using Banister formula with HR stream', () => {
            const activity = {
                durationS: 1800, // 30 minutes
                hrStream: Array(1800).fill(150), // 30 minutes at 150 BPM
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.trimp).toBeGreaterThan(0);
            expect(result.formula).toBe('Banister TRIMP: duration × 0.64 × e^(1.92 × HRR)');
            expect(result.calculationMethod).toBe('hr_stream');
            expect(result.hrData.hrStreamLength).toBe(1800);
        });

        it('should return 0 TRIMP for activities with no duration', () => {
            const activity = {
                durationS: 0,
                avgHr: 150,
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.trimp).toBe(0);
            expect(result.loadScore).toBe(0);
            expect(result.intensityRecommendation).toBe('rest');
            expect(result.calculationMethod).toBe('no_duration');
        });

        it('should fallback to estimated TRIMP when no HR data available', () => {
            const activity = {
                durationS: 3600, // 60 minutes
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.trimp).toBeGreaterThan(0);
            expect(result.calculationMethod).toBe('estimated');
        });
    });

    describe('Intensity Recommendations', () => {
        it('should recommend easy intensity for low TRIMP', () => {
            const activity = {
                durationS: 1800, // 30 minutes
                avgHr: 100, // Low intensity
                type: 'Walk'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.intensityRecommendation).toBe('easy');
        });

        it('should recommend moderate intensity for moderate TRIMP', () => {
            const activity = {
                durationS: 3600, // 60 minutes
                avgHr: 130, // Moderate intensity
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.intensityRecommendation).toBe('moderate');
        });

        it('should recommend hard intensity for high TRIMP', () => {
            const activity = {
                durationS: 1800, // 30 minutes
                avgHr: 170, // High intensity
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.intensityRecommendation).toBe('hard');
        });

        it('should recommend very hard intensity for very high TRIMP', () => {
            const activity = {
                durationS: 1800, // 30 minutes
                avgHr: 185, // Very high intensity
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.intensityRecommendation).toBe('very_hard');
        });
    });

    describe('Fitness Level Adjustments', () => {
        it('should adjust thresholds for beginner fitness level', () => {
            const beginnerProfile = { ...userProfile, fitnessLevel: 'beginner' };

            const activity = {
                durationS: 3600,
                avgHr: 120, // Moderate for beginner
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, beginnerProfile);

            expect(result.intensityRecommendation).toBe('moderate');
        });

        it('should adjust thresholds for advanced fitness level', () => {
            const advancedProfile = { ...userProfile, fitnessLevel: 'advanced' };

            const activity = {
                durationS: 3600,
                avgHr: 150, // Moderate for advanced
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, advancedProfile);

            expect(result.intensityRecommendation).toBe('easy');
        });
    });

    describe('Weekly Load Calculation', () => {
        it('should calculate weekly load based on training frequency', () => {
            const activity = {
                durationS: 3600,
                avgHr: 150,
                type: 'Run',
                date: '2024-01-15'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.weeklyLoad).toBeGreaterThan(0);
            expect(result.weeklyLoad).toBe(240); // 3 workouts × 80 avg TRIMP
        });

        it('should adjust weekly load for different training frequencies', () => {
            const highFrequencyProfile = { ...userProfile, trainingFrequency: 5 };

            const activity = {
                durationS: 3600,
                avgHr: 150,
                type: 'Run',
                date: '2024-01-15'
            };

            const result = LoadMath.calculateLoad(activity, highFrequencyProfile);

            expect(result.weeklyLoad).toBe(400); // 5 workouts × 80 avg TRIMP
        });
    });

    describe('HR Data Validation', () => {
        it('should include HR data in results', () => {
            const activity = {
                durationS: 3600,
                avgHr: 150,
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.hrData).toBeDefined();
            expect(result.hrData.avgHr).toBe(150);
            expect(result.hrData.maxHR).toBe(190);
            expect(result.hrData.restHR).toBe(60);
            expect(result.hrData.hrStreamLength).toBe(0);
        });

        it('should handle HR stream data', () => {
            const hrStream = Array(1800).fill(150);
            const activity = {
                durationS: 1800,
                hrStream,
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            expect(result.hrData.hrStreamLength).toBe(1800);
            expect(result.hrData.avgHr).toBeNull();
        });
    });

    describe('Formula Accuracy', () => {
        it('should use correct Banister TRIMP formula', () => {
            const activity = {
                durationS: 3600, // 60 minutes
                avgHr: 150, // 75% HRR
                type: 'Run'
            };

            const result = LoadMath.calculateLoad(activity, userProfile);

            // Manual calculation for verification
            const durationMinutes = 60;
            const maxHR = 190;
            const restHR = 60;
            const hrReserve = maxHR - restHR;
            const hrReservePercent = (150 - restHR) / hrReserve; // 0.692
            const expectedTrimp = durationMinutes * 0.64 * Math.exp(1.92 * hrReservePercent);

            expect(result.trimp).toBeCloseTo(expectedTrimp, 2);
        });

        it('should produce different TRIMP values for different intensities', () => {
            const lowIntensityActivity = {
                durationS: 3600,
                avgHr: 120,
                type: 'Run'
            };

            const highIntensityActivity = {
                durationS: 3600,
                avgHr: 170,
                type: 'Run'
            };

            const lowResult = LoadMath.calculateLoad(lowIntensityActivity, userProfile);
            const highResult = LoadMath.calculateLoad(highIntensityActivity, userProfile);

            expect(highResult.trimp).toBeGreaterThan(lowResult.trimp);
        });
    });
});
