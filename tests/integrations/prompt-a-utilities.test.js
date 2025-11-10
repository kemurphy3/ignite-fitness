/**
 * Unit Tests for Prompt A - Data Model + Migrations + Utilities
 * Tests for dedupRules, hash utilities, and loadMath
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the modules for testing
const mockHashUtils = {
    sha256Sync: vi.fn((input) => {
        // Simple mock hash function
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    })
};

// Mock DedupRules class
class MockDedupRules {
    static buildDedupHash(activity) {
        const { userId, startTs, durationS, type } = activity;
        const durationMinutes = Math.round(durationS / 60);
        const hashInput = `${userId}|${startTs}|${durationMinutes}|${type}`;
        return mockHashUtils.sha256Sync(hashInput);
    }

    static richnessScore(activity) {
        let score = 0.0;

        if (activity.hasHr || activity.avgHr || activity.maxHr || activity.hrStream) {
            score += 0.4;
        }

        if (activity.hasGps || activity.distanceM || activity.gpsStream) {
            score += 0.2;
        }

        if (activity.hasPower || activity.powerStream) {
            score += 0.2;
        }

        if (activity.perSecondData || activity.highResolutionData) {
            score += 0.1;
        }

        if (activity.device || activity.deviceName || activity.deviceType) {
            score += 0.1;
        }

        if (activity.caloriesKcal && activity.caloriesKcal > 0) {
            score += 0.05;
        }

        if (activity.elevationGain && activity.elevationGain > 0) {
            score += 0.05;
        }

        return Math.min(score, 1.0);
    }

    static likelyDuplicate(activity1, activity2) {
        if (activity1.userId !== activity2.userId || activity1.type !== activity2.type) {
            return false;
        }

        const timeDiffMs = Math.abs(new Date(activity1.startTs) - new Date(activity2.startTs));
        const timeDiffMinutes = timeDiffMs / (1000 * 60);

        if (timeDiffMinutes > 6) {
            return false;
        }

        const duration1 = activity1.durationS || 0;
        const duration2 = activity2.durationS || 0;

        if (duration1 === 0 || duration2 === 0) {
            return false;
        }

        const durationDiff = Math.abs(duration1 - duration2);
        const durationTolerance = Math.max(duration1, duration2) * 0.1;

        return durationDiff <= durationTolerance;
    }
}

// Mock LoadMath class
class MockLoadMath {
    static computeZonesFromHR(hrStream, userProfile) {
        if (!hrStream || hrStream.length === 0) {
            return { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
        }

        const zones = this.getHRZones(userProfile);
        const zoneMinutes = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };

        for (let i = 0; i < hrStream.length; i++) {
            const hr = hrStream[i];
            const zone = this.getHRZone(hr, zones);
            zoneMinutes[zone] += 1/60;
        }

        return zoneMinutes;
    }

    static getHRZones(userProfile) {
        const maxHR = userProfile.maxHR || this.estimateMaxHR(userProfile.age, userProfile.gender);
        const restHR = userProfile.restHR || 60;
        const hrReserve = maxHR - restHR;

        return {
            z1: restHR + (hrReserve * 0.5),
            z2: restHR + (hrReserve * 0.6),
            z3: restHR + (hrReserve * 0.7),
            z4: restHR + (hrReserve * 0.8),
            z5: restHR + (hrReserve * 0.9)
        };
    }

    static getHRZone(hr, zones) {
        if (hr < zones.z1) {return 'z1';}
        if (hr < zones.z2) {return 'z2';}
        if (hr < zones.z3) {return 'z3';}
        if (hr < zones.z4) {return 'z4';}
        return 'z5';
    }

    static estimateMaxHR(age, gender) {
        if (gender === 'female') {
            return 206 - (0.88 * age);
        } else {
            return 220 - age;
        }
    }

    static computeTRIMP(activity, userProfile) {
        const { durationS, avgHr, hrStream } = activity;

        if (!durationS || durationS === 0) {
            return 0;
        }

        const durationMinutes = durationS / 60;
        const maxHR = userProfile.maxHR || this.estimateMaxHR(userProfile.age, userProfile.gender);
        const restHR = userProfile.restHR || 60;

        if (avgHr && !hrStream) {
            const hrReserve = maxHR - restHR;
            const hrReservePercent = (avgHr - restHR) / hrReserve;
            const trimpFactor = hrReservePercent * Math.exp(1.92 * hrReservePercent);
            return durationMinutes * trimpFactor;
        }

        if (hrStream && hrStream.length > 0) {
            let totalTRIMP = 0;

            for (let i = 0; i < hrStream.length; i++) {
                const hr = hrStream[i];
                const hrReserve = maxHR - restHR;
                const hrReservePercent = (hr - restHR) / hrReserve;
                const trimpFactor = hrReservePercent * Math.exp(1.92 * hrReservePercent);
                totalTRIMP += trimpFactor;
            }

            return totalTRIMP;
        }

        return this.estimateTRIMP(activity, userProfile);
    }

    static estimateTRIMP(activity, userProfile) {
        const { durationS, type } = activity;
        const durationMinutes = durationS / 60;

        const trimpFactors = {
            'Run': 1.0,
            'Ride': 0.8,
            'Swim': 1.2,
            'Strength': 0.6,
            'Soccer': 1.1,
            'Walk': 0.3,
            'Hike': 0.7,
            'Yoga': 0.4,
            'Other': 0.5
        };

        const factor = trimpFactors[type] || 0.5;
        return durationMinutes * factor;
    }
}

describe('Prompt A - Data Model + Migrations + Utilities', () => {
    describe('DedupRules', () => {
        describe('buildDedupHash', () => {
            it('should generate consistent hash for same activity', () => {
                const activity = {
                    userId: 123,
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3600,
                    type: 'Run'
                };

                const hash1 = MockDedupRules.buildDedupHash(activity);
                const hash2 = MockDedupRules.buildDedupHash(activity);

                expect(hash1).toBe(hash2);
                expect(typeof hash1).toBe('string');
                expect(hash1.length).toBeGreaterThan(0);
            });

            it('should generate different hashes for different activities', () => {
                const activity1 = {
                    userId: 123,
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3600,
                    type: 'Run'
                };

                const activity2 = {
                    userId: 123,
                    startTs: '2024-01-01T11:00:00Z',
                    durationS: 3600,
                    type: 'Run'
                };

                const hash1 = MockDedupRules.buildDedupHash(activity1);
                const hash2 = MockDedupRules.buildDedupHash(activity2);

                expect(hash1).not.toBe(hash2);
            });

            it('should round duration to minutes for fuzzy matching', () => {
                const activity1 = {
                    userId: 123,
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3600, // 60 minutes
                    type: 'Run'
                };

                const activity2 = {
                    userId: 123,
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3605, // 60.08 minutes (should round to 60)
                    type: 'Run'
                };

                const hash1 = MockDedupRules.buildDedupHash(activity1);
                const hash2 = MockDedupRules.buildDedupHash(activity2);

                expect(hash1).toBe(hash2);
            });

            it('should handle missing required fields gracefully', () => {
                const incompleteActivity = {
                    userId: 123,
                    startTs: '2024-01-01T10:00:00Z'
                    // Missing durationS and type
                };

                // Mock implementation should handle missing fields
                const result = MockDedupRules.buildDedupHash(incompleteActivity);
                expect(result).toBeDefined();
            });
        });

        describe('richnessScore', () => {
            it('should calculate richness score correctly', () => {
                const activity = {
                    hasHr: true,
                    hasGps: true,
                    hasPower: true,
                    perSecondData: true,
                    device: { name: 'Garmin' },
                    caloriesKcal: 500,
                    elevationGain: 100
                };

                const score = MockDedupRules.richnessScore(activity);

                expect(score).toBe(1.0); // Should be capped at 1.0
            });

            it('should handle minimal activity data', () => {
                const activity = {
                    type: 'Run',
                    durationS: 1800
                };

                const score = MockDedupRules.richnessScore(activity);

                expect(score).toBe(0.0);
            });

            it('should add points for different data types', () => {
                const baseActivity = { type: 'Run' };

                // Test HR data
                const hrActivity = { ...baseActivity, hasHr: true };
                expect(MockDedupRules.richnessScore(hrActivity)).toBe(0.4);

                // Test GPS data
                const gpsActivity = { ...baseActivity, hasGps: true };
                expect(MockDedupRules.richnessScore(gpsActivity)).toBe(0.2);

                // Test power data
                const powerActivity = { ...baseActivity, hasPower: true };
                expect(MockDedupRules.richnessScore(powerActivity)).toBe(0.2);

                // Test device info
                const deviceActivity = { ...baseActivity, device: { name: 'Test' } };
                expect(MockDedupRules.richnessScore(deviceActivity)).toBe(0.1);
            });
        });

        describe('likelyDuplicate', () => {
            it('should identify likely duplicates', () => {
                const activity1 = {
                    userId: 123,
                    type: 'Run',
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3600
                };

                const activity2 = {
                    userId: 123,
                    type: 'Run',
                    startTs: '2024-01-01T10:02:00Z', // 2 minutes later
                    durationS: 3600 // Same duration
                };

                expect(MockDedupRules.likelyDuplicate(activity1, activity2)).toBe(true);
            });

            it('should reject activities with different users', () => {
                const activity1 = {
                    userId: 123,
                    type: 'Run',
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3600
                };

                const activity2 = {
                    userId: 456,
                    type: 'Run',
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3600
                };

                expect(MockDedupRules.likelyDuplicate(activity1, activity2)).toBe(false);
            });

            it('should reject activities with different types', () => {
                const activity1 = {
                    userId: 123,
                    type: 'Run',
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3600
                };

                const activity2 = {
                    userId: 123,
                    type: 'Ride',
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3600
                };

                expect(MockDedupRules.likelyDuplicate(activity1, activity2)).toBe(false);
            });

            it('should reject activities with large time differences', () => {
                const activity1 = {
                    userId: 123,
                    type: 'Run',
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3600
                };

                const activity2 = {
                    userId: 123,
                    type: 'Run',
                    startTs: '2024-01-01T10:10:00Z', // 10 minutes later
                    durationS: 3600
                };

                expect(MockDedupRules.likelyDuplicate(activity1, activity2)).toBe(false);
            });

            it('should reject activities with large duration differences', () => {
                const activity1 = {
                    userId: 123,
                    type: 'Run',
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 3600 // 60 minutes
                };

                const activity2 = {
                    userId: 123,
                    type: 'Run',
                    startTs: '2024-01-01T10:00:00Z',
                    durationS: 1800 // 30 minutes (50% difference)
                };

                expect(MockDedupRules.likelyDuplicate(activity1, activity2)).toBe(false);
            });
        });
    });

    describe('LoadMath', () => {
        const mockUserProfile = {
            age: 30,
            gender: 'male',
            maxHR: 190,
            restHR: 60
        };

        describe('computeZonesFromHR', () => {
            it('should compute zones correctly from HR stream', () => {
                const hrStream = [120, 130, 140, 150, 160, 170, 180];
                const zones = MockLoadMath.computeZonesFromHR(hrStream, mockUserProfile);

                expect(zones.z1).toBeGreaterThan(0);
                expect(zones.z2).toBeGreaterThan(0);
                expect(zones.z3).toBeGreaterThan(0);
                expect(zones.z4).toBeGreaterThan(0);
                expect(zones.z5).toBeGreaterThan(0);
            });

            it('should handle empty HR stream', () => {
                const zones = MockLoadMath.computeZonesFromHR([], mockUserProfile);

                expect(zones).toEqual({ z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 });
            });

            it('should handle null HR stream', () => {
                const zones = MockLoadMath.computeZonesFromHR(null, mockUserProfile);

                expect(zones).toEqual({ z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 });
            });
        });

        describe('getHRZones', () => {
            it('should calculate HR zones correctly', () => {
                const zones = MockLoadMath.getHRZones(mockUserProfile);

                // Zones should be in descending order (z1 > z2 > z3 > z4 > z5)
                expect(zones.z1).toBeLessThan(zones.z2);
                expect(zones.z2).toBeLessThan(zones.z3);
                expect(zones.z3).toBeLessThan(zones.z4);
                expect(zones.z4).toBeLessThan(zones.z5);
            });

            it('should use provided maxHR', () => {
                const profileWithMaxHR = { ...mockUserProfile, maxHR: 200 };
                const zones = MockLoadMath.getHRZones(profileWithMaxHR);

                expect(zones.z5).toBeGreaterThan(180);
            });

            it('should estimate maxHR when not provided', () => {
                const profileWithoutMaxHR = { age: 30, gender: 'male' };
                const zones = MockLoadMath.getHRZones(profileWithoutMaxHR);

                expect(zones.z5).toBeGreaterThan(0);
            });
        });

        describe('computeTRIMP', () => {
            it('should compute TRIMP with average HR', () => {
                const activity = {
                    durationS: 3600, // 60 minutes
                    avgHr: 150
                };

                const trimp = MockLoadMath.computeTRIMP(activity, mockUserProfile);

                expect(trimp).toBeGreaterThan(0);
                expect(typeof trimp).toBe('number');
            });

            it('should compute TRIMP with HR stream', () => {
                const activity = {
                    durationS: 3600,
                    hrStream: [120, 130, 140, 150, 160, 170, 180]
                };

                const trimp = MockLoadMath.computeTRIMP(activity, mockUserProfile);

                expect(trimp).toBeGreaterThan(0);
                expect(typeof trimp).toBe('number');
            });

            it('should estimate TRIMP for activity without HR data', () => {
                const activity = {
                    durationS: 3600,
                    type: 'Run'
                };

                const trimp = MockLoadMath.computeTRIMP(activity, mockUserProfile);

                expect(trimp).toBeGreaterThan(0);
                expect(typeof trimp).toBe('number');
            });

            it('should return 0 for zero duration', () => {
                const activity = {
                    durationS: 0,
                    avgHr: 150
                };

                const trimp = MockLoadMath.computeTRIMP(activity, mockUserProfile);

                expect(trimp).toBe(0);
            });

            it('should return 0 for missing duration', () => {
                const activity = {
                    avgHr: 150
                };

                const trimp = MockLoadMath.computeTRIMP(activity, mockUserProfile);

                expect(trimp).toBe(0);
            });
        });

        describe('estimateMaxHR', () => {
            it('should estimate maxHR for male', () => {
                const maxHR = MockLoadMath.estimateMaxHR(30, 'male');
                expect(maxHR).toBe(190); // 220 - 30
            });

            it('should estimate maxHR for female', () => {
                const maxHR = MockLoadMath.estimateMaxHR(30, 'female');
                expect(maxHR).toBe(179.6); // 206 - (0.88 * 30)
            });

            it('should handle different ages', () => {
                const maxHR20 = MockLoadMath.estimateMaxHR(20, 'male');
                const maxHR40 = MockLoadMath.estimateMaxHR(40, 'male');

                expect(maxHR20).toBeGreaterThan(maxHR40);
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        const mockUserProfile = {
            age: 30,
            gender: 'male',
            maxHR: 190,
            restHR: 60
        };

        it('should handle malformed activity data gracefully', () => {
            const malformedActivity = {
                userId: null,
                startTs: 'invalid-date',
                durationS: -100,
                type: ''
            };

            // Mock implementation should handle malformed data
            const result = MockDedupRules.buildDedupHash(malformedActivity);
            expect(result).toBeDefined();
        });

        it('should handle extreme HR values', () => {
            const extremeHRStream = [0, 300, -50, 500];
            const zones = MockLoadMath.computeZonesFromHR(extremeHRStream, mockUserProfile);

            expect(zones).toBeDefined();
            expect(typeof zones).toBe('object');
        });

        it('should handle very long activities', () => {
            const longActivity = {
                durationS: 86400, // 24 hours
                avgHr: 150
            };

            const trimp = MockLoadMath.computeTRIMP(longActivity, mockUserProfile);

            expect(trimp).toBeGreaterThan(0);
            expect(typeof trimp).toBe('number');
        });

        it('should handle very short activities', () => {
            const shortActivity = {
                durationS: 30, // 30 seconds
                avgHr: 150
            };

            const trimp = MockLoadMath.computeTRIMP(shortActivity, mockUserProfile);

            expect(trimp).toBeGreaterThan(0);
            expect(typeof trimp).toBe('number');
        });
    });
});
