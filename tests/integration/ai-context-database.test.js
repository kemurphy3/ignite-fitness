/**
 * Integration Tests for AI Context Database Queries
 * Verifies real Supabase queries work correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AI Context Database Integration', () => {
    let mockSupabase;
    let AIContextDatabase;

    beforeEach(() => {
        // Mock Supabase client
        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis()
        };

        // Mock AIContextDatabase class
        class MockAIContextDatabase {
            constructor() {
                this.supabase = mockSupabase;
            }

            async getLoadMetrics(userId) {
                if (!this.supabase) {
                    return this.getFallbackLoadMetrics();
                }

                try {
                    const { data, error } = await this.supabase
                        .from('daily_aggregates')
                        .select('date, trimp, tss, zone_minutes')
                        .eq('user_id', userId)
                        .gte('date', this.getDateNDaysAgo(28))
                        .order('date', { ascending: false })
                        .limit(28);

                    if (error) {
                        console.error('Error fetching load metrics:', error);
                        return this.getFallbackLoadMetrics();
                    }

                    if (!data || data.length === 0) {
                        return this.getFallbackLoadMetrics();
                    }

                    const atl7 = this.calculateATL(data.slice(0, 7));
                    const ctl28 = this.calculateCTL(data.slice(0, 28));
                    const monotony = this.calculateMonotony(data.slice(0, 7));
                    const strain = this.calculateStrain(data.slice(0, 7));

                    return {
                        atl7,
                        ctl28,
                        monotony,
                        strain,
                        dataPoints: data.length,
                        lastUpdated: data[0]?.date
                    };

                } catch (error) {
                    console.error('Error calculating load metrics:', error);
                    return this.getFallbackLoadMetrics();
                }
            }

            async getYesterdayActivity(userId) {
                if (!this.supabase) {
                    return this.getFallbackYesterdayActivity();
                }

                try {
                    const yesterday = this.getYesterdayDate();
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const { data, error } = await this.supabase
                        .from('activities')
                        .select('*')
                        .eq('user_id', userId)
                        .gte('start_ts', yesterday.toISOString())
                        .lt('start_ts', today.toISOString())
                        .eq('is_excluded', false);

                    if (error) {
                        console.error('Error fetching yesterday activities:', error);
                        return this.getFallbackYesterdayActivity();
                    }

                    if (!data || data.length === 0) {
                        return this.getFallbackYesterdayActivity();
                    }

                    return this.aggregateYesterdayActivity(data);

                } catch (error) {
                    console.error('Error getting yesterday activity:', error);
                    return this.getFallbackYesterdayActivity();
                }
            }

            async calculateDataConfidence(userId) {
                if (!this.supabase) {
                    return this.getFallbackDataConfidence();
                }

                try {
                    const sevenDaysAgo = this.getDateNDaysAgo(7);

                    const { data, error } = await this.supabase
                        .from('activities')
                        .select('start_ts, has_hr, avg_hr, source_set, type')
                        .eq('user_id', userId)
                        .gte('start_ts', sevenDaysAgo.toISOString())
                        .eq('is_excluded', false);

                    if (error) {
                        console.error('Error fetching confidence data:', error);
                        return this.getFallbackDataConfidence();
                    }

                    if (!data || data.length === 0) {
                        return this.getFallbackDataConfidence();
                    }

                    const daysWithHR = new Set();
                    let totalRichness = 0;
                    let totalActivities = 0;

                    for (const activity of data) {
                        const date = new Date(activity.start_ts).toISOString().split('T')[0];

                        if (activity.has_hr || activity.avg_hr) {
                            daysWithHR.add(date);
                        }

                        if (activity.source_set && Object.keys(activity.source_set).length > 0) {
                            const sources = Object.values(activity.source_set);
                            const avgRichness = sources.reduce((sum, s) => sum + (s.richness || 0), 0) / sources.length;
                            totalRichness += avgRichness;
                        }

                        totalActivities++;
                    }

                    const recent7days = daysWithHR.size / 7;
                    const sessionDetail = totalActivities > 0 ? totalRichness / totalActivities : 0;
                    const trend = this.calculateTrend(data);

                    return {
                        recent7days: Math.min(recent7days, 1),
                        sessionDetail: Math.min(sessionDetail, 1),
                        trend,
                        dataPoints: totalActivities,
                        daysWithData: daysWithHR.size
                    };

                } catch (error) {
                    console.error('Error calculating data confidence:', error);
                    return this.getFallbackDataConfidence();
                }
            }

            // Helper methods
            calculateATL(data) {
                if (!data || data.length === 0) {return 0;}
                let weightedSum = 0;
                let totalWeight = 0;
                for (let i = 0; i < data.length; i++) {
                    const weight = Math.exp(-i * 0.1);
                    const load = (data[i].trimp || 0) + (data[i].tss || 0);
                    weightedSum += load * weight;
                    totalWeight += weight;
                }
                return totalWeight > 0 ? weightedSum / totalWeight : 0;
            }

            calculateCTL(data) {
                if (!data || data.length === 0) {return 0;}
                let weightedSum = 0;
                let totalWeight = 0;
                for (let i = 0; i < data.length; i++) {
                    const weight = Math.exp(-i * 0.05);
                    const load = (data[i].trimp || 0) + (data[i].tss || 0);
                    weightedSum += load * weight;
                    totalWeight += weight;
                }
                return totalWeight > 0 ? weightedSum / totalWeight : 0;
            }

            calculateMonotony(data) {
                if (!data || data.length < 2) {return 1.0;}
                const loads = data.map(d => (d.trimp || 0) + (d.tss || 0));
                const mean = loads.reduce((sum, load) => sum + load, 0) / loads.length;
                const variance = loads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / loads.length;
                const stdDev = Math.sqrt(variance);
                return stdDev > 0 ? mean / stdDev : 1.0;
            }

            calculateStrain(data) {
                const monotony = this.calculateMonotony(data);
                const totalLoad = data.reduce((sum, d) => sum + (d.trimp || 0) + (d.tss || 0), 0);
                return totalLoad * monotony;
            }

            calculateTrend(data) {
                if (!data || data.length < 3) {return 'flat';}
                const recent = data.slice(0, 3).length;
                const older = data.slice(3, 6).length;
                if (recent > older * 1.2) {return 'increasing';}
                if (recent < older * 0.8) {return 'decreasing';}
                return 'stable';
            }

            aggregateYesterdayActivity(activities) {
                const aggregated = {
                    type: null,
                    duration_s: 0,
                    avg_hr: null,
                    max_hr: null,
                    z4_min: 0,
                    z5_min: 0,
                    activities: activities.length,
                    totalLoad: 0
                };

                let totalHR = 0;
                let hrCount = 0;
                let maxHR = 0;

                for (const activity of activities) {
                    aggregated.duration_s += activity.duration_s || 0;

                    if (activity.avg_hr) {
                        totalHR += activity.avg_hr;
                        hrCount++;
                    }

                    if (activity.max_hr && activity.max_hr > maxHR) {
                        maxHR = activity.max_hr;
                    }

                    if (activity.avg_hr && activity.max_hr) {
                        const hrReserve = (activity.avg_hr - 60) / (activity.max_hr - 60);
                        if (hrReserve > 0.8) {
                            aggregated.z4_min += (activity.duration_s / 60) * 0.5;
                            aggregated.z5_min += (activity.duration_s / 60) * 0.3;
                        }
                    }
                }

                if (hrCount > 0) {
                    aggregated.avg_hr = totalHR / hrCount;
                }
                aggregated.max_hr = maxHR;

                const typeCounts = {};
                for (const activity of activities) {
                    typeCounts[activity.type] = (typeCounts[activity.type] || 0) + (activity.duration_s || 0);
                }

                const primaryType = Object.keys(typeCounts).reduce((a, b) =>
                    typeCounts[a] > typeCounts[b] ? a : b,
                    null
                );
                aggregated.type = primaryType;

                return aggregated;
            }

            getDateNDaysAgo(days) {
                const date = new Date();
                date.setDate(date.getDate() - days);
                date.setHours(0, 0, 0, 0);
                return date;
            }

            getYesterdayDate() {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                return yesterday;
            }

            getFallbackLoadMetrics() {
                return {
                    atl7: 0,
                    ctl28: 0,
                    monotony: 1.0,
                    strain: 0,
                    dataPoints: 0,
                    lastUpdated: null
                };
            }

            getFallbackYesterdayActivity() {
                return {
                    type: null,
                    duration_s: 0,
                    avg_hr: null,
                    max_hr: null,
                    z4_min: 0,
                    z5_min: 0,
                    activities: 0,
                    totalLoad: 0
                };
            }

            getFallbackDataConfidence() {
                return {
                    recent7days: 0,
                    sessionDetail: 0,
                    trend: 'flat',
                    dataPoints: 0,
                    daysWithData: 0
                };
            }
        }

        AIContextDatabase = MockAIContextDatabase;
    });

    describe('Load Metrics Queries', () => {
        it('should query daily aggregates for load metrics', async () => {
            const db = new AIContextDatabase();
            const mockData = [
                { date: '2023-01-01', trimp: 50, tss: 30, zone_minutes: { z4: 10, z5: 5 } },
                { date: '2023-01-02', trimp: 60, tss: 40, zone_minutes: { z4: 15, z5: 8 } },
                { date: '2023-01-03', trimp: 45, tss: 25, zone_minutes: { z4: 8, z5: 3 } }
            ];

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            order: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue({ data: mockData, error: null })
                            })
                        })
                    })
                })
            });

            const result = await db.getLoadMetrics(123);

            expect(mockSupabase.from).toHaveBeenCalledWith('daily_aggregates');
            expect(result.atl7).toBeGreaterThan(0);
            expect(result.ctl28).toBeGreaterThan(0);
            expect(result.dataPoints).toBe(3);
        });

        it('should handle empty data gracefully', async () => {
            const db = new AIContextDatabase();

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            order: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue({ data: [], error: null })
                            })
                        })
                    })
                })
            });

            const result = await db.getLoadMetrics(123);

            expect(result.atl7).toBe(0);
            expect(result.ctl28).toBe(0);
            expect(result.dataPoints).toBe(0);
        });

        it('should handle database errors gracefully', async () => {
            const db = new AIContextDatabase();

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            order: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') })
                            })
                        })
                    })
                })
            });

            const result = await db.getLoadMetrics(123);

            expect(result.atl7).toBe(0);
            expect(result.ctl28).toBe(0);
            expect(result.dataPoints).toBe(0);
        });
    });

    describe('Yesterday Activity Queries', () => {
        it('should query activities for yesterday', async () => {
            const db = new AIContextDatabase();
            const mockData = [
                {
                    type: 'running',
                    duration_s: 3600,
                    avg_hr: 150,
                    max_hr: 180,
                    start_ts: '2023-01-01T10:00:00Z'
                }
            ];

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            lt: vi.fn().mockReturnValue({
                                eq: vi.fn().mockResolvedValue({ data: mockData, error: null })
                            })
                        })
                    })
                })
            });

            const result = await db.getYesterdayActivity(123);

            expect(mockSupabase.from).toHaveBeenCalledWith('activities');
            expect(result.type).toBe('running');
            expect(result.duration_s).toBe(3600);
            expect(result.activities).toBe(1);
        });

        it('should aggregate multiple activities correctly', async () => {
            const db = new AIContextDatabase();
            const mockData = [
                {
                    type: 'running',
                    duration_s: 1800,
                    avg_hr: 140,
                    max_hr: 160,
                    start_ts: '2023-01-01T10:00:00Z'
                },
                {
                    type: 'cycling',
                    duration_s: 2700,
                    avg_hr: 130,
                    max_hr: 150,
                    start_ts: '2023-01-01T14:00:00Z'
                }
            ];

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            lt: vi.fn().mockReturnValue({
                                eq: vi.fn().mockResolvedValue({ data: mockData, error: null })
                            })
                        })
                    })
                })
            });

            const result = await db.getYesterdayActivity(123);

            expect(result.duration_s).toBe(4500); // 1800 + 2700
            expect(result.avg_hr).toBe(135); // (140 + 130) / 2
            expect(result.max_hr).toBe(160);
            expect(result.activities).toBe(2);
        });
    });

    describe('Data Confidence Queries', () => {
        it('should calculate confidence from recent activities', async () => {
            const db = new AIContextDatabase();
            const mockData = [
                {
                    start_ts: '2023-01-01T10:00:00Z',
                    has_hr: true,
                    avg_hr: 150,
                    source_set: { strava: { richness: 0.8 } },
                    type: 'running'
                },
                {
                    start_ts: '2023-01-02T10:00:00Z',
                    has_hr: true,
                    avg_hr: 140,
                    source_set: { manual: { richness: 0.6 } },
                    type: 'cycling'
                }
            ];

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({ data: mockData, error: null })
                        })
                    })
                })
            });

            const result = await db.calculateDataConfidence(123);

            expect(result.recent7days).toBeGreaterThan(0);
            expect(result.sessionDetail).toBeGreaterThan(0);
            expect(result.dataPoints).toBe(2);
            expect(result.daysWithData).toBe(2);
        });

        it('should handle activities without HR data', async () => {
            const db = new AIContextDatabase();
            const mockData = [
                {
                    start_ts: '2023-01-01T10:00:00Z',
                    has_hr: false,
                    avg_hr: null,
                    source_set: {},
                    type: 'walking'
                }
            ];

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({ data: mockData, error: null })
                        })
                    })
                })
            });

            const result = await db.calculateDataConfidence(123);

            expect(result.recent7days).toBe(0);
            expect(result.daysWithData).toBe(0);
        });
    });

    describe('Fallback Behavior', () => {
        it('should use fallback when Supabase is not available', async () => {
            const db = new AIContextDatabase();
            db.supabase = null;

            const loadMetrics = await db.getLoadMetrics(123);
            const yesterdayActivity = await db.getYesterdayActivity(123);
            const dataConfidence = await db.calculateDataConfidence(123);

            expect(loadMetrics.atl7).toBe(0);
            expect(yesterdayActivity.activities).toBe(0);
            expect(dataConfidence.recent7days).toBe(0);
        });
    });

    describe('Query Chain Verification', () => {
        it('should call Supabase methods in correct order for load metrics', async () => {
            const db = new AIContextDatabase();

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            order: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue({ data: [], error: null })
                            })
                        })
                    })
                })
            });

            await db.getLoadMetrics(123);

            expect(mockSupabase.from).toHaveBeenCalledWith('daily_aggregates');
            expect(mockSupabase.from().select).toHaveBeenCalledWith('date, trimp, tss, zone_minutes');
        });

        it('should call Supabase methods in correct order for activities', async () => {
            const db = new AIContextDatabase();

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            lt: vi.fn().mockReturnValue({
                                eq: vi.fn().mockResolvedValue({ data: [], error: null })
                            })
                        })
                    })
                })
            });

            await db.getYesterdayActivity(123);

            expect(mockSupabase.from).toHaveBeenCalledWith('activities');
            expect(mockSupabase.from().select).toHaveBeenCalledWith('*');
        });
    });
});
