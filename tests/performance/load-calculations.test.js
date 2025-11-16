/**
 * Load Calculation Performance Tests
 * Tests for performance with large datasets and complex calculations
 */

import { describe, it, expect } from 'vitest';

describe('Load Calculation Performance', () => {
  it('should handle large session datasets efficiently', () => {
    // Generate 1000 sessions over 20 weeks
    const sessions = Array.from({ length: 1000 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      load: Math.random() * 100,
      duration: Math.random() * 120,
      intensity: Math.random() * 10,
    }));

    const start = performance.now();

    // Simulate weekly load calculations
    for (let week = 0; week < 20; week++) {
      const weekSessions = sessions.slice(week * 50, (week + 1) * 50);
      const weekLoad = weekSessions.reduce((sum, s) => sum + s.load, 0);
      expect(weekLoad).toBeGreaterThan(0);
    }

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(500); // Should complete in <500ms
  });

  it('should handle rapid sequential load calculations', () => {
    const sessions = Array.from({ length: 100 }, (_, i) => ({
      load: Math.random() * 100,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    }));

    const start = performance.now();

    // Perform 100 rapid calculations
    for (let i = 0; i < 100; i++) {
      const total = sessions.reduce((sum, s) => sum + s.load, 0);
      expect(total).toBeGreaterThan(0);
    }

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(100); // Should complete in <100ms
  });

  it('should handle week view calculations with large datasets efficiently', () => {
    // Generate large dataset
    const largePlannedSessions = Array.from({ length: 100 }, (_, i) => ({
      date: `2024-01-${(i % 31) + 1}`.padStart(10, '0'),
      load: Math.random() * 100,
    }));

    const largeCompletedSessions = Array.from({ length: 80 }, (_, i) => ({
      date: `2024-01-${(i % 31) + 1}`.padStart(10, '0'),
      load: Math.random() * 90,
    }));

    const calculateTotalLoad = sessions => {
      return sessions.reduce((sum, s) => sum + (s.load || 0), 0);
    };

    const start = performance.now();

    const plannedLoad = calculateTotalLoad(largePlannedSessions);
    const completedLoad = calculateTotalLoad(largeCompletedSessions);
    const loadRatio = plannedLoad > 0 ? completedLoad / plannedLoad : 0;

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(100); // Should complete in <100ms
    expect(plannedLoad).toBeGreaterThan(0);
    expect(completedLoad).toBeGreaterThan(0);
    expect(loadRatio).toBeGreaterThan(0);
    expect(loadRatio).toBeLessThan(2); // Should be reasonable
  });

  it('should handle daily breakdown calculations efficiently', () => {
    const weekStart = new Date('2024-01-07');
    const sessions = Array.from({ length: 200 }, (_, i) => ({
      date: new Date(weekStart.getTime() + (i % 7) * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      load: Math.random() * 100,
    }));

    const start = performance.now();

    // Group sessions by day
    const dailyBreakdown = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(currentDate.getDate() + i);
      const dateString = currentDate.toISOString().split('T')[0];

      const daySessions = sessions.filter(s => s.date === dateString);
      const dayLoad = daySessions.reduce((sum, s) => sum + s.load, 0);

      dailyBreakdown.push({
        date: dateString,
        load: dayLoad,
      });
    }

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(50); // Should complete in <50ms
    expect(dailyBreakdown).toHaveLength(7);
    dailyBreakdown.forEach(day => {
      expect(day.load).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle ramp rate calculations for multiple users efficiently', () => {
    const users = Array.from({ length: 50 }, (_, i) => ({
      userId: `user${i}`,
      weeklyLoads: Array.from({ length: 4 }, () => Math.random() * 200 + 50),
    }));

    const start = performance.now();

    users.forEach(user => {
      const loads = user.weeklyLoads;
      if (loads.length >= 2) {
        const currentLoad = loads[0];
        const previousLoad = loads[1];
        if (previousLoad > 0) {
          const rampRate = (currentLoad - previousLoad) / previousLoad;
          expect(rampRate).toBeGreaterThan(-2); // Should be reasonable
          // With random values 50-250, max ramp rate could be (250-50)/50 = 4.0
          // Allow for realistic variation in test data
          expect(rampRate).toBeLessThan(5.0); // Allow for edge cases in random test data
        }
      }
    });

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(50); // Should complete in <50ms
  });

  it('should handle load status determination efficiently', () => {
    const loadRatios = Array.from({ length: 1000 }, () => Math.random() * 2);

    const thresholds = {
      onTrack: { min: 0.9, max: 1.1 },
      slightlyOver: { min: 1.1, max: 1.2 },
      slightlyUnder: { min: 0.8, max: 0.9 },
      significantlyOver: { min: 1.2, max: Infinity },
      significantlyUnder: { min: 0, max: 0.8 },
    };

    const determineLoadStatus = ratio => {
      for (const [statusKey, threshold] of Object.entries(thresholds)) {
        if (ratio >= threshold.min && ratio < threshold.max) {
          return statusKey;
        }
      }
      return 'onTrack';
    };

    const start = performance.now();

    const statuses = loadRatios.map(ratio => determineLoadStatus(ratio));

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(50); // Should complete in <50ms
    expect(statuses).toHaveLength(1000);
    statuses.forEach(status => {
      expect([
        'onTrack',
        'slightlyOver',
        'slightlyUnder',
        'significantlyOver',
        'significantlyUnder',
      ]).toContain(status);
    });
  });
});
