/**
 * TagManager Unit Tests
 * Tests for tag validation, intensity scoring, and filtering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import TagManager from '../../js/modules/workout/TagManager.js';

// Mock ExerciseDatabase
const mockExerciseDatabase = {
    getSoccerShapeTags: () => ({
        acceleration: {
            name: 'Acceleration',
            description: 'First 20m sprint speed and explosive starts',
            color: '#ff6b35',
            adaptations: ['rate_of_force_development', 'neural_drive', 'stride_frequency']
        },
        COD: {
            name: 'Change of Direction',
            description: 'Cutting, pivoting, and multi-directional speed',
            color: '#f7931e',
            adaptations: ['reactive_strength', 'proprioception', 'eccentric_strength']
        },
        VO2: {
            name: 'Aerobic Power',
            description: 'Maximal oxygen uptake and aerobic capacity',
            color: '#1e88e5',
            adaptations: ['cardiac_output', 'mitochondrial_density', 'oxygen_extraction']
        },
        anaerobic_capacity: {
            name: 'Anaerobic Capacity',
            description: 'Lactate tolerance and high-intensity repeat ability',
            color: '#e53935',
            adaptations: ['lactate_buffering', 'glycolytic_power', 'fatigue_resistance']
        },
        neuromotor: {
            name: 'Neuromotor',
            description: 'Coordination, timing, and movement efficiency',
            color: '#8e24aa',
            adaptations: ['motor_learning', 'coordination', 'movement_economy']
        }
    })
};

describe('TagManager', () => {
    let tagManager;

    beforeEach(() => {
        // Mock window.ExerciseDatabase
        window.ExerciseDatabase = mockExerciseDatabase;
        window.SafeLogger = console;

        tagManager = new TagManager();
    });

    describe('getAllTags', () => {
        it('should return base tags and soccer-shape tags', () => {
            const tags = tagManager.getAllTags();

            expect(tags).toHaveProperty('acceleration');
            expect(tags).toHaveProperty('COD');
            expect(tags).toHaveProperty('VO2');
            expect(tags).toHaveProperty('endurance');
            expect(tags).toHaveProperty('strength');
        });

        it('should include soccer-shape tag metadata', () => {
            const tags = tagManager.getAllTags();

            expect(tags.acceleration).toHaveProperty('name', 'Acceleration');
            expect(tags.acceleration).toHaveProperty('description');
            expect(tags.acceleration).toHaveProperty('color');
            expect(tags.acceleration).toHaveProperty('adaptations');
        });
    });

    describe('validateTagCombination', () => {
        it('should return valid for compatible tags', () => {
            const result = tagManager.validateTagCombination(['acceleration', 'COD']);
            expect(result.valid).toBe(true);
        });

        it('should return invalid for conflicting tags', () => {
            const result = tagManager.validateTagCombination(['acceleration', 'recovery']);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('conflicts');
            expect(result.conflictingTags).toContain('recovery');
        });

        it('should return invalid for acceleration and endurance conflict', () => {
            const result = tagManager.validateTagCombination(['acceleration', 'endurance']);
            expect(result.valid).toBe(false);
        });

        it('should return invalid for anaerobic_capacity and recovery conflict', () => {
            const result = tagManager.validateTagCombination(['anaerobic_capacity', 'recovery']);
            expect(result.valid).toBe(false);
        });

        it('should return valid for empty tag array', () => {
            const result = tagManager.validateTagCombination([]);
            expect(result.valid).toBe(true);
        });

        it('should return valid for single tag', () => {
            const result = tagManager.validateTagCombination(['acceleration']);
            expect(result.valid).toBe(true);
        });
    });

    describe('calculateTagIntensity', () => {
        it('should return high intensity for acceleration tag', () => {
            const intensity = tagManager.calculateTagIntensity(['acceleration']);
            expect(intensity).toBe(9);
        });

        it('should return high intensity for anaerobic_capacity tag', () => {
            const intensity = tagManager.calculateTagIntensity(['anaerobic_capacity']);
            expect(intensity).toBe(8);
        });

        it('should return moderate intensity for COD tag', () => {
            const intensity = tagManager.calculateTagIntensity(['COD']);
            expect(intensity).toBe(7);
        });

        it('should return low intensity for recovery tag', () => {
            const intensity = tagManager.calculateTagIntensity(['recovery']);
            expect(intensity).toBe(2);
        });

        it('should return maximum intensity from multiple tags', () => {
            const intensity = tagManager.calculateTagIntensity(['recovery', 'acceleration', 'endurance']);
            expect(intensity).toBe(9); // Should be max of [2, 9, 4]
        });

        it('should return default intensity for empty tags', () => {
            const intensity = tagManager.calculateTagIntensity([]);
            expect(intensity).toBe(5);
        });

        it('should return default intensity for unknown tags', () => {
            const intensity = tagManager.calculateTagIntensity(['unknown_tag']);
            expect(intensity).toBe(5);
        });
    });

    describe('getTagsByIntensity', () => {
        it('should return high intensity tags', () => {
            const tags = tagManager.getTagsByIntensity('high');
            expect(tags).toContain('acceleration');
            expect(tags).toContain('anaerobic_capacity');
            expect(tags).toContain('VO2');
        });

        it('should return moderate intensity tags', () => {
            const tags = tagManager.getTagsByIntensity('moderate');
            expect(tags).toContain('COD');
            expect(tags).toContain('strength');
        });

        it('should return low intensity tags', () => {
            const tags = tagManager.getTagsByIntensity('low');
            expect(tags).toContain('endurance');
            expect(tags).toContain('recovery');
        });
    });

    describe('filterWorkoutsByTags', () => {
        const workouts = [
            { id: 1, tags: ['acceleration', 'COD'], name: 'Sprint Shuttles' },
            { id: 2, tags: ['endurance', 'recovery'], name: 'Easy Run' },
            { id: 3, tags: ['VO2', 'anaerobic_capacity'], name: 'Track Intervals' },
            { id: 4, tags: ['acceleration'], name: 'Sprint Starts' },
            { id: 5, tags: ['neuromotor', 'COD'], name: 'Agility Drills' }
        ];

        it('should filter by required tags', () => {
            const filtered = tagManager.filterWorkoutsByTags(workouts, {
                requiredTags: ['acceleration']
            });
            expect(filtered).toHaveLength(2);
            expect(filtered.map(w => w.id)).toEqual([1, 4]);
        });

        it('should filter by excluded tags', () => {
            const filtered = tagManager.filterWorkoutsByTags(workouts, {
                excludedTags: ['recovery']
            });
            expect(filtered).toHaveLength(4);
            expect(filtered.map(w => w.id)).toEqual([1, 3, 4, 5]);
        });

        it('should filter by intensity range', () => {
            const filtered = tagManager.filterWorkoutsByTags(workouts, {
                minIntensity: 8,
                maxIntensity: 10
            });
            expect(filtered).toHaveLength(1); // Only VO2/anaerobic_capacity workout
            expect(filtered[0].id).toBe(3);
        });

        it('should combine required and excluded tags', () => {
            const filtered = tagManager.filterWorkoutsByTags(workouts, {
                requiredTags: ['acceleration'],
                excludedTags: ['recovery']
            });
            expect(filtered).toHaveLength(2);
            expect(filtered.map(w => w.id)).toEqual([1, 4]);
        });

        it('should return all workouts when no filters applied', () => {
            const filtered = tagManager.filterWorkoutsByTags(workouts, {});
            expect(filtered).toHaveLength(5);
        });
    });

    describe('getTagsForPhase', () => {
        it('should return base phase tags', () => {
            const tags = tagManager.getTagsForPhase('base');
            expect(tags).toContain('aerobic_base');
            expect(tags).toContain('endurance');
            expect(tags).toContain('strength');
        });

        it('should return build phase tags', () => {
            const tags = tagManager.getTagsForPhase('build');
            expect(tags).toContain('VO2');
            expect(tags).toContain('anaerobic_capacity');
        });

        it('should return peak phase tags', () => {
            const tags = tagManager.getTagsForPhase('peak');
            expect(tags).toContain('acceleration');
            expect(tags).toContain('COD');
            expect(tags).toContain('neuromotor');
        });

        it('should return recovery phase tags', () => {
            const tags = tagManager.getTagsForPhase('recovery');
            expect(tags).toContain('recovery');
            expect(tags).toContain('aerobic_base');
        });

        it('should return empty array for unknown phase', () => {
            const tags = tagManager.getTagsForPhase('unknown');
            expect(tags).toEqual([]);
        });
    });

    describe('getComplementaryTags', () => {
        it('should return complementary tags for acceleration', () => {
            const complementary = tagManager.getComplementaryTags(['acceleration']);
            expect(complementary).toContain('COD');
            expect(complementary).toContain('neuromotor');
        });

        it('should return complementary tags for COD', () => {
            const complementary = tagManager.getComplementaryTags(['COD']);
            expect(complementary).toContain('acceleration');
            expect(complementary).toContain('neuromotor');
        });

        it('should not include base tags in complementary', () => {
            const complementary = tagManager.getComplementaryTags(['acceleration', 'COD']);
            expect(complementary).not.toContain('acceleration');
            expect(complementary).not.toContain('COD');
        });

        it('should return empty array for tags with no complements', () => {
            const complementary = tagManager.getComplementaryTags(['unknown_tag']);
            expect(complementary).toEqual([]);
        });
    });

    describe('validateWorkoutTags', () => {
        it('should validate workout with compatible tags', () => {
            const workout = { tags: ['acceleration', 'COD'] };
            const result = tagManager.validateWorkoutTags(workout);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should invalidate workout with conflicting tags', () => {
            const workout = { tags: ['acceleration', 'recovery'] };
            const result = tagManager.validateWorkoutTags(workout);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should warn about high intensity workouts without recovery', () => {
            const workout = { tags: ['acceleration', 'anaerobic_capacity'] };
            const result = tagManager.validateWorkoutTags(workout);
            expect(result.valid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('should calculate intensity for workout', () => {
            const workout = { tags: ['acceleration', 'COD'] };
            const result = tagManager.validateWorkoutTags(workout);
            expect(result.intensity).toBe(9); // Max of acceleration (9) and COD (7)
        });

        it('should provide recommendations', () => {
            const workout = { tags: ['acceleration'] };
            const result = tagManager.validateWorkoutTags(workout);
            expect(result.recommendations).toContain('COD');
            expect(result.recommendations).toContain('neuromotor');
        });
    });

    describe('getTagStatistics', () => {
        const workouts = [
            { tags: ['acceleration', 'COD'] },
            { tags: ['acceleration'] },
            { tags: ['VO2', 'anaerobic_capacity'] },
            { tags: ['COD', 'neuromotor'] },
            { tags: ['endurance'] }
        ];

        it('should calculate tag statistics', () => {
            const stats = tagManager.getTagStatistics(workouts);

            expect(stats.totalWorkouts).toBe(5);
            expect(stats.uniqueTags).toBeGreaterThan(0);
            expect(stats.tagStats).toBeDefined();
            expect(stats.mostCommonTags).toBeDefined();
        });

        it('should identify most common tags', () => {
            const stats = tagManager.getTagStatistics(workouts);
            expect(stats.mostCommonTags.length).toBeGreaterThan(0);
            expect(stats.mostCommonTags.length).toBeLessThanOrEqual(5);
        });

        it('should calculate tag frequency', () => {
            const stats = tagManager.getTagStatistics(workouts);
            const accelerationStat = stats.tagStats.find(s => s.tag === 'acceleration');
            expect(accelerationStat).toBeDefined();
            expect(accelerationStat.frequency).toBeGreaterThan(0);
            expect(accelerationStat.frequency).toBeLessThanOrEqual(1);
        });

        it('should calculate average intensity per tag', () => {
            const stats = tagManager.getTagStatistics(workouts);
            const accelerationStat = stats.tagStats.find(s => s.tag === 'acceleration');
            expect(accelerationStat.avgIntensity).toBe(9);
        });
    });

    describe('Soccer-shape tag integration', () => {
        it('should include soccer-shape tags in getAllTags', () => {
            const tags = tagManager.getAllTags();
            expect(tags).toHaveProperty('acceleration');
            expect(tags).toHaveProperty('COD');
            expect(tags).toHaveProperty('VO2');
            expect(tags).toHaveProperty('anaerobic_capacity');
            expect(tags).toHaveProperty('neuromotor');
        });

        it('should validate soccer-shape tag combinations', () => {
            const result = tagManager.validateTagCombination(['acceleration', 'COD', 'neuromotor']);
            expect(result.valid).toBe(true);
        });

        it('should calculate intensity for soccer-shape tags', () => {
            const intensity = tagManager.calculateTagIntensity(['acceleration', 'COD', 'VO2']);
            expect(intensity).toBe(9); // Max of [9, 7, 8]
        });
    });
});

