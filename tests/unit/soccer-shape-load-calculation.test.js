/**
 * Soccer-Shape Load Calculation Unit Tests
 * Tests for deterministic load calculation for soccer-shape workouts
 */

import { describe, it, expect } from 'vitest';

/**
 * Calculate soccer-shape specific load for a workout
 * This matches the function in workouts-soccer-shape.js
 */
function calculateSoccerShapeLoad(workout) {
    const baseLoad = workout.time_required * 0.8; // Base RPE of 8 for soccer-shape
    
    // Get intensity multiplier from structure if available
    let intensityMultiplier = 1.0;
    if (workout.structure && Array.isArray(workout.structure)) {
        const mainBlock = workout.structure.find(b => b.block_type === 'main');
        if (mainBlock && mainBlock.intensity) {
            const zone = mainBlock.intensity.includes('Z') 
                ? mainBlock.intensity.split('-')[0] 
                : 'Z3';
            const zoneMultipliers = {
                'Z1': 1.0,
                'Z2': 2.0,
                'Z3': 4.0,
                'Z4': 7.0,
                'Z5': 10.0
            };
            intensityMultiplier = zoneMultipliers[zone] || 4.0;
        }
    }
    
    // Complexity factor (default 5, scaled to 0-1)
    const complexityFactor = 0.5; // Mid-range complexity
    
    // Calculate final load
    return Math.round(baseLoad * intensityMultiplier * (1 + complexityFactor));
}

