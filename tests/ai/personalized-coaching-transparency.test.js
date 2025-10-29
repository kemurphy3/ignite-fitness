/**
 * Test suite for PersonalizedCoaching transparency indicators
 * Tests the new responseType, confidence, and rationale fields
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
const mockLogger = {
    debug: () => {},
    error: () => {},
    info: () => {}
};

const mockEventBus = {
    subscribe: () => {},
    publish: () => {}
};

const mockAuthManager = {
    getCurrentUser: () => ({
        username: 'testuser',
        athleteName: 'Test Athlete',
        preferences: { primary_goal: 'strength' }
    })
};

const mockStorageManager = {};
const mockProgressionEngine = {};
const mockDailyCheckIn = {
    getTodayCheckIn: () => ({
        readinessScore: 7,
        energyLevel: 6,
        stressLevel: 4
    })
};

const mockDataValidator = {
    validateContext: (context) => context
};

// Set up global mocks
global.window = {
    SafeLogger: mockLogger,
    EventBus: mockEventBus,
    AuthManager: mockAuthManager,
    StorageManager: mockStorageManager,
    ProgressionEngine: mockProgressionEngine,
    DailyCheckIn: mockDailyCheckIn,
    AIDataValidator: mockDataValidator
};

// Import the class after setting up mocks
import PersonalizedCoaching from '../../js/modules/ai/PersonalizedCoaching.js';

describe('PersonalizedCoaching Transparency Indicators', () => {
    let coaching;

    beforeEach(() => {
        coaching = new PersonalizedCoaching();
    });

    describe('getCoachingMessage() returns transparency data', () => {
        it('should return responseType, confidence, and rationale fields', () => {
            const result = coaching.getCoachingMessage("I'm feeling tired today");
            
            expect(result).toHaveProperty('responseType');
            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('rationale');
            expect(result).toHaveProperty('response');
            expect(result).toHaveProperty('success');
        });

        it('should return responseType as "rule-based" for recovery scenarios', () => {
            const result = coaching.getCoachingMessage("I'm feeling tired and stressed");
            
            expect(result.responseType).toBe('rule-based');
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.rationale).toContain('readiness score');
        });

        it('should return responseType as "template" for motivation scenarios', () => {
            const result = coaching.getCoachingMessage("I need motivation");
            
            expect(result.responseType).toBe('template');
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.rationale).toContain('motivational templates');
        });

        it('should return responseType as "rule-based" for injury scenarios', () => {
            const result = coaching.getCoachingMessage("My knee hurts during squats");
            
            expect(result.responseType).toBe('rule-based');
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.rationale).toContain('safety protocols');
        });

        it('should return responseType as "rule-based" for plateau scenarios', () => {
            const result = coaching.getCoachingMessage("I'm stuck at the same weight");
            
            expect(result.responseType).toBe('rule-based');
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.rationale).toContain('progression rate');
        });

        it('should return responseType as "rule-based" for seasonal scenarios', () => {
            const result = coaching.getCoachingMessage("Basketball season starts soon");
            
            expect(result.responseType).toBe('rule-based');
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.rationale).toContain('season phase');
        });

        it('should return responseType as "rule-based" for performance scenarios', () => {
            const result = coaching.getCoachingMessage("My workouts have been really hard lately");
            
            expect(result.responseType).toBe('rule-based');
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.rationale).toContain('average RPE');
        });

        it('should return responseType as "rule-based" for return scenarios', () => {
            const result = coaching.getCoachingMessage("I've been away from the gym for a while");
            
            expect(result.responseType).toBe('rule-based');
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.rationale).toContain('missed workouts');
        });
    });

    describe('Confidence scoring', () => {
        it('should return confidence between 0 and 100', () => {
            const result = coaching.getCoachingMessage("I need help");
            
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(100);
        });

        it('should return higher confidence for rule-based responses', () => {
            const ruleBasedResult = coaching.getCoachingMessage("My knee hurts");
            const templateResult = coaching.getCoachingMessage("I need motivation");
            
            expect(ruleBasedResult.confidence).toBeGreaterThan(templateResult.confidence);
        });

        it('should return lower confidence when data quality is poor', () => {
            // Mock poor data quality by overriding getUserContext
            const originalGetUserContext = coaching.getUserContext;
            coaching.getUserContext = () => ({
                username: 'user',
                athleteName: 'Athlete',
                preferences: {},
                trainingHistory: [],
                recentWorkouts: [],
                progressionData: {},
                missedWorkouts: 0,
                readinessScore: 5,
                energyLevel: 5,
                stressLevel: 5,
                primaryGoal: 'general_fitness',
                sport: 'general_fitness',
                seasonPhase: 'offseason',
                trainingFrequency: 3,
                averageRPE: 7.5,
                progressionRate: 0.1,
                consistencyScore: 0.8,
                workoutStreak: 0,
                lastWorkout: null,
                energyTrend: 'stable',
                stressTrend: 'stable'
            });

            const result = coaching.getCoachingMessage("I need help");
            
            expect(result.confidence).toBeLessThan(50);
            expect(result.rationale).toContain('Limited user data available');
            
            // Restore original method
            coaching.getUserContext = originalGetUserContext;
        });
    });

    describe('Rationale explanations', () => {
        it('should provide specific rationale for each scenario type', () => {
            const scenarios = [
                { message: "My knee hurts", expectedRationale: "safety protocols" },
                { message: "I've been away", expectedRationale: "missed workouts" },
                { message: "I'm tired", expectedRationale: "readiness score" },
                { message: "I'm stuck", expectedRationale: "progression rate" },
                { message: "Season starts soon", expectedRationale: "season phase" },
                { message: "Workouts are hard", expectedRationale: "average RPE" },
                { message: "I need motivation", expectedRationale: "motivational templates" }
            ];

            scenarios.forEach(({ message, expectedRationale }) => {
                const result = coaching.getCoachingMessage(message);
                expect(result.rationale).toContain(expectedRationale);
            });
        });

        it('should include data quality indicators in rationale', () => {
            const result = coaching.getCoachingMessage("I need help");
            
            expect(result.rationale).toBeTruthy();
            expect(typeof result.rationale).toBe('string');
            expect(result.rationale.length).toBeGreaterThan(10);
        });
    });

    describe('Error handling', () => {
        it('should return template response with low confidence on error', () => {
            // Mock an error by overriding getUserContext
            const originalGetUserContext = coaching.getUserContext;
            coaching.getUserContext = () => {
                throw new Error('Test error');
            };

            const result = coaching.getCoachingMessage("I need help");
            
            expect(result.success).toBe(false);
            expect(result.responseType).toBe('template');
            expect(result.confidence).toBe(0);
            expect(result.rationale).toBe('System error - using fallback template');
            
            // Restore original method
            coaching.getUserContext = originalGetUserContext;
        });
    });

    describe('Backward compatibility', () => {
        it('should maintain backward compatibility with existing response structure', () => {
            const result = coaching.getCoachingMessage("I need help");
            
            // Check that all existing fields are still present
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('response');
            expect(result).toHaveProperty('scenario');
            expect(result).toHaveProperty('context');
            expect(result).toHaveProperty('timestamp');
            
            // Check that new fields are added
            expect(result).toHaveProperty('responseType');
            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('rationale');
        });
    });
});
