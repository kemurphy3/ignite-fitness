/**
 * WorkoutCatalog Unit Tests
 * Tests for comprehensive multi-sport workout catalog
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window objects
global.window = {
    SafeLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
};

// Note: WorkoutCatalog is instantiated globally
let WorkoutCatalog;

describe('WorkoutCatalog', () => {
    let catalog;

    beforeEach(async () => {
        // Load WorkoutCatalog
        const module = await import('../../js/modules/sports/WorkoutCatalog.js');
        WorkoutCatalog = module.default || module.WorkoutCatalog || window.WorkoutCatalog?.constructor;
        
        // Create new instance for each test
        catalog = new WorkoutCatalog();
    });

    describe('Initialization', () => {
        it('should initialize with all workout modalities', () => {
            expect(catalog.workouts).toBeDefined();
            expect(catalog.workouts.running).toBeDefined();
            expect(catalog.workouts.cycling).toBeDefined();
            expect(catalog.workouts.swimming).toBeDefined();
        });

        it('should have minimum 50 workouts total', () => {
            const total = catalog.getTotalWorkoutCount();
            expect(total).toBeGreaterThanOrEqual(50);
        });

        it('should have workouts in all required categories', () => {
            expect(catalog.workouts.running.track.length).toBeGreaterThan(0);
            expect(catalog.workouts.running.tempo.length).toBeGreaterThan(0);
            expect(catalog.workouts.running.hills.length).toBeGreaterThan(0);
            expect(catalog.workouts.running.soccer.length).toBeGreaterThan(0);
            
            expect(catalog.workouts.cycling.endurance.length).toBeGreaterThan(0);
            expect(catalog.workouts.cycling.tempo.length).toBeGreaterThan(0);
            expect(catalog.workouts.cycling.vo2.length).toBeGreaterThan(0);
            expect(catalog.workouts.cycling.cadence.length).toBeGreaterThan(0);
            
            expect(catalog.workouts.swimming.aerobic.length).toBeGreaterThan(0);
            expect(catalog.workouts.swimming.threshold.length).toBeGreaterThan(0);
            expect(catalog.workouts.swimming.vo2.length).toBeGreaterThan(0);
        });
    });

    describe('Workout Structure', () => {
        it('should have valid workout structure for all workouts', () => {
            const allWorkouts = [];
            
            for (const modality of Object.keys(catalog.workouts)) {
                for (const category of Object.keys(catalog.workouts[modality])) {
                    catalog.workouts[modality][category].forEach(workout => {
                        allWorkouts.push(workout);
                    });
                }
            }

            allWorkouts.forEach(workout => {
                expect(workout.id).toBeDefined();
                expect(workout.name).toBeDefined();
                expect(workout.structure).toBeDefined();
                expect(Array.isArray(workout.structure)).toBe(true);
                expect(workout.adaptation).toBeDefined();
                expect(workout.estimatedLoad).toBeDefined();
                expect(typeof workout.estimatedLoad).toBe('number');
                expect(workout.equipment).toBeDefined();
                expect(Array.isArray(workout.equipment)).toBe(true);
                
                if (workout.timeRequired) {
                    expect(typeof workout.timeRequired).toBe('number');
                }
            });
        });

        it('should have valid intensity zones (Z1-Z5)', () => {
            const allWorkouts = [];
            
            for (const modality of Object.keys(catalog.workouts)) {
                for (const category of Object.keys(catalog.workouts[modality])) {
                    catalog.workouts[modality][category].forEach(workout => {
                        allWorkouts.push(workout);
                    });
                }
            }

            const validZones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
            const zonePattern = /Z[1-5](-Z[1-5])?/;

            allWorkouts.forEach(workout => {
                workout.structure.forEach(segment => {
                    if (segment.intensity) {
                        expect(zonePattern.test(segment.intensity)).toBe(true);
                    }
                    if (segment.work?.intensity) {
                        expect(zonePattern.test(segment.work.intensity)).toBe(true);
                    }
                });
            });
        });
    });

    describe('getWorkoutsByModality', () => {
        it('should return workouts for running', () => {
            const running = catalog.getWorkoutsByModality('running');
            expect(running).toBeDefined();
            expect(running.track).toBeDefined();
            expect(running.tempo).toBeDefined();
            expect(running.hills).toBeDefined();
            expect(running.soccer).toBeDefined();
        });

        it('should return workouts for cycling', () => {
            const cycling = catalog.getWorkoutsByModality('cycling');
            expect(cycling).toBeDefined();
            expect(cycling.endurance).toBeDefined();
            expect(cycling.tempo).toBeDefined();
            expect(cycling.vo2).toBeDefined();
            expect(cycling.cadence).toBeDefined();
        });

        it('should return workouts for swimming', () => {
            const swimming = catalog.getWorkoutsByModality('swimming');
            expect(swimming).toBeDefined();
            expect(swimming.aerobic).toBeDefined();
            expect(swimming.threshold).toBeDefined();
            expect(swimming.vo2).toBeDefined();
        });

        it('should return empty object for invalid modality', () => {
            const result = catalog.getWorkoutsByModality('invalid');
            expect(result).toEqual({});
        });
    });

    describe('getWorkoutById', () => {
        it('should return workout by ID', () => {
            const workout = catalog.getWorkoutById('track_200m_repeats');
            expect(workout).toBeDefined();
            expect(workout.id).toBe('track_200m_repeats');
            expect(workout.name).toBe('12x200m Track Repeats');
            expect(workout.modality).toBe('running');
            expect(workout.category).toBe('track');
        });

        it('should return workout for cycling', () => {
            const workout = catalog.getWorkoutById('cycling_z2_60min');
            expect(workout).toBeDefined();
            expect(workout.modality).toBe('cycling');
            expect(workout.category).toBe('endurance');
        });

        it('should return workout for swimming', () => {
            const workout = catalog.getWorkoutById('swim_3000_aerobic');
            expect(workout).toBeDefined();
            expect(workout.modality).toBe('swimming');
            expect(workout.category).toBe('aerobic');
        });

        it('should return null for invalid ID', () => {
            const workout = catalog.getWorkoutById('invalid_id');
            expect(workout).toBeNull();
        });
    });

    describe('getWorkoutsByAdaptation', () => {
        it('should return VO2 max workouts', () => {
            const workouts = catalog.getWorkoutsByAdaptation('VO2 max');
            expect(Array.isArray(workouts)).toBe(true);
            expect(workouts.length).toBeGreaterThan(0);
            
            workouts.forEach(workout => {
                expect(workout.adaptation.toLowerCase()).toContain('vo2');
            });
        });

        it('should return threshold workouts', () => {
            const workouts = catalog.getWorkoutsByAdaptation('threshold');
            expect(Array.isArray(workouts)).toBe(true);
            expect(workouts.length).toBeGreaterThan(0);
            
            workouts.forEach(workout => {
                expect(workout.adaptation.toLowerCase()).toContain('threshold');
            });
        });

        it('should return aerobic workouts', () => {
            const workouts = catalog.getWorkoutsByAdaptation('aerobic');
            expect(Array.isArray(workouts)).toBe(true);
            expect(workouts.length).toBeGreaterThan(0);
        });

        it('should return empty array for invalid adaptation', () => {
            const workouts = catalog.getWorkoutsByAdaptation('invalid_adaptation');
            expect(Array.isArray(workouts)).toBe(true);
        });
    });

    describe('getWorkoutsByEquipment', () => {
        it('should return track workouts', () => {
            const workouts = catalog.getWorkoutsByEquipment('track');
            expect(Array.isArray(workouts)).toBe(true);
            expect(workouts.length).toBeGreaterThan(0);
            
            workouts.forEach(workout => {
                expect(workout.equipment.some(eq => eq.toLowerCase().includes('track'))).toBe(true);
            });
        });

        it('should return pool workouts', () => {
            const workouts = catalog.getWorkoutsByEquipment('pool');
            expect(Array.isArray(workouts)).toBe(true);
            expect(workouts.length).toBeGreaterThan(0);
        });

        it('should return bike workouts', () => {
            const workouts = catalog.getWorkoutsByEquipment('bike');
            expect(Array.isArray(workouts)).toBe(true);
            expect(workouts.length).toBeGreaterThan(0);
        });

        it('should return empty array for invalid equipment', () => {
            const workouts = catalog.getWorkoutsByEquipment('invalid_equipment');
            expect(Array.isArray(workouts)).toBe(true);
        });
    });

    describe('getTotalWorkoutCount', () => {
        it('should return total workout count', () => {
            const count = catalog.getTotalWorkoutCount();
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(50);
        });

        it('should match sum of all categories', () => {
            const total = catalog.getTotalWorkoutCount();
            const counts = catalog.getWorkoutCounts();
            const sum = Object.values(counts).reduce((a, b) => a + b, 0);
            expect(total).toBe(sum);
        });
    });

    describe('getWorkoutCounts', () => {
        it('should return counts for all modalities', () => {
            const counts = catalog.getWorkoutCounts();
            expect(counts.running).toBeGreaterThan(0);
            expect(counts.cycling).toBeGreaterThan(0);
            expect(counts.swimming).toBeGreaterThan(0);
        });

        it('should match actual workout counts', () => {
            const counts = catalog.getWorkoutCounts();
            
            const runningCount = catalog.workouts.running.track.length +
                                 catalog.workouts.running.tempo.length +
                                 catalog.workouts.running.hills.length +
                                 catalog.workouts.running.soccer.length;
            expect(counts.running).toBe(runningCount);
        });
    });

    describe('Running Workouts', () => {
        it('should have 10 track workouts', () => {
            expect(catalog.workouts.running.track.length).toBe(10);
        });

        it('should have 5 tempo workouts', () => {
            expect(catalog.workouts.running.tempo.length).toBe(5);
        });

        it('should have 5 hill workouts', () => {
            expect(catalog.workouts.running.hills.length).toBe(5);
        });

        it('should have 7 soccer workouts', () => {
            expect(catalog.workouts.running.soccer.length).toBe(7);
        });
    });

    describe('Cycling Workouts', () => {
        it('should have 5 endurance workouts', () => {
            expect(catalog.workouts.cycling.endurance.length).toBe(5);
        });

        it('should have 5 tempo workouts', () => {
            expect(catalog.workouts.cycling.tempo.length).toBe(5);
        });

        it('should have 5 VO2 workouts', () => {
            expect(catalog.workouts.cycling.vo2.length).toBe(5);
        });

        it('should have 4 cadence workouts', () => {
            expect(catalog.workouts.cycling.cadence.length).toBe(4);
        });
    });

    describe('Swimming Workouts', () => {
        it('should have 5 aerobic workouts', () => {
            expect(catalog.workouts.swimming.aerobic.length).toBe(5);
        });

        it('should have 5 threshold workouts', () => {
            expect(catalog.workouts.swimming.threshold.length).toBe(5);
        });

        it('should have 5 VO2 workouts', () => {
            expect(catalog.workouts.swimming.vo2.length).toBe(5);
        });
    });

    describe('Workout Structure Validation', () => {
        it('should have warmup in structure', () => {
            const workout = catalog.getWorkoutById('track_200m_repeats');
            const hasWarmup = workout.structure.some(s => s.type === 'warmup');
            expect(hasWarmup).toBe(true);
        });

        it('should have main work in structure', () => {
            const workout = catalog.getWorkoutById('cycling_3x8_tempo');
            const hasMain = workout.structure.some(s => s.type === 'main');
            expect(hasMain).toBe(true);
        });

        it('should have cooldown in structure', () => {
            const workout = catalog.getWorkoutById('swim_3000_aerobic');
            const hasCooldown = workout.structure.some(s => s.type === 'cooldown');
            expect(hasCooldown).toBe(true);
        });
    });
});

