// tests/strava-import.test.js
// Test file for Strava data import functionality
// Tests integrations-strava-import.js and related import features

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mapStravaActivity,
  validateAfterParam,
  generateContinueToken,
  parseContinueToken,
  sanitizeForLog,
  buildStravaUrl,
  fetchWithTimeout,
} from '../netlify/functions/utils/strava-import.js';
import { createStravaActivity } from './factories/strava.js';

const originalFetch = global.fetch;

beforeEach(() => {
  vi.useRealTimers();
  global.fetch = originalFetch;
});

afterEach(() => {
  vi.useRealTimers();
  global.fetch = originalFetch;
});

describe('mapStravaActivity', () => {
  it('maps heart rate, power metrics, and basic fields', () => {
    const activity = createStravaActivity({
      moving_time: 1800,
      elapsed_time: 1900,
      distance: 10000,
      average_heartrate: 155,
      max_heartrate: 182,
      has_heartrate: true,
      average_watts: 215,
      weighted_average_watts: 245,
      max_watts: 390,
      timezone: '(GMT-05:00) America/New_York',
    });

    const mapped = mapStravaActivity(activity, 'user-1');

    expect(mapped.user_id).toBe('user-1');
    expect(mapped.duration).toBe(30);
    expect(mapped.payload.summary.distance_km).toBe('10.00');
    expect(mapped.payload.summary.pace_per_km).toBe('3:00');
    expect(mapped.payload.summary.heart_rate).toEqual({
      average: 155,
      max: 182,
      has_data: true,
    });
    expect(mapped.payload.summary.power.has_data).toBe(true);
    expect(mapped.timezone_offset).toBe(-300);
  });
});

describe('validateAfterParam', () => {
  it('accepts valid unix timestamp strings', () => {
    expect(validateAfterParam('1700000000')).toBe(true);
    expect(validateAfterParam(1700000000)).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(validateAfterParam('abc')).toBe(false);
    expect(validateAfterParam('999999999999')).toBe(false);
    expect(validateAfterParam(-100)).toBe(false);
  });
});

describe('continue tokens', () => {
  it('round-trips state via generateContinueToken/parseContinueToken', () => {
    const state = {
      page: 3,
      after: '1699999999',
      imported: 45,
      duplicates: 5,
    };

    const token = generateContinueToken(state);
    const parsed = parseContinueToken(token);
    expect(parsed).toEqual(state);
  });
});

describe('sanitizeForLog', () => {
  it('removes secrets and hashes identifiers', () => {
    const sanitized = sanitizeForLog({
      user_id: 'user-abc-123',
      access_token: 'secret',
      refresh_token: 'refresh',
      notes: 'a'.repeat(120),
    });

    expect(sanitized.access_token).toBeUndefined();
    expect(sanitized.refresh_token).toBeUndefined();
    expect(sanitized.user_hash).toMatch(/^[a-f0-9]{8}$/);
    expect(sanitized.notes.endsWith('...')).toBe(true);
  });
});

describe('buildStravaUrl', () => {
  it('composes pagination parameters correctly', () => {
    const url = new URL(
      buildStravaUrl({
        perPage: 50,
        page: 2,
        lastActivityId: 987654,
        after: 1699000000,
      })
    );

    expect(url.searchParams.get('per_page')).toBe('50');
    expect(url.searchParams.get('before')).toBe('987654');
    expect(url.searchParams.get('after')).toBe('1699000000');
    expect(url.searchParams.has('page')).toBe(false);
  });
});

describe('fetchWithTimeout', () => {
  it('resolves when the request completes in time', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchSpy;

    const response = await fetchWithTimeout('https://example.com/api', {}, 50);
    expect(response.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('rejects when the request exceeds the timeout', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn(
      (url, options) =>
        new Promise((_resolve, reject) => {
          // Simulate a slow request that will be aborted
          const timeoutId = setTimeout(() => {
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          }, 20); // Longer than the timeout
          options?.signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        })
    );
    global.fetch = fetchSpy;

    const promise = fetchWithTimeout('https://example.com/slow', {}, 10);

    // Advance timers to trigger timeout
    await vi.advanceTimersByTimeAsync(15);

    // Wait for the promise to reject
    await expect(promise).rejects.toThrow('Request timeout after 10ms');

    vi.useRealTimers();
  });
});
