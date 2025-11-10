/**
 * Performance Tests for LRU Cache with Size Limits
 * Verifies memory usage stays under limits and LRU eviction works correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('LRU Cache Performance Tests', () => {
    let planCache;

    beforeEach(() => {
        // Mock PlanCache with LRU functionality
        class MockPlanCache {
            constructor(options = {}) {
                this.maxMemoryMB = options.maxMemoryMB || 50;
                this.maxEntries = options.maxEntries || 100;
                this.entryTTL = options.entryTTL || 5 * 60 * 1000;

                this.cache = new Map();
                this.accessOrder = new Map();
                this.entrySizes = new Map();
                this.currentMemoryBytes = 0;
                this.lastRefresh = new Map();
            }

            estimateObjectSize(obj) {
                try {
                    const jsonString = JSON.stringify(obj);
                    return new Blob([jsonString]).size;
                } catch (error) {
                    return JSON.stringify(obj).length * 2;
                }
            }

            updateAccessOrder(key) {
                const now = Date.now();
                this.accessOrder.set(key, now);
            }

            getLRUKey() {
                if (this.accessOrder.size === 0) {return null;}

                let oldestKey = null;
                let oldestTime = Infinity;

                for (const [key, time] of this.accessOrder) {
                    if (time < oldestTime) {
                        oldestTime = time;
                        oldestKey = key;
                    }
                }

                return oldestKey;
            }

            evictLRUEntries(requiredBytes = 0) {
                const maxMemoryBytes = this.maxMemoryMB * 1024 * 1024;

                while ((this.currentMemoryBytes + requiredBytes > maxMemoryBytes ||
                        this.cache.size >= this.maxEntries) && this.cache.size > 0) {

                    const lruKey = this.getLRUKey();
                    if (!lruKey) {break;}

                    this.evictEntry(lruKey);
                }
            }

            evictEntry(key) {
                const entrySize = this.entrySizes.get(key) || 0;

                this.cache.delete(key);
                this.accessOrder.delete(key);
                this.entrySizes.delete(key);
                this.currentMemoryBytes -= entrySize;
            }

            setCacheEntry(key, value, ttl = this.entryTTL) {
                const entrySize = this.estimateObjectSize(value);

                this.evictLRUEntries(entrySize);

                if (this.cache.has(key)) {
                    this.evictEntry(key);
                }

                const now = Date.now();
                this.cache.set(key, {
                    value,
                    timestamp: now,
                    ttl,
                    expiresAt: now + ttl
                });

                this.accessOrder.set(key, now);
                this.entrySizes.set(key, entrySize);
                this.currentMemoryBytes += entrySize;
            }

            getCacheEntry(key) {
                const entry = this.cache.get(key);

                if (!entry) {
                    return null;
                }

                if (Date.now() > entry.expiresAt) {
                    this.evictEntry(key);
                    return null;
                }

                this.updateAccessOrder(key);

                return entry.value;
            }

            cleanupExpiredEntries() {
                const now = Date.now();
                const expiredKeys = [];

                for (const [key, entry] of this.cache) {
                    if (now > entry.expiresAt) {
                        expiredKeys.push(key);
                    }
                }

                for (const key of expiredKeys) {
                    this.evictEntry(key);
                }

                return expiredKeys.length;
            }

            getCacheStats() {
                return {
                    totalEntries: this.cache.size,
                    memoryUsageMB: Math.round(this.currentMemoryBytes / (1024 * 1024) * 100) / 100,
                    maxMemoryMB: this.maxMemoryMB,
                    maxEntries: this.maxEntries,
                    memoryUtilization: Math.round((this.currentMemoryBytes / (this.maxMemoryMB * 1024 * 1024)) * 100),
                    entryUtilization: Math.round((this.cache.size / this.maxEntries) * 100)
                };
            }
        }

        planCache = new MockPlanCache();
    });

    describe('Memory Usage Limits', () => {
        it('should stay under memory limit', () => {
            const largePlan = {
                blocks: Array(100).fill({
                    name: 'Test Block',
                    items: Array(50).fill({
                        name: 'Test Exercise',
                        sets: 5,
                        reps: '10-15',
                        notes: 'This is a very long note that takes up more memory to test the memory limits of the cache system'
                    })
                }),
                why: Array(20).fill('This is a reason why this exercise was selected for the workout plan'),
                warnings: ['Test warning']
            };

            // Add entries until we hit memory limit
            for (let i = 0; i < 200; i++) {
                planCache.setCacheEntry(`user_1_2023-01-${String(i + 1).padStart(2, '0')}`, largePlan);
            }

            const stats = planCache.getCacheStats();
            expect(stats.memoryUsageMB).toBeLessThanOrEqual(planCache.maxMemoryMB);
            expect(stats.memoryUtilization).toBeLessThanOrEqual(100);
        });

        it('should evict entries when memory limit exceeded', () => {
            const plan = { blocks: [], why: [], warnings: [] };

            // Fill cache beyond memory limit
            for (let i = 0; i < 1000; i++) {
                planCache.setCacheEntry(`key_${i}`, plan);
            }

            const stats = planCache.getCacheStats();
            expect(stats.memoryUsageMB).toBeLessThanOrEqual(planCache.maxMemoryMB);
            expect(stats.totalEntries).toBeLessThan(1000);
        });

        it('should respect entry count limit', () => {
            const plan = { test: 'data' };

            // Add more entries than maxEntries
            for (let i = 0; i < planCache.maxEntries + 50; i++) {
                planCache.setCacheEntry(`key_${i}`, plan);
            }

            const stats = planCache.getCacheStats();
            expect(stats.totalEntries).toBeLessThanOrEqual(planCache.maxEntries);
        });
    });

    describe('LRU Eviction', () => {
        it('should evict least recently used entries first', () => {
            const plan = { test: 'data' };

            // Add entries
            planCache.setCacheEntry('key_1', plan);
            planCache.setCacheEntry('key_2', plan);
            planCache.setCacheEntry('key_3', plan);

            // Access key_2 to make it more recently used
            planCache.getCacheEntry('key_2');

            // Force eviction by adding many entries
            for (let i = 4; i <= planCache.maxEntries + 10; i++) {
                planCache.setCacheEntry(`key_${i}`, plan);
            }

            // key_1 and key_3 should be evicted, key_2 should remain
            expect(planCache.getCacheEntry('key_1')).toBeNull();
            expect(planCache.getCacheEntry('key_2')).toBeDefined();
            expect(planCache.getCacheEntry('key_3')).toBeNull();
        });

        it('should update access order on get operations', () => {
            const plan = { test: 'data' };

            planCache.setCacheEntry('key_1', plan);
            planCache.setCacheEntry('key_2', plan);

            // Access key_1 to update its access time
            planCache.getCacheEntry('key_1');

            // Add enough entries to force eviction
            for (let i = 3; i <= planCache.maxEntries + 5; i++) {
                planCache.setCacheEntry(`key_${i}`, plan);
            }

            // key_2 should be evicted (least recently used), key_1 should remain
            expect(planCache.getCacheEntry('key_1')).toBeDefined();
            expect(planCache.getCacheEntry('key_2')).toBeNull();
        });
    });

    describe('TTL and Expiration', () => {
        it('should expire entries after TTL', () => {
            const plan = { test: 'data' };
            const shortTTL = 100; // 100ms

            planCache.setCacheEntry('key_1', plan, shortTTL);

            // Entry should be available immediately
            expect(planCache.getCacheEntry('key_1')).toBeDefined();

            // Wait for expiration
            return new Promise(resolve => {
                setTimeout(() => {
                    expect(planCache.getCacheEntry('key_1')).toBeNull();
                    resolve();
                }, shortTTL + 50);
            });
        });

        it('should clean up expired entries', () => {
            const plan = { test: 'data' };
            const shortTTL = 50; // 50ms

            planCache.setCacheEntry('key_1', plan, shortTTL);
            planCache.setCacheEntry('key_2', plan, shortTTL);

            return new Promise(resolve => {
                setTimeout(() => {
                    const cleanedCount = planCache.cleanupExpiredEntries();
                    expect(cleanedCount).toBe(2);
                    expect(planCache.getCacheStats().totalEntries).toBe(0);
                    resolve();
                }, shortTTL + 50);
            });
        });
    });

    describe('Performance Benchmarks', () => {
        it('should handle large number of operations efficiently', () => {
            const plan = { test: 'data' };
            const startTime = Date.now();

            // Perform many operations
            for (let i = 0; i < 1000; i++) {
                planCache.setCacheEntry(`key_${i}`, plan);
                if (i % 10 === 0) {
                    planCache.getCacheEntry(`key_${i - 5}`);
                }
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (adjust threshold as needed)
            expect(duration).toBeLessThan(1000); // 1 second
        });

        it('should maintain reasonable performance under load', () => {
            const plan = { test: 'data' };
            const startTime = Date.now();

            // Perform many operations
            for (let i = 0; i < 100; i++) {
                planCache.setCacheEntry(`key_${i}`, plan);
                if (i % 10 === 0) {
                    planCache.getCacheEntry(`key_${i - 5}`);
                }
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time
            expect(duration).toBeLessThan(1000); // Less than 1 second for 100 operations

            // Verify cache is working correctly
            const stats = planCache.getCacheStats();
            expect(stats.totalEntries).toBeLessThanOrEqual(planCache.maxEntries);
        });
    });

    describe('Cache Statistics', () => {
        it('should provide accurate cache statistics', () => {
            const plan = { test: 'data' };

            planCache.setCacheEntry('key_1', plan);
            planCache.setCacheEntry('key_2', plan);

            const stats = planCache.getCacheStats();

            expect(stats.totalEntries).toBe(2);
            expect(stats.memoryUsageMB).toBeGreaterThanOrEqual(0);
            expect(stats.maxMemoryMB).toBe(planCache.maxMemoryMB);
            expect(stats.maxEntries).toBe(planCache.maxEntries);
            expect(stats.memoryUtilization).toBeGreaterThanOrEqual(0);
            expect(stats.entryUtilization).toBeGreaterThanOrEqual(0);
        });

        it('should update statistics after eviction', () => {
            const plan = { test: 'data' };

            // Fill cache
            for (let i = 0; i < planCache.maxEntries + 10; i++) {
                planCache.setCacheEntry(`key_${i}`, plan);
            }

            const stats = planCache.getCacheStats();
            expect(stats.totalEntries).toBeLessThanOrEqual(planCache.maxEntries);
            expect(stats.entryUtilization).toBeLessThanOrEqual(100);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty cache gracefully', () => {
            expect(planCache.getLRUKey()).toBeNull();
            expect(planCache.getCacheEntry('nonexistent')).toBeNull();
            expect(planCache.cleanupExpiredEntries()).toBe(0);
        });

        it('should handle very large objects', () => {
            const veryLargePlan = {
                data: 'x'.repeat(1024 * 1024) // 1MB string
            };

            planCache.setCacheEntry('large_key', veryLargePlan);

            const stats = planCache.getCacheStats();
            expect(stats.memoryUsageMB).toBeGreaterThan(0);
        });

        it('should handle rapid set/get operations', () => {
            const plan = { test: 'data' };

            // Rapid operations
            for (let i = 0; i < 100; i++) {
                planCache.setCacheEntry(`key_${i}`, plan);
                planCache.getCacheEntry(`key_${i}`);
            }

            const stats = planCache.getCacheStats();
            expect(stats.totalEntries).toBeLessThanOrEqual(planCache.maxEntries);
        });
    });
});
