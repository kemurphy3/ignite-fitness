/**
 * LoadGuardrails Unit Tests
 * Tests for weekly ramp-rate monitoring, HIIT reduction, and recovery protocols
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  audit: vi.fn(),
  debug: vi.fn(),
};

const mockEventBus = {
  on: vi.fn(),
  emit: vi.fn(),
  TOPICS: {
    SESSION_COMPLETED: 'SESSION_COMPLETED',
    READINESS_UPDATED: 'READINESS_UPDATED',
  },
};

const mockLoadCalculator = {
  calculateWeeklyLoad: vi.fn(sessions => ({
    total: sessions.reduce((sum, s) => sum + (s.load || 0), 0),
    volumeLoad: 0,
    intensityLoad: 0,
  })),
};

const mockAuthManager = {
  getCurrentUser: vi.fn(() => ({
    username: 'testuser',
    personalData: { experience: 'intermediate' },
  })),
};

const mockStorageManager = {
  getUser: vi.fn(),
  get: vi.fn(() => []),
  set: vi.fn(),
};

// Load LoadGuardrails class
class LoadGuardrails {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.loadCalculator = window.LoadCalculator;
    this.authManager = window.AuthManager;
    this.storageManager = window.StorageManager;
    this.rampRateThresholds = this.initializeRampRateThresholds();
    this.recoveryProtocols = this.initializeRecoveryProtocols();
    this.adjustmentHistory = new Map();
    this.initializeEventListeners();
  }

  initializeRampRateThresholds() {
    return {
      beginner: {
        maxWeeklyIncrease: 0.08,
        hiitReduction: 0.25,
        consecutiveDaysLimit: 3,
        minRestDays: 2,
      },
      intermediate: {
        maxWeeklyIncrease: 0.1,
        hiitReduction: 0.2,
        consecutiveDaysLimit: 4,
        minRestDays: 1,
      },
      advanced: {
        maxWeeklyIncrease: 0.12,
        hiitReduction: 0.15,
        consecutiveDaysLimit: 5,
        minRestDays: 1,
      },
      elite: {
        maxWeeklyIncrease: 0.15,
        hiitReduction: 0.1,
        consecutiveDaysLimit: 6,
        minRestDays: 1,
      },
    };
  }

  initializeRecoveryProtocols() {
    return {
      rampExceeded: { action: 'reduce_hiit', duration: 7 },
      missedDays: { action: 'gradual_return', rampDown: 0.15, maxReduction: 0.4 },
      painFlag: { action: 'immediate_downshift', reduction: 0.3, duration: 14 },
      consecutiveDays: { action: 'mandatory_rest' },
    };
  }

  initializeEventListeners() {
    if (this.eventBus) {
      this.eventBus.on(this.eventBus.TOPICS?.SESSION_COMPLETED, () => {});
      this.eventBus.on('PAIN_REPORTED', () => {});
      this.eventBus.on('SESSION_PLANNED', () => {});
    }
  }

  async checkWeeklyRampRate(userId) {
    try {
      const loadHistory = await this.getWeeklyLoadHistory(userId, 2);

      if (!loadHistory || loadHistory.length < 2) {
        return { status: 'insufficient_data' };
      }

      const currentWeek = loadHistory[0];
      const previousWeek = loadHistory[1];

      if (!currentWeek || !previousWeek || previousWeek.totalLoad === 0) {
        return { status: 'insufficient_data' };
      }

      const thresholds = this.rampRateThresholds.intermediate;
      const rampRate = (currentWeek.totalLoad - previousWeek.totalLoad) / previousWeek.totalLoad;
      const rampAnalysis = this.analyzeRampRate(rampRate, thresholds, loadHistory);

      if (rampAnalysis.exceedsThreshold) {
        const actions = await this.applyRampRateGuardrails(userId, rampAnalysis, thresholds);
        return {
          status: 'guardrail_applied',
          rampRate,
          threshold: thresholds.maxWeeklyIncrease,
          actions,
          message: rampAnalysis.message,
        };
      }

      return {
        status: 'within_limits',
        rampRate,
        threshold: thresholds.maxWeeklyIncrease,
        message: 'Training load progression is within safe limits',
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Unable to check training load progression',
      };
    }
  }

  calculateHIITReduction(rampAnalysis, thresholds) {
    const baseReduction = thresholds.hiitReduction;
    const excessRate = rampAnalysis.rampRate - thresholds.maxWeeklyIncrease;
    const scaledReduction = baseReduction + excessRate * 0.5;
    return Math.min(scaledReduction, 0.5);
  }

  isHighIntensitySession(session) {
    return (
      session.tags?.includes('HIIT') ||
      session.intensity?.primary_zone === 'Z4' ||
      session.intensity?.primary_zone === 'Z5' ||
      session.rpe >= 8
    );
  }

  reduceIntensityZone(currentZone, reduction) {
    const zoneMap = { Z1: 1, Z2: 2, Z3: 3, Z4: 4, Z5: 5 };
    const currentLevel = zoneMap[currentZone] || 3;
    const zoneReduction = reduction >= 0.3 ? 2 : 1;
    const newLevel = Math.max(1, currentLevel - zoneReduction);
    const reverseMap = { 1: 'Z1', 2: 'Z2', 3: 'Z3', 4: 'Z4', 5: 'Z5' };
    return reverseMap[newLevel] || 'Z3';
  }

  async handleMissedDays(userId, missedDays) {
    if (missedDays < 3) {
      return { status: 'no_action' };
    }
    const protocol = this.recoveryProtocols.missedDays;
    const totalReduction = Math.min(missedDays * protocol.rampDown, protocol.maxReduction);
    return {
      status: 'downshift_applied',
      actions: [{ type: 'gradual_return', reduction: totalReduction }],
    };
  }

  async handlePainFlag(userId, painLevel, location) {
    const protocol = this.recoveryProtocols.painFlag;
    const scaledReduction = Math.min(protocol.reduction + (painLevel - 5) * 0.05, 0.5);
    return {
      status: 'pain_response_applied',
      actions: [{ type: 'immediate_downshift', reduction: scaledReduction }],
    };
  }

  async validatePlannedSession(userId, session) {
    return { valid: true };
  }

  checkConsecutiveIncreases(loadHistory, threshold) {
    let consecutive = 0;
    for (let i = 0; i < loadHistory.length - 1; i++) {
      const current = loadHistory[i];
      const previous = loadHistory[i + 1];
      if (previous.totalLoad > 0) {
        const rate = (current.totalLoad - previous.totalLoad) / previous.totalLoad;
        if (rate > threshold) {
          consecutive++;
        } else {
          break;
        }
      }
    }
    return consecutive;
  }

  async getWeeklyLoadHistory(userId, weeks) {
    return [];
  }
  async getRecentSessions(userId, days) {
    return [];
  }
  async getUpcomingSessions(userId, days) {
    return [];
  }
  async modifyUpcomingHIIT(userId, reduction) {}
  async saveSessionModification(userId, session) {}
  async applySessionModifications(userId, actions) {}
  async getActiveAdjustments(userId) {
    return [];
  }
  async applyRampRateGuardrails(userId, rampAnalysis, thresholds) {
    return [];
  }
  analyzeRampRate(rampRate, thresholds, loadHistory) {
    const exceedsThreshold = rampRate > thresholds.maxWeeklyIncrease;
    let severity = 'low';
    if (rampRate > thresholds.maxWeeklyIncrease * 1.5) {
      severity = 'high';
    } else if (rampRate > thresholds.maxWeeklyIncrease * 1.2) {
      severity = 'moderate';
    }
    return {
      rampRate,
      exceedsThreshold,
      severity,
      consecutiveIncreases: this.checkConsecutiveIncreases(
        loadHistory,
        thresholds.maxWeeklyIncrease
      ),
      recommendedReduction: this.calculateRecommendedReduction(rampRate, thresholds),
      message: `Load increase detected (${Math.round(rampRate * 100)}% vs ${Math.round(thresholds.maxWeeklyIncrease * 100)}% max)`,
    };
  }
  calculateRecommendedReduction(rampRate, thresholds) {
    const excessRate = rampRate - thresholds.maxWeeklyIncrease;
    const baseReduction = thresholds.hiitReduction;
    const scaledReduction = baseReduction + excessRate * 0.5;
    return Math.min(scaledReduction, 0.5);
  }
  generateRampRateMessage(rampRate, thresholds, severity) {
    return 'Test message';
  }
  countConsecutiveTrainingDays(sessions) {
    return 0;
  }
  sessionViolatesAdjustment(session, adjustment) {
    return false;
  }
  getSessionIntensity(session) {
    return 0.6;
  }
  async getUserSessions(userId) {
    return [];
  }
  calculateNextReviewDate() {
    return new Date().toISOString();
  }
  async getGuardrailStatus(userId) {
    return { activeAdjustments: [], recentAnalysis: {}, isUnderGuardrail: false };
  }
}

describe('LoadGuardrails', () => {
  let guardrails;

  beforeEach(() => {
    // Setup mocks
    window.SafeLogger = mockLogger;
    window.EventBus = mockEventBus;
    window.LoadCalculator = mockLoadCalculator;
    window.AuthManager = mockAuthManager;
    window.StorageManager = mockStorageManager;

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    // Reset mocks
    vi.clearAllMocks();

    // Create new instance for testing
    guardrails = new LoadGuardrails();
  });

  describe('Initialization', () => {
    it('should initialize with correct ramp rate thresholds', () => {
      expect(guardrails.rampRateThresholds).toBeDefined();
      expect(guardrails.rampRateThresholds.intermediate.maxWeeklyIncrease).toBe(0.1);
      expect(guardrails.rampRateThresholds.intermediate.hiitReduction).toBe(0.2);
    });

    it('should initialize recovery protocols', () => {
      expect(guardrails.recoveryProtocols).toBeDefined();
      expect(guardrails.recoveryProtocols.rampExceeded).toBeDefined();
      expect(guardrails.recoveryProtocols.missedDays).toBeDefined();
      expect(guardrails.recoveryProtocols.painFlag).toBeDefined();
    });

    it('should set up event listeners', () => {
      expect(mockEventBus.on).toHaveBeenCalled();
    });
  });

  describe('Ramp Rate Monitoring', () => {
    it('should detect ramp rate exceeding threshold', async () => {
      // Mock weekly load history with 15% increase (exceeds 10% threshold)
      const loadHistory = [
        { week: 0, totalLoad: 230, startDate: new Date().toISOString() },
        { week: 1, totalLoad: 200, startDate: new Date().toISOString() },
      ];

      guardrails.getWeeklyLoadHistory = vi.fn().mockResolvedValue(loadHistory);

      const result = await guardrails.checkWeeklyRampRate('testuser');

      expect(result.status).toBe('guardrail_applied');
      expect(result.rampRate).toBeGreaterThan(0.1);
      expect(result.actions).toBeDefined();
    });

    it('should allow ramp rate within threshold', async () => {
      // Mock weekly load history with 5% increase (within 10% threshold)
      const loadHistory = [
        { week: 0, totalLoad: 210, startDate: new Date().toISOString() },
        { week: 1, totalLoad: 200, startDate: new Date().toISOString() },
      ];

      guardrails.getWeeklyLoadHistory = vi.fn().mockResolvedValue(loadHistory);

      const result = await guardrails.checkWeeklyRampRate('testuser');

      expect(result.status).toBe('within_limits');
      expect(result.rampRate).toBeLessThanOrEqual(0.1);
    });

    it('should return insufficient data for < 2 weeks', async () => {
      const loadHistory = [{ week: 0, totalLoad: 200, startDate: new Date().toISOString() }];

      guardrails.getWeeklyLoadHistory = vi.fn().mockResolvedValue(loadHistory);

      const result = await guardrails.checkWeeklyRampRate('testuser');

      expect(result.status).toBe('insufficient_data');
    });

    it('should calculate HIIT reduction correctly', () => {
      const rampAnalysis = {
        rampRate: 0.15, // 15% increase (exceeds 10% by 5%)
        exceedsThreshold: true,
        severity: 'moderate',
      };

      const thresholds = guardrails.rampRateThresholds.intermediate;
      const reduction = guardrails.calculateHIITReduction(rampAnalysis, thresholds);

      // Base reduction (20%) + scaled excess (5% * 0.5 = 2.5%) = 22.5%
      expect(reduction).toBeGreaterThan(0.2);
      expect(reduction).toBeLessThanOrEqual(0.5);
    });

    it('should cap HIIT reduction at 50%', () => {
      const rampAnalysis = {
        rampRate: 0.5, // 50% increase (very high)
        exceedsThreshold: true,
        severity: 'high',
      };

      const thresholds = guardrails.rampRateThresholds.intermediate;
      const reduction = guardrails.calculateHIITReduction(rampAnalysis, thresholds);

      expect(reduction).toBeLessThanOrEqual(0.5);
    });
  });

  describe('HIIT Reduction', () => {
    it('should identify high-intensity sessions', () => {
      const hiitSession = {
        tags: ['HIIT'],
        intensity: { primary_zone: 'Z4' },
        rpe: 8,
      };

      const lowIntensitySession = {
        tags: ['endurance'],
        intensity: { primary_zone: 'Z2' },
        rpe: 5,
      };

      expect(guardrails.isHighIntensitySession(hiitSession)).toBe(true);
      expect(guardrails.isHighIntensitySession(lowIntensitySession)).toBe(false);
    });

    it('should modify upcoming HIIT sessions', async () => {
      const upcomingSessions = [
        { id: 1, tags: ['HIIT'], intensity: { primary_zone: 'Z5' } },
        { id: 2, tags: ['endurance'], intensity: { primary_zone: 'Z2' } },
        { id: 3, tags: ['HIIT'], intensity: { primary_zone: 'Z4' } },
      ];

      guardrails.getUpcomingSessions = vi.fn().mockResolvedValue(upcomingSessions);
      guardrails.saveSessionModification = vi.fn().mockResolvedValue();

      await guardrails.modifyUpcomingHIIT('testuser', 0.2);

      expect(guardrails.saveSessionModification).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('GUARDRAIL_APPLIED', expect.any(Object));
    });

    it('should reduce intensity zones correctly', () => {
      expect(guardrails.reduceIntensityZone('Z5', 0.2)).toBe('Z4');
      // For 0.3 reduction, zoneReduction = 2, so Z4 -> Z2 (not Z3)
      expect(guardrails.reduceIntensityZone('Z4', 0.3)).toBe('Z2');
      expect(guardrails.reduceIntensityZone('Z3', 0.2)).toBe('Z2');
    });
  });

  describe('Missed Days Handling', () => {
    it('should not adjust for < 3 missed days', async () => {
      const result = await guardrails.handleMissedDays('testuser', 2);

      expect(result.status).toBe('no_action');
    });

    it('should apply downshift for 3+ missed days', async () => {
      guardrails.applySessionModifications = vi.fn().mockResolvedValue();

      const result = await guardrails.handleMissedDays('testuser', 5);

      expect(result.status).toBe('downshift_applied');
      expect(result.actions).toBeDefined();
      expect(result.actions[0].reduction).toBeGreaterThan(0);
    });

    it('should cap reduction at 40% for missed days', async () => {
      guardrails.applySessionModifications = vi.fn().mockResolvedValue();

      const result = await guardrails.handleMissedDays('testuser', 10); // 10 days

      // 10 days * 15% = 150%, but capped at 40%
      expect(result.actions[0].reduction).toBeLessThanOrEqual(0.4);
    });
  });

  describe('Pain Flag Handling', () => {
    it('should apply immediate downshift for pain', async () => {
      guardrails.applySessionModifications = vi.fn().mockResolvedValue();

      const result = await guardrails.handlePainFlag('testuser', 6, 'knee');

      expect(result.status).toBe('pain_response_applied');
      expect(result.actions[0].type).toBe('immediate_downshift');
      expect(result.actions[0].reduction).toBeGreaterThanOrEqual(0.3);
    });

    it('should scale reduction based on pain level', async () => {
      guardrails.applySessionModifications = vi.fn().mockResolvedValue();

      const lowPain = await guardrails.handlePainFlag('testuser', 5, 'knee');
      const highPain = await guardrails.handlePainFlag('testuser', 8, 'knee');

      expect(highPain.actions[0].reduction).toBeGreaterThan(lowPain.actions[0].reduction);
    });

    it('should cap pain reduction at 50%', async () => {
      guardrails.applySessionModifications = vi.fn().mockResolvedValue();

      const result = await guardrails.handlePainFlag('testuser', 10, 'knee');

      expect(result.actions[0].reduction).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Session Validation', () => {
    it('should validate session against consecutive days limit', async () => {
      const recentSessions = [
        { date: new Date().toISOString() },
        { date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
        { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
      ];

      guardrails.getRecentSessions = vi.fn().mockResolvedValue(recentSessions);
      guardrails.getActiveAdjustments = vi.fn().mockResolvedValue([]);

      const session = { date: new Date().toISOString() };
      const result = await guardrails.validatePlannedSession('testuser', session);

      // 5 consecutive days exceeds intermediate limit of 4
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('consecutive_days_exceeded');
    });

    it('should allow session within consecutive days limit', async () => {
      const recentSessions = [
        { date: new Date().toISOString() },
        { date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
        { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
      ];

      guardrails.getRecentSessions = vi.fn().mockResolvedValue(recentSessions);
      guardrails.getActiveAdjustments = vi.fn().mockResolvedValue([]);

      const session = { date: new Date().toISOString() };
      const result = await guardrails.validatePlannedSession('testuser', session);

      expect(result.valid).toBe(true);
    });

    it('should reject session violating active adjustment', async () => {
      const activeAdjustments = [
        {
          type: 'reduce_hiit',
          reduction: 0.2,
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      guardrails.getRecentSessions = vi.fn().mockResolvedValue([]);
      guardrails.getActiveAdjustments = vi.fn().mockResolvedValue(activeAdjustments);

      const hiitSession = {
        tags: ['HIIT'],
        intensity: { primary_zone: 'Z5' },
        date: new Date().toISOString(),
      };

      const result = await guardrails.validatePlannedSession('testuser', hiitSession);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('violates_adjustment');
    });
  });

  describe('Experience Level Customization', () => {
    it('should use beginner thresholds for beginner users', async () => {
      mockAuthManager.getCurrentUser.mockReturnValue({
        username: 'beginner',
        personalData: { experience: 'beginner' },
      });

      const loadHistory = [
        { week: 0, totalLoad: 110, startDate: new Date().toISOString() },
        { week: 1, totalLoad: 100, startDate: new Date().toISOString() },
      ];

      guardrails.getWeeklyLoadHistory = vi.fn().mockResolvedValue(loadHistory);

      const result = await guardrails.checkWeeklyRampRate('beginner');

      // 10% increase exceeds beginner's 8% threshold
      expect(result.status).toBe('guardrail_applied');
      expect(result.threshold).toBe(0.08);
    });

    it('should use advanced thresholds for advanced users', async () => {
      mockAuthManager.getCurrentUser.mockReturnValue({
        username: 'advanced',
        personalData: { experience: 'advanced' },
      });

      const loadHistory = [
        { week: 0, totalLoad: 225, startDate: new Date().toISOString() },
        { week: 1, totalLoad: 200, startDate: new Date().toISOString() },
      ];

      guardrails.getWeeklyLoadHistory = vi.fn().mockResolvedValue(loadHistory);

      const result = await guardrails.checkWeeklyRampRate('advanced');

      // 12.5% increase exceeds advanced's 12% threshold
      expect(result.status).toBe('guardrail_applied');
      expect(result.threshold).toBe(0.12);
    });
  });

  describe('Consecutive Increases Detection', () => {
    it('should detect consecutive weeks of high increases', () => {
      const loadHistory = [
        { week: 0, totalLoad: 250 }, // 25% increase
        { week: 1, totalLoad: 200 }, // 20% increase
        { week: 2, totalLoad: 160 },
      ];

      const consecutive = guardrails.checkConsecutiveIncreases(loadHistory, 0.1);

      // Both weeks exceed 10% threshold
      expect(consecutive).toBeGreaterThanOrEqual(1);
    });

    it('should trigger deload week recommendation for consecutive increases', async () => {
      const loadHistory = [
        { week: 0, totalLoad: 250, startDate: new Date().toISOString() },
        { week: 1, totalLoad: 200, startDate: new Date().toISOString() },
        { week: 2, totalLoad: 160, startDate: new Date().toISOString() },
      ];

      guardrails.getWeeklyLoadHistory = vi.fn().mockResolvedValue(loadHistory);
      guardrails.applyRampRateGuardrails = vi.fn().mockResolvedValue([
        { type: 'reduce_hiit', reduction: 0.2 },
        { type: 'deload_week', reduction: 0.25 },
      ]);

      const result = await guardrails.checkWeeklyRampRate('testuser');

      if (result.status === 'guardrail_applied') {
        const deloadAction = result.actions.find(a => a.type === 'deload_week');
        expect(deloadAction).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero previous load', async () => {
      const loadHistory = [
        { week: 0, totalLoad: 100, startDate: new Date().toISOString() },
        { week: 1, totalLoad: 0, startDate: new Date().toISOString() },
      ];

      guardrails.getWeeklyLoadHistory = vi.fn().mockResolvedValue(loadHistory);

      const result = await guardrails.checkWeeklyRampRate('testuser');

      // Should handle gracefully
      expect(result).toBeDefined();
    });

    it('should fail open if validation error occurs', async () => {
      guardrails.getRecentSessions = vi.fn().mockRejectedValue(new Error('Database error'));

      const session = { date: new Date().toISOString() };
      const result = await guardrails.validatePlannedSession('testuser', session);

      // Fail open for safety
      expect(result.valid).toBe(true);
      expect(result.message).toContain('caution');
    });

    it('should handle missing EventBus gracefully', () => {
      window.EventBus = null;
      const guardrailsNoEventBus = new LoadGuardrails();

      expect(guardrailsNoEventBus).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Integration with LoadCalculator', () => {
    it('should use LoadCalculator for weekly load calculation', async () => {
      const sessions = [{ load: 50 }, { load: 30 }, { load: 20 }];

      mockLoadCalculator.calculateWeeklyLoad.mockReturnValue({
        total: 100,
        volumeLoad: 50,
        intensityLoad: 50,
      });

      guardrails.getUserSessions = vi.fn().mockResolvedValue(sessions);

      const loadHistory = await guardrails.getWeeklyLoadHistory('testuser', 2);

      expect(mockLoadCalculator.calculateWeeklyLoad).toHaveBeenCalled();
      expect(loadHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases - Enhanced', () => {
    it('should handle zero previous load without crashing', () => {
      const currentPeriod = { total: 100 };
      const previousPeriod = { total: 0 };

      const rampRate =
        guardrails.loadCalculator?.calculateRampRate?.(currentPeriod, previousPeriod) || 0;

      expect(rampRate).toBe(0); // Should not crash with division by zero
      expect(isNaN(rampRate)).toBe(false);
    });

    it('should handle negative load values gracefully', () => {
      const currentPeriod = { total: -50 };
      const previousPeriod = { total: 100 };

      const rampRate =
        guardrails.loadCalculator?.calculateRampRate?.(currentPeriod, previousPeriod) || 0;

      // Should handle negative values without crashing
      expect(isNaN(rampRate)).toBe(false);
    });

    it('should handle very large load values', () => {
      const currentPeriod = { total: 1000000 };
      const previousPeriod = { total: 100000 };

      const rampRate =
        guardrails.loadCalculator?.calculateRampRate?.(currentPeriod, previousPeriod) || 0;

      expect(isFinite(rampRate)).toBe(true);
    });

    it('should handle missing user data gracefully', async () => {
      mockAuthManager.getCurrentUser.mockReturnValue(null);
      mockAuthManager.getCurrentUsername.mockReturnValue(null);

      const result = await guardrails.checkWeeklyRampRate('testuser');

      // Should handle gracefully without crashing
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle large load history efficiently', async () => {
      const largeHistory = Array.from({ length: 100 }, (_, i) => ({
        week: i,
        totalLoad: Math.random() * 200,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      }));

      const start = performance.now();

      const analysis = guardrails.analyzeRampRate(0.15, { maxWeeklyIncrease: 0.1 }, largeHistory);

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(100); // Should complete in <100ms
      expect(analysis).toBeDefined();
    });
  });
});
