/**
 * GuardrailManager Unit Tests
 * Tests for comprehensive safety guardrails and load management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window objects
global.window = {
  SafeLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  StorageManager: {
    get: vi.fn(() => []),
    save: vi.fn(),
  },
  LoadCalculator: {
    calculateSessionLoad: vi.fn(workout => ({
      total: workout.estimatedLoad || 50,
      volume: 30,
      intensity: 20,
    })),
  },
};

let GuardrailManager;

describe('GuardrailManager', () => {
  let manager;

  beforeEach(async () => {
    // Load GuardrailManager
    const module = await import('../../js/modules/safety/GuardrailManager.js');
    GuardrailManager =
      module.default || module.GuardrailManager || window.GuardrailManager?.constructor;

    // Create new instance for each test
    manager = new GuardrailManager();
  });

  describe('Initialization', () => {
    it('should initialize with safety limits', () => {
      expect(manager.limits).toBeDefined();
      expect(manager.limits.weeklyLoadCaps).toBeDefined();
      expect(manager.limits.rampRates).toBeDefined();
      expect(manager.limits.recovery).toBeDefined();
      expect(manager.limits.injury).toBeDefined();
    });

    it('should have weekly load caps for all training levels', () => {
      const caps = manager.limits.weeklyLoadCaps;
      expect(caps.beginner).toBeDefined();
      expect(caps.intermediate).toBeDefined();
      expect(caps.advanced).toBeDefined();
      expect(caps.elite).toBeDefined();
    });

    it('should have ramp rate limits', () => {
      const rates = manager.limits.rampRates;
      expect(rates.load).toBe(0.1); // 10%
      expect(rates.volume).toBe(0.1); // 10%
      expect(rates.intensity).toBe(0.05); // 5%
    });
  });

  describe('validateWorkout', () => {
    it('should return validation result structure', async () => {
      const workout = {
        estimatedLoad: 50,
        structure: [{ type: 'main', duration: 1800, intensity: 'Z3' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const recentSessions = [];
      const readinessData = {};

      const result = await manager.validateWorkout(
        workout,
        userProfile,
        recentSessions,
        readinessData
      );

      expect(result).toHaveProperty('isAllowed');
      expect(result).toHaveProperty('modifications');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('autoAdjustments');
      expect(result).toHaveProperty('blocks');
    });

    it('should allow valid workout', async () => {
      const workout = {
        estimatedLoad: 50,
        structure: [{ type: 'main', duration: 1800, intensity: 'Z2' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const recentSessions = [];
      const readinessData = { readinessScore: 8 };

      const result = await manager.validateWorkout(
        workout,
        userProfile,
        recentSessions,
        readinessData
      );

      expect(result.isAllowed).toBe(true);
      expect(result.blocks.length).toBe(0);
    });

    it('should block workout exceeding weekly load cap', async () => {
      const workout = {
        estimatedLoad: 400,
        structure: [{ type: 'main', duration: 3600, intensity: 'Z4' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const recentSessions = [{ date: new Date(), calculatedLoad: 350 }];
      const readinessData = {};

      const result = await manager.validateWorkout(
        workout,
        userProfile,
        recentSessions,
        readinessData
      );

      expect(result.isAllowed).toBe(false);
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it('should warn about excessive ramp rate', async () => {
      const workout = {
        estimatedLoad: 250,
        structure: [{ type: 'main', duration: 2400, intensity: 'Z4' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const recentSessions = [
        { date: lastWeek.toISOString(), calculatedLoad: 200 },
        { date: new Date().toISOString(), calculatedLoad: 150 },
      ];
      const readinessData = {};

      const result = await manager.validateWorkout(
        workout,
        userProfile,
        recentSessions,
        readinessData
      );

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should block hard workout without sufficient recovery', async () => {
      const workout = {
        estimatedLoad: 80,
        structure: [{ type: 'main', sets: 8, work: { duration: 60, intensity: 'Z5' } }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentSessions = [
        {
          date: yesterday.toISOString(),
          calculatedLoad: 70,
          averageIntensity: 'Z5',
          hardMinutes: 20,
        },
      ];
      const readinessData = {};

      const result = await manager.validateWorkout(
        workout,
        userProfile,
        recentSessions,
        readinessData
      );

      expect(result.isAllowed).toBe(false);
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it('should adjust for low readiness score', async () => {
      const workout = {
        estimatedLoad: 70,
        structure: [{ type: 'main', duration: 2400, intensity: 'Z4' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const recentSessions = [];
      const readinessData = { readinessScore: 4 };

      const result = await manager.validateWorkout(
        workout,
        userProfile,
        recentSessions,
        readinessData
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.autoAdjustments.length).toBeGreaterThan(0);
      expect(result.autoAdjustments.some(a => a.type === 'readiness_adjustment')).toBe(true);
    });

    it('should block workout with high pain level', async () => {
      const workout = {
        estimatedLoad: 50,
        structure: [{ type: 'main', duration: 1800, intensity: 'Z2' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const recentSessions = [];
      const readinessData = { painLevel: 6 };

      const result = await manager.validateWorkout(
        workout,
        userProfile,
        recentSessions,
        readinessData
      );

      expect(result.isAllowed).toBe(false);
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it('should suggest deload after 4 weeks', async () => {
      const workout = {
        estimatedLoad: 60,
        structure: [{ type: 'main', duration: 2000, intensity: 'Z3' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };

      // Create 4 weeks of sessions
      const recentSessions = [];
      for (let week = 0; week < 4; week++) {
        const date = new Date();
        date.setDate(date.getDate() - week * 7);
        recentSessions.push({
          date: date.toISOString(),
          calculatedLoad: 300,
        });
      }

      const readinessData = { readinessScore: 8 };

      const result = await manager.validateWorkout(
        workout,
        userProfile,
        recentSessions,
        readinessData
      );

      expect(result.warnings.some(w => w.includes('Deload'))).toBe(true);
      expect(result.autoAdjustments.some(a => a.type === 'deload_week')).toBe(true);
    });
  });

  describe('checkWeeklyLoadCap', () => {
    it('should pass for workout within weekly cap', () => {
      const workout = {
        estimatedLoad: 50,
        structure: [{ type: 'main', duration: 1800, intensity: 'Z3' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const recentSessions = [{ date: new Date().toISOString(), calculatedLoad: 200 }];

      const result = manager.checkWeeklyLoadCap(workout, userProfile, recentSessions);

      expect(result.passed).toBe(true);
    });

    it('should fail for workout exceeding weekly cap', () => {
      const workout = {
        estimatedLoad: 250,
        structure: [{ type: 'main', duration: 3600, intensity: 'Z4' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const recentSessions = [{ date: new Date().toISOString(), calculatedLoad: 350 }];

      const result = manager.checkWeeklyLoadCap(workout, userProfile, recentSessions);

      expect(result.passed).toBe(false);
      expect(result.suggestedReduction).toBeDefined();
    });

    it('should check hard minutes cap', () => {
      const workout = {
        estimatedLoad: 50,
        structure: [{ type: 'main', sets: 10, work: { duration: 60, intensity: 'Z5' } }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const recentSessions = [
        {
          date: new Date().toISOString(),
          calculatedLoad: 100,
          hardMinutes: 70,
        },
      ];

      const result = manager.checkWeeklyLoadCap(workout, userProfile, recentSessions);

      expect(result.passed).toBe(false);
    });
  });

  describe('checkRampRate', () => {
    it('should pass for workout within ramp rate', () => {
      const workout = {
        estimatedLoad: 50,
        structure: [{ type: 'main', duration: 1800, intensity: 'Z3' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const recentSessions = [
        { date: lastWeek.toISOString(), calculatedLoad: 300 },
        { date: new Date().toISOString(), calculatedLoad: 250 },
      ];

      const result = manager.checkRampRate(workout, userProfile, recentSessions);

      expect(result.passed).toBe(true);
    });

    it('should fail for excessive weekly increase', () => {
      const workout = {
        estimatedLoad: 250,
        structure: [{ type: 'main', duration: 3600, intensity: 'Z4' }],
      };

      const userProfile = { trainingLevel: 'intermediate' };
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const recentSessions = [
        { date: lastWeek.toISOString(), calculatedLoad: 200 },
        { date: new Date().toISOString(), calculatedLoad: 150 },
      ];

      const result = manager.checkRampRate(workout, userProfile, recentSessions);

      expect(result.passed).toBe(false);
      expect(result.suggestedAdjustment).toBeDefined();
    });
  });

  describe('checkRecoveryRequirements', () => {
    it('should pass for easy workout', () => {
      const workout = {
        estimatedLoad: 30,
        structure: [{ type: 'main', duration: 1800, intensity: 'Z2' }],
      };

      const recentSessions = [];

      const result = manager.checkRecoveryRequirements(workout, recentSessions);

      expect(result.passed).toBe(true);
    });

    it('should block hard workout without sufficient rest', () => {
      const workout = {
        estimatedLoad: 80,
        structure: [{ type: 'main', sets: 8, work: { duration: 60, intensity: 'Z5' } }],
      };

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0);

      const recentSessions = [
        {
          date: yesterday.toISOString(),
          calculatedLoad: 70,
          averageIntensity: 'Z5',
          hardMinutes: 20,
        },
      ];

      const result = manager.checkRecoveryRequirements(workout, recentSessions);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('block');
    });

    it('should warn about consecutive hard days', () => {
      const workout = {
        estimatedLoad: 70,
        structure: [{ type: 'main', sets: 8, work: { duration: 60, intensity: 'Z4' } }],
      };

      const day1 = new Date();
      day1.setDate(day1.getDate() - 2);
      const day2 = new Date();
      day2.setDate(day2.getDate() - 1);

      const recentSessions = [
        {
          date: day1.toISOString(),
          calculatedLoad: 60,
          averageIntensity: 'Z4',
          hardMinutes: 15,
        },
        {
          date: day2.toISOString(),
          calculatedLoad: 65,
          averageIntensity: 'Z5',
          hardMinutes: 18,
        },
      ];

      const result = manager.checkRecoveryRequirements(workout, recentSessions);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('warn');
    });
  });

  describe('checkReadinessCompatibility', () => {
    it('should pass for high readiness', () => {
      const workout = {
        estimatedLoad: 70,
        structure: [{ type: 'main', duration: 2400, intensity: 'Z4' }],
      };

      const readinessData = { readinessScore: 9 };

      const result = manager.checkReadinessCompatibility(workout, readinessData);

      expect(result.passed).toBe(true);
    });

    it('should block for high pain level', () => {
      const workout = {
        estimatedLoad: 50,
        structure: [{ type: 'main', duration: 1800, intensity: 'Z2' }],
      };

      const readinessData = { painLevel: 5 };

      const result = manager.checkReadinessCompatibility(workout, readinessData);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('block');
    });

    it('should warn and reduce load for high soreness', () => {
      const workout = {
        estimatedLoad: 60,
        structure: [{ type: 'main', duration: 2000, intensity: 'Z3' }],
      };

      const readinessData = { sorenessLevel: 8 };

      const result = manager.checkReadinessCompatibility(workout, readinessData);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('warn');
      expect(result.loadReduction).toBe(0.3);
    });

    it('should adjust for low readiness score', () => {
      const workout = {
        estimatedLoad: 70,
        structure: [{ type: 'main', duration: 2400, intensity: 'Z4' }],
      };

      const readinessData = { readinessScore: 4 };

      const result = manager.checkReadinessCompatibility(workout, readinessData);

      expect(result.passed).toBe(false);
      expect(result.loadReduction).toBeGreaterThan(0);
    });
  });

  describe('checkDeloadRequirement', () => {
    it('should not require deload for new trainee', () => {
      const userProfile = { trainingLevel: 'intermediate' };
      const recentSessions = [];

      const result = manager.checkDeloadRequirement(userProfile, recentSessions);

      expect(result.required).toBe(false);
    });

    it('should require deload after 4 weeks', () => {
      const userProfile = { trainingLevel: 'intermediate' };

      const recentSessions = [];
      for (let week = 0; week < 4; week++) {
        const date = new Date();
        date.setDate(date.getDate() - week * 7);
        recentSessions.push({
          date: date.toISOString(),
          calculatedLoad: 300,
          readinessScore: 8,
        });
      }

      const result = manager.checkDeloadRequirement(userProfile, recentSessions);

      expect(result.required).toBe(true);
    });
  });

  describe('applyAutoAdjustments', () => {
    it('should apply load reduction', () => {
      const workout = {
        estimatedLoad: 100,
        structure: [{ type: 'main', sets: 10, work: { duration: 60, intensity: 'Z4' } }],
      };

      const adjustments = [
        {
          type: 'load_reduction',
          factor: 0.3,
          reason: 'Weekly load cap exceeded',
        },
      ];

      const modified = manager.applyAutoAdjustments(workout, adjustments);

      expect(modified.isModified).toBe(true);
      expect(modified.structure[0].sets).toBeLessThan(10);
    });

    it('should apply intensity reduction', () => {
      const workout = {
        estimatedLoad: 80,
        structure: [{ type: 'main', duration: 2400, intensity: 'Z5' }],
      };

      const adjustments = [
        {
          type: 'intensity_reduction',
          newIntensity: 'Z2',
          reason: 'Insufficient recovery',
        },
      ];

      const modified = manager.applyAutoAdjustments(workout, adjustments);

      expect(modified.isModified).toBe(true);
      expect(modified.structure[0].intensity).toBe('Z2');
    });

    it('should apply deload reduction', () => {
      const workout = {
        estimatedLoad: 100,
        structure: [{ type: 'main', sets: 10, work: { duration: 60, intensity: 'Z4' } }],
      };

      const adjustments = [
        {
          type: 'deload_week',
          loadReduction: 0.4,
          reason: 'Scheduled deload',
        },
      ];

      const modified = manager.applyAutoAdjustments(workout, adjustments);

      expect(modified.isModified).toBe(true);
      expect(modified.modifications).toContain('Deload: 40% reduction');
    });

    it('should return original workout if no adjustments', () => {
      const workout = {
        estimatedLoad: 50,
        structure: [{ type: 'main', duration: 1800, intensity: 'Z3' }],
      };

      const modified = manager.applyAutoAdjustments(workout, []);

      expect(modified).toEqual(workout);
    });
  });

  describe('Helper methods', () => {
    it('should calculate workout load', () => {
      const workout = {
        estimatedLoad: 75,
        structure: [],
      };

      const load = manager.calculateWorkoutLoad(workout);

      expect(load).toBe(75);
    });

    it('should calculate hard minutes', () => {
      const workout = {
        structure: [{ type: 'main', sets: 8, work: { duration: 60, intensity: 'Z5' } }],
      };

      const hardMinutes = manager.calculateHardMinutes(workout);

      expect(hardMinutes).toBeGreaterThan(0);
    });

    it('should identify hard session', () => {
      const session = {
        averageIntensity: 'Z4',
        hardMinutes: 15,
      };

      const isHard = manager.isHardSession(session);

      expect(isHard).toBe(true);
    });

    it('should get max intensity from workout', () => {
      const workout = {
        structure: [
          { type: 'main', duration: 1800, intensity: 'Z2' },
          { type: 'main', sets: 8, work: { duration: 60, intensity: 'Z5' } },
        ],
      };

      const maxIntensity = manager.getMaxIntensity(workout);

      expect(maxIntensity).toBe('Z5');
    });
  });
});
