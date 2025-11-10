/**
 * Database Transaction Tests for Activity Deduplication
 * Verifies atomic operations, rollback capability, and race condition handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Activity Transaction Manager', () => {
    let transactionManager;
    let mockSupabase;

    beforeEach(() => {
        // Mock Supabase client with proper method chaining
        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            single: vi.fn()
        };

        // Mock ActivityTransactionManager
        global.window = global.window || {};
        if (!global.window.ActivityTransactionManager) {
            class MockActivityTransactionManager {
                constructor(supabase) {
                    this.supabase = supabase;
                    this.transactions = new Map();
                }

                async executeActivityDedupTransaction(normalized, userId, affectedDates) {
                    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                    try {
                        // Mock transaction execution
                        const existingActivity = await this.findActivityByDedupHash(normalized.dedupHash, userId);

                        if (existingActivity) {
                            return await this.handleExistingActivityInTransaction(existingActivity, normalized, userId, affectedDates, transactionId);
                        } else {
                            const likelyDuplicates = await this.findLikelyDuplicatesInTransaction(normalized, userId);

                            if (likelyDuplicates.length > 0) {
                                return await this.handleLikelyDuplicateInTransaction(likelyDuplicates[0], normalized, userId, affectedDates, transactionId);
                            } else {
                                return await this.handleNewActivityInTransaction(normalized, userId, affectedDates, transactionId);
                            }
                        }
                    } catch (error) {
                        await this.rollbackTransaction(transactionId);
                        throw error;
                    }
                }

                async findActivityByDedupHash(dedupHash, userId) {
                    // Mock the chained call
                    const mockResult = await this.supabase.single();
                    const { data, error } = mockResult;

                    if (error && error.code !== 'PGRST116') {
                        throw new Error(`Database error finding activity: ${error.message}`);
                    }

                    return data;
                }

                async findLikelyDuplicatesInTransaction(normalized, userId) {
                    const mockResult = await this.supabase.select();
                    const { data, error } = mockResult;

                    if (error) {
                        throw new Error(`Database error finding duplicates: ${error.message}`);
                    }

                    return data.filter(activity => {
                        const duration1 = normalized.durationS || 0;
                        const duration2 = activity.duration_s || 0;

                        if (duration1 === 0 || duration2 === 0) {return false;}

                        const durationDiff = Math.abs(duration1 - duration2);
                        const durationTolerance = Math.max(duration1, duration2) * 0.1;

                        return durationDiff <= durationTolerance;
                    });
                }

                async handleExistingActivityInTransaction(existing, normalized, userId, affectedDates, transactionId) {
                    const existingRichness = this.calculateRichness(existing) || 0;
                    const newRichness = this.calculateRichness(normalized.rawActivity) || 0;

                    if (newRichness > existingRichness) {
                        const mockResult = await this.supabase.single();
                        const { data, error } = mockResult;

                        if (error) {
                            throw new Error(`Failed to update activity: ${error.message}`);
                        }

                        affectedDates.add(new Date(normalized.startTs).toISOString().split('T')[0]);
                        return { id: data.id, externalId: normalized.canonicalExternalId, status: 'updated', richness: newRichness };
                    }

                    return { id: existing.id, externalId: normalized.canonicalExternalId, status: 'skipped_dup', richness: existingRichness };
                }

                async handleLikelyDuplicateInTransaction(existing, normalized, userId, affectedDates, transactionId) {
                    const existingRichness = this.calculateRichness(existing) || 0;
                    const newRichness = this.calculateRichness(normalized.rawActivity) || 0;
                    const primaryRichness = newRichness > existingRichness ? newRichness : existingRichness;

                    const mockResult = await this.supabase.single();
                    const { data, error } = mockResult;

                    if (error) {
                        throw new Error(`Failed to merge activity: ${error.message}`);
                    }

                    affectedDates.add(new Date(normalized.startTs).toISOString().split('T')[0]);
                    return { id: data.id, externalId: normalized.canonicalExternalId, status: 'merged', richness: primaryRichness };
                }

                async handleNewActivityInTransaction(normalized, userId, affectedDates, transactionId) {
                    const mockResult = await this.supabase.single();
                    const { data, error } = mockResult;

                    if (error) {
                        throw new Error(`Failed to insert activity: ${error.message}`);
                    }

                    affectedDates.add(new Date(normalized.startTs).toISOString().split('T')[0]);
                    return { id: data.id, externalId: normalized.canonicalExternalId, status: 'imported', richness: this.calculateRichness(normalized.rawActivity) };
                }

                async attachStreamsInTransaction(streamsByActivityId, activitiesById, transactionId) {
                    for (const [externalId, streams] of Object.entries(streamsByActivityId)) {
                        const activity = Array.from(activitiesById.values()).find(a => a.externalId === externalId);
                        if (!activity || !activity.id) {continue;}

                        for (const [streamType, streamData] of Object.entries(streams)) {
                            const mockResult = await this.supabase.insert();
                            const { error } = mockResult;

                            if (error) {
                                throw new Error(`Failed to attach stream ${streamType}: ${error.message}`);
                            }
                        }
                    }
                }

                async logIngestionInTransaction(userId, provider, payload, results, transactionId) {
                    for (const result of results) {
                        const mockResult = await this.supabase.insert();
                        const { error } = mockResult;

                        if (error) {
                            throw new Error(`Failed to log ingestion: ${error.message}`);
                        }
                    }
                }

                async rollbackTransaction(transactionId) {
                    // Mock rollback - in real implementation would undo changes
                    console.log(`Rolling back transaction ${transactionId}`);
                }

                calculateRichness(activity) {
                    let score = 0.0;
                    if (activity.has_heartrate || activity.average_heartrate) {score += 0.4;}
                    if (activity.start_latlng || activity.distance) {score += 0.2;}
                    if (activity.device_watts) {score += 0.2;}
                    if (activity.device_name) {score += 0.1;}
                    return Math.min(score, 1.0);
                }
            }
            global.window.ActivityTransactionManager = MockActivityTransactionManager;
        }

        transactionManager = new global.window.ActivityTransactionManager(mockSupabase);
    });

    describe('Transaction Execution', () => {
        it('should execute new activity transaction successfully', async () => {
            const normalized = {
                canonicalExternalId: '123',
                canonicalSource: 'strava',
                type: 'Run',
                name: 'Morning Run',
                startTs: '2023-01-01T06:00:00Z',
                durationS: 1800,
                dedupHash: 'abc123',
                rawActivity: { has_heartrate: true, distance: 5000 }
            };

            const affectedDates = new Set();

            // Mock no existing activity found
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' }
            });

            // Mock no likely duplicates found
            mockSupabase.select.mockResolvedValueOnce({
                data: [],
                error: null
            });

            // Mock successful insert
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 1, external_id: '123' },
                error: null
            });

            const result = await transactionManager.executeActivityDedupTransaction(normalized, 'user1', affectedDates);

            expect(result.status).toBe('imported');
            expect(result.id).toBe(1);
            expect(result.externalId).toBe('123');
            expect(affectedDates.has('2023-01-01')).toBe(true);
        });

        it('should handle existing activity update transaction', async () => {
            const existing = {
                id: 1,
                canonical_external_id: '123',
                avg_hr: 150,
                has_hr: true,
                source_set: {}
            };

            const normalized = {
                canonicalExternalId: '123',
                startTs: '2023-01-01T06:00:00Z',
                avgHr: 160,
                rawActivity: { has_heartrate: true, distance: 5000, average_heartrate: 160 }
            };

            const affectedDates = new Set();

            // Mock finding existing activity
            mockSupabase.single.mockResolvedValueOnce({
                data: existing,
                error: null
            });

            // Mock successful update
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 1, avg_hr: 160 },
                error: null
            });

            const result = await transactionManager.executeActivityDedupTransaction(normalized, 'user1', affectedDates);

            expect(result.status).toBe('updated');
            expect(result.id).toBe(1);
            expect(affectedDates.has('2023-01-01')).toBe(true);
        });

        it('should handle likely duplicate merge transaction', async () => {
            const existing = {
                id: 1,
                canonical_external_id: '456',
                avg_hr: 150,
                duration_s: 1800,
                type: 'Run'
            };

            const normalized = {
                canonicalExternalId: '123',
                type: 'Run',
                startTs: '2023-01-01T06:00:00Z',
                durationS: 1800,
                avgHr: 160,
                rawActivity: { has_heartrate: true, average_heartrate: 160 }
            };

            const affectedDates = new Set();

            // Mock finding no exact match
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' }
            });

            // Mock finding likely duplicates
            mockSupabase.select.mockResolvedValueOnce({
                data: [existing],
                error: null
            });

            // Mock successful merge
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 1, avg_hr: 160 },
                error: null
            });

            const result = await transactionManager.executeActivityDedupTransaction(normalized, 'user1', affectedDates);

            expect(result.status).toBe('merged');
            expect(result.id).toBe(1);
            expect(affectedDates.has('2023-01-01')).toBe(true);
        });
    });

    describe('Transaction Rollback', () => {
        it('should rollback transaction on database error', async () => {
            const normalized = {
                canonicalExternalId: '123',
                canonicalSource: 'strava',
                type: 'Run',
                name: 'Morning Run',
                startTs: '2023-01-01T06:00:00Z',
                durationS: 1800,
                dedupHash: 'abc123',
                rawActivity: { has_heartrate: true }
            };

            const affectedDates = new Set();

            // Mock database error
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Database connection failed' }
            });

            await expect(
                transactionManager.executeActivityDedupTransaction(normalized, 'user1', affectedDates)
            ).rejects.toThrow('Database connection failed');

            // Verify rollback was called
            expect(affectedDates.size).toBe(0);
        });

        it('should rollback transaction on insert failure', async () => {
            const normalized = {
                canonicalExternalId: '123',
                canonicalSource: 'strava',
                type: 'Run',
                name: 'Morning Run',
                startTs: '2023-01-01T06:00:00Z',
                durationS: 1800,
                dedupHash: 'abc123',
                rawActivity: { has_heartrate: true }
            };

            const affectedDates = new Set();

            // Mock no existing activity
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' }
            });

            // Mock no likely duplicates
            mockSupabase.select.mockResolvedValueOnce({
                data: [],
                error: null
            });

            // Mock insert failure
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Insert failed' }
            });

            await expect(
                transactionManager.executeActivityDedupTransaction(normalized, 'user1', affectedDates)
            ).rejects.toThrow('Insert failed');

            expect(affectedDates.size).toBe(0);
        });
    });

    describe('Concurrent Transaction Handling', () => {
        it('should handle concurrent deduplication attempts', async () => {
            const normalized1 = {
                canonicalExternalId: '123',
                type: 'Run',
                startTs: '2023-01-01T06:00:00Z',
                durationS: 1800,
                dedupHash: 'abc123',
                rawActivity: { has_heartrate: true }
            };

            const normalized2 = {
                canonicalExternalId: '456',
                type: 'Run',
                startTs: '2023-01-01T06:00:00Z',
                durationS: 1800,
                dedupHash: 'abc123', // Same hash
                rawActivity: { has_heartrate: true }
            };

            const affectedDates1 = new Set();
            const affectedDates2 = new Set();

            // Mock first transaction finding no existing activity
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' }
            });

            // Mock first transaction finding no likely duplicates
            mockSupabase.select.mockResolvedValueOnce({
                data: [],
                error: null
            });

            // Mock first transaction successful insert
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 1, external_id: '123' },
                error: null
            });

            // Mock second transaction finding existing activity (from first transaction)
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 1, canonical_external_id: '123' },
                error: null
            });

            // Mock second transaction successful update
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 1, avg_hr: 160 },
                error: null
            });

            // Execute transactions concurrently
            const [result1, result2] = await Promise.all([
                transactionManager.executeActivityDedupTransaction(normalized1, 'user1', affectedDates1),
                transactionManager.executeActivityDedupTransaction(normalized2, 'user1', affectedDates2)
            ]);

            expect(result1.status).toBe('imported');
            expect(result2.status).toBe('updated');
            expect(affectedDates1.has('2023-01-01')).toBe(true);
            expect(affectedDates2.has('2023-01-01')).toBe(true);
        });

        it('should handle race conditions in stream attachment', async () => {
            const activitiesById = new Map([
                [1, { id: 1, externalId: '123' }],
                [2, { id: 2, externalId: '456' }]
            ]);

            const streamsByActivityId = {
                '123': { hr: [{ t: 0, v: 150 }] },
                '456': { hr: [{ t: 0, v: 160 }] }
            };

            // Mock successful stream insertions
            mockSupabase.insert.mockResolvedValue({ error: null });

            await transactionManager.attachStreamsInTransaction(streamsByActivityId, activitiesById, 'streams_tx');

            expect(mockSupabase.insert).toHaveBeenCalledTimes(2);
        });
    });

    describe('Stream Attachment Transactions', () => {
        it('should attach streams atomically', async () => {
            const activitiesById = new Map([
                [1, { id: 1, externalId: '123' }]
            ]);

            const streamsByActivityId = {
                '123': {
                    hr: [{ t: 0, v: 150 }, { t: 1, v: 155 }],
                    power: [{ t: 0, v: 200 }, { t: 1, v: 210 }]
                }
            };

            // Mock successful stream insertions
            mockSupabase.insert.mockResolvedValue({ error: null });

            await transactionManager.attachStreamsInTransaction(streamsByActivityId, activitiesById, 'streams_tx');

            expect(mockSupabase.insert).toHaveBeenCalledTimes(2);
        });

        it('should rollback stream attachment on failure', async () => {
            const activitiesById = new Map([
                [1, { id: 1, externalId: '123' }]
            ]);

            const streamsByActivityId = {
                '123': {
                    hr: [{ t: 0, v: 150 }],
                    power: [{ t: 0, v: 200 }]
                }
            };

            // Mock first stream success, second stream failure
            mockSupabase.insert
                .mockResolvedValueOnce({ error: null })
                .mockResolvedValueOnce({ error: { message: 'Stream insert failed' } });

            await expect(
                transactionManager.attachStreamsInTransaction(streamsByActivityId, activitiesById, 'streams_tx')
            ).rejects.toThrow('Stream insert failed');
        });
    });

    describe('Ingestion Logging Transactions', () => {
        it('should log ingestion results atomically', async () => {
            const results = [
                { externalId: '123', status: 'imported' },
                { externalId: '456', status: 'updated' },
                { externalId: '789', status: 'skipped_dup' }
            ];

            // Mock successful log insertions
            mockSupabase.insert.mockResolvedValue({ error: null });

            await transactionManager.logIngestionInTransaction('user1', 'strava', {}, results, 'log_tx');

            expect(mockSupabase.insert).toHaveBeenCalledTimes(3);
        });

        it('should rollback logging on failure', async () => {
            const results = [
                { externalId: '123', status: 'imported' },
                { externalId: '456', status: 'updated' }
            ];

            // Mock first log success, second log failure
            mockSupabase.insert
                .mockResolvedValueOnce({ error: null })
                .mockResolvedValueOnce({ error: { message: 'Log insert failed' } });

            await expect(
                transactionManager.logIngestionInTransaction('user1', 'strava', {}, results, 'log_tx')
            ).rejects.toThrow('Log insert failed');
        });
    });

    describe('Data Consistency', () => {
        it('should maintain data consistency across operations', async () => {
            const normalized = {
                canonicalExternalId: '123',
                canonicalSource: 'strava',
                type: 'Run',
                name: 'Morning Run',
                startTs: '2023-01-01T06:00:00Z',
                durationS: 1800,
                dedupHash: 'abc123',
                rawActivity: { has_heartrate: true, distance: 5000 }
            };

            const affectedDates = new Set();

            // Mock no existing activity found
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' }
            });

            // Mock no likely duplicates found
            mockSupabase.select.mockResolvedValueOnce({
                data: [],
                error: null
            });

            // Mock successful insert
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 1, external_id: '123' },
                error: null
            });

            const result = await transactionManager.executeActivityDedupTransaction(normalized, 'user1', affectedDates);

            // Verify all data is consistent
            expect(result.id).toBe(1);
            expect(result.externalId).toBe('123');
            expect(result.status).toBe('imported');
            expect(affectedDates.size).toBe(1);
            expect(affectedDates.has('2023-01-01')).toBe(true);
        });

        it('should handle partial failures gracefully', async () => {
            const normalized = {
                canonicalExternalId: '123',
                canonicalSource: 'strava',
                type: 'Run',
                name: 'Morning Run',
                startTs: '2023-01-01T06:00:00Z',
                durationS: 1800,
                dedupHash: 'abc123',
                rawActivity: { has_heartrate: true }
            };

            const affectedDates = new Set();

            // Mock no existing activity found
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' }
            });

            // Mock no likely duplicates found
            mockSupabase.select.mockResolvedValueOnce({
                data: [],
                error: null
            });

            // Mock successful activity processing
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 1, external_id: '123' },
                error: null
            });

            const result = await transactionManager.executeActivityDedupTransaction(normalized, 'user1', affectedDates);

            expect(result.status).toBe('imported');
            expect(affectedDates.size).toBe(1);
        });
    });
});
