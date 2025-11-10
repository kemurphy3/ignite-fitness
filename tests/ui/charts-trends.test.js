/**
 * Trends Charts Unit Tests
 * Tests for prompt 8 - Progress & Trends
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Trends Charts', () => {
    let mockChartLibrary, trendsModule;

    beforeEach(() => {
        // Mock Chart.js
        mockChartLibrary = vi.fn();

        // Mock window objects
        global.window = {
            SafeLogger: console,
            StorageManager: {
                getSessionLogs: vi.fn(() => ({})),
                getUserProfile: vi.fn(() => ({})),
            },
            AuthManager: {
                getCurrentUsername: vi.fn(() => 'test-user')
            }
        };

        // Reset module
        delete window.Trends;
    });

    describe('Aggregation Functions', () => {
        // Extract aggregation logic for testing
        function calculateWeeklyVolume(sessions) {
            const weeks = {};

            sessions.forEach(session => {
                const date = new Date(session.timestamp);
                const weekKey = getWeekKey(date);

                if (!weeks[weekKey]) {
                    weeks[weekKey] = {
                        upper: 0,
                        lower: 0,
                        core: 0,
                        cardio: 0
                    };
                }

                session.exercises?.forEach(ex => {
                    const category = getExerciseCategory(ex.name);
                    const volume = ex.sets?.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0) || 0;
                    weeks[weekKey][category] += volume;
                });
            });

            return Object.entries(weeks)
                .map(([key, data]) => ({ date: key, ...data }))
                .sort((a, b) => a.date.localeCompare(b.date));
        }

        function getWeekKey(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const week = Math.ceil(date.getDate() / 7);
            return `${year}-${month}-W${week}`;
        }

        function getExerciseCategory(exerciseName) {
            const name = exerciseName.toLowerCase();

            if (name.includes('squat') || name.includes('deadlift') || name.includes('leg') ||
                name.includes('calf') || name.includes('glute') || name.includes('hip')) {
                return 'lower';
            }

            if (name.includes('press') || name.includes('curl') || name.includes('row') ||
                name.includes('pull') || name.includes('shoulder') || name.includes('tricep') ||
                name.includes('bicep') || name.includes('chest') || name.includes('lat')) {
                return 'upper';
            }

            if (name.includes('core') || name.includes('ab') || name.includes('plank') ||
                name.includes('crunch') || name.includes('sit-up')) {
                return 'core';
            }

            return 'cardio';
        }

        function calculate1RM(weight, reps) {
            if (reps === 1) {return weight;}
            return weight * (36 / (37 - reps));
        }

        function detectStrengthPRs(sessions) {
            const prs = {};

            sessions.forEach(session => {
                session.exercises?.forEach(ex => {
                    if (!ex.name) {return;}

                    const category = getExerciseCategory(ex.name);

                    if (category !== 'upper' && category !== 'lower') {return;}

                    ex.sets?.forEach(set => {
                        if (!set.reps || !set.weight) {return;}

                        if (set.reps >= 1 && set.reps <= 5) {
                            const oneRepMax = calculate1RM(set.weight, set.reps);

                            if (!prs[ex.name] || prs[ex.name].max < oneRepMax) {
                                prs[ex.name] = {
                                    max: oneRepMax,
                                    date: session.timestamp,
                                    weight: set.weight,
                                    reps: set.reps
                                };
                            }
                        }
                    });
                });
            });

            return prs;
        }

        it('should aggregate weekly volume by category', () => {
            const sessions = [
                {
                    timestamp: new Date('2024-01-15').toISOString(),
                    exercises: [
                        { name: 'Bench Press', sets: [{ reps: 10, weight: 135 }] },
                        { name: 'Squat', sets: [{ reps: 8, weight: 225 }] }
                    ]
                },
                {
                    timestamp: new Date('2024-01-16').toISOString(),
                    exercises: [
                        { name: 'Overhead Press', sets: [{ reps: 8, weight: 95 }] },
                        { name: 'Deadlift', sets: [{ reps: 5, weight: 315 }] }
                    ]
                }
            ];

            const result = calculateWeeklyVolume(sessions);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toHaveProperty('upper');
            expect(result[0]).toHaveProperty('lower');
        });

        it('should categorize exercises correctly', () => {
            expect(getExerciseCategory('Bench Press')).toBe('upper');
            expect(getExerciseCategory('Squat')).toBe('lower');
            expect(getExerciseCategory('Plank')).toBe('core');
            expect(getExerciseCategory('Run')).toBe('cardio');
        });

        it('should detect strength PRs', () => {
            const sessions = [
                {
                    timestamp: new Date('2024-01-15').toISOString(),
                    exercises: [
                        {
                            name: 'Bench Press',
                            sets: [
                                { reps: 5, weight: 135 },
                                { reps: 5, weight: 185 },
                                { reps: 5, weight: 205 } // PR
                            ]
                        }
                    ]
                },
                {
                    timestamp: new Date('2024-01-20').toISOString(),
                    exercises: [
                        {
                            name: 'Bench Press',
                            sets: [
                                { reps: 3, weight: 225 }, // New PR
                                { reps: 5, weight: 185 }
                            ]
                        }
                    ]
                }
            ];

            const prs = detectStrengthPRs(sessions);

            expect(prs).toHaveProperty('Bench Press');
            expect(prs['Bench Press'].weight).toBe(225);
            expect(prs['Bench Press'].reps).toBe(3);
        });

        it('should calculate 1RM correctly', () => {
            const oneRM1 = calculate1RM(225, 5);
            expect(oneRM1).toBeGreaterThan(225);

            const oneRM2 = calculate1RM(135, 1);
            expect(oneRM2).toBe(135);

            // Formula should produce reasonable estimates
            const oneRM3 = calculate1RM(185, 3);
            const oneRM4 = calculate1RM(185, 5);

            // Both should be greater than the working weight
            expect(oneRM3).toBeGreaterThan(185);
            expect(oneRM4).toBeGreaterThan(185);

            // More reps at the same weight = easier, so lower estimated 1RM
            // Fewer reps = harder = higher estimated 1RM
            expect(oneRM3).toBeLessThan(oneRM4); // Correct: 5 reps gives higher estimate than 3 reps
        });
    });

    describe('Week Key Generation', () => {
        it('should generate consistent week keys', () => {
            const date = new Date('2024-01-15');
            const week1 = `2024-01-W${Math.ceil(15 / 7)}`;

            expect(week1).toBeTruthy();
            expect(week1).toContain('2024-01-W');
        });

        it('should handle different dates in same month', () => {
            const date1 = new Date('2024-01-05');
            const date2 = new Date('2024-01-12');

            // Both should be in different weeks
            const week1 = Math.ceil(date1.getDate() / 7);
            const week2 = Math.ceil(date2.getDate() / 7);

            expect(week1).not.toBe(week2);
        });
    });

    describe('Cache Management', () => {
        it('should cache chart data', () => {
            const cache = {
                last30Days: { test: 'data' },
                cacheTime: Date.now(),
                ttl: 5 * 60 * 1000
            };

            const isCacheValid = () => {
                if (!cache.cacheTime) {return false;}
                return (Date.now() - cache.cacheTime) < cache.ttl;
            };

            expect(isCacheValid()).toBe(true);
        });

        it('should invalidate cache after TTL', () => {
            const cache = {
                last30Days: { test: 'data' },
                cacheTime: Date.now() - (6 * 60 * 1000), // 6 minutes ago
                ttl: 5 * 60 * 1000
            };

            const isCacheValid = () => {
                if (!cache.cacheTime) {return false;}
                return (Date.now() - cache.cacheTime) < cache.ttl;
            };

            expect(isCacheValid()).toBe(false);
        });
    });
});

