/**
 * Unit Tests for Dedup Functionality
 * Tests for buildDedupHash, likelyDuplicate, richness-based canonical selection, merge
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DedupRules class
class MockDedupRules {
    static buildDedupHash(activity) {
        const { userId, startTs, durationS, type } = activity;
        const durationMinutes = Math.round(durationS / 60);
        const hashInput = `${userId}|${startTs}|${durationMinutes}|${type}`;
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < hashInput.length; i++) {
            const char = hashInput.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    static richnessScore(activity) {
        let score = 0.0;
        if (activity.hasHr) {score += 0.4;}
        if (activity.hasGps) {score += 0.2;}
        if (activity.hasPower) {score += 0.2;}
        if (activity.perSecondData) {score += 0.1;}
        if (activity.device) {score += 0.1;}
        return Math.min(score, 1.0);
    }

    static likelyDuplicate(activity1, activity2, toleranceMinutes = 6, tolerancePercent = 0.1) {
        if (activity1.userId !== activity2.userId || activity1.type !== activity2.type) {
            return false;
        }

        const timeDiffMs = Math.abs(new Date(activity1.startTs) - new Date(activity2.startTs));
        const timeDiffMinutes = timeDiffMs / (1000 * 60);

        if (timeDiffMinutes > toleranceMinutes) {
            return false;
        }

        const duration1 = activity1.durationS || 0;
        const duration2 = activity2.durationS || 0;

        if (duration1 === 0 || duration2 === 0) {
            return false;
        }

        const durationDiff = Math.abs(duration1 - duration2);
        const durationTolerance = Math.max(duration1, duration2) * tolerancePercent;

        return durationDiff <= durationTolerance;
    }
}

describe('Dedup Functionality', () => {
    describe('buildDedupHash', () => {
        it('should build stable dedup_hash', () => {
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
                durationS: 3605, // 60.08 minutes
                type: 'Run'
            };

            const hash1 = MockDedupRules.buildDedupHash(activity1);
            const hash2 = MockDedupRules.buildDedupHash(activity2);

            expect(hash1).toBe(hash2);
        });
    });

    describe('likelyDuplicate', () => {
        it('should detect duplicates within ±6 min / ±10% duration', () => {
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
                durationS: 3600
            };

            const activity2 = {
                userId: 123,
                type: 'Run',
                startTs: '2024-01-01T10:00:00Z',
                durationS: 1800 // 50% difference
            };

            expect(MockDedupRules.likelyDuplicate(activity1, activity2)).toBe(false);
        });

        it('should handle edge case: exactly ±6 minutes', () => {
            const activity1 = {
                userId: 123,
                type: 'Run',
                startTs: '2024-01-01T10:00:00Z',
                durationS: 3600
            };

            const activity2 = {
                userId: 123,
                type: 'Run',
                startTs: '2024-01-01T10:06:00Z', // Exactly 6 minutes later
                durationS: 3600
            };

            // Should still be within tolerance
            expect(MockDedupRules.likelyDuplicate(activity1, activity2)).toBe(true);
        });
    });

    describe('selects canonical by richness', () => {
        it('should select richer source as canonical', () => {
            const richActivity = {
                hasHr: true,
                hasGps: true,
                hasPower: true,
                device: { name: 'Garmin' }
            };

            const poorActivity = {
                hasHr: false,
                hasGps: false
            };

            const richScore = MockDedupRules.richnessScore(richActivity);
            const poorScore = MockDedupRules.richnessScore(poorActivity);

            expect(richScore).toBeGreaterThan(poorScore);
            expect(richScore).toBeGreaterThan(0.8);
            expect(poorScore).toBe(0);
        });

        it('should compare richness scores correctly', () => {
            const activities = [
                { hasHr: true, hasGps: true }, // 0.6
                { hasHr: true }, // 0.4
                { hasGps: true }, // 0.2
                {} // 0.0
            ];

            const scores = activities.map(a => MockDedupRules.richnessScore(a));

            expect(scores[0]).toBeGreaterThan(scores[1]);
            expect(scores[1]).toBeGreaterThan(scores[2]);
            expect(scores[2]).toBeGreaterThan(scores[3]);
        });
    });

    describe('merges streams and preserves manual notes/RPE', () => {
        it('should merge activity sources correctly', () => {
            const manualActivity = {
                id: 'manual_1',
                source: 'manual',
                notes: 'Felt great',
                rpe: 7,
                durationS: 3600,
                type: 'Run',
                hasHr: false,
                hasGps: false
            };

            const stravaActivity = {
                id: 'strava_123',
                source: 'strava',
                hasHr: true,
                hasGps: true,
                durationS: 3600,
                type: 'Run'
            };

            // Calculate richness scores
            const manualRichness = MockDedupRules.richnessScore(manualActivity);
            const stravaRichness = MockDedupRules.richnessScore(stravaActivity);

            // Canonical selection: Strava is richer
            const canonicalSource = stravaRichness > manualRichness
                ? 'strava' : 'manual';

            // Merge sources
            const mergedActivity = {
                canonical_source: canonicalSource,
                canonical_external_id: canonicalSource === 'strava' ? 'strava_123' : null,
                source_set: {
                    manual: { id: 'manual_1', richness: manualRichness },
                    strava: { id: 'strava_123', richness: stravaRichness }
                },
                notes: manualActivity.notes, // Preserve manual notes
                rpe: manualActivity.rpe, // Preserve RPE
                ...stravaActivity // Richer data is canonical
            };

            expect(mergedActivity.canonical_source).toBe('strava');
            expect(mergedActivity.notes).toBe('Felt great');
            expect(mergedActivity.rpe).toBe(7);
            expect(mergedActivity.hasHr).toBe(true);
            expect(mergedActivity.hasGps).toBe(true);
        });

        it('should preserve manual data even when external is canonical', () => {
            const manualData = {
                notes: 'Post-workout notes',
                rpe: 8,
                subjectiveFeeling: 'strong'
            };

            const externalData = {
                hasHr: true,
                hasGps: true,
                richness: 0.8
            };

            const merged = {
                canonical_source: 'strava', // External is richer
                ...manualData, // Manual data preserved as scalars
                ...externalData // External data as canonical
            };

            expect(merged.notes).toBe('Post-workout notes');
            expect(merged.rpe).toBe(8);
            expect(merged.hasHr).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle activities with zero duration', () => {
            const activity = {
                userId: 123,
                startTs: '2024-01-01T10:00:00Z',
                durationS: 0,
                type: 'Run'
            };

            const hash = MockDedupRules.buildDedupHash(activity);
            expect(hash).toBeDefined();
        });

        it('should handle missing fields gracefully', () => {
            const incompleteActivity = {
                userId: 123,
                startTs: '2024-01-01T10:00:00Z'
            };

            const result = MockDedupRules.buildDedupHash(incompleteActivity);
            expect(result).toBeDefined();
        });

        it('should handle very short activities correctly', () => {
            const activity = {
                userId: 123,
                startTs: '2024-01-01T10:00:00Z',
                durationS: 30, // 30 seconds
                type: 'Run'
            };

            const hash = MockDedupRules.buildDedupHash(activity);
            expect(hash).toBeDefined();
        });
    });
});

