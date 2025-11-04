/**
 * Substitution Engine Unit Tests
 * Tests workout substitution logic and load equivalence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SubstitutionEngine from '../../js/modules/substitution/SubstitutionEngine.js';
import EquivalenceRules from '../../js/modules/substitution/EquivalenceRules.js';

describe('SubstitutionEngine', () => {
    let substitutionEngine;
    let mockWorkoutCatalog;
    let mockGuardrailManager;

    beforeEach(() => {
        mockWorkoutCatalog = {
            getWorkoutsByModality: vi.fn()
        };

        mockGuardrailManager = {
            validateWorkout: vi.fn().mockResolvedValue({
                isAllowed: true,
                warnings: []
            })
        };

        substitutionEngine = new SubstitutionEngine(mockWorkoutCatalog, mockGuardrailManager);
    });

    describe('suggest_substitutions', () => {
        it('should suggest substitutions for "Run 50 min Z2" to cycling', async () => {
            mockWorkoutCatalog.getWorkoutsByModality.mockResolvedValue([
                {
                    template_id: 'cycle_endurance_60min_z2',
                    name: '60min Z2 Endurance',
                    modality: 'cycling',
                    category: 'endurance',
                    adaptation: 'aerobic_base',
                    estimated_load: 60,
                    time_required: 60,
                    equipment_required: ['bike'],
                    structure: [
                        { block_type: 'warmup', duration: 10, intensity: 'Z1' },
                        { block_type: 'main', duration: 40, intensity: 'Z2' },
                        { block_type: 'cooldown', duration: 10, intensity: 'Z1' }
                    ]
                }
            ]);

            const plannedSession = {
                modality: 'running',
                duration_minutes: 50,
                intensity: 'Z2',
                adaptation: 'aerobic_base'
            };

            const userContext = {
                equipment: ['bike'],
                available_time: 90,
                user_profile: { training_level: 'intermediate' }
            };

            const substitutions = await substitutionEngine.suggest_substitutions(
                plannedSession,
                'cycling',
                userContext
            );

            expect(substitutions).toHaveLength(1);

            const substitution = substitutions[0];
            expect(substitution.modality).toBe('cycling');
            expect(substitution.scaled_duration).toBeGreaterThanOrEqual(60);
            expect(substitution.scaled_duration).toBeLessThanOrEqual(75);

            expect(substitution.load_variance_percentage).toBeLessThanOrEqual(10);
            expect(substitution.confidence_score).toBeGreaterThan(0.7);
        });

        it('should preserve hard minutes for VO2 session substitutions', async () => {
            mockWorkoutCatalog.getWorkoutsByModality.mockResolvedValue([
                {
                    template_id: 'swim_vo2_20x50',
                    name: '20x50m VO2 Set',
                    modality: 'swimming',
                    category: 'vo2',
                    adaptation: 'vo2_max',
                    estimated_load: 85,
                    time_required: 50,
                    equipment_required: ['pool'],
                    structure: [
                        { block_type: 'warmup', duration: 15, intensity: 'Z1' },
                        { block_type: 'main', sets: 20, work_duration: 45, rest_duration: 10, intensity: 'Z4' },
                        { block_type: 'cooldown', duration: 15, intensity: 'Z1' }
                    ]
                }
            ]);

            const plannedSession = {
                modality: 'running',
                duration_minutes: 45,
                intensity: 'Z4',
                adaptation: 'vo2_max',
                structure: [
                    { block_type: 'warmup', duration: 15, intensity: 'Z1' },
                    { block_type: 'main', sets: 8, work_duration: 180, rest_duration: 90, intensity: 'Z4' },
                    { block_type: 'cooldown', duration: 10, intensity: 'Z1' }
                ]
            };

            const userContext = {
                equipment: ['pool'],
                available_time: 60,
                user_profile: { training_level: 'advanced' }
            };

            const substitutions = await substitutionEngine.suggest_substitutions(
                plannedSession,
                'swimming',
                userContext
            );

            expect(substitutions).toHaveLength(1);

            const substitution = substitutions[0];

            const originalHardMinutes = 8 * 180 / 60;
            const substitutedHardMinutes = 20 * 45 / 60;

            const hardMinutesRatio = substitutedHardMinutes / originalHardMinutes;
            expect(hardMinutesRatio).toBeGreaterThan(0.5);
            expect(hardMinutesRatio).toBeLessThan(1.5);
        });

        it('should apply guardrails and filter unsafe options', async () => {
            mockGuardrailManager.validateWorkout
                .mockResolvedValueOnce({
                    isAllowed: false,
                    warnings: ['Weekly load cap exceeded']
                })
                .mockResolvedValue({
                    isAllowed: true,
                    warnings: []
                });

            mockWorkoutCatalog.getWorkoutsByModality.mockResolvedValue([
                {
                    template_id: 'cycle_high_load',
                    name: 'High Load Cycling',
                    modality: 'cycling',
                    adaptation: 'aerobic_base',
                    time_required: 60,
                    structure: [{ block_type: 'main', duration: 50, intensity: 'Z2' }]
                },
                {
                    template_id: 'cycle_moderate_load',
                    name: 'Moderate Load Cycling',
                    modality: 'cycling',
                    adaptation: 'aerobic_base',
                    time_required: 45,
                    structure: [{ block_type: 'main', duration: 35, intensity: 'Z2' }]
                }
            ]);

            const plannedSession = {
                modality: 'running',
                duration_minutes: 40,
                intensity: 'Z2',
                adaptation: 'aerobic_base'
            };

            const userContext = {
                equipment: ['bike'],
                recent_sessions: []
            };

            const substitutions = await substitutionEngine.suggest_substitutions(
                plannedSession,
                'cycling',
                userContext
            );

            expect(substitutions).toHaveLength(1);
            expect(substitutions[0].template_id).toBe('cycle_moderate_load');
        });

        it('should return top 3 options ranked by quality', async () => {
            mockWorkoutCatalog.getWorkoutsByModality.mockResolvedValue([
                {
                    template_id: 'cycle_perfect_match',
                    name: 'Perfect Match',
                    modality: 'cycling',
                    adaptation: 'aerobic_base',
                    time_required: 50,
                    structure: [{ block_type: 'main', duration: 40, intensity: 'Z2' }]
                },
                {
                    template_id: 'cycle_good_match',
                    name: 'Good Match',
                    modality: 'cycling',
                    adaptation: 'endurance',
                    time_required: 55,
                    structure: [{ block_type: 'main', duration: 45, intensity: 'Z2' }]
                },
                {
                    template_id: 'cycle_okay_match',
                    name: 'Okay Match',
                    modality: 'cycling',
                    adaptation: 'recovery',
                    time_required: 45,
                    structure: [{ block_type: 'main', duration: 35, intensity: 'Z1' }]
                },
                {
                    template_id: 'cycle_poor_match',
                    name: 'Poor Match',
                    modality: 'cycling',
                    adaptation: 'power',
                    time_required: 30,
                    structure: [{ block_type: 'main', duration: 20, intensity: 'Z5' }]
                }
            ]);

            const plannedSession = {
                modality: 'running',
                duration_minutes: 45,
                intensity: 'Z2',
                adaptation: 'aerobic_base'
            };

            const userContext = {
                equipment: ['bike'],
                available_time: 90
            };

            const substitutions = await substitutionEngine.suggest_substitutions(
                plannedSession,
                'cycling',
                userContext
            );

            expect(substitutions).toHaveLength(3);

            expect(substitutions[0].quality_score).toBeGreaterThanOrEqual(substitutions[1].quality_score);
            expect(substitutions[1].quality_score).toBeGreaterThanOrEqual(substitutions[2].quality_score);

            expect(substitutions[0].template_id).toBe('cycle_perfect_match');
        });
    });

    describe('parsePlannedSession', () => {
        it('should parse structured session correctly', () => {
            const session = {
                modality: 'running',
                duration_minutes: 60,
                adaptation: 'lactate_threshold',
                structure: [
                    { block_type: 'warmup', duration: 15, intensity: 'Z1' },
                    { block_type: 'main', sets: 3, work_duration: 480, rest_duration: 180, intensity: 'Z3' },
                    { block_type: 'cooldown', duration: 15, intensity: 'Z1' }
                ]
            };

            const analysis = substitutionEngine.parsePlannedSession(session);

            expect(analysis.modality).toBe('running');
            expect(analysis.duration_minutes).toBe(60);
            expect(analysis.adaptation).toBe('lactate_threshold');
            expect(analysis.primary_zone).toBe('Z3');
            expect(analysis.zone_distribution.Z3).toBeCloseTo(24);
        });

        it('should parse simple intensity session', () => {
            const session = {
                modality: 'cycling',
                duration_minutes: 45,
                intensity: 'Z2',
                adaptation: 'aerobic_base'
            };

            const analysis = substitutionEngine.parsePlannedSession(session);

            expect(analysis.primary_zone).toBe('Z2');
            expect(analysis.zone_distribution.Z2).toBe(45);
            expect(analysis.intensity_profile).toBe('moderate');
        });
    });

    describe('scaleWorkoutForEquivalence', () => {
        it('should scale workout duration using time factors', () => {
            const candidate = {
                template_id: 'cycle_base',
                name: 'Base Cycling',
                time_required: 60,
                structure: [
                    { block_type: 'main', duration: 50, intensity: 'Z2' }
                ]
            };

            const sessionAnalysis = {
                primary_zone: 'Z2',
                adaptation: 'aerobic_base'
            };

            const scaled = substitutionEngine.scaleWorkoutForEquivalence(
                candidate,
                sessionAnalysis,
                100,
                'running',
                'cycling'
            );

            expect(scaled.scaling_factor).toBeCloseTo(1.33, 1);
            expect(scaled.scaled_duration).toBeGreaterThan(60);
            expect(scaled.scaled_duration).toBeLessThan(85);
        });

        it('should preserve interval structure when scaling', () => {
            const candidate = {
                template_id: 'cycle_intervals',
                name: 'Cycling Intervals',
                time_required: 45,
                structure: [
                    { block_type: 'warmup', duration: 10, intensity: 'Z1' },
                    { block_type: 'main', sets: 5, work_duration: 300, rest_duration: 180, intensity: 'Z3' },
                    { block_type: 'cooldown', duration: 10, intensity: 'Z1' }
                ]
            };

            const sessionAnalysis = {
                primary_zone: 'Z3',
                adaptation: 'lactate_threshold'
            };

            const scaled = substitutionEngine.scaleWorkoutForEquivalence(
                candidate,
                sessionAnalysis,
                120,
                'running',
                'cycling'
            );

            const mainBlock = scaled.scaled_structure.find(block => block.block_type === 'main');

            expect(mainBlock.sets).toBe(5);
            expect(mainBlock.work_duration).toBeGreaterThan(300);
            expect(scaled.is_substitution).toBe(true);
        });
    });

    describe('generateReasoning', () => {
        it('should generate clear reasoning for substitutions', () => {
            const originalSession = {
                modality: 'running',
                duration_minutes: 50,
                adaptation: 'aerobic_base'
            };

            const substitution = {
                modality: 'cycling',
                scaled_duration: 65,
                load_variance_percentage: 8,
                adaptation: 'aerobic_base',
                adaptation_match: 'exact',
                equipment_required: ['bike'],
                confidence_score: 0.88
            };

            const reasoning = substitutionEngine.generateReasoning(
                originalSession,
                substitution,
                100
            );

            expect(reasoning).toContain('30% longer duration');
            expect(reasoning).toContain('8% difference');
            expect(reasoning).toContain('Same training adaptation');
            expect(reasoning).toContain('bike');
            expect(reasoning).toContain('Good substitution');
        });
    });

    describe('Error Handling', () => {
        it('should handle no suitable workouts found', async () => {
            mockWorkoutCatalog.getWorkoutsByModality.mockResolvedValue([]);

            const plannedSession = {
                modality: 'running',
                duration_minutes: 50,
                adaptation: 'aerobic_base'
            };

            await expect(
                substitutionEngine.suggest_substitutions(plannedSession, 'cycling', {})
            ).rejects.toThrow('No suitable cycling workouts found');
        });

        it('should handle guardrails blocking all options', async () => {
            mockWorkoutCatalog.getWorkoutsByModality.mockResolvedValue([
                {
                    template_id: 'cycle_test',
                    name: 'Test Cycling',
                    modality: 'cycling',
                    adaptation: 'aerobic_base',
                    time_required: 60,
                    structure: [{ block_type: 'main', duration: 50, intensity: 'Z2' }]
                }
            ]);

            mockGuardrailManager.validateWorkout.mockResolvedValue({
                isAllowed: false,
                warnings: ['Exceeds weekly cap']
            });

            const plannedSession = {
                modality: 'running',
                duration_minutes: 50,
                adaptation: 'aerobic_base'
            };

            await expect(
                substitutionEngine.suggest_substitutions(plannedSession, 'cycling', {})
            ).rejects.toThrow('No substitutions pass safety guardrails');
        });
    });
});

describe('EquivalenceRules', () => {
    describe('getTimeFactor', () => {
        it('should return correct time factors for Run→Bike Z2', () => {
            const factor = EquivalenceRules.getTimeFactor('running', 'cycling', 'Z2');

            expect(factor).toBeCloseTo(1.33, 2);
            expect(Math.abs(factor - 1.3)).toBeLessThanOrEqual(0.05);
        });

        it('should return 1.0 for same modality', () => {
            const factor = EquivalenceRules.getTimeFactor('running', 'running', 'Z2');
            expect(factor).toBe(1.0);
        });

        it('should handle all zone combinations', () => {
            const zones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

            zones.forEach(zone => {
                const factor = EquivalenceRules.getTimeFactor('running', 'cycling', zone);
                expect(factor).toBeGreaterThan(0.5);
                expect(factor).toBeLessThan(2.0);
            });
        });
    });

    describe('checkAdaptationCompatibility', () => {
        it('should match exact adaptations', () => {
            const result = EquivalenceRules.checkAdaptationCompatibility(
                'aerobic_base',
                'aerobic_base'
            );

            expect(result.compatible).toBe(true);
            expect(result.match).toBe('exact');
            expect(result.confidence_bonus).toBe(0.10);
        });

        it('should match compatible adaptations', () => {
            const result = EquivalenceRules.checkAdaptationCompatibility(
                'aerobic_base',
                'endurance'
            );

            expect(result.compatible).toBe(true);
            expect(result.match).toBe('compatible');
            expect(result.confidence_bonus).toBe(0.05);
        });

        it('should reject incompatible adaptations', () => {
            const result = EquivalenceRules.checkAdaptationCompatibility(
                'aerobic_base',
                'neuromuscular_power'
            );

            expect(result.compatible).toBe(false);
            expect(result.match).toBe('incompatible');
            expect(result.confidence_bonus).toBe(-0.15);
        });
    });

    describe('validateDurationLimits', () => {
        it('should validate reasonable durations', () => {
            const z2Result = EquivalenceRules.validateDurationLimits('Z2', 45);
            const z4Result = EquivalenceRules.validateDurationLimits('Z4', 12);

            expect(z2Result.valid).toBe(true);
            expect(z4Result.valid).toBe(true);
        });

        it('should reject durations outside limits', () => {
            const tooShortZ2 = EquivalenceRules.validateDurationLimits('Z2', 5);
            const tooLongZ5 = EquivalenceRules.validateDurationLimits('Z5', 30);

            expect(tooShortZ2.valid).toBe(false);
            expect(tooLongZ5.valid).toBe(false);
            expect(tooShortZ2.reason).toContain('below minimum');
            expect(tooLongZ5.reason).toContain('exceeds maximum');
        });
    });
});
