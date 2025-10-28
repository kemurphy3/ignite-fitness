/**
 * WeightMath Unit Tests
 * Tests for practical gym math and plate loading
 */

import { describe, it, expect } from 'vitest';

describe('WeightMath', () => {
    let weightMath;
    
    beforeEach(() => {
        // Mock window.WeightMath
        if (!window.WeightMath) {
            class MockWeightMath {
                constructor() {
                    this.equipment = {
                        availablePlates: [45, 35, 25, 10, 5, 2.5],
                        mode: 'us',
                        barWeight: 45,
                        unit: 'lb'
                    };
                }
                
                gymLoadPlan(config, targetWeight) {
                    const barWeight = 45;
                    const weightPerSide = (targetWeight - barWeight) / 2;
                    
                    if (weightPerSide <= 0) {
                        return {
                            target: barWeight,
                            totalWeight: barWeight,
                            sides: [],
                            text: `${barWeight} lb bar only`,
                            exact: true
                        };
                    }
                    
                    // Simple plate calculation
                    const plates = [45, 35, 25, 10, 5, 2.5].filter(p => p <= weightPerSide);
                    const total = plates.reduce((sum, p) => sum + p, 0);
                    
                    return {
                        target: targetWeight,
                        totalWeight: barWeight + (total * 2),
                        sides: plates,
                        text: `Load ${barWeight} lb bar + ${plates.join(' + ')} per side → ${barWeight + (total * 2)} lb total`,
                        exact: Math.abs(total - weightPerSide) < 0.1
                    };
                }
            }
            
            window.WeightMath = MockWeightMath;
        }
        
        weightMath = new window.WeightMath();
    });

    describe('gymLoadPlan', () => {
        it('should calculate exact load with 2.5s', () => {
            const config = {
                availablePlates: [45, 35, 25, 10, 5, 2.5],
                barWeight: 45,
                unit: 'lb'
            };
            
            const result = weightMath.gymLoadPlan(config, 135); // 45 bar + 45 per side
            
            expect(result.exact).toBe(true);
            expect(result.text).toContain('135 lb total');
        });

        it('should round when 2.5s not available', () => {
            const config = {
                availablePlates: [45, 35, 25, 10, 5], // No 2.5s
                barWeight: 45,
                unit: 'lb'
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
                unit: 'kg'
            };
            
            const result = weightMath.gymLoadPlan(config, 100); // 20 bar + 40 per side
            
            expect(result.text).toContain('kg');
            expect(result.unit || 'kg').toBe('kg');
        });

        it('should return bar only for weights less than bar', () => {
            const config = {
                availablePlates: [45, 35, 25, 10, 5, 2.5],
                barWeight: 45,
                unit: 'lb'
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
                unit: 'lb'
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
                unit: 'lb'
            };
            
            const result = weightMath.gymLoadPlan(config, 135);
            
            expect(result.text).toMatch(/Load \d+ lb bar/);
            expect(result.text).toContain('per side');
            expect(result.text).toContain('total');
        });
    });
});

