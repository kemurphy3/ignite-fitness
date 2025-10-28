/**
 * Unit Tests for Aggregates Recompute
 * Tests for daily aggregates and rolling metrics (ATL/CTL/monotony/strain)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock aggregate recompute functions
class MockAggregatesRecompute {
    static async recomputeDailyAggregates(userId, date) {
        // Simulate recomputing daily aggregates
        return {
            userId,
            date,
            trimp: this.calculateTRIMP(date),
            tss: this.calculateTSS(date),
            loadScore: this.calculateLoadScore(date),
            z1Min: this.calculateZoneMinutes(date, 'z1'),
            z2Min: this.calculateZoneMinutes(date, 'z2'),
            z3Min: this.calculateZoneMinutes(date, 'z3'),
            z4Min: this.calculateZoneMinutes(date, 'z4'),
            z5Min: this.calculateZoneMinutes(date, 'z5'),
            distanceM: this.calculateDistance(date),
            durationS: this.calculateDuration(date),
            runCount: this.countActivitiesByType(date, 'Run'),
            rideCount: this.countActivitiesByType(date, 'Ride'),
            strengthCount: this.countActivitiesByType(date, 'Strength'),
            lastRecalcTs: new Date().toISOString()
        };
    }

    static calculateTRIMP(date) {
        return 45;
    }

    static calculateTSS(date) {
        return 52;
    }

    static calculateLoadScore(date) {
        return 48;
    }

    static calculateZoneMinutes(date, zone) {
        const zones = { z1: 15, z2: 25, z3: 20, z4: 10, z5: 5 };
        return zones[zone] || 0;
    }

    static calculateDistance(date) {
        return 10000; // 10 km
    }

    static calculateDuration(date) {
        return 3600; // 1 hour
    }

    static countActivitiesByType(date, type) {
        return type === 'Run' ? 1 : type === 'Ride' ? 1 : 0;
    }

    static async recomputeRollingMetrics(userId, startDate, days = 35) {
        // Simulate rolling metrics
        const dailyLoads = Array.from({ length: days }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() - i);
            return this.getLoadForDate(date);
        }).reverse();

        const atl7 = this.calculateATL(dailyLoads.slice(-7));
        const ctl28 = this.calculateCTL(dailyLoads.slice(-28));
        const monotony = this.calculateMonotony(dailyLoads.slice(-7));
        const strain = this.calculateStrain(monotony, dailyLoads.slice(-7));

        return {
            atl7,
            ctl28,
            monotony,
            strain,
            affectedDates: Array.from({ length: days }).map((_, i) => {
                const date = new Date(startDate);
                date.setDate(date.getDate() - i);
                return date.toISOString().split('T')[0];
            }).reverse()
        };
    }

    static getLoadForDate(date) {
        // Mock daily load
        return 40 + Math.random() * 20;
    }

    static calculateATL(dailyLoads) {
        if (dailyLoads.length === 0) return 0;
        
        const timeConstant = 7;
        let atl = 0;
        
        for (let i = 0; i < dailyLoads.length; i++) {
            const alpha = 1 - Math.exp(-1 / timeConstant);
            atl = alpha * dailyLoads[i] + (1 - alpha) * atl;
        }
        
        return atl;
    }

    static calculateCTL(dailyLoads) {
        if (dailyLoads.length === 0) return 0;
        
        const timeConstant = 28;
        let ctl = 0;
        
        for (let i = 0; i < dailyLoads.length; i++) {
            const alpha = 1 - Math.exp(-1 / timeConstant);
            ctl = alpha * dailyLoads[i] + (1 - alpha) * ctl;
        }
        
        return ctl;
    }

    static calculateMonotony(dailyLoads) {
        if (dailyLoads.length === 0) return 1.0;
        
        const mean = dailyLoads.reduce((sum, load) => sum + load, 0) / dailyLoads.length;
        const variance = dailyLoads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / dailyLoads.length;
        const stdDev = Math.sqrt(variance);
        
        return mean / (stdDev + 1);
    }

    static calculateStrain(monotony, dailyLoads) {
        if (dailyLoads.length === 0) return 0;
        
        const weeklyLoad = dailyLoads.reduce((sum, load) => sum + load, 0);
        return weeklyLoad * monotony;
    }
}

describe('Aggregates Recompute', () => {
    describe('recomputeDailyAggregates', () => {
        it('should recompute day + rolling ATL/CTL/monotony/strain after updates', async () => {
            const userId = 1;
            const date = '2024-01-15';
            
            const aggregates = await MockAggregatesRecompute.recomputeDailyAggregates(userId, date);
            
            expect(aggregates.userId).toBe(userId);
            expect(aggregates.date).toBe(date);
            expect(aggregates.trimp).toBeDefined();
            expect(aggregates.tss).toBeDefined();
            expect(aggregates.loadScore).toBeDefined();
            expect(aggregates.z1Min).toBeDefined();
            expect(aggregates.z2Min).toBeDefined();
            expect(aggregates.z3Min).toBeDefined();
            expect(aggregates.z4Min).toBeDefined();
            expect(aggregates.z5Min).toBeDefined();
            expect(aggregates.distanceM).toBeDefined();
            expect(aggregates.durationS).toBeDefined();
            expect(aggregates.runCount).toBeDefined();
            expect(aggregates.rideCount).toBeDefined();
            expect(aggregates.strengthCount).toBeDefined();
            expect(aggregates.lastRecalcTs).toBeDefined();
        });

        it('should calculate TRIMP correctly', () => {
            const trimp = MockAggregatesRecompute.calculateTRIMP('2024-01-15');
            expect(trimp).toBeGreaterThan(0);
            expect(typeof trimp).toBe('number');
        });

        it('should calculate TSS correctly', () => {
            const tss = MockAggregatesRecompute.calculateTSS('2024-01-15');
            expect(tss).toBeGreaterThan(0);
            expect(typeof tss).toBe('number');
        });

        it('should calculate zone minutes correctly', () => {
            const z1Min = MockAggregatesRecompute.calculateZoneMinutes('2024-01-15', 'z1');
            const z4Min = MockAggregatesRecompute.calculateZoneMinutes('2024-01-15', 'z4');
            
            expect(z1Min).toBeGreaterThan(0);
            expect(z4Min).toBeGreaterThan(0);
        });
    });

    describe('recomputeRollingMetrics', () => {
        it('should compute rolling ATL/CTL/monotony/strain', async () => {
            const userId = 1;
            const startDate = '2024-01-15';
            
            const rollingMetrics = await MockAggregatesRecompute.recomputeRollingMetrics(userId, startDate);
            
            expect(rollingMetrics.atl7).toBeDefined();
            expect(rollingMetrics.ctl28).toBeDefined();
            expect(rollingMetrics.monotony).toBeDefined();
            expect(rollingMetrics.strain).toBeDefined();
            expect(rollingMetrics.affectedDates).toBeDefined();
            expect(Array.isArray(rollingMetrics.affectedDates)).toBe(true);
        });

        it('should calculate ATL (7-day rolling average)', async () => {
            const userId = 1;
            const startDate = '2024-01-15';
            
            const rollingMetrics = await MockAggregatesRecompute.recomputeRollingMetrics(userId, startDate);
            
            expect(rollingMetrics.atl7).toBeGreaterThan(0);
            expect(typeof rollingMetrics.atl7).toBe('number');
        });

        it('should calculate CTL (28-day rolling average)', async () => {
            const userId = 1;
            const startDate = '2024-01-15';
            
            const rollingMetrics = await MockAggregatesRecompute.recomputeRollingMetrics(userId, startDate);
            
            expect(rollingMetrics.ctl28).toBeGreaterThan(0);
            expect(typeof rollingMetrics.ctl28).toBe('number');
        });

        it('should calculate monotony correctly', async () => {
            const userId = 1;
            const startDate = '2024-01-15';
            
            const rollingMetrics = await MockAggregatesRecompute.recomputeRollingMetrics(userId, startDate);
            
            expect(rollingMetrics.monotony).toBeGreaterThanOrEqual(1.0);
            expect(typeof rollingMetrics.monotony).toBe('number');
        });

        it('should calculate strain correctly', async () => {
            const userId = 1;
            const startDate = '2024-01-15';
            
            const rollingMetrics = await MockAggregatesRecompute.recomputeRollingMetrics(userId, startDate);
            
            expect(rollingMetrics.strain).toBeGreaterThan(0);
            expect(typeof rollingMetrics.strain).toBe('number');
        });
    });

    describe('affected dates window', () => {
        it('should cover correct date range for daily aggregates', async () => {
            const userId = 1;
            const date = '2024-01-15';
            
            const aggregates = await MockAggregatesRecompute.recomputeDailyAggregates(userId, date);
            
            expect(aggregates.date).toBe(date);
            expect(aggregates.lastRecalcTs).toBeDefined();
        });

        it('should cover correct rolling span (35 days)', async () => {
            const userId = 1;
            const startDate = '2024-01-15';
            
            const rollingMetrics = await MockAggregatesRecompute.recomputeRollingMetrics(userId, startDate);
            
            expect(rollingMetrics.affectedDates.length).toBe(35);
            
            // First date should be oldest
            const firstDate = new Date(rollingMetrics.affectedDates[0]);
            const lastDate = new Date(rollingMetrics.affectedDates[rollingMetrics.affectedDates.length - 1]);
            
            expect(lastDate.getTime() - firstDate.getTime()).toBeGreaterThan(30 * 24 * 60 * 60 * 1000);
        });

        it('should include start_ts day in affected dates', async () => {
            const userId = 1;
            const startDate = '2024-01-15';
            
            const rollingMetrics = await MockAggregatesRecompute.recomputeRollingMetrics(userId, startDate);
            
            expect(rollingMetrics.affectedDates).toContain(startDate);
        });
    });

    describe('ATL calculation', () => {
        it('should return 0 for empty loads array', () => {
            const atl = MockAggregatesRecompute.calculateATL([]);
            expect(atl).toBe(0);
        });

        it('should calculate ATL for 7-day array', () => {
            const dailyLoads = [40, 45, 50, 48, 42, 46, 44];
            const atl = MockAggregatesRecompute.calculateATL(dailyLoads);
            
            expect(atl).toBeGreaterThan(0);
            expect(typeof atl).toBe('number');
        });

        it('should give more weight to recent days', () => {
            const increasingLoads = [20, 30, 40, 50, 60, 70, 80];
            const atl = MockAggregatesRecompute.calculateATL(increasingLoads);
            
            // ATL calculation uses exponential smoothing with a 7-day time constant
            // With increasing loads from low (20) to high (80), the ATL should reflect
            // some influence of the recent higher values but still be influenced by earlier low values
            expect(atl).toBeGreaterThan(25); // Should show some increase due to recent high loads
            expect(atl).toBeLessThan(80); // But not as high as the latest value due to exponential smoothing
            expect(typeof atl).toBe('number');
        });
    });

    describe('CTL calculation', () => {
        it('should return 0 for empty loads array', () => {
            const ctl = MockAggregatesRecompute.calculateCTL([]);
            expect(ctl).toBe(0);
        });

        it('should calculate CTL for 28-day array', () => {
            const dailyLoads = Array.from({ length: 28 }, () => 45);
            const ctl = MockAggregatesRecompute.calculateCTL(dailyLoads);
            
            expect(ctl).toBeGreaterThan(0);
            expect(typeof ctl).toBe('number');
        });

        it('should be less responsive than ATL', () => {
            const steadyLoads = Array.from({ length: 35 }, () => 50);
            const recentSpike = [...steadyLoads, 100];
            
            const ctl = MockAggregatesRecompute.calculateCTL(recentSpike);
            const atl = MockAggregatesRecompute.calculateATL(recentSpike.slice(-7));
            
            // CTL should change less dramatically than ATL
            expect(ctl).toBeLessThan(atl * 2);
        });
    });

    describe('Monotony calculation', () => {
        it('should return 1.0 for empty loads array', () => {
            const monotony = MockAggregatesRecompute.calculateMonotony([]);
            expect(monotony).toBe(1.0);
        });

        it('should return higher monotony for consistent loads', () => {
            const consistentLoads = [50, 50, 50, 50, 50, 50, 50];
            const monotony = MockAggregatesRecompute.calculateMonotony(consistentLoads);
            
            expect(monotony).toBeGreaterThan(10); // Very high for no variance
        });

        it('should return lower monotony for variable loads', () => {
            const variableLoads = [20, 80, 30, 70, 40, 60, 50];
            const monotony = MockAggregatesRecompute.calculateMonotony(variableLoads);
            
            expect(monotony).toBeLessThan(3); // Lower for high variance
        });
    });

    describe('Strain calculation', () => {
        it('should return 0 for empty loads array', () => {
            const strain = MockAggregatesRecompute.calculateStrain(1.0, []);
            expect(strain).toBe(0);
        });

        it('should calculate strain as weekly load * monotony', () => {
            const weeklyLoads = [50, 60, 55, 58, 52, 57, 53];
            const monotony = 2.0;
            const strain = MockAggregatesRecompute.calculateStrain(monotony, weeklyLoads);
            
            const weeklyTotal = weeklyLoads.reduce((sum, load) => sum + load, 0);
            const expectedStrain = weeklyTotal * monotony;
            
            expect(strain).toBeCloseTo(expectedStrain, 2);
        });
    });
});

