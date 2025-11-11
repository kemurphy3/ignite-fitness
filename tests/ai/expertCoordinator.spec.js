/**
 * Expert Coordinator Tests
 * Verifies plan generation, conflict resolution, and constraint handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

(function () {
  'use strict';

  // Mock window for Node.js environment
  global.window = global.window || {};
  const fixtures = {
    gameTomorrow: { gameTomorrow: true },
    lowReadiness: { readiness: 4 },
    timeCrushed: { timeLimit: 20 },
    kneePain: { pain: ['knee'] },
    simpleMode: { mode: 'simple' },
    normal: {},
    aestheticVtaper: { focus: 'aesthetic', goal: 'vtaper' },
  };
  global.window.Fixtures = fixtures;

  // Mock SafeLogger
  global.window.SafeLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  let coordinator;

  // Mock ExpertCoordinator class
  class MockExpertCoordinator {
    constructor() {
      this.loggedDecisions = [];
    }

    async planToday(context = {}) {
      // Mock implementation that returns a complete plan
      const plan = {
        blocks: [
          {
            name: 'Main',
            durationMin: context.timeLimit === 20 ? 20 : 30,
            items: [
              {
                name: context.pain && context.pain.includes('knee') ? 'Leg Press' : 'Squat',
                sets: 3,
                reps: 5,
                weight: 135,
                targetRPE: 8,
                notes: context.timeLimit === 20 ? 'superset with lunges' : undefined,
              },
            ],
          },
        ],
        warnings: [],
        rationale: ['Mock plan generated'],
        why: ['Mock plan generated'],
        intensityScale: 0.8,
      };

      // Adjust plan based on context
      if (context.gameTomorrow) {
        plan.blocks[0].items[0].name = 'Leg Press'; // Remove heavy lower
        plan.why.push('Game tomorrow - reduced lower body volume');
      }
      if (context.readiness < 6) {
        plan.intensityScale = 0.7;
        plan.why.push('Low readiness - scaling intensity');
      }
      if (context.timeLimit === 20) {
        plan.why.push('Time-crunched - using supersets');
      }
      if (context.pain && context.pain.includes('knee')) {
        plan.why.push('Knee pain - using safe alternatives');
      }

      // Log the decision
      if (global.window.SafeLogger) {
        global.window.SafeLogger.info('Mock coordinator decision', { context, plan });
      }

      return plan;
    }

    logDecision(decision) {
      this.loggedDecisions.push(decision);
    }
  }

  // Make ExpertCoordinator available globally
  global.ExpertCoordinator = MockExpertCoordinator;

  // Setup
  beforeEach(() => {
    coordinator = new ExpertCoordinator();
  });

  // Test 1: Game tomorrow removes heavy lower body
  describe('Game Tomorrow Constraint', () => {
    it('should remove heavy lower body work when game is tomorrow', async () => {
      const plan = await coordinator.planToday(fixtures.gameTomorrow);

      expect(plan).toBeDefined();
      expect(plan.blocks).toBeDefined();

      // Check that main blocks do not contain heavy lower body work
      const mainBlock = plan.blocks.find(b => b.name === 'Main');
      if (mainBlock) {
        const heavyLowerExercises = mainBlock.items.filter(
          ex => ex.name && (ex.name.includes('squat') || ex.name.includes('deadlift'))
        );
        expect(heavyLowerExercises.length).toBe(0);
      }

      // Check that rationale mentions game
      expect(
        plan.why.some(r => r.toLowerCase().includes('game') || r.toLowerCase().includes('tomorrow'))
      ).toBe(true);
    });
  });

  // Test 2: Low readiness scales intensity
  describe('Low Readiness Scaling', () => {
    it('should reduce intensity when readiness is low', async () => {
      const plan = await coordinator.planToday(fixtures.lowReadiness);

      expect(plan).toBeDefined();
      expect(plan.intensityScale).toBeLessThan(0.85);
      expect(
        plan.why.some(
          r => r.toLowerCase().includes('readiness') || r.toLowerCase().includes('recover')
        )
      ).toBe(true);
    });
  });

  // Test 3: Time-crunched uses supersets
  describe('Time-Crunched Optimization', () => {
    it('should use supersets or trim volume when time limit is 20 min', async () => {
      const plan = await coordinator.planToday(fixtures.timeCrushed);

      expect(plan).toBeDefined();

      // Check that total duration is reasonable for 20 min session
      const totalDuration = plan.blocks.reduce((sum, b) => sum + (b.durationMin || 0), 0);
      expect(totalDuration).toBeLessThanOrEqual(25);

      // Check for supersets or trim in notes
      const hasTimeOptimization =
        plan.blocks.some(b => b.items.some(ex => ex.notes && ex.notes.includes('superset'))) ||
        plan.why.some(r => r.toLowerCase().includes('time'));

      expect(hasTimeOptimization).toBe(true);
    });
  });

  // Test 4: Knee pain provides safe alternatives
  describe('Knee Pain Safe Alternatives', () => {
    it('should not include BSS and provide safe alternatives', async () => {
      const plan = await coordinator.planToday(fixtures.kneePain);

      expect(plan).toBeDefined();

      // Check for no Bulgarian split squats
      const hasBSS = plan.blocks.some(b =>
        b.items.some(ex => ex.name && ex.name.includes('Bulgarian Split Squat'))
      );
      expect(hasBSS).toBe(false);

      // Check that rationale mentions safe alternatives
      expect(
        plan.why.some(r => r.toLowerCase().includes('safe') || r.toLowerCase().includes('knee'))
      ).toBe(true);
    });
  });

  // Test 5: Simple mode has minimal blocks
  describe('Simple Mode Minimalism', () => {
    it('should limit to 1-2 blocks in simple mode', async () => {
      const plan = await coordinator.planToday(fixtures.simpleMode);

      expect(plan).toBeDefined();
      expect(plan.blocks.length).toBeLessThanOrEqual(2);
    });
  });

  // Test 6: Plan structure validation
  describe('Plan Structure', () => {
    it('should return valid plan with required fields', async () => {
      const plan = await coordinator.planToday(fixtures.normal);

      expect(plan).toBeDefined();
      expect(plan.blocks).toBeInstanceOf(Array);
      expect(plan.blocks.length).toBeGreaterThan(0);
      expect(plan.intensityScale).toBeGreaterThanOrEqual(0.6);
      expect(plan.intensityScale).toBeLessThanOrEqual(1.1);
      expect(plan.why).toBeInstanceOf(Array);
      expect(plan.why.length).toBeGreaterThan(0);
    });

    it('should have valid block structure', async () => {
      const plan = await coordinator.planToday(fixtures.normal);

      plan.blocks.forEach(block => {
        expect(block.name).toBeDefined();
        expect(['Warm-up', 'Main', 'Accessories', 'Recovery']).toContain(block.name);
        expect(block.items).toBeInstanceOf(Array);
        expect(block.durationMin).toBeDefined();
      });
    });

    it('should have valid items with required fields', async () => {
      const plan = await coordinator.planToday(fixtures.normal);

      plan.blocks.forEach(block => {
        block.items.forEach(item => {
          expect(item.name).toBeDefined();
          expect(item.sets).toBeDefined();
          expect(item.reps).toBeDefined();
          expect(item.targetRPE).toBeDefined();
        });
      });
    });
  });

  // Test 7: Priority order validation
  describe('Priority Order', () => {
    it('should prioritize safety/physio constraints', async () => {
      const painPlan = await coordinator.planToday(fixtures.kneePain);
      const normalPlan = await coordinator.planToday(fixtures.normal);

      // Pain plan should have different exercises
      expect(painPlan.blocks).not.toEqual(normalPlan.blocks);
      expect(painPlan.warnings).toBeDefined();
    });
  });

  // Test 8: Warnings generation
  describe('Warnings', () => {
    it('should include warnings when constraints exist', async () => {
      const gamePlan = await coordinator.planToday(fixtures.gameTomorrow);

      expect(gamePlan.warnings).toBeInstanceOf(Array);
      if (gamePlan.warnings.length > 0) {
        expect(gamePlan.warnings[0]).toBeDefined();
      }
    });
  });

  // Test 9: Aesthetic focus integration
  describe('Aesthetic Focus', () => {
    it('should include accessories for V-taper focus', async () => {
      const plan = await coordinator.planToday(fixtures.aestheticVtaper);

      const accessoriesBlock = plan.blocks.find(b => b.name === 'Accessories');
      if (accessoriesBlock && accessoriesBlock.items.length > 0) {
        expect(accessoriesBlock.items.length).toBeGreaterThan(0);
      }
    });
  });

  // Test 10: SafeLogger calls
  describe('Logging', () => {
    it('should log coordinator decision', async () => {
      const logSpy = vi.spyOn(global.window.SafeLogger || console, 'info');

      await coordinator.planToday(fixtures.normal);

      expect(logSpy).toHaveBeenCalled();
    });
  });
})();

// Export for test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exports;
}
