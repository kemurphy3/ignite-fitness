/**
 * Load Calculation Engine Unit Tests
 * Tests pure function behavior and deterministic calculations
 */

import { describe, it, expect } from 'vitest';
import LoadCalculationEngine from '../../js/modules/load/LoadCalculationEngine.js';

describe('LoadCalculationEngine', () => {
    describe('compute_load - Pure Function Behavior', () => {
        it('should be deterministic - same input produces same output', () => {
            const session = {
                duration_minutes: 50,
                rpe: 6,
                modality: 'running',
                intensity: 'Z2'
            };

            const result1 = LoadCalculationEngine.compute_load(session);
            const result2 = LoadCalculationEngine.compute_load(session);
            const result3 = LoadCalculationEngine.compute_load(session);

            expect(result1.total_load).toBe(result2.total_load);
            expect(result2.total_load).toBe(result3.total_load);
            expect(result1.method_used).toBe(result2.method_used);
        });

        it('should not mutate input session object', () => {
            const originalSession = {
                duration_minutes: 45,
                rpe: 7,
                modality: 'cycling'
            };
            const sessionCopy = { ...originalSession };

            LoadCalculationEngine.compute_load(originalSession);

            expect(originalSession).toEqual(sessionCopy);
        });

        it('should throw error for invalid input', () => {
            expect(() => LoadCalculationEngine.compute_load(null)).toThrow('Session object is required');
            expect(() => LoadCalculationEngine.compute_load(undefined)).toThrow('Session object is required');
            expect(() => LoadCalculationEngine.compute_load('string')).toThrow('Session object is required');
            expect(() => LoadCalculationEngine.compute_load({})).toThrow('Insufficient data for load calculation');
        });
    });

    describe('TRIMP Calculation', () => {
        it('should calculate TRIMP when HR data is available', () => {
            const session = {
                duration_minutes: 60,
                hr_data: { avg_hr: 150 },
                user_profile: { max_hr: 190, rest_hr: 60, gender: 'male' }
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.method_used).toBe('TRIMP');
            expect(result.total_load).toBeGreaterThan(0);
            expect(result.confidence).toBe(0.95);
            expect(result.breakdown.duration_minutes).toBe(60);
            expect(result.breakdown.avg_hr).toBe(150);
        });

        it('should handle female gender factor correctly', () => {
            const maleSession = {
                duration_minutes: 60,
                hr_data: { avg_hr: 150 },
                user_profile: { max_hr: 190, rest_hr: 60, gender: 'male' }
            };

            const femaleSession = {
                duration_minutes: 60,
                hr_data: { avg_hr: 150 },
                user_profile: { max_hr: 190, rest_hr: 60, gender: 'female' }
            };

            const maleResult = LoadCalculationEngine.compute_load(maleSession);
            const femaleResult = LoadCalculationEngine.compute_load(femaleSession);

            expect(maleResult.breakdown.gender_factor).toBe(1.92);
            expect(femaleResult.breakdown.gender_factor).toBe(1.67);
            expect(maleResult.total_load).not.toBe(femaleResult.total_load);
        });

        it('should clamp extreme HR values', () => {
            const extremeSession = {
                duration_minutes: 30,
                hr_data: { avg_hr: 250 },
                user_profile: { max_hr: 190, rest_hr: 60 }
            };

            const result = LoadCalculationEngine.compute_load(extremeSession);

            expect(result.breakdown.hrr_fraction).toBeLessThanOrEqual(1.2);
            expect(result.total_load).toBeGreaterThan(0);
        });
    });

    describe('Zone-Based Load Calculation', () => {
        it('should calculate load from zone distribution', () => {
            const session = {
                duration_minutes: 60,
                zone_distribution: {
                    Z1: 10,
                    Z2: 40,
                    Z3: 10
                }
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.method_used).toBe('Zone_RPE');
            expect(result.confidence).toBe(0.85);

            expect(result.total_load).toBe(130);
            expect(result.breakdown.Z1.load_contribution).toBe(10);
            expect(result.breakdown.Z2.load_contribution).toBe(80);
            expect(result.breakdown.Z3.load_contribution).toBe(40);
        });

        it('should handle single zone sessions', () => {
            const session = {
                duration_minutes: 50,
                zone_distribution: {
                    Z2: 50
                }
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.total_load).toBe(100);
            expect(Object.keys(result.breakdown)).toEqual(['Z2']);
        });

        it('should ignore unknown zones', () => {
            const session = {
                duration_minutes: 30,
                zone_distribution: {
                    Z2: 25,
                    Z6: 5,
                    unknown: 10
                }
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.total_load).toBe(50);
            expect(Object.keys(result.breakdown)).toEqual(['Z2']);
        });
    });

    describe('RPE-Duration Load Calculation', () => {
        it('should calculate RPE * duration load', () => {
            const session = {
                duration_minutes: 50,
                rpe: 6
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.method_used).toBe('RPE_Duration');
            expect(result.confidence).toBe(0.75);
            expect(result.total_load).toBe(300);
            expect(result.breakdown.calculation).toBe('6 × 50');
        });

        it('should clamp RPE to valid range', () => {
            const lowSession = {
                duration_minutes: 30,
                rpe: -2
            };

            const highSession = {
                duration_minutes: 30,
                rpe: 15
            };

            const lowResult = LoadCalculationEngine.compute_load(lowSession);
            const highResult = LoadCalculationEngine.compute_load(highSession);

            expect(lowResult.breakdown.rpe).toBe(1);
            expect(highResult.breakdown.rpe).toBe(10);
            expect(lowResult.total_load).toBe(30);
            expect(highResult.total_load).toBe(300);
        });
    });

    describe('MET-Based Load Calculation', () => {
        it('should calculate MET load for known modalities', () => {
            const runningSession = {
                duration_minutes: 40,
                modality: 'running',
                intensity: 'Z3'
            };

            const result = LoadCalculationEngine.compute_load(runningSession);

            expect(result.method_used).toBe('MET_Minutes');
            expect(result.confidence).toBe(0.65);

            expect(result.total_load).toBe(384);
            expect(result.breakdown.met_value).toBe(12);
            expect(result.breakdown.met_minutes).toBe(480);
        });

        it('should handle different modalities correctly', () => {
            const baseSession = {
                duration_minutes: 30,
                intensity: 'Z2'
            };

            const runningSession = { ...baseSession, modality: 'running' };
            const cyclingSession = { ...baseSession, modality: 'cycling' };
            const swimmingSession = { ...baseSession, modality: 'swimming' };

            const runResult = LoadCalculationEngine.compute_load(runningSession);
            const cycleResult = LoadCalculationEngine.compute_load(cyclingSession);
            const swimResult = LoadCalculationEngine.compute_load(swimmingSession);

            expect(runResult.total_load).not.toBe(cycleResult.total_load);
            expect(cycleResult.total_load).not.toBe(swimResult.total_load);

            expect(runResult.breakdown.met_value).toBe(10);
            expect(cycleResult.breakdown.met_value).toBe(8);
            expect(swimResult.breakdown.met_value).toBe(12);
        });
    });

    describe('Load Calculation Priority', () => {
        it('should prioritize TRIMP over other methods', () => {
            const session = {
                duration_minutes: 45,
                hr_data: { avg_hr: 140 },
                user_profile: { max_hr: 185, rest_hr: 65 },
                rpe: 7,
                zone_distribution: { Z2: 45 },
                modality: 'running',
                intensity: 'Z2'
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.method_used).toBe('TRIMP');
            expect(result.confidence).toBe(0.95);
        });

        it('should fall back to zone-based when no HR data', () => {
            const session = {
                duration_minutes: 45,
                rpe: 7,
                zone_distribution: { Z2: 45 },
                modality: 'running',
                intensity: 'Z2'
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.method_used).toBe('Zone_RPE');
            expect(result.confidence).toBe(0.85);
        });

        it('should fall back to RPE when no zone data', () => {
            const session = {
                duration_minutes: 45,
                rpe: 7,
                modality: 'running',
                intensity: 'Z2'
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.method_used).toBe('RPE_Duration');
            expect(result.confidence).toBe(0.75);
        });

        it('should fall back to MET when only basic data available', () => {
            const session = {
                duration_minutes: 45,
                modality: 'running',
                intensity: 'Z2'
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.method_used).toBe('MET_Minutes');
            expect(result.confidence).toBe(0.65);
        });
    });

    describe('Validation', () => {
        it('should validate session structure', () => {
            const validSession = {
                duration_minutes: 45,
                rpe: 6,
                hr_data: { avg_hr: 140 }
            };

            const invalidSession = {
                duration_minutes: -10,
                rpe: 15,
                hr_data: { avg_hr: 300 }
            };

            const validResult = LoadCalculationEngine.validateSession(validSession);
            const invalidResult = LoadCalculationEngine.validateSession(invalidSession);

            expect(validResult.valid).toBe(true);
            expect(validResult.errors).toHaveLength(0);

            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.errors.length).toBeGreaterThan(0);
            expect(invalidResult.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero duration gracefully', () => {
            const session = {
                duration_minutes: 0,
                rpe: 5
            };

            expect(() => LoadCalculationEngine.compute_load(session)).toThrow();
        });

        it('should handle missing user profile in TRIMP calculation', () => {
            const session = {
                duration_minutes: 30,
                hr_data: { avg_hr: 140 }
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.method_used).toBe('TRIMP');
            expect(result.details.max_hr).toBe(185);
            expect(result.details.rest_hr).toBe(60);
        });

        it('should handle partial zone distribution data', () => {
            const session = {
                duration_minutes: 60,
                zone_distribution: {
                    Z2: 30
                }
            };

            const result = LoadCalculationEngine.compute_load(session);

            expect(result.method_used).toBe('Zone_RPE');
            expect(result.total_load).toBe(60);
            expect(result.details.total_minutes).toBe(60);
        });
    });
});

