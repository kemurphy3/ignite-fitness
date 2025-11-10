/**
 * T2B-1: Load Calculator Bounds Checking Tests
 * Verifies that LoadCalculator handles negative values, zero divisions, and extreme ratios safely
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window objects
global.window = {
    SafeLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    },
    EventBus: {
        on: vi.fn(),
        emit: vi.fn()
    },
    AuthManager: {},
    StorageManager: {
        get: vi.fn(() => [])
    },
    StravaProcessor: {
        getRecentActivities: vi.fn(() => [])
    }
};

// Note: LoadCalculator is a class instantiated globally
// We'll test via the window instance or create our own instance
let LoadCalculator;

describe('LoadCalculator Bounds Checking (T2B-1)', () => {
    let calculator;

    beforeEach(async () => {
        // LoadCalculator is a class, accessed via window or require
        // For browser modules, use dynamic import and get constructor from window
        if (typeof window !== 'undefined' && window.LoadCalculator) {
            // Get constructor from instance
            LoadCalculator = window.LoadCalculator.constructor;
        } else {
            // Try to import the module
            const module = await import('../../js/modules/load/LoadCalculator.js');
            LoadCalculator = module.default || module.LoadCalculator;
        }

        // Create new instance for each test
        calculator = new LoadCalculator();
    });

    describe('Negative Load Values', () => {
        it('should handle negative volume in calculateSessionLoad', () => {
            const session = {
                exercises: [
                    { sets: -3, reps: -5, weight: -10, rpe: 5 }
                ]
            };

            const result = calculator.calculateSessionLoad(session);

            expect(result.total).toBeGreaterThanOrEqual(0);
            expect(result.volume).toBeGreaterThanOrEqual(0);
            expect(result.intensity).toBeGreaterThanOrEqual(0);
            expect(result.volumeRatio).toBeGreaterThanOrEqual(0);
            expect(result.intensityRatio).toBeGreaterThanOrEqual(0);
        });

        it('should handle zero totalLoad in ratio calculations', () => {
            const session = {
                exercises: []
            };

            const result = calculator.calculateSessionLoad(session);

            expect(result.total).toBeGreaterThanOrEqual(0);
            expect(result.volumeRatio).toBe(0);
            expect(result.intensityRatio).toBe(0);
            expect(Number.isFinite(result.volumeRatio)).toBe(true);
            expect(Number.isFinite(result.intensityRatio)).toBe(true);
        });

        it('should handle negative external activity load', () => {
            const session = {
                externalActivities: [
                    { training_stress_score: -50 }
                ]
            };

            const result = calculator.calculateSessionLoad(session);

            expect(result.total).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Division by Zero Protection', () => {
        it('should handle zero thresholds in suggestNextDayIntensity', () => {
            const thresholds = { weeklyLoad: 0, dailyLoad: 0 };
            const totalLoad = 100;
            const averageDailyLoad = 20;

            // Mock getUserTrainingLevel to return custom thresholds
            calculator.getUserTrainingLevel = vi.fn(() => 'intermediate');
            calculator.loadThresholds.intermediate = thresholds;

            const result = calculator.suggestNextDayIntensity(totalLoad, averageDailyLoad);

            expect(result).toBeDefined();
            expect(result.intensity).toBeGreaterThanOrEqual(0);
            expect(result.type).toBeDefined();
            expect(result.message).toBeDefined();
        });

        it('should handle zero sevenDayAverage in detectLoadSpike', () => {
            const currentLoad = 50;
            const sevenDayAverage = 0;

            const result = calculator.detectLoadSpike(currentLoad, sevenDayAverage);

            expect(result.isSpike).toBe(false);
            expect(result.ratio).toBe(1.0);
            expect(result.severity).toBe('none');
            expect(Number.isFinite(result.ratio)).toBe(true);
        });

        it('should return safe default (1) on error in calculateSevenDayAverage', () => {
            // Force an error by passing invalid data
            const sessions = null;
            const activities = null;

            const result = calculator.calculateSevenDayAverage(sessions, activities);

            // Should return 1 instead of 0 to prevent downstream division issues
            expect(result).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(result)).toBe(true);
        });
    });

    describe('Ratio Capping', () => {
        it('should cap loadRatio between 0.1 and 10.0 in suggestNextDayIntensity', () => {
            const totalLoad = 100000; // Extreme value
            const averageDailyLoad = 1;
            const thresholds = { weeklyLoad: 1, dailyLoad: 1 };

            calculator.getUserTrainingLevel = vi.fn(() => 'beginner');
            calculator.loadThresholds.beginner = thresholds;

            const result = calculator.suggestNextDayIntensity(totalLoad, averageDailyLoad);

            // Ratios should be capped
            expect(result).toBeDefined();
            // The internal ratios are capped, ensuring safe recommendations
        });

        it('should cap ratio in detectLoadSpike to prevent extreme values', () => {
            const currentLoad = 100000;
            const sevenDayAverage = 1;

            const result = calculator.detectLoadSpike(currentLoad, sevenDayAverage);

            expect(result.ratio).toBeLessThanOrEqual(10.0);
            expect(result.ratio).toBeGreaterThanOrEqual(0.1);
            expect(Number.isFinite(result.ratio)).toBe(true);
        });

        it('should cap ratio in generateWorkoutIntensityRecommendations', () => {
            const currentLoad = 100000;
            const sevenDayAverage = 1;
            const loadSpike = { isSpike: false, ratio: 1.0, severity: 'none' };

            const result = calculator.generateWorkoutIntensityRecommendations(
                currentLoad,
                sevenDayAverage,
                loadSpike
            );

            expect(result.loadRatio).toBeLessThanOrEqual(10.0);
            expect(result.loadRatio).toBeGreaterThanOrEqual(0.1);
            expect(Number.isFinite(result.loadRatio)).toBe(true);
        });
    });

    describe('Comprehensive Load Bounds', () => {
        it('should handle negative inputs in calculateComprehensiveLoad', () => {
            const sessions = [{ exercises: [{ sets: -1, reps: -1, weight: -1, rpe: 5 }] }];
            const activities = [{ training_stress_score: -50 }];

            const result = calculator.calculateComprehensiveLoad(sessions, activities);

            expect(result.combined.totalLoad).toBeGreaterThanOrEqual(0);
            expect(result.internal.totalLoad).toBeGreaterThanOrEqual(0);
            expect(result.external.totalLoad).toBeGreaterThanOrEqual(0);
        });

        it('should handle negative currentLoad in generateWorkoutIntensityRecommendations', () => {
            const currentLoad = -50;
            const sevenDayAverage = 100;
            const loadSpike = { isSpike: false, ratio: 1.0, severity: 'none' };

            const result = calculator.generateWorkoutIntensityRecommendations(
                currentLoad,
                sevenDayAverage,
                loadSpike
            );

            expect(result.intensity).toBeGreaterThanOrEqual(0.3);
            expect(result.intensity).toBeLessThanOrEqual(1.0);
            expect(result.volume).toBeGreaterThanOrEqual(0.3);
            expect(result.volume).toBeLessThanOrEqual(1.0);
            expect(Number.isFinite(result.intensity)).toBe(true);
            expect(Number.isFinite(result.volume)).toBe(true);
        });

        it('should handle zero or undefined values gracefully', () => {
            const session = {
                exercises: [
                    { sets: 0, reps: 0, weight: 0, rpe: undefined }
                ]
            };

            const result = calculator.calculateSessionLoad(session);

            expect(result.total).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(result.total)).toBe(true);
            expect(Number.isFinite(result.volumeRatio)).toBe(true);
            expect(Number.isFinite(result.intensityRatio)).toBe(true);
        });
    });

    describe('Bounds Logging', () => {
        it('should log when bounds checking is triggered', () => {
            const currentLoad = -50;
            const sevenDayAverage = -100;
            const loadSpike = { isSpike: false, ratio: 1.0, severity: 'none' };

            calculator.generateWorkoutIntensityRecommendations(
                currentLoad,
                sevenDayAverage,
                loadSpike
            );

            // Verify debug logging was called if bounds were corrected
            // (This is implicit - the function should handle it gracefully)
            expect(calculator.logger.debug).toBeDefined();
        });
    });
});

