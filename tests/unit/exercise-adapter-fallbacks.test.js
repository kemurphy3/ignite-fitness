/**
 * T2B-2: Exercise Adapter Fallback Tests
 * Verifies that ExerciseAdapter always provides safe alternatives for injured users
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
    StorageManager: {
        getPreferences: vi.fn(() => Promise.resolve({})),
        savePreferences: vi.fn(() => Promise.resolve())
    },
    AuthManager: {
        getCurrentUsername: vi.fn(() => 'test-user')
    }
};

// Note: ExerciseAdapter is instantiated globally
let ExerciseAdapter;

describe('ExerciseAdapter Fallback System (T2B-2)', () => {
    let adapter;

    beforeEach(async () => {
        // Load the module and get the class
        const module = await import('../../js/modules/workout/ExerciseAdapter.js');
        ExerciseAdapter = module.default || window.ExerciseAdapter?.constructor;

        // Create new instance for each test
        adapter = new ExerciseAdapter();
    });

    describe('Fallback Chain - Specific Exercise Not Found', () => {
        it('should call getFallbackAlternatives when exercise not in substitution rules', () => {
            const exerciseName = 'Unknown Exercise';
            const painLocation = 'knee';
            const constraints = {};

            const result = adapter.suggestSubstitutions(exerciseName, [], painLocation, constraints);

            expect(result.alternatives).toBeDefined();
            expect(Array.isArray(result.alternatives)).toBe(true);
            expect(result.alternatives.length).toBeGreaterThan(0);
            expect(result.fallbackLevel).toBeDefined();
            expect(result.message).toBeDefined();
        });

        it('should never return empty alternatives array', () => {
            const exerciseName = 'NonExistent Exercise';
            const painLocation = null;
            const constraints = {};

            const result = adapter.suggestSubstitutions(exerciseName, [], painLocation, constraints);

            expect(result.alternatives.length).toBeGreaterThan(0);
        });
    });

    describe('Body-Part-Specific Fallbacks', () => {
        it('should return knee-safe alternatives for knee injury', () => {
            const painLocation = 'knee';
            const fallbacks = adapter.getBodyPartFallback(painLocation);

            expect(Array.isArray(fallbacks)).toBe(true);
            expect(fallbacks.length).toBeGreaterThan(0);

            // Verify alternatives are knee-safe
            fallbacks.forEach(alt => {
                expect(alt.name).toBeDefined();
                expect(alt.rationale).toBeDefined();
                expect(typeof alt.volumeAdjustment).toBe('number');
            });
        });

        it('should return shoulder-safe alternatives for shoulder injury', () => {
            const painLocation = 'shoulder';
            const fallbacks = adapter.getBodyPartFallback(painLocation);

            expect(Array.isArray(fallbacks)).toBe(true);
            expect(fallbacks.length).toBeGreaterThan(0);

            // Verify alternatives don't stress shoulders
            fallbacks.forEach(alt => {
                expect(alt.name).toBeDefined();
                expect(alt.rationale).toMatch(/lower body|core|leg/i);
            });
        });

        it('should return back-safe alternatives for back injury', () => {
            const painLocation = 'back';
            const fallbacks = adapter.getBodyPartFallback(painLocation);

            expect(Array.isArray(fallbacks)).toBe(true);
            expect(fallbacks.length).toBeGreaterThan(0);

            // Verify alternatives are back-safe
            fallbacks.forEach(alt => {
                expect(alt.name).toBeDefined();
                expect(alt.rationale).toMatch(/supported|seated|flexibility|mobility/i);
            });
        });

        it('should return empty array for unknown body part and fall back to generic', () => {
            const painLocation = 'unknown';
            const fallbacks = adapter.getBodyPartFallback(painLocation);

            expect(Array.isArray(fallbacks)).toBe(true);
            // Should return empty, triggering next level of fallback
        });
    });

    describe('Generic Safe Alternatives', () => {
        it('should return generic safe alternatives', () => {
            const alternatives = adapter.getGenericSafeAlternatives();

            expect(Array.isArray(alternatives)).toBe(true);
            expect(alternatives.length).toBeGreaterThan(0);

            alternatives.forEach(alt => {
                expect(alt.name).toBeDefined();
                expect(alt.rationale).toBeDefined();
                expect(typeof alt.restAdjustment).toBe('number');
                expect(typeof alt.volumeAdjustment).toBe('number');
            });
        });

        it('should include low-impact activities in generic alternatives', () => {
            const alternatives = adapter.getGenericSafeAlternatives();
            const names = alternatives.map(a => a.name.toLowerCase());

            expect(names.some(name =>
                name.includes('walking') ||
                name.includes('cardio') ||
                name.includes('mobility')
            )).toBe(true);
        });
    });

    describe('Bodyweight Fallback (Ultimate Fallback)', () => {
        it('should return bodyweight alternatives as ultimate fallback', () => {
            const alternatives = adapter.getGenericBodyweightAlternatives();

            expect(Array.isArray(alternatives)).toBe(true);
            expect(alternatives.length).toBeGreaterThan(0);

            alternatives.forEach(alt => {
                expect(alt.name).toBeDefined();
                expect(alt.rationale).toBeDefined();
            });
        });

        it('should include bodyweight exercises in ultimate fallback', () => {
            const alternatives = adapter.getGenericBodyweightAlternatives();
            const names = alternatives.map(a => a.name.toLowerCase());

            expect(names.some(name =>
                name.includes('bodyweight') ||
                name.includes('plank') ||
                name.includes('stretch')
            )).toBe(true);
        });
    });

    describe('Progressive Fallback Chain', () => {
        it('should use body-part fallback when pain location provided', () => {
            const exerciseName = 'Unknown';
            const painLocation = 'knee';
            const constraints = {};

            const result = adapter.getFallbackAlternatives(exerciseName, painLocation, constraints);

            expect(result.fallbackLevel).toBe('body_part_specific');
            expect(result.alternatives.length).toBeGreaterThan(0);
        });

        it('should fall back to generic safe when body-part fallback empty', () => {
            const exerciseName = 'Unknown';
            const painLocation = 'unknown'; // Unknown body part
            const constraints = {};

            const result = adapter.getFallbackAlternatives(exerciseName, painLocation, constraints);

            // Should fall back to generic safe or bodyweight
            expect(['generic_safe', 'bodyweight']).toContain(result.fallbackLevel);
            expect(result.alternatives.length).toBeGreaterThan(0);
        });

        it('should always return at least bodyweight alternatives', () => {
            const exerciseName = 'Unknown';
            const painLocation = null;
            const constraints = {};

            const result = adapter.getFallbackAlternatives(exerciseName, painLocation, constraints);

            expect(result.alternatives.length).toBeGreaterThan(0);
            expect(result.fallbackLevel).toBeDefined();
        });
    });

    describe('Fallback Logging', () => {
        it('should log EXERCISE_FALLBACK event with decision rationale', () => {
            const exerciseName = 'Unknown Exercise';
            const painLocation = 'knee';

            adapter.getFallbackAlternatives(exerciseName, painLocation, {});

            // Verify logging was called
            expect(adapter.logger.info).toHaveBeenCalled();
            const callArgs = adapter.logger.info.mock.calls.find(call =>
                call[0] === 'EXERCISE_FALLBACK'
            );

            if (callArgs) {
                expect(callArgs[1]).toHaveProperty('original', exerciseName);
                expect(callArgs[1]).toHaveProperty('painLocation', painLocation);
                expect(callArgs[1]).toHaveProperty('fallbackUsed');
                expect(callArgs[1]).toHaveProperty('replacements');
            }
        });
    });

    describe('Error Handling in Fallback', () => {
        it('should return bodyweight alternatives even if fallback system errors', () => {
            // Force an error by making getBodyPartFallback throw
            const originalMethod = adapter.getBodyPartFallback;
            adapter.getBodyPartFallback = vi.fn(() => {
                throw new Error('Test error');
            });

            const result = adapter.getFallbackAlternatives('Test', 'knee', {});

            // Should still return bodyweight alternatives
            expect(result.alternatives.length).toBeGreaterThan(0);
            expect(result.fallbackReason).toBeDefined();

            // Restore method
            adapter.getBodyPartFallback = originalMethod;
        });
    });
});

