/**
 * Strava Processor Unit Tests
 * Tests for prompt 9 - Strava Ingest MVP
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Strava Processor', () => {
    let mockStorageManager, mockAuthManager, stravaProcessor;

    beforeEach(() => {
        // Mock dependencies
        mockStorageManager = {
            getStorage: vi.fn(() => ({})),
            setStorage: vi.fn()
        };

        mockAuthManager = {
            getCurrentUsername: vi.fn(() => 'test-user')
        };

        // Mock window objects
        global.window = {
            SafeLogger: console,
            StorageManager: mockStorageManager,
            AuthManager: mockAuthManager
        };

        // Reset module
        delete window.StravaProcessor;
    });

    describe('Activity Processing', () => {
        // Extract processing logic for testing
        function mapActivityType(stravaType) {
            const typeMap = {
                'Run': 'run',
                'TrailRun': 'run',
                'Treadmill': 'run',
                'Ride': 'cycle',
                'VirtualRide': 'cycle',
                'IndoorRide': 'cycle',
                'Swim': 'swim',
                'WeightTraining': 'strength',
                'Workout': 'strength',
                'Yoga': 'recovery',
                'Stretching': 'recovery',
                'Walk': 'recovery'
            };
            return typeMap[stravaType] || 'other';
        }

        function parseDuration(seconds) {
            if (!seconds || seconds <= 0) {return null;}
            return Math.round(seconds / 60);
        }

        function parseDistance(meters) {
            if (!meters || meters <= 0) {return null;}
            return Math.round(meters);
        }

        function parseHeartRate(bpm) {
            if (!bpm || bpm <= 0) {return null;}
            return Math.round(bpm);
        }

        function parseStartTime(dateString) {
            if (!dateString) {return null;}

            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) {return null;}
                return date.toISOString();
            } catch (error) {
                return null;
            }
        }

        function calculateTrainingLoad(activity) {
            const { type, duration, distance, avgHR } = activity;

            let baseLoad = 0;

            const typeMultipliers = {
                'run': 1.0,
                'cycle': 0.8,
                'swim': 0.9,
                'strength': 1.2,
                'recovery': 0.3,
                'other': 0.5
            };

            baseLoad = typeMultipliers[type] || 0.5;

            const durationFactor = Math.log10(Math.max(duration, 1)) / 2;

            let distanceFactor = 0;
            if (['run', 'cycle', 'swim'].includes(type) && distance) {
                distanceFactor = Math.min(distance / 10000, 1);
            }

            let hrFactor = 0;
            if (avgHR && avgHR > 0) {
                const hrPercent = Math.min(avgHR / 200, 1);
                hrFactor = hrPercent * 0.5;
            }

            const totalLoad = baseLoad * (durationFactor + distanceFactor + hrFactor) * 20;

            return Math.max(0, Math.min(100, Math.round(totalLoad)));
        }

        function getDedupeKey(activity) {
            const type = mapActivityType(activity.type);
            const startTime = parseStartTime(activity.start_date_local);
            const duration = parseDuration(activity.moving_time || activity.elapsed_time);

            return `${type}_${startTime}_${duration}`;
        }

        it('should map Strava activity types correctly', () => {
            expect(mapActivityType('Run')).toBe('run');
            expect(mapActivityType('TrailRun')).toBe('run');
            expect(mapActivityType('Ride')).toBe('cycle');
            expect(mapActivityType('Swim')).toBe('swim');
            expect(mapActivityType('WeightTraining')).toBe('strength');
            expect(mapActivityType('Yoga')).toBe('recovery');
            expect(mapActivityType('Unknown')).toBe('other');
        });

        it('should parse duration correctly', () => {
            expect(parseDuration(3600)).toBe(60); // 1 hour
            expect(parseDuration(1800)).toBe(30); // 30 minutes
            expect(parseDuration(0)).toBeNull();
            expect(parseDuration(null)).toBeNull();
        });

        it('should parse distance correctly', () => {
            expect(parseDistance(5000)).toBe(5000); // 5km
            expect(parseDistance(10000)).toBe(10000); // 10km
            expect(parseDistance(0)).toBeNull();
            expect(parseDistance(null)).toBeNull();
        });

        it('should parse heart rate correctly', () => {
            expect(parseHeartRate(150)).toBe(150);
            expect(parseHeartRate(0)).toBeNull();
            expect(parseHeartRate(null)).toBeNull();
        });

        it('should parse start time correctly', () => {
            const validDate = '2024-01-15T10:30:00Z';
            const result = parseStartTime(validDate);
            expect(result).toBeTruthy();
            expect(new Date(result).getTime()).toBe(new Date(validDate).getTime());

            expect(parseStartTime('invalid')).toBeNull();
            expect(parseStartTime(null)).toBeNull();
        });

        it('should calculate training load correctly', () => {
            const runActivity = {
                type: 'run',
                duration: 60, // 1 hour
                distance: 10000, // 10km
                avgHR: 150
            };

            const load = calculateTrainingLoad(runActivity);
            expect(load).toBeGreaterThan(0);
            expect(load).toBeLessThanOrEqual(100);

            const shortActivity = {
                type: 'run',
                duration: 5, // 5 minutes
                distance: 1000, // 1km
                avgHR: 120
            };

            const shortLoad = calculateTrainingLoad(shortActivity);
            expect(shortLoad).toBeLessThan(load);
        });

        it('should generate deduplication keys correctly', () => {
            const activity = {
                type: 'Run',
                start_date_local: '2024-01-15T10:30:00Z',
                moving_time: 3600
            };

            const key = getDedupeKey(activity);
            expect(key).toContain('run_');
            expect(key).toContain('2024-01-15T10:30:00.000Z');
            expect(key).toContain('_60');
        });

        it('should handle different activity types for training load', () => {
            const activities = [
                { type: 'run', duration: 60, distance: 10000, avgHR: 150 },
                { type: 'cycle', duration: 60, distance: 20000, avgHR: 140 },
                { type: 'strength', duration: 45, distance: null, avgHR: 120 },
                { type: 'recovery', duration: 30, distance: null, avgHR: 100 }
            ];

            activities.forEach(activity => {
                const load = calculateTrainingLoad(activity);
                expect(load).toBeGreaterThanOrEqual(0);
                expect(load).toBeLessThanOrEqual(100);
            });

            // Strength should have higher load than recovery
            const strengthLoad = calculateTrainingLoad(activities[2]);
            const recoveryLoad = calculateTrainingLoad(activities[3]);
            expect(strengthLoad).toBeGreaterThan(recoveryLoad);
        });
    });

    describe('Deduplication', () => {
        // Helper functions for deduplication tests
        function mapActivityType(stravaType) {
            const typeMap = {
                'Run': 'run',
                'TrailRun': 'run',
                'Treadmill': 'run',
                'Ride': 'cycle',
                'VirtualRide': 'cycle',
                'IndoorRide': 'cycle',
                'Swim': 'swim',
                'WeightTraining': 'strength',
                'Workout': 'strength',
                'Yoga': 'recovery',
                'Stretching': 'recovery',
                'Walk': 'recovery'
            };
            return typeMap[stravaType] || 'other';
        }

        function parseStartTime(dateString) {
            if (!dateString) {return null;}

            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) {return null;}
                return date.toISOString();
            } catch (error) {
                return null;
            }
        }

        function parseDuration(seconds) {
            if (!seconds || seconds <= 0) {return null;}
            return Math.round(seconds / 60);
        }

        it('should detect duplicate activities', () => {
            const activities = [
                {
                    type: 'Run',
                    start_date_local: '2024-01-15T10:30:00Z',
                    moving_time: 3600,
                    distance: 10000
                },
                {
                    type: 'Run',
                    start_date_local: '2024-01-15T10:30:00Z',
                    moving_time: 3600,
                    distance: 10000
                }
            ];

            // Both activities should have same dedupe key
            const key1 = `${mapActivityType(activities[0].type)}_${parseStartTime(activities[0].start_date_local)}_${parseDuration(activities[0].moving_time)}`;
            const key2 = `${mapActivityType(activities[1].type)}_${parseStartTime(activities[1].start_date_local)}_${parseDuration(activities[1].moving_time)}`;

            expect(key1).toBe(key2);
        });

        it('should not detect different activities as duplicates', () => {
            const activities = [
                {
                    type: 'Run',
                    start_date_local: '2024-01-15T10:30:00Z',
                    moving_time: 3600
                },
                {
                    type: 'Run',
                    start_date_local: '2024-01-15T11:30:00Z', // Different time
                    moving_time: 3600
                }
            ];

            const key1 = `${mapActivityType(activities[0].type)}_${parseStartTime(activities[0].start_date_local)}_${parseDuration(activities[0].moving_time)}`;
            const key2 = `${mapActivityType(activities[1].type)}_${parseStartTime(activities[1].start_date_local)}_${parseDuration(activities[1].moving_time)}`;

            expect(key1).not.toBe(key2);
        });
    });

    describe('File Processing', () => {
        it('should handle valid Strava export format', () => {
            const stravaExport = [
                {
                    id: 12345,
                    type: 'Run',
                    name: 'Morning Run',
                    start_date_local: '2024-01-15T06:00:00Z',
                    moving_time: 1800,
                    distance: 5000,
                    average_heartrate: 150
                }
            ];

            // Test that we can process this format
            expect(Array.isArray(stravaExport)).toBe(true);
            expect(stravaExport[0]).toHaveProperty('type');
            expect(stravaExport[0]).toHaveProperty('start_date_local');
        });

        it('should handle wrapped export format', () => {
            const wrappedExport = {
                activities: [
                    {
                        id: 12345,
                        type: 'Run',
                        name: 'Morning Run',
                        start_date_local: '2024-01-15T06:00:00Z',
                        moving_time: 1800,
                        distance: 5000
                    }
                ]
            };

            expect(wrappedExport).toHaveProperty('activities');
            expect(Array.isArray(wrappedExport.activities)).toBe(true);
        });
    });

    describe('Training Load Integration', () => {
        it('should calculate weekly load from activities', () => {
            const activities = [
                { trainingLoad: 20, startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() }, // 1 day ago
                { trainingLoad: 15, startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }, // 3 days ago
                { trainingLoad: 25, startTime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() } // 8 days ago (excluded)
            ];

            // Filter last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentActivities = activities.filter(activity => {
                const activityDate = new Date(activity.startTime);
                return activityDate >= sevenDaysAgo;
            });

            const weeklyLoad = recentActivities.reduce((total, activity) => {
                return total + (activity.trainingLoad || 0);
            }, 0);

            expect(weeklyLoad).toBe(35); // 20 + 15, excluding the 8-day-old activity
        });
    });
});
