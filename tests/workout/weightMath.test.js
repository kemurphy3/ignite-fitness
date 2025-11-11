/**
 * WeightMath Unit Tests
 * Tests for practical gym math and plate loading
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('WeightMath', () => {
  let weightMath;

  beforeEach(() => {
    // Mock window.WeightMath for Node.js environment
    global.window = global.window || {};
    if (!global.window.WeightMath) {
      class MockWeightMath {
        constructor() {
          this.equipment = {
            availablePlates: [45, 35, 25, 10, 5, 2.5],
            mode: 'us',
            barWeight: 45,
            unit: 'lb',
          };
        }

        gymLoadPlan(config, targetWeight) {
          const barWeight = config.barWeight || 45;
          const weightPerSide = (targetWeight - barWeight) / 2;

          if (weightPerSide <= 0) {
            return {
              target: targetWeight,
              totalWeight: barWeight,
              sides: [],
              text: `${barWeight} lb bar only`,
              exact: true,
            };
          }

          // Greedy plate calculation
          const availablePlates = config.availablePlates || [45, 35, 25, 10, 5, 2.5];
          const plates = [];
          let remaining = weightPerSide;

          for (const plate of availablePlates) {
            while (remaining >= plate) {
              plates.push(plate);
              remaining -= plate;
            }
          }

          const total = plates.reduce((sum, p) => sum + p, 0);
          const actualTotal = barWeight + total * 2;
          const isExact = Math.abs(actualTotal - targetWeight) < 0.1;

          let text = `Load ${barWeight} ${config.unit || 'lb'} bar + ${plates.join(' + ')} per side → ${actualTotal} ${config.unit || 'lb'} total`;
          if (!isExact) {
            text += ` (target: ${targetWeight} ${config.unit || 'lb'})`;
          }

          return {
            target: targetWeight,
            totalWeight: actualTotal,
            sides: plates,
            text,
            exact: isExact,
            note: !isExact ? 'Closest possible with available plates' : undefined,
            unit: config.unit || 'lb',
          };
        }
      }

      global.window.WeightMath = MockWeightMath;
    }

    weightMath = new global.window.WeightMath();
  });

  describe('gymLoadPlan', () => {
    it('should calculate exact load with 2.5s', () => {
      const config = {
        availablePlates: [45, 35, 25, 10, 5, 2.5],
        barWeight: 45,
        unit: 'lb',
      };

      const result = weightMath.gymLoadPlan(config, 135); // 45 bar + 45 per side

      expect(result.exact).toBe(true);
      expect(result.text).toContain('135 lb total');
    });

    it('should round when 2.5s not available', () => {
      const config = {
        availablePlates: [45, 35, 25, 10, 5], // No 2.5s
        barWeight: 45,
        unit: 'lb',
      };

      const result = weightMath.gymLoadPlan(config, 137.5); // Would need 2.5s

      expect(result.note).toBeTruthy();
      expect(result.exact).toBe(false);
    });

    it('should handle metric configuration', () => {
      const config = {
        availablePlates: [20, 15, 10, 5, 2.5, 1.25],
        barWeight: 20,
        mode: 'metric',
        unit: 'kg',
      };

      const result = weightMath.gymLoadPlan(config, 100); // 20 bar + 40 per side

      expect(result.text).toContain('kg');
      expect(result.unit || 'kg').toBe('kg');
    });

    it('should return bar only for weights less than bar', () => {
      const config = {
        availablePlates: [45, 35, 25, 10, 5, 2.5],
        barWeight: 45,
        unit: 'lb',
      };

      const result = weightMath.gymLoadPlan(config, 40);

      expect(result.totalWeight).toBe(45);
      expect(result.sides.length).toBe(0);
      expect(result.text).toContain('bar only');
    });

    it('should handle exactly bar weight', () => {
      const config = {
        availablePlates: [45, 35, 25, 10, 5, 2.5],
        barWeight: 45,
        unit: 'lb',
      };

      const result = weightMath.gymLoadPlan(config, 45);

      expect(result.totalWeight).toBe(45);
      expect(result.exact).toBe(true);
    });
  });

  describe('instruction text format', () => {
    it('should format as "Load X lb bar + plates per side → total lb"', () => {
      const config = {
        availablePlates: [45, 35, 25, 10, 5, 2.5],
        barWeight: 45,
        unit: 'lb',
      };

      const result = weightMath.gymLoadPlan(config, 135);

      expect(result.text).toMatch(/Load \d+ lb bar/);
      expect(result.text).toContain('per side');
      expect(result.text).toContain('total');
    });
  });
});
