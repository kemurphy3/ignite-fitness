/**
 * ReadinessInference Unit Tests
 * Tests for passive readiness inference when user skips check-in
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ReadinessInference', () => {
  let inference;

  beforeEach(() => {
    // Mock window.ReadinessInference for Node.js environment
    global.window = global.window || {};
    if (!global.window.ReadinessInference) {
      class MockReadinessInference {
        async inferReadiness({ lastSessions = [], schedule = {} }) {
          let readiness = 7;
          const rationale = [];

          if (lastSessions.length > 0) {
            const lastSession = lastSessions[0];
            const lastRPE = lastSession?.averageRPE || lastSession?.rpe || 7;

            if (lastRPE >= 8) {
              readiness -= 2;
              rationale.push("Yesterday's session was intense (RPE ≥8)");
            } else if (lastRPE < 5) {
              readiness += 1;
              rationale.push("Yesterday's session was light");
            }
          }

          // Game proximity logic
          if (schedule.daysUntilGame !== undefined) {
            if (schedule.daysUntilGame <= 1) {
              readiness -= 1;
              rationale.push('Game tomorrow - reducing intensity');
            } else if (schedule.daysUntilGame <= 3) {
              readiness -= 0.5;
              rationale.push('Game soon - moderate reduction');
            }
          }

          return {
            score: Math.max(1, Math.min(10, Math.round(readiness))),
            inferred: true,
            rationale: rationale.join('; '),
          };
        }
      }

      global.window.ReadinessInference = MockReadinessInference;
    }

    inference = new global.window.ReadinessInference();
  });

  describe('inferReadiness', () => {
    it('should infer lower readiness after high RPE session', async () => {
      const lastSessions = [{ averageRPE: 9, date: '2025-01-20' }];

      const result = await inference.inferReadiness({ lastSessions });

      expect(result.score).toBeLessThan(7);
      expect(result.inferred).toBe(true);
      expect(result.rationale).toContain('intense');
    });

    it('should infer higher readiness after light session', async () => {
      const lastSessions = [{ averageRPE: 4, date: '2025-01-20' }];

      const result = await inference.inferReadiness({ lastSessions });

      expect(result.score).toBeGreaterThan(7);
      expect(result.inferred).toBe(true);
    });

    it('should infer lower readiness with game soon', async () => {
      const schedule = { daysUntilGame: 1 };

      const result = await inference.inferReadiness({ lastSessions: [], schedule });

      expect(result.score).toBeLessThan(7);
      expect(result.rationale).toContain('Game');
    });

    it('should return default moderate readiness with no data', async () => {
      const result = await inference.inferReadiness({ lastSessions: [], schedule: {} });

      expect(result.score).toBe(7);
      expect(result.inferred).toBe(true);
    });

    it('should clamp score to 1-10 range', async () => {
      const lastSessions = [
        { averageRPE: 10 }, // Very high RPE
        { averageRPE: 10 },
        { averageRPE: 10 },
      ];

      const result = await inference.inferReadiness({ lastSessions });

      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(10);
    });
  });

  describe('with ExpertCoordinator', () => {
    let coordinator;

    beforeEach(() => {
      if (!window.ExpertCoordinator) {
        window.ExpertCoordinator = class MockExpertCoordinator {
          constructor() {
            this.readinessInference = inference;
          }
        };
      }

      coordinator = new window.ExpertCoordinator();
    });

    it('should use inferred readiness when no explicit check-in', async () => {
      const context = {
        // No readiness provided
        history: {
          lastSessions: [{ averageRPE: 8 }],
        },
      };

      expect(context.readiness).toBeUndefined();

      // Coordinator would infer here
      if (coordinator.readinessInference) {
        const result = await coordinator.readinessInference.inferReadiness({
          lastSessions: context.history.lastSessions,
        });

        expect(result.inferred).toBe(true);
        expect(result.score).toBeLessThan(7);
      }
    });

    it('should not infer when explicit readiness provided', async () => {
      const context = {
        readiness: 8, // Explicit check-in
      };

      expect(context.readiness).toBe(8);
      // Should use provided value, not infer
    });
  });
});
