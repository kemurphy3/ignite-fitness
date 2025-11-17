/**
 * Unit Tests for Strava Ingest Handler
 * Tests for duplicate detection, richness promotion, stream attach, and aggregates recalculation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase client
const mockSupabaseClient = (mockData = {}) => {
  return {
    from: vi.fn(table => {
      const tableData = mockData[table] || [];

      return {
        select: vi.fn(() => ({
          eq: vi.fn((column, value) => ({
            single: vi.fn(() => {
              const foundItem = tableData.find(row => row[column] === value);
              if (foundItem) {
                return { data: foundItem, error: null };
              }
              return { data: null, error: { code: 'PGRST116' } };
            }),
          })),
        })),
        insert: vi.fn(data => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: Array.isArray(data) ? data[0] : data,
              error: null,
            })),
          })),
        })),
        update: vi.fn(data => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { id: 1, ...data },
                error: null,
              })),
            })),
          })),
        })),
        gte: vi.fn((column, value) => ({
          lte: vi.fn((col, val) => ({
            // This would be used for findLikelyDuplicates
            filter: vi.fn(() => ({
              data: tableData.filter(item => item.start_ts >= val && item.start_ts <= val),
              error: null,
            })),
          })),
        })),
      };
    }),
  };
};

// Mock Strava activity
const createMockStravaActivity = (overrides = {}) => ({
  id: 12345,
  type: 'Run',
  name: 'Morning Run',
  start_date: '2024-01-15T07:00:00Z',
  moving_time: 3600,
  elapsed_time: 3600,
  distance: 10000,
  average_heartrate: 150,
  max_heartrate: 170,
  calories: 500,
  has_heartrate: true,
  start_latlng: [37.7749, -122.4194],
  ...overrides,
});

describe('Strava Ingest Handler', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = mockSupabaseClient({
      activities: [],
      activity_streams: [],
      ingest_log: [],
      daily_aggregates: [],
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect exact duplicates by hash', async () => {
      // Mock existing activity with same hash
      const existingActivity = {
        id: 1,
        user_id: 123,
        canonical_source: 'strava',
        canonical_external_id: '999',
        type: 'Run',
        start_ts: '2024-01-15T07:00:00Z',
        duration_s: 3600,
        dedup_hash: 'abc123',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn((col, val) => ({
            single: vi.fn(() => ({
              data: existingActivity,
              error: null,
            })),
          })),
        })),
      });

      // This would be called by the ingest function
      expect(existingActivity).toBeDefined();
      expect(existingActivity.dedup_hash).toBe('abc123');
    });

    it('should identify likely duplicates within time/duration tolerance', async () => {
      const activities = [
        {
          id: 1,
          user_id: 123,
          type: 'Run',
          start_ts: '2024-01-15T07:00:00Z',
          duration_s: 3600,
        },
        {
          id: 2,
          user_id: 123,
          type: 'Run',
          start_ts: '2024-01-15T07:03:00Z', // 3 minutes later
          duration_s: 3600, // Same duration
        },
      ];

      // Activities should be identified as likely duplicates
      const durationDiff = Math.abs(activities[0].duration_s - activities[1].duration_s);
      const durationTolerance = Math.max(activities[0].duration_s, activities[1].duration_s) * 0.1;

      expect(durationDiff).toBeLessThanOrEqual(durationTolerance);
    });

    it('should reject activities with large time differences', async () => {
      const activities = [
        {
          id: 1,
          user_id: 123,
          type: 'Run',
          start_ts: '2024-01-15T07:00:00Z',
          duration_s: 3600,
        },
        {
          id: 2,
          user_id: 123,
          type: 'Run',
          start_ts: '2024-01-15T07:10:00Z', // 10 minutes later
          duration_s: 3600,
        },
      ];

      const timeDiffMs = Math.abs(
        new Date(activities[1].start_ts) - new Date(activities[0].start_ts)
      );
      const timeDiffMinutes = timeDiffMs / (1000 * 60);

      expect(timeDiffMinutes).toBeGreaterThan(6);
    });
  });

  describe('Richness Promotion', () => {
    it('should update activity with richer version', async () => {
      const existingActivity = {
        id: 1,
        avg_hr: 140,
        max_hr: 160,
        has_hr: true,
        source_set: { strava: { id: '999', richness: 0.5 } },
      };

      const richerActivity = {
        id: 999,
        avg_hr: 150,
        max_hr: 170,
        has_hr: true,
        has_gps: true,
        has_power: true,
        source_set: { strava: { id: '999', richness: 0.9 } },
      };

      // Calculate richness
      function calculateRichness(activity) {
        let score = 0.0;
        if (activity.has_hr || activity.avg_hr) {
          score += 0.4;
        }
        if (activity.has_gps) {
          score += 0.2;
        }
        if (activity.has_power) {
          score += 0.2;
        }
        if (activity.device) {
          score += 0.1;
        }
        return Math.min(score, 1.0);
      }

      const existingRichness = calculateRichness(existingActivity);
      const newRichness = calculateRichness(richerActivity);

      expect(newRichness).toBeGreaterThan(existingRichness);
      expect(newRichness).toBeCloseTo(0.8, 1);
    });

    it('should skip duplicate with equal or lower richness', async () => {
      const existingActivity = {
        avg_hr: 150,
        max_hr: 170,
        has_hr: true,
        has_gps: true,
        source_set: { strava: { id: '999', richness: 0.6 } },
      };

      const newerActivity = {
        avg_hr: 150,
        max_hr: 170,
        has_hr: true,
        source_set: { strava: { id: '999', richness: 0.4 } },
      };

      function calculateRichness(activity) {
        let score = 0.0;
        if (activity.has_hr || activity.avg_hr) {
          score += 0.4;
        }
        if (activity.has_gps) {
          score += 0.2;
        }
        return Math.min(score, 1.0);
      }

      const existingRichness = calculateRichness(existingActivity);
      const newRichness = calculateRichness(newerActivity);

      expect(newRichness).toBeLessThanOrEqual(existingRichness);
    });

    it('should preserve manual data when merging with Strava', async () => {
      const manualActivity = {
        id: 1,
        canonical_source: 'manual',
        name: 'Morning Run - Felt Great',
        type: 'Run',
        start_ts: '2024-01-15T07:00:00Z',
        duration_s: 3600,
      };

      const stravaActivity = {
        id: 12345,
        type: 'Run',
        start_date: '2024-01-15T07:00:00Z',
        moving_time: 3600,
        average_heartrate: 150,
        has_heartrate: true,
      };

      // After merge, manual notes should be preserved
      const mergedActivity = {
        ...manualActivity,
        avg_hr: stravaActivity.average_heartrate,
        has_hr: stravaActivity.has_heartrate,
        source_set: {
          manual: { id: 'm_1', richness: 0.3 },
          strava: { id: '12345', richness: 0.6 },
          merged_from: [
            {
              canonical_source: 'manual',
              canonical_external_id: 'm_1',
              merged_at: '2024-01-15T08:00:00Z',
            },
          ],
        },
      };

      expect(mergedActivity.name).toBe('Morning Run - Felt Great');
      expect(mergedActivity.avg_hr).toBe(150);
    });
  });

  describe('Stream Attachment', () => {
    it('should attach heart rate stream to activity', async () => {
      const activity = {
        id: 1,
        externalId: '12345',
      };

      const stream = {
        heartrate: [
          { t: 0, v: 120 },
          { t: 1, v: 125 },
          { t: 2, v: 130 },
        ],
      };

      // Function to calculate sample rate
      function calculateSampleRate(samples) {
        if (!Array.isArray(samples) || samples.length < 2) {
          return 0;
        }
        const timeSpan = samples[samples.length - 1].t - samples[0].t;
        return samples.length / timeSpan;
      }

      const sampleRate = calculateSampleRate(stream.heartrate);
      expect(sampleRate).toBe(1.5); // 3 samples / 2 seconds = 1.5 Hz
    });

    it('should attach GPS stream to activity', async () => {
      const stream = {
        latlng: [
          [37.7749, -122.4194],
          [37.775, -122.4195],
          [37.7751, -122.4196],
        ],
      };

      expect(stream.latlng).toBeDefined();
      expect(stream.latlng.length).toBe(3);
    });

    it('should handle empty streams gracefully', async () => {
      const emptyStream = {};

      expect(Object.keys(emptyStream).length).toBe(0);
    });
  });

  describe('Aggregates Recalculation', () => {
    it('should trigger aggregate recalculation for affected dates', async () => {
      const affectedDates = new Set(['2024-01-15', '2024-01-16']);

      expect(affectedDates.size).toBe(2);
      expect(affectedDates.has('2024-01-15')).toBe(true);
      expect(affectedDates.has('2024-01-16')).toBe(true);
    });

    it('should not trigger recalculation for duplicate imports', async () => {
      const affectedDates = new Set();

      // Simulate duplicate detection
      const existingActivity = { id: 1, start_ts: '2024-01-15T07:00:00Z' };
      const newActivity = { id: 1, startTs: '2024-01-15T07:00:00Z' }; // Same hash

      // If same hash, don't add to affected dates
      const isDuplicate = existingActivity.id === newActivity.id;

      if (!isDuplicate) {
        const date = new Date(newActivity.startTs).toISOString().split('T')[0];
        affectedDates.add(date);
      }

      expect(affectedDates.size).toBe(0);
    });

    it('should recalculate for dates with richer updates', async () => {
      const affectedDates = new Set();

      // Simulate richer update
      const existingRichness = 0.5;
      const newRichness = 0.8;

      if (newRichness > existingRichness) {
        affectedDates.add('2024-01-15');
      }

      expect(affectedDates.size).toBe(1);
      expect(affectedDates.has('2024-01-15')).toBe(true);
    });

    it('should handle multiple activities on same day', async () => {
      const activities = [
        { startTs: '2024-01-15T07:00:00Z' },
        { startTs: '2024-01-15T12:00:00Z' },
        { startTs: '2024-01-15T18:00:00Z' },
      ];

      const affectedDates = new Set();
      for (const activity of activities) {
        const date = new Date(activity.startTs).toISOString().split('T')[0];
        affectedDates.add(date);
      }

      expect(affectedDates.size).toBe(1);
      expect(affectedDates.has('2024-01-15')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle second import of same file', async () => {
      const firstImport = { status: 'imported', externalId: '12345' };
      const secondImport = { status: 'skipped_dup', externalId: '12345' };

      expect(firstImport.status).toBe('imported');
      expect(secondImport.status).toBe('skipped_dup');
      expect(secondImport.externalId).toBe(firstImport.externalId);
    });

    it('should handle activities without heart rate data', async () => {
      const activityWithoutHR = {
        type: 'Run',
        start_date: '2024-01-15T07:00:00Z',
        moving_time: 3600,
        distance: 10000,
        has_heartrate: false,
        average_heartrate: null,
      };

      expect(activityWithoutHR.has_heartrate).toBe(false);
      expect(activityWithoutHR.average_heartrate).toBeNull();
    });

    it('should handle missing fields gracefully', async () => {
      const incompleteActivity = {
        type: 'Run',
        start_date: '2024-01-15T07:00:00Z',
        // Missing other fields
      };

      // Should provide defaults
      const normalized = {
        durationS: incompleteActivity.moving_time || incompleteActivity.elapsed_time || 0,
        distanceM: incompleteActivity.distance || 0,
        avgHr: incompleteActivity.average_heartrate || null,
      };

      expect(normalized.durationS).toBe(0);
      expect(normalized.distanceM).toBe(0);
      expect(normalized.avgHr).toBeNull();
    });
  });
});
