/**
 * SubstitutionEngine Unit Tests
 * Tests for AI-powered workout substitution with load equivalence
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
    WorkoutCatalog: {
        getWorkoutsByModality: vi.fn((modality) => {
            if (modality === 'running') {
                return {
                    track: [
                        {
                            id: 'track_200m_repeats',
                            name: '12x200m Track Repeats',
                            structure: [
                                { type: 'warmup', duration: 900, intensity: 'Z1' },
                                { type: 'main', sets: 12, work: { duration: 60, intensity: 'Z4' }, rest: { duration: 90, intensity: 'Z1' } },
                                { type: 'cooldown', duration: 600, intensity: 'Z1' }
                            ],
                            adaptation: 'VO2 max, speed',
                            estimatedLoad: 85,
                            equipment: ['track']
                        }
                    ],
                    tempo: [
                        {
                            id: 'tempo_20min',
                            name: '20min Tempo Run',
                            structure: [
                                { type: 'warmup', duration: 900, intensity: 'Z1' },
                                { type: 'main', duration: 1200, intensity: 'Z3' },
                                { type: 'cooldown', duration: 600, intensity: 'Z1' }
                            ],
                            adaptation: 'Lactate threshold',
                            estimatedLoad: 75,
                            equipment: []
                        }
                    ]
                };
            } else if (modality === 'cycling') {
                return {
                    vo2: [
                        {
                            id: 'cycling_30_30',
                            name: '8x(30s on / 30s off)',
                            structure: [
                                { type: 'warmup', duration: 900, intensity: 'Z1' },
                                { type: 'main', sets: 8, work: { duration: 30, intensity: 'Z5' }, rest: { duration: 30, intensity: 'Z1' } },
                                { type: 'cooldown', duration: 900, intensity: 'Z1' }
                            ],
                            adaptation: 'VO2 max',
                            estimatedLoad: 85,
                            equipment: ['bike']
                        }
                    ],
                    endurance: [
                        {
                            id: 'cycling_z2_60min',
                            name: '60min Z2 Endurance',
                            structure: [
                                { type: 'warmup', duration: 600, intensity: 'Z1' },
                                { type: 'main', duration: 3000, intensity: 'Z2' },
                                { type: 'cooldown', duration: 600, intensity: 'Z1' }
                            ],
                            adaptation: 'Aerobic base',
                            estimatedLoad: 60,
                            equipment: ['bike']
                        }
                    ]
                };
            } else if (modality === 'swimming') {
                return {
                    vo2: [
                        {
                            id: 'swim_20x50_vo2',
                            name: '20x50m VO2 Set',
                            structure: [
                                { type: 'warmup', distance: 600, intensity: 'Z1' },
                                { type: 'main', sets: 20, work: { distance: 50, intensity: 'Z4-Z5' }, rest: { duration: 10 } },
                                { type: 'cooldown', distance: 400, intensity: 'Z1' }
                            ],
                            adaptation: 'VO2 max',
                            estimatedLoad: 85,
                            equipment: ['pool']
                        }
                    ]
                };
            }
            return {};
        })
    },
    LoadCalculator: {
        calculateSessionLoad: vi.fn((session) => ({
            total: session.estimatedLoad || 75,
            volume: 50,
            intensity: 25
        }))
    }
};

let SubstitutionEngine;

describe('SubstitutionEngine', () => {
    let engine;

    beforeEach(async () => {
        // Load SubstitutionEngine
        const module = await import('../../js/modules/ai/SubstitutionEngine.js');
        SubstitutionEngine = module.default || module.SubstitutionEngine || window.SubstitutionEngine?.constructor;
        
        // Create new instance for each test
        engine = new SubstitutionEngine();
    });

    describe('Initialization', () => {
        it('should initialize with workout catalog and load calculator', () => {
            expect(engine.workoutCatalog).toBeDefined();
            expect(engine.loadCalculator).toBeDefined();
            expect(engine.modalityFactors).toBeDefined();
            expect(engine.guardrails).toBeDefined();
        });

        it('should have time conversion factors for all modality pairs', () => {
            const factors = engine.modalityFactors.timeFactors;
            expect(factors.run_to_bike).toBeDefined();
            expect(factors.run_to_swim).toBeDefined();
            expect(factors.bike_to_run).toBeDefined();
            expect(factors.bike_to_swim).toBeDefined();
            expect(factors.swim_to_run).toBeDefined();
            expect(factors.swim_to_bike).toBeDefined();
        });

        it('should have zone adjustments for all zones', () => {
            const adjustments = engine.modalityFactors.zoneAdjustments;
            expect(adjustments.Z1).toBeDefined();
            expect(adjustments.Z2).toBeDefined();
            expect(adjustments.Z3).toBeDefined();
            expect(adjustments.Z4).toBeDefined();
            expect(adjustments.Z5).toBeDefined();
        });
    });

    describe('generateSubstitutions', () => {
        it('should return array of substitution options', async () => {
            const plannedWorkout = {
                id: 'track_200m_repeats',
                name: '12x200m Track Repeats',
                modality: 'running',
                structure: [
                    { type: 'warmup', duration: 900, intensity: 'Z1' },
                    { type: 'main', sets: 12, work: { duration: 60, intensity: 'Z4' }, rest: { duration: 90 } },
                    { type: 'cooldown', duration: 600, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, speed',
                estimatedLoad: 85,
                equipment: ['track']
            };

            const constraints = {
                equipment: ['bike', 'pool'],
                availableTime: 60
            };

            const substitutions = await engine.generateSubstitutions(plannedWorkout, constraints);

            expect(Array.isArray(substitutions)).toBe(true);
            expect(substitutions.length).toBeLessThanOrEqual(3);
        });

        it('should include load comparison in substitutions', async () => {
            const plannedWorkout = {
                id: 'tempo_20min',
                modality: 'running',
                structure: [
                    { type: 'main', duration: 1200, intensity: 'Z3' }
                ],
                adaptation: 'Lactate threshold',
                estimatedLoad: 75
            };

            const substitutions = await engine.generateSubstitutions(plannedWorkout, {
                equipment: ['bike']
            });

            if (substitutions.length > 0) {
                expect(substitutions[0]).toHaveProperty('loadComparison');
                expect(substitutions[0].loadComparison).toHaveProperty('original');
                expect(substitutions[0].loadComparison).toHaveProperty('substituted');
                expect(substitutions[0].loadComparison).toHaveProperty('variance');
            }
        });

        it('should include substitution reason', async () => {
            const plannedWorkout = {
                id: 'track_200m_repeats',
                modality: 'running',
                structure: [
                    { type: 'main', sets: 12, work: { duration: 60, intensity: 'Z4' } }
                ],
                adaptation: 'VO2 max',
                estimatedLoad: 85
            };

            const substitutions = await engine.generateSubstitutions(plannedWorkout, {
                equipment: ['bike']
            });

            if (substitutions.length > 0) {
                expect(substitutions[0]).toHaveProperty('substitutionReason');
                expect(typeof substitutions[0].substitutionReason).toBe('string');
            }
        });

        it('should return empty array for invalid input', async () => {
            const substitutions = await engine.generateSubstitutions(null, {});
            expect(Array.isArray(substitutions)).toBe(true);
            expect(substitutions.length).toBe(0);
        });
    });

    describe('calculateWorkoutLoad', () => {
        it('should calculate load for interval workout', () => {
            const workout = {
                structure: [
                    { type: 'main', sets: 8, work: { duration: 60, intensity: 'Z4' }, rest: { duration: 90 } }
                ]
            };

            const load = engine.calculateWorkoutLoad(workout);
            expect(typeof load).toBe('number');
            expect(load).toBeGreaterThan(0);
        });

        it('should calculate load for continuous workout', () => {
            const workout = {
                structure: [
                    { type: 'main', duration: 1200, intensity: 'Z3' }
                ]
            };

            const load = engine.calculateWorkoutLoad(workout);
            expect(typeof load).toBe('number');
            expect(load).toBeGreaterThan(0);
        });

        it('should use estimatedLoad if provided', () => {
            const workout = {
                estimatedLoad: 75
            };

            const load = engine.calculateWorkoutLoad(workout);
            expect(load).toBe(75);
        });

        it('should apply zone multipliers correctly', () => {
            const z1Workout = { structure: [{ type: 'main', duration: 600, intensity: 'Z1' }] };
            const z5Workout = { structure: [{ type: 'main', duration: 600, intensity: 'Z5' }] };

            const z1Load = engine.calculateWorkoutLoad(z1Workout);
            const z5Load = engine.calculateWorkoutLoad(z5Workout);

            expect(z5Load).toBeGreaterThan(z1Load);
        });
    });

    describe('scaleWorkoutForEquivalence', () => {
        it('should scale workout duration for different modality', () => {
            const originalWorkout = {
                modality: 'running',
                structure: [
                    { type: 'main', duration: 1200, intensity: 'Z3' }
                ]
            };

            const baseWorkout = {
                id: 'cycling_z2_60min',
                modality: 'cycling',
                structure: [
                    { type: 'main', duration: 3000, intensity: 'Z2' }
                ],
                estimatedLoad: 60
            };

            const scaled = engine.scaleWorkoutForEquivalence(
                baseWorkout,
                originalWorkout,
                'cycling',
                75
            );

            expect(scaled.modality).toBe('cycling');
            expect(scaled.isSubstitution).toBe(true);
        });

        it('should adjust interval sets for equivalence', () => {
            const originalWorkout = {
                modality: 'running',
                structure: [
                    { type: 'main', sets: 12, work: { duration: 60, intensity: 'Z4' } }
                ]
            };

            const baseWorkout = {
                modality: 'cycling',
                structure: [
                    { type: 'main', sets: 8, work: { duration: 30, intensity: 'Z5' } }
                ]
            };

            const scaled = engine.scaleWorkoutForEquivalence(
                baseWorkout,
                originalWorkout,
                'cycling',
                85
            );

            expect(scaled.structure).toBeDefined();
            expect(scaled.isSubstitution).toBe(true);
        });
    });

    describe('validateSubstitution', () => {
        it('should reject substitution without required equipment', () => {
            const substitution = {
                equipment: ['track'],
                timeRequired: 45,
                estimatedLoad: 75
            };

            const constraints = {
                equipment: ['bike'] // No track available
            };

            const isValid = engine.validateSubstitution(substitution, constraints);
            expect(isValid).toBe(false);
        });

        it('should reject substitution exceeding available time', () => {
            const substitution = {
                equipment: [],
                timeRequired: 120,
                estimatedLoad: 75
            };

            const constraints = {
                availableTime: 60
            };

            const isValid = engine.validateSubstitution(substitution, constraints);
            expect(isValid).toBe(false);
        });

        it('should reject substitution exceeding weekly hard minutes', () => {
            const substitution = {
                equipment: [],
                timeRequired: 45,
                structure: [
                    { type: 'main', sets: 20, work: { duration: 60, intensity: 'Z5' } }
                ]
            };

            const constraints = {
                recentSessions: [
                    { date: new Date(), hardMinutes: 35 }
                ]
            };

            const isValid = engine.validateSubstitution(substitution, constraints);
            expect(isValid).toBe(false);
        });

        it('should accept valid substitution', () => {
            const substitution = {
                equipment: [],
                timeRequired: 45,
                estimatedLoad: 75,
                structure: [
                    { type: 'main', duration: 1200, intensity: 'Z2' }
                ]
            };

            const constraints = {
                equipment: [],
                availableTime: 60,
                recentSessions: [],
                todayLoad: 0
            };

            const isValid = engine.validateSubstitution(substitution, constraints);
            expect(isValid).toBe(true);
        });
    });

    describe('isCompatibleAdaptation', () => {
        it('should recognize compatible aerobic adaptations', () => {
            expect(engine.isCompatibleAdaptation('aerobic base', 'aerobic capacity')).toBe(true);
            expect(engine.isCompatibleAdaptation('endurance', 'aerobic')).toBe(true);
        });

        it('should recognize compatible threshold adaptations', () => {
            expect(engine.isCompatibleAdaptation('lactate threshold', 'tempo')).toBe(true);
        });

        it('should recognize compatible VO2 adaptations', () => {
            expect(engine.isCompatibleAdaptation('VO2 max', 'speed')).toBe(true);
        });

        it('should reject incompatible adaptations', () => {
            expect(engine.isCompatibleAdaptation('aerobic base', 'VO2 max')).toBe(false);
            expect(engine.isCompatibleAdaptation('threshold', 'power')).toBe(false);
        });
    });

    describe('calculateHardMinutes', () => {
        it('should count Z4 and Z5 minutes as hard', () => {
            const workout = {
                structure: [
                    { type: 'main', sets: 8, work: { duration: 60, intensity: 'Z4' } },
                    { type: 'main', duration: 600, intensity: 'Z5' }
                ]
            };

            const hardMinutes = engine.calculateHardMinutes(workout);
            expect(hardMinutes).toBeGreaterThan(0);
        });

        it('should not count Z1-Z3 as hard', () => {
            const workout = {
                structure: [
                    { type: 'main', duration: 1800, intensity: 'Z2' },
                    { type: 'main', duration: 1200, intensity: 'Z3' }
                ]
            };

            const hardMinutes = engine.calculateHardMinutes(workout);
            expect(hardMinutes).toBe(0);
        });
    });

    describe('calculateLoadVariance', () => {
        it('should calculate variance as decimal', () => {
            const variance = engine.calculateLoadVariance(100, 85);
            expect(variance).toBe(0.15);
        });

        it('should handle zero original load', () => {
            const variance = engine.calculateLoadVariance(0, 50);
            expect(variance).toBe(1);
        });
    });

    describe('generateReason', () => {
        it('should generate equipment-based reason', () => {
            const original = {
                equipment: ['track'],
                adaptation: 'VO2 max',
                estimatedLoad: 85
            };

            const substitution = {
                equipment: ['bike'],
                adaptation: 'VO2 max',
                estimatedLoad: 85
            };

            const reason = engine.generateReason(original, substitution);
            expect(typeof reason).toBe('string');
            expect(reason.length).toBeGreaterThan(0);
        });

        it('should include load comparison in reason', () => {
            const original = {
                adaptation: 'threshold',
                estimatedLoad: 75
            };

            const substitution = {
                adaptation: 'threshold',
                estimatedLoad: 80
            };

            const reason = engine.generateReason(original, substitution);
            expect(reason).toContain('load');
        });
    });

    describe('getAvailableModalities', () => {
        it('should return all modalities with no constraints', () => {
            const modalities = engine.getAvailableModalities({});
            expect(modalities).toContain('running');
            expect(modalities).toContain('cycling');
            expect(modalities).toContain('swimming');
        });

        it('should filter based on equipment', () => {
            const constraints = {
                equipment: ['bike']
            };

            const modalities = engine.getAvailableModalities(constraints);
            expect(modalities).toContain('running'); // Always available
            expect(modalities).toContain('cycling'); // Has bike
            expect(modalities).not.toContain('swimming'); // No pool
        });
    });

    describe('detectModality', () => {
        it('should detect modality from equipment', () => {
            const workout = {
                equipment: ['pool']
            };

            expect(engine.detectModality(workout)).toBe('swimming');
        });

        it('should detect modality from name', () => {
            const workout = {
                name: 'Cycling VO2 Intervals'
            };

            expect(engine.detectModality(workout)).toBe('cycling');
        });

        it('should use explicit modality if provided', () => {
            const workout = {
                modality: 'running',
                name: 'Swim Session'
            };

            expect(engine.detectModality(workout)).toBe('running');
        });
    });

    describe('extractWorkTime', () => {
        it('should extract work time from interval workout', () => {
            const workout = {
                structure: [
                    { type: 'main', sets: 10, work: { duration: 60 } }
                ]
            };

            const workTime = engine.extractWorkTime(workout);
            expect(workTime).toBe(600); // 10 sets * 60 seconds
        });

        it('should extract work time from continuous workout', () => {
            const workout = {
                structure: [
                    { type: 'main', duration: 1800 }
                ]
            };

            const workTime = engine.extractWorkTime(workout);
            expect(workTime).toBe(1800);
        });
    });
});

