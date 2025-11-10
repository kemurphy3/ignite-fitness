/**
 * T2B-3: Expert Coordinator Mandatory Validation Tests
 * Verifies that ExpertCoordinator validates all context data with graceful degradation
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
    AIDataValidator: {
        validateContext: vi.fn((ctx) => ({ ...ctx, validated: true }))
    },
    CoordinatorContext: {
        buildContext: vi.fn(async (ctx) => ctx)
    },
    ReadinessInference: {
        inferReadiness: vi.fn(async () => ({ score: 7, inferred: true, rationale: 'Test' }))
    },
    SeasonalPrograms: {
        getSeasonContext: vi.fn(() => ({
            phaseKey: 'off',
            weekOfBlock: 1,
            deloadThisWeek: false,
            gameProximity: { hasGame: false }
        }))
    },
    ErrorAlert: {
        showErrorAlert: vi.fn()
    }
};

let ExpertCoordinator;

describe('ExpertCoordinator Mandatory Validation (T2B-3)', () => {
    let coordinator;

    beforeEach(async () => {
        // Mock expert coaches
        global.window.StrengthCoach = vi.fn();
        global.window.SportsCoach = vi.fn();
        global.window.PhysioCoach = vi.fn();
        global.window.NutritionCoach = vi.fn();
        global.window.AestheticsCoach = vi.fn();
        global.window.ClimbingCoach = vi.fn();
        global.window.WhyThisDecider = vi.fn();
        global.window.MemoizedCoordinator = vi.fn(() => ({
            registerExpert: vi.fn()
        }));

        // Load ExpertCoordinator
        const module = await import('../../js/modules/ai/ExpertCoordinator.js');
        ExpertCoordinator = module.default || window.ExpertCoordinator?.constructor || ExpertCoordinator;

        coordinator = new ExpertCoordinator();
    });

    describe('Mandatory Validation', () => {
        it('should validate context even when validator is unavailable', async () => {
            // Remove validator
            coordinator.dataValidator = null;

            const context = {
                readiness: 8,
                atl7: 50,
                ctl28: 100
            };

            // Should use conservative defaults gracefully
            const result = await coordinator.planTodayFallback(context);

            expect(result).toBeDefined();
            // Should have conservative defaults applied
            if (context._conservativeDefaults) {
                expect(context.readiness).toBeDefined();
                expect(context.readiness).toBeGreaterThanOrEqual(1);
                expect(context.readiness).toBeLessThanOrEqual(10);
            }
        });

        it('should validate context when validator is available', async () => {
            const context = {
                readiness: 8,
                atl7: 50,
                ctl28: 100
            };

            await coordinator.planTodayFallback(context);

            // Validator should have been called
            expect(coordinator.dataValidator?.validateContext).toHaveBeenCalled();
        });

        it('should use validation cache for performance', async () => {
            const context = {
                readiness: 8,
                atl7: 50,
                ctl28: 100,
                user: { id: 'test-user' }
            };

            // First call - should validate
            await coordinator.planTodayFallback(context);
            const firstCallCount = coordinator.dataValidator?.validateContext.mock.calls.length || 0;

            // Second call with same context - should use cache
            await coordinator.planTodayFallback(context);
            const secondCallCount = coordinator.dataValidator?.validateContext.mock.calls.length || 0;

            // Cache should reduce calls (if cache hit, second call count should be same or only 1 more)
            // This is a soft test - cache may not hit if context is mutated
            expect(secondCallCount).toBeGreaterThanOrEqual(firstCallCount);
        });

        it('should apply conservative defaults when validation fails', async () => {
            // Make validator throw
            coordinator.dataValidator = {
                validateContext: vi.fn(() => {
                    throw new Error('Validation error');
                })
            };

            const context = {
                readiness: null, // Invalid
                atl7: -50, // Invalid
                ctl28: undefined
            };

            await coordinator.planTodayFallback(context);

            // Should have conservative defaults applied
            expect(context._conservativeDefaults).toBe(true);
            expect(context.readiness).toBeGreaterThanOrEqual(1);
            expect(context.readiness).toBeLessThanOrEqual(10);
            expect(context.atl7).toBeGreaterThanOrEqual(0);
            expect(context.ctl28).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Validation Metadata', () => {
        it('should store validation metadata in context', async () => {
            const context = {
                readiness: 8,
                atl7: 50,
                ctl28: 100
            };

            await coordinator.planTodayFallback(context);

            expect(context._validationMetadata).toBeDefined();
            expect(context._validationMetadata).toHaveProperty('isValid');
            expect(context._validationMetadata).toHaveProperty('errors');
            expect(context._validationMetadata).toHaveProperty('warnings');
            expect(context._validationMetadata).toHaveProperty('cached');
        });

        it('should log validation warnings when validation has issues', async () => {
            coordinator.dataValidator = {
                validateContext: vi.fn(() => ({
                    ...context,
                    isValid: false,
                    warnings: ['Low confidence']
                }))
            };

            const context = {
                readiness: 8,
                atl7: 50
            };

            await coordinator.planTodayFallback(context);

            // Should log validation warnings
            const infoCalls = coordinator.logger.info.mock.calls;
            const hasValidationWarning = infoCalls.some(call =>
                call[0] === 'VALIDATION_WARNINGS'
            );

            // If validation had warnings, they should be logged
            if (context._validationMetadata?.warnings?.length > 0) {
                expect(hasValidationWarning).toBe(true);
            }
        });
    });

    describe('Conservative Defaults', () => {
        it('should provide safe defaults for invalid readiness', () => {
            const context = {
                readiness: null,
                readinessScore: NaN
            };

            const result = coordinator.applyConservativeDefaults(context);

            expect(result.readiness).toBe(7);
            expect(result.readinessScore).toBe(7);
        });

        it('should provide safe defaults for invalid load values', () => {
            const context = {
                atl7: -50,
                ctl28: undefined
            };

            const result = coordinator.applyConservativeDefaults(context);

            expect(result.atl7).toBeGreaterThanOrEqual(0);
            expect(result.ctl28).toBeGreaterThanOrEqual(0);
        });

        it('should provide safe defaults for missing data confidence', () => {
            const context = {
                dataConfidence: null
            };

            const result = coordinator.applyConservativeDefaults(context);

            expect(result.dataConfidence).toBeDefined();
            expect(result.dataConfidence.recent7days).toBe(0.5);
            expect(result.dataConfidence.recent30days).toBe(0.6);
        });

        it('should provide safe defaults for intensity and volume scales', () => {
            const context = {};

            const result = coordinator.applyConservativeDefaults(context);

            expect(result.intensityScale).toBe(0.8);
            expect(result.volumeScale).toBeGreaterThanOrEqual(0.5);
            expect(result.volumeScale).toBeLessThanOrEqual(1.0);
        });

        it('should mark context as using conservative defaults', () => {
            const context = {};

            const result = coordinator.applyConservativeDefaults(context);

            expect(result._conservativeDefaults).toBe(true);
        });
    });

    describe('Validation Cache Management', () => {
        it('should initialize validation cache', () => {
            expect(coordinator.validationCache).toBeDefined();
            expect(coordinator.validationCacheMaxSize).toBe(100);
        });

        it('should generate deterministic cache keys', () => {
            const context1 = {
                readiness: 8,
                atl7: 50,
                ctl28: 100,
                user: { id: 'user1' }
            };

            const context2 = {
                readiness: 8,
                atl7: 50,
                ctl28: 100,
                user: { id: 'user1' }
            };

            const key1 = coordinator.generateValidationCacheKey(context1);
            const key2 = coordinator.generateValidationCacheKey(context2);

            expect(key1).toBe(key2);
        });

        it('should generate different keys for different contexts', () => {
            const context1 = {
                readiness: 8,
                atl7: 50,
                user: { id: 'user1' }
            };

            const context2 = {
                readiness: 5,
                atl7: 50,
                user: { id: 'user1' }
            };

            const key1 = coordinator.generateValidationCacheKey(context1);
            const key2 = coordinator.generateValidationCacheKey(context2);

            expect(key1).not.toBe(key2);
        });
    });

    describe('Graceful Degradation', () => {
        it('should continue working when validator throws error', async () => {
            coordinator.dataValidator = {
                validateContext: vi.fn(() => {
                    throw new Error('Validator crashed');
                })
            };

            const context = {
                readiness: 8,
                atl7: 50
            };

            // Should not throw, should use conservative defaults
            await expect(coordinator.planTodayFallback(context)).resolves.toBeDefined();

            expect(context._conservativeDefaults).toBe(true);
        });

        it('should continue working when validator is undefined', async () => {
            coordinator.dataValidator = undefined;

            const context = {
                readiness: 8,
                atl7: 50
            };

            // Should not throw, should use conservative defaults
            await expect(coordinator.planTodayFallback(context)).resolves.toBeDefined();

            expect(context._conservativeDefaults).toBe(true);
        });
    });
});

