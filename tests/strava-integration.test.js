/**
 * Strava integration tests validating StravaHook, ActivityMatcher, and token flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import StravaHook from '../js/modules/integration/StravaHook.js';
import ActivityMatcher from '../js/modules/integration/ActivityMatcher.js';

const makeResponse = (status, body, headers = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
        get: (name) => {
            const key = name.toLowerCase();
            const entries = Object.entries(headers).reduce((acc, [k, v]) => {
                acc[k.toLowerCase()] = v;
                return acc;
            }, {});
            return entries[key] ?? null;
        }
    },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
});

const createTokenPayload = () => ({
    accessToken: 'access-token-123',
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    scope: 'read,activity:read'
});

describe('StravaHook integration', () => {
    let fetchMock;
    let tokenManager;
    let storageManager;
    let activityMatcher;
    let stravaProcessor;
    let hook;
    let importedActivities;

    beforeEach(() => {
        fetchMock = vi.fn();
        tokenManager = {
            ensureAccessToken: vi.fn(async () => createTokenPayload()),
            refreshToken: vi.fn(async () => ({ success: true }))
        };
        storageManager = {
            getStorage: vi.fn(() => ({})),
            setStorage: vi.fn(),
            get: vi.fn(() => []),
            set: vi.fn()
        };
        activityMatcher = new ActivityMatcher({ logger: console });
        importedActivities = [];
        stravaProcessor = {
            getExternalActivities: vi.fn(() => []),
            importActivities: vi.fn(async (activities) => {
                importedActivities = activities;
                return { processed: activities.length };
            })
        };
        hook = new StravaHook({
            fetchImpl: fetchMock,
            tokenManager,
            storageManager,
            activityMatcher,
            stravaProcessor,
            logger: console
        });
        vi.spyOn(hook, 'sleep').mockImplementation(() => Promise.resolve());
    });

    it('synchronizes activities with streams and matching', async () => {
        const now = new Date('2024-01-01T10:00:00Z');
        const activities = [
            {
                id: 101,
                name: 'Morning Run',
                type: 'Run',
                moving_time: 1800,
                distance: 5000,
                start_date: now.toISOString()
            },
            {
                id: 102,
                name: 'Evening Ride',
                type: 'Ride',
                moving_time: 3600,
                distance: 20000,
                start_date: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
            }
        ];

        fetchMock
            .mockImplementationOnce(() => makeResponse(200, activities))
            .mockImplementationOnce(() => makeResponse(200, []))
            .mockImplementationOnce(() => makeResponse(200, {
                heartrate: { data: [140, 142, 145] },
                time: { data: [0, 30, 60] }
            }))
            .mockImplementationOnce(() => makeResponse(200, {
                heartrate: { data: [120, 125] },
                time: { data: [0, 60] }
            }));

        const session = {
            id: 'session-1',
            startTime: new Date(now.getTime() + 10 * 60 * 1000).toISOString()
        };

        const summary = await hook.syncActivities('user-123', { sessions: [session] });

        expect(tokenManager.ensureAccessToken).toHaveBeenCalledWith('user-123');
        expect(importedActivities.length).toBe(2);
        expect(importedActivities.some(activity => activity.heartRateSeries.length > 0)).toBe(true);
        expect(summary.fetched).toBe(2);
        expect(summary.processed).toBe(2);
        expect(summary.matches.length).toBe(1);
        expect(summary.matches[0].activityId).toBe('101');
    });

    it('refreshes tokens when encountering unauthorized responses', async () => {
        tokenManager.ensureAccessToken
            .mockResolvedValueOnce({ ...createTokenPayload(), accessToken: 'expired-token' })
            .mockResolvedValueOnce({ ...createTokenPayload(), accessToken: 'renewed-token' });

        fetchMock
            .mockImplementationOnce(() => makeResponse(401, { message: 'expired' }))
            .mockImplementationOnce(() => makeResponse(200, []))
            .mockImplementationOnce(() => makeResponse(200, []));

        const summary = await hook.syncActivities('user-456');
        expect(tokenManager.refreshToken).toHaveBeenCalledWith('user-456');
        expect(importedActivities.length).toBe(0);
        expect(summary.processed).toBe(0);
    });

    it('backs off when Strava returns rate limit errors', async () => {
        fetchMock
            .mockImplementationOnce(() => makeResponse(429, { message: 'rate limit' }, { 'retry-after': '1' }))
            .mockImplementationOnce(() => makeResponse(200, []))
            .mockImplementationOnce(() => makeResponse(200, []));

        await hook.fetchActivities('token', 'user-789', { perPage: 200 });
        expect(hook.sleep).toHaveBeenCalledWith(1000);
    });
});
