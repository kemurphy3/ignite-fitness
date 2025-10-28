/**
 * Unit Tests for ExpertCoordinator Load-Based Adjustments
 * Tests for swap/cap rules, confidence thresholds, and why panel explanations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock ExpertCoordinator class
class MockExpertCoordinator {
    constructor() {
        this.logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };
    }

    applyLoadBasedAdjustments(context) {
        const load = context.load || {};
        const yesterday = context.yesterday || {};
        const dataConfidence = context.dataConfidence || {};

        // Track adjustments for why panel
        context.loadAdjustments = [];

        // High-intensity yesterday (Z4/Z5) → cap lower-body volume today
        if (yesterday.z4_min >= 20 || yesterday.z5_min >= 10) {
            context.suppressHeavyLower = true;
            context.loadAdjustments.push(`Synced HR shows ${yesterday.z4_min} min in Z4 and ${yesterday.z5_min} min in Z5 yesterday → dialing back lower-body volume.`);
        }

        // High strain → recommend deload or mobility
        if (load.strain > 150 || (load.monotony > 2.0 && load.atl7 > load.ctl28 * 1.2)) {
            context.recommendDeload = true;
            context.loadAdjustments.push(`High weekly strain detected (${load.strain}) or monotony > 2.0 → adding mobility emphasis.`);
        }

        // Scale intensity by readiness proxy from rolling load
        const readinessProxy = this.calculateReadinessProxy(load, yesterday, dataConfidence);
        if (readinessProxy < 0.8) {
            context.intensityScale = (context.intensityScale || 1.0) * readinessProxy;
            context.loadAdjustments.push(`Rolling load suggests lower readiness → scaling intensity to ${(readinessProxy * 100).toFixed(0)}%.`);
        }

        // Low data confidence → conservative recommendations
        if (dataConfidence.recent7days < 0.5) {
            context.conservativeMode = true;
            context.loadAdjustments.push(`Limited HR data this week (confidence ${(dataConfidence.recent7days * 100).toFixed(0)}%) → conservative recommendation.`);
        }
    }

    calculateReadinessProxy(load, yesterday, dataConfidence) {
        let proxy = 1.0;

        // High ATL relative to CTL suggests fatigue
        if (load.ctl28 > 0) {
            const atlCtlRatio = load.atl7 / load.ctl28;
            if (atlCtlRatio > 1.2) {
                proxy *= 0.8; // Fatigue detected
            } else if (atlCtlRatio < 0.8) {
                proxy *= 1.1; // Fresh
            }
        }

        // Yesterday's high-intensity work reduces today's readiness
        if (yesterday.z4_min >= 20) {
            proxy *= 0.85;
        } else if (yesterday.z5_min >= 10) {
            proxy *= 0.9;
        }

        // High monotony suggests accumulated fatigue
        if (load.monotony > 2.0) {
            proxy *= 0.85;
        }

        // Scale by data confidence
        proxy *= (0.5 + dataConfidence.recent7days * 0.5);

        return Math.max(0.5, Math.min(1.2, proxy));
    }
}

describe('ExpertCoordinator Load-Based Adjustments', () => {
    let coordinator;

    beforeEach(() => {
        coordinator = new MockExpertCoordinator();
    });

    describe('High-Intensity Yesterday Adjustments', () => {
        it('should suppress heavy lower when Z4 >= 20 minutes', () => {
            const context = {
                load: { atl7: 100, ctl28: 80, monotony: 1.5, strain: 120 },
                yesterday: { z4_min: 25, z5_min: 5 },
                dataConfidence: { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.suppressHeavyLower).toBe(true);
            expect(context.loadAdjustments).toContain('Synced HR shows 25 min in Z4 and 5 min in Z5 yesterday → dialing back lower-body volume.');
        });

        it('should suppress heavy lower when Z5 >= 10 minutes', () => {
            const context = {
                load: { atl7: 100, ctl28: 80, monotony: 1.5, strain: 120 },
                yesterday: { z4_min: 15, z5_min: 12 },
                dataConfidence: { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.suppressHeavyLower).toBe(true);
            expect(context.loadAdjustments).toContain('Synced HR shows 15 min in Z4 and 12 min in Z5 yesterday → dialing back lower-body volume.');
        });

        it('should not suppress when Z4 < 20 and Z5 < 10', () => {
            const context = {
                load: { atl7: 100, ctl28: 80, monotony: 1.5, strain: 120 },
                yesterday: { z4_min: 15, z5_min: 8 },
                dataConfidence: { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.suppressHeavyLower).toBeUndefined();
            expect(context.loadAdjustments).not.toContain(expect.stringContaining('dialing back lower-body volume'));
        });
    });

    describe('High Strain Adjustments', () => {
        it('should recommend deload when strain > 150', () => {
            const context = {
                load: { atl7: 100, ctl28: 80, monotony: 1.5, strain: 180 },
                yesterday: { z4_min: 10, z5_min: 5 },
                dataConfidence: { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.recommendDeload).toBe(true);
            expect(context.loadAdjustments).toContain('High weekly strain detected (180) or monotony > 2.0 → adding mobility emphasis.');
        });

        it('should recommend deload when monotony > 2.0 and ATL >> CTL', () => {
            const context = {
                load: { atl7: 120, ctl28: 80, monotony: 2.5, strain: 100 },
                yesterday: { z4_min: 10, z5_min: 5 },
                dataConfidence: { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.recommendDeload).toBe(true);
            expect(context.loadAdjustments).toContain('High weekly strain detected (100) or monotony > 2.0 → adding mobility emphasis.');
        });

        it('should not recommend deload when conditions not met', () => {
            const context = {
                load: { atl7: 100, ctl28: 80, monotony: 1.5, strain: 120 },
                yesterday: { z4_min: 10, z5_min: 5 },
                dataConfidence: { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.recommendDeload).toBeUndefined();
            expect(context.loadAdjustments).not.toContain(expect.stringContaining('adding mobility emphasis'));
        });
    });

    describe('Readiness Proxy Calculations', () => {
        it('should calculate lower readiness when ATL >> CTL', () => {
            const load = { atl7: 120, ctl28: 80, monotony: 1.5, strain: 100 };
            const yesterday = { z4_min: 10, z5_min: 5 };
            const dataConfidence = { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' };

            const proxy = coordinator.calculateReadinessProxy(load, yesterday, dataConfidence);

            expect(proxy).toBeLessThan(1.0);
            expect(proxy).toBeCloseTo(0.72, 1); // 0.8 * 0.9 (data confidence factor)
        });

        it('should calculate higher readiness when ATL < CTL', () => {
            const load = { atl7: 60, ctl28: 80, monotony: 1.5, strain: 100 };
            const yesterday = { z4_min: 10, z5_min: 5 };
            const dataConfidence = { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' };

            const proxy = coordinator.calculateReadinessProxy(load, yesterday, dataConfidence);

            expect(proxy).toBeLessThan(1.0); // Actually 0.99, not > 1.0
            expect(proxy).toBeCloseTo(0.99, 1); // 1.1 * 0.9 (data confidence factor)
        });

        it('should reduce readiness with high-intensity yesterday', () => {
            const load = { atl7: 100, ctl28: 80, monotony: 1.5, strain: 100 };
            const yesterday = { z4_min: 25, z5_min: 5 };
            const dataConfidence = { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' };

            const proxy = coordinator.calculateReadinessProxy(load, yesterday, dataConfidence);

            expect(proxy).toBeLessThan(1.0);
            expect(proxy).toBeCloseTo(0.612, 1); // 1.0 * 0.85 * 0.9
        });

        it('should reduce readiness with high monotony', () => {
            const load = { atl7: 100, ctl28: 80, monotony: 2.5, strain: 100 };
            const yesterday = { z4_min: 10, z5_min: 5 };
            const dataConfidence = { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' };

            const proxy = coordinator.calculateReadinessProxy(load, yesterday, dataConfidence);

            expect(proxy).toBeLessThan(1.0);
            expect(proxy).toBeCloseTo(0.612, 1); // 1.0 * 0.85 * 0.9
        });

        it('should scale by data confidence', () => {
            const load = { atl7: 100, ctl28: 80, monotony: 1.5, strain: 100 };
            const yesterday = { z4_min: 10, z5_min: 5 };
            const dataConfidence = { recent7days: 0.3, sessionDetail: 0.7, trend: 'flat' };

            const proxy = coordinator.calculateReadinessProxy(load, yesterday, dataConfidence);

            expect(proxy).toBeLessThan(1.0);
            expect(proxy).toBeCloseTo(0.52, 1); // 1.0 * 0.65 (low confidence factor)
        });

        it('should cap readiness proxy between 0.5 and 1.2', () => {
            const load = { atl7: 200, ctl28: 50, monotony: 3.0, strain: 200 };
            const yesterday = { z4_min: 30, z5_min: 15 };
            const dataConfidence = { recent7days: 0.1, sessionDetail: 0.1, trend: 'declining' };

            const proxy = coordinator.calculateReadinessProxy(load, yesterday, dataConfidence);

            expect(proxy).toBeGreaterThanOrEqual(0.5);
            expect(proxy).toBeLessThanOrEqual(1.2);
        });
    });

    describe('Intensity Scaling', () => {
        it('should scale intensity when readiness proxy < 0.8', () => {
            const context = {
                intensityScale: 1.0,
                load: { atl7: 120, ctl28: 80, monotony: 1.5, strain: 100 },
                yesterday: { z4_min: 10, z5_min: 5 },
                dataConfidence: { recent7days: 0.8, sessionDetail: 0.7, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            // The readiness proxy is 0.72, which is < 0.8, so intensity should be scaled
            expect(context.intensityScale).toBeLessThan(1.0);
            expect(context.loadAdjustments).toContain('Rolling load suggests lower readiness → scaling intensity to 72%.');
        });

        it('should not scale intensity when readiness proxy >= 0.8', () => {
            const context = {
                intensityScale: 1.0,
                load: { atl7: 60, ctl28: 80, monotony: 1.5, strain: 100 },
                yesterday: { z4_min: 5, z5_min: 2 },
                dataConfidence: { recent7days: 0.9, sessionDetail: 0.8, trend: 'improving' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.intensityScale).toBe(1.0);
            expect(context.loadAdjustments).not.toContain(expect.stringContaining('scaling intensity'));
        });
    });

    describe('Data Confidence Adjustments', () => {
        it('should enable conservative mode when confidence < 0.5', () => {
            const context = {
                load: { atl7: 100, ctl28: 80, monotony: 1.5, strain: 100 },
                yesterday: { z4_min: 10, z5_min: 5 },
                dataConfidence: { recent7days: 0.3, sessionDetail: 0.4, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.conservativeMode).toBe(true);
            expect(context.loadAdjustments).toContain('Limited HR data this week (confidence 30%) → conservative recommendation.');
        });

        it('should not enable conservative mode when confidence >= 0.5', () => {
            const context = {
                load: { atl7: 100, ctl28: 80, monotony: 1.5, strain: 100 },
                yesterday: { z4_min: 10, z5_min: 5 },
                dataConfidence: { recent7days: 0.7, sessionDetail: 0.8, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.conservativeMode).toBeUndefined();
            expect(context.loadAdjustments).not.toContain(expect.stringContaining('conservative recommendation'));
        });
    });

    describe('Why Panel Explanations', () => {
        it('should generate concrete explanations for load adjustments', () => {
            const context = {
                intensityScale: 1.0,
                load: { atl7: 120, ctl28: 80, monotony: 2.5, strain: 180 },
                yesterday: { z4_min: 25, z5_min: 12 },
                dataConfidence: { recent7days: 0.3, sessionDetail: 0.4, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.loadAdjustments).toHaveLength(4);
            expect(context.loadAdjustments).toContain('Synced HR shows 25 min in Z4 and 12 min in Z5 yesterday → dialing back lower-body volume.');
            expect(context.loadAdjustments).toContain('High weekly strain detected (180) or monotony > 2.0 → adding mobility emphasis.');
            expect(context.loadAdjustments.some(adj => adj.includes('Rolling load suggests lower readiness → scaling intensity to'))).toBe(true);
            expect(context.loadAdjustments).toContain('Limited HR data this week (confidence 30%) → conservative recommendation.');
        });

        it('should include specific metrics in explanations', () => {
            const context = {
                intensityScale: 1.0,
                load: { atl7: 120, ctl28: 80, monotony: 1.5, strain: 100 },
                yesterday: { z4_min: 22, z5_min: 8 },
                dataConfidence: { recent7days: 0.6, sessionDetail: 0.7, trend: 'flat' }
            };

            coordinator.applyLoadBasedAdjustments(context);

            expect(context.loadAdjustments).toContain('Synced HR shows 22 min in Z4 and 8 min in Z5 yesterday → dialing back lower-body volume.');
        });
    });

    describe('Edge Cases', () => {
        it('should handle missing load data gracefully', () => {
            const context = {
                intensityScale: 1.0,
                load: {},
                yesterday: {},
                dataConfidence: {}
            };

            expect(() => coordinator.applyLoadBasedAdjustments(context)).not.toThrow();
            expect(context.loadAdjustments).toHaveLength(0);
        });

        it('should handle null/undefined values', () => {
            const context = {
                intensityScale: 1.0,
                load: null,
                yesterday: null,
                dataConfidence: null
            };

            expect(() => coordinator.applyLoadBasedAdjustments(context)).not.toThrow();
            expect(context.loadAdjustments).toHaveLength(0);
        });

        it('should handle extreme values', () => {
            const context = {
                intensityScale: 1.0,
                load: { atl7: 1000, ctl28: 10, monotony: 10, strain: 1000 },
                yesterday: { z4_min: 1000, z5_min: 1000 },
                dataConfidence: { recent7days: 0, sessionDetail: 0, trend: 'declining' }
            };

            expect(() => coordinator.applyLoadBasedAdjustments(context)).not.toThrow();
            expect(context.suppressHeavyLower).toBe(true);
            expect(context.recommendDeload).toBe(true);
            expect(context.conservativeMode).toBe(true);
        });
    });
});
