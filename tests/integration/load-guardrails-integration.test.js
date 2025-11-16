/**
 * LoadGuardrails Integration Tests
 * End-to-end tests for guardrail system integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import LoadCalculator from '../../js/modules/load/LoadCalculator.js';
import LoadGuardrails from '../../js/modules/load/LoadGuardrails.js';

// Mock window globals if needed
if (typeof window === 'undefined') {
  global.window = {};
}

// Initialize window globals for tests
if (!window.LoadCalculator) {
  window.LoadCalculator = new LoadCalculator();
}
if (!window.LoadGuardrails) {
  window.LoadGuardrails = new LoadGuardrails();
}
if (!window.EventBus) {
  window.EventBus = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    TOPICS: {
      SESSION_COMPLETED: 'SESSION_COMPLETED',
      READINESS_UPDATED: 'READINESS_UPDATED',
      PHASE_CHANGED: 'PHASE_CHANGED',
      PROFILE_UPDATED: 'PROFILE_UPDATED',
    },
  };
}
if (!window.SafeLogger) {
  window.SafeLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

describe('LoadGuardrails Integration', () => {
  let guardrails;
  let loadCalculator;
  let mockLogger;

  beforeEach(() => {
    // Ensure dependencies are loaded
    guardrails = window.LoadGuardrails;
    loadCalculator = window.LoadCalculator;

    // Skip tests if dependencies not available
    if (!guardrails || !loadCalculator) {
      console.warn('LoadGuardrails or LoadCalculator not available, skipping integration tests');
    }

    // Reset localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // Mock logger for testing
    mockLogger = {
      audit: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };
  });

  describe('Weekly Ramp Rate Monitoring', () => {
    it('should prevent >10% weekly load increases for intermediate users', async () => {
      if (!guardrails || !loadCalculator) {
        console.warn('Skipping test - dependencies not available');
        return;
      }
      const weeklyLoads = [
        { total: 220 }, // 10% increase would be 220
        { total: 200 },
      ];

      const progression = loadCalculator.checkLoadProgression(weeklyLoads, 'intermediate');

      // 10% increase should be detected
      expect(progression.safe).toBe(false);
      expect(progression.rampRate).toBeGreaterThan(0.1);
      expect(progression.recommendation).toContain('Reduce');
    });

    it('should allow 10% or less increase for intermediate users', async () => {
      const weeklyLoads = [
        { total: 210 }, // Exactly 10% increase
        { total: 200 },
      ];

      const progression = loadCalculator.checkLoadProgression(weeklyLoads, 'intermediate');

      // Exactly 10% should be allowed (threshold is <= 10%)
      expect(progression.safe).toBe(true);
    });

    it('should calculate ramp rate correctly', () => {
      const current = { total: 220 };
      const previous = { total: 200 };

      const rampRate = loadCalculator.calculateRampRate(current, previous);

      // (220 - 200) / 200 = 0.10 = 10%
      expect(rampRate).toBe(0.1);
    });

    it('should handle zero previous load', () => {
      const current = { total: 100 };
      const previous = { total: 0 };

      const rampRate = loadCalculator.calculateRampRate(current, previous);

      expect(rampRate).toBe(0);
    });
  });

  describe('HIIT Reduction Application', () => {
    it('should apply 20% reduction to next HIIT session when threshold exceeded', async () => {
      const userId = 'testuser';

      // Mock upcoming sessions with HIIT
      const upcomingSessions = [
        {
          id: 1,
          template_id: 'hiit_1',
          tags: ['HIIT', 'anaerobic_capacity'],
          intensity: { primary_zone: 'Z5' },
          structure: [
            {
              block_type: 'main',
              intensity: 'Z5',
            },
          ],
        },
      ];

      // Mock localStorage
      localStorage.setItem(`ignite_upcoming_sessions_${userId}`, JSON.stringify(upcomingSessions));

      await guardrails.modifyUpcomingHIIT(userId, 0.2);

      // Verify session was modified
      const stored = localStorage.getItem(`ignite_upcoming_sessions_${userId}`);
      const modifiedSessions = JSON.parse(stored);

      expect(modifiedSessions[0].modifications).toBeDefined();
      expect(modifiedSessions[0].modifications[0].amount).toBe(0.2);
    });

    it('should modify next 2 HIIT sessions only', async () => {
      const userId = 'testuser';

      const upcomingSessions = [
        { id: 1, tags: ['HIIT'], intensity: { primary_zone: 'Z5' } },
        { id: 2, tags: ['HIIT'], intensity: { primary_zone: 'Z4' } },
        { id: 3, tags: ['HIIT'], intensity: { primary_zone: 'Z5' } },
        { id: 4, tags: ['endurance'], intensity: { primary_zone: 'Z2' } },
      ];

      localStorage.setItem(`ignite_upcoming_sessions_${userId}`, JSON.stringify(upcomingSessions));

      await guardrails.modifyUpcomingHIIT(userId, 0.2);

      const stored = localStorage.getItem(`ignite_upcoming_sessions_${userId}`);
      const modifiedSessions = JSON.parse(stored);

      const modifiedHIIT = modifiedSessions.filter(
        s => s.modifications && s.modifications.some(m => m.reason === 'guardrail_ramp_rate')
      );

      expect(modifiedHIIT.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Missed Days Detection', () => {
    it('should apply downshift after 3+ missed days', async () => {
      const userId = 'testuser';

      const result = await guardrails.handleMissedDays(userId, 5);

      expect(result.status).toBe('downshift_applied');
      expect(result.actions[0].reduction).toBeGreaterThan(0);
      expect(result.message).toContain('reduced');
    });

    it('should not adjust for < 3 missed days', async () => {
      const userId = 'testuser';

      const result = await guardrails.handleMissedDays(userId, 2);

      expect(result.status).toBe('no_action');
    });
  });

  describe('Pain Flag Response', () => {
    it('should apply immediate 30% reduction for pain', async () => {
      const userId = 'testuser';

      const result = await guardrails.handlePainFlag(userId, 5, 'knee');

      expect(result.status).toBe('pain_response_applied');
      expect(result.actions[0].type).toBe('immediate_downshift');
      expect(result.actions[0].reduction).toBeGreaterThanOrEqual(0.3);
      expect(result.actions[0].duration).toBe(14);
    });

    it('should scale reduction based on pain level', async () => {
      const userId = 'testuser';

      const lowPain = await guardrails.handlePainFlag(userId, 5, 'knee');
      const highPain = await guardrails.handlePainFlag(userId, 8, 'knee');

      expect(highPain.actions[0].reduction).toBeGreaterThan(lowPain.actions[0].reduction);
    });
  });

  describe('Session Validation', () => {
    it('should reject session exceeding consecutive days limit', async () => {
      const userId = 'testuser';

      // Mock 5 consecutive days of training
      const recentSessions = [];
      for (let i = 0; i < 5; i++) {
        recentSessions.push({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Mock getUserSessions to return recent sessions
      guardrails.getUserSessions = async () => recentSessions;

      const session = {
        date: new Date().toISOString(),
        tags: ['HIIT'],
      };

      const result = await guardrails.validatePlannedSession(userId, session);

      // 5 consecutive days exceeds intermediate limit of 4
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('consecutive_days_exceeded');
    });

    it('should allow session within consecutive days limit', async () => {
      const userId = 'testuser';

      const recentSessions = [
        { date: new Date().toISOString() },
        { date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      ];

      guardrails.getUserSessions = async () => recentSessions;

      const session = {
        date: new Date().toISOString(),
      };

      const result = await guardrails.validatePlannedSession(userId, session);

      expect(result.valid).toBe(true);
    });
  });

  describe('Guardrail Status', () => {
    it('should return current guardrail status', async () => {
      const userId = 'testuser';

      const status = await guardrails.getGuardrailStatus(userId);

      expect(status).toHaveProperty('activeAdjustments');
      expect(status).toHaveProperty('recentAnalysis');
      expect(status).toHaveProperty('isUnderGuardrail');
      expect(status).toHaveProperty('nextReview');
    });
  });

  describe('End-to-End Flow', () => {
    it('should complete full guardrail flow: detect → analyze → apply → log', async () => {
      const userId = 'testuser';

      // 1. Create load history with exceeding ramp rate
      const loadHistory = [
        { week: 0, totalLoad: 230, startDate: new Date().toISOString() },
        { week: 1, totalLoad: 200, startDate: new Date().toISOString() },
      ];

      guardrails.getWeeklyLoadHistory = async () => loadHistory;
      guardrails.modifyUpcomingHIIT = async () => {};

      // 2. Check ramp rate
      const result = await guardrails.checkWeeklyRampRate(userId);

      // 3. Verify detection and application
      expect(result.status).toBe('guardrail_applied');
      expect(result.actions).toBeDefined();
      expect(result.actions.some(a => a.type === 'reduce_hiit')).toBe(true);

      // 4. Verify logging
      expect(mockLogger.audit).toHaveBeenCalledWith(
        'GUARDRAIL_TRIGGERED',
        expect.objectContaining({
          userId,
          trigger: 'ramp_rate_exceeded',
        })
      );
    });
  });
});