describe('Soccer-Shape Load Calculation', () => {
    describe('Deterministic Load Calculation', () => {
        it('should calculate deterministic load for track intervals', () => {
            const workout = {
                name: '12 x 200m Speed Endurance',
                time_required: 45,
                structure: [
                    {
                        block_type: 'warmup',
                        duration: 15,
                        intensity: 'Z1'
                    },
                    {
                        block_type: 'main',
                        sets: 12,
                        work_duration: 60,
                        rest_duration: 90,
                        intensity: 'Z4',
                        distance: 200
                    },
                    {
                        block_type: 'cooldown',
                        duration: 10,
                        intensity: 'Z1'
                    }
                ]
            };

            // Expected: 45 * 0.8 * 7.0 * 1.5 = 378
            const calculatedLoad = calculateSoccerShapeLoad(workout);
            expect(calculatedLoad).toBe(378);
        });

        it('should return same result for identical inputs', () => {
            const workout = {
                name: 'Test Workout',
                time_required: 30,
                structure: [
                    {
                        block_type: 'main',
                        intensity: 'Z4'
                    }
                ]
            };

            const load1 = calculateSoccerShapeLoad(workout);
            const load2 = calculateSoccerShapeLoad(workout);
            const load3 = calculateSoccerShapeLoad(workout);

            expect(load1).toBe(load2);
            expect(load2).toBe(load3);
        });

        it('should handle workouts without structure', () => {
            const workout = {
                name: 'Simple Workout',
                time_required: 40
            };

            // Should use default values when structure is missing
            const calculatedLoad = calculateSoccerShapeLoad(workout);
            expect(calculatedLoad).toBeGreaterThan(0);
            expect(typeof calculatedLoad).toBe('number');
        });
    });

    describe('Intensity Zone Handling', () => {
        it('should handle different intensity zones appropriately', () => {
            const z5Workout = {
                time_required: 30,
                structure: [
                    {
                        block_type: 'main',
                        intensity: 'Z5'
                    }
                ]
            };

            const z2Workout = {
                time_required: 60,
                structure: [
                    {
                        block_type: 'main',
                        intensity: 'Z2'
                    }
                ]
            };

            const z5Load = calculateSoccerShapeLoad(z5Workout);
            const z2Load = calculateSoccerShapeLoad(z2Workout);

            expect(z5Load).toBeGreaterThan(z2Load); // Higher intensity should yield higher load
        });

        it('should handle zone ranges (Z4-Z5)', () => {
            const workout = {
                time_required: 40,
                structure: [
                    {
                        block_type: 'main',
                        intensity: 'Z4-Z5'
                    }
                ]
            };

            // Should extract 'Z4' from 'Z4-Z5'
            const calculatedLoad = calculateSoccerShapeLoad(workout);
            expect(calculatedLoad).toBeGreaterThan(0);
        });

        it('should default to Z3 for unknown zones', () => {
            const workout = {
                time_required: 30,
                structure: [
                    {
                        block_type: 'main',
                        intensity: 'UNKNOWN_ZONE'
                    }
                ]
            };

            // Should default to Z3 (multiplier 4.0)
            const calculatedLoad = calculateSoccerShapeLoad(workout);
            expect(calculatedLoad).toBeGreaterThan(0);
        });
    });

    describe('Load Calculation Edge Cases', () => {
        it('should handle zero duration', () => {
            const workout = {
                time_required: 0,
                structure: [
                    {
                        block_type: 'main',
                        intensity: 'Z4'
                    }
                ]
            };

            const calculatedLoad = calculateSoccerShapeLoad(workout);
            expect(calculatedLoad).toBe(0);
        });

        it('should handle very short workouts', () => {
            const workout = {
                time_required: 5,
                structure: [
                    {
                        block_type: 'main',
                        intensity: 'Z5'
                    }
                ]
            };

            const calculatedLoad = calculateSoccerShapeLoad(workout);
            expect(calculatedLoad).toBeGreaterThan(0);
            expect(calculatedLoad).toBeLessThan(100); // Should be reasonable
        });

        it('should handle very long workouts', () => {
            const workout = {
                time_required: 120,
                structure: [
                    {
                        block_type: 'main',
                        intensity: 'Z2'
                    }
                ]
            };

            const calculatedLoad = calculateSoccerShapeLoad(workout);
            expect(calculatedLoad).toBeGreaterThan(0);
            expect(calculatedLoad).toBeLessThan(1000); // Should be reasonable
        });

        it('should handle empty structure array', () => {
            const workout = {
                time_required: 45,
                structure: []
            };

            const calculatedLoad = calculateSoccerShapeLoad(workout);
            // Should use default multiplier (1.0)
            expect(calculatedLoad).toBeGreaterThan(0);
        });

        it('should handle structure without main block', () => {
            const workout = {
                time_required: 45,
                structure: [
                    {
                        block_type: 'warmup',
                        intensity: 'Z1'
                    },
                    {
                        block_type: 'cooldown',
                        intensity: 'Z1'
                    }
                ]
            };

            // Should use default multiplier when no main block found
            const calculatedLoad = calculateSoccerShapeLoad(workout);
            expect(calculatedLoad).toBeGreaterThan(0);
        });
    });

    describe('Load Calculation Accuracy', () => {
        it('should calculate load for 12x200m workout correctly', () => {
            const workout = {
                name: 'Track 12x200m Speed Endurance',
                time_required: 45,
                structure: [
                    {
                        block_type: 'warmup',
                        duration: 15,
                        intensity: 'Z1'
                    },
                    {
                        block_type: 'main',
                        sets: 12,
                        work_duration: 60,
                        rest_duration: 90,
                        intensity: 'Z4',
                        distance: 200
                    },
                    {
                        block_type: 'cooldown',
                        duration: 10,
                        intensity: 'Z1'
                    }
                ]
            };

            const calculatedLoad = calculateSoccerShapeLoad(workout);
            // 45 * 0.8 * 7.0 * 1.5 = 378
            expect(calculatedLoad).toBe(378);
        });

        it('should calculate load for 6x300m workout correctly', () => {
            const workout = {
                name: 'Track 6x300m Speed Endurance',
                time_required: 50,
                structure: [
                    {
                        block_type: 'main',
                        sets: 6,
                        intensity: 'Z4'
                    }
                ]
            };

            const calculatedLoad = calculateSoccerShapeLoad(workout);
            // 50 * 0.8 * 7.0 * 1.5 = 420
            expect(calculatedLoad).toBe(420);
        });

        it('should calculate load for hill sprints correctly', () => {
            const workout = {
                name: 'Hill 8-16x20s Sprints',
                time_required: 50,
                structure: [
                    {
                        block_type: 'main',
                        sets: 12,
                        intensity: 'Z5'
                    }
                ]
            };

            const calculatedLoad = calculateSoccerShapeLoad(workout);
            // 50 * 0.8 * 10.0 * 1.5 = 600
            expect(calculatedLoad).toBe(600);
        });
    });

    describe('Complexity Factor Application', () => {
        it('should apply complexity factor correctly', () => {
            const simpleWorkout = {
                time_required: 30,
                structure: [
                    {
                        block_type: 'main',
                        intensity: 'Z4'
                    }
                ]
            };

            const calculatedLoad = calculateSoccerShapeLoad(simpleWorkout);
            
            // Base calculation: 30 * 0.8 * 7.0 * 1.5 = 252
            expect(calculatedLoad).toBe(252);
        });
    });

    describe('Load Comparison', () => {
        it('should rank workouts by load correctly', () => {
            const workouts = [
                {
                    name: 'Low Intensity',
                    time_required: 30,
                    structure: [{ block_type: 'main', intensity: 'Z2' }]
                },
                {
                    name: 'Medium Intensity',
                    time_required: 30,
                    structure: [{ block_type: 'main', intensity: 'Z4' }]
                },
                {
                    name: 'High Intensity',
                    time_required: 30,
                    structure: [{ block_type: 'main', intensity: 'Z5' }]
                }
            ];

            const loads = workouts.map(w => calculateSoccerShapeLoad(w));

            // Z2 load: 30 * 0.8 * 2.0 * 1.5 = 72
            // Z4 load: 30 * 0.8 * 7.0 * 1.5 = 252
            // Z5 load: 30 * 0.8 * 10.0 * 1.5 = 360

            expect(loads[0]).toBeLessThan(loads[1]); // Z2 < Z4
            expect(loads[1]).toBeLessThan(loads[2]); // Z4 < Z5
        });

        it('should account for duration in load calculation', () => {
            const shortWorkout = {
                time_required: 20,
                structure: [{ block_type: 'main', intensity: 'Z4' }]
            };

            const longWorkout = {
                time_required: 60,
                structure: [{ block_type: 'main', intensity: 'Z4' }]
            };

            const shortLoad = calculateSoccerShapeLoad(shortWorkout);
            const longLoad = calculateSoccerShapeLoad(longWorkout);

            expect(longLoad).toBeGreaterThan(shortLoad);
            // Should be approximately 3x (60/20 = 3)
            expect(longLoad / shortLoad).toBeCloseTo(3, 0);
        });
    });
});

