// tests/admin-analytics.test.js
// Test file for admin analytics functionality
// Tests admin-*.js endpoints and analytics features

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createAdminMetrics } from './factories/admin.js';

vi.mock('jsonwebtoken', () => ({
    verify: vi.fn(() => ({ sub: 'admin-user-id' }))
}), { virtual: true });

vi.mock('@neondatabase/serverless', () => ({
    neon: vi.fn(() => vi.fn())
}), { virtual: true });

vi.mock('../netlify/functions/utils/connection-pool.js', () => ({
    getNeonClient: vi.fn(() => vi.fn()),
    releaseClient: vi.fn(() => {})
}), { virtual: true });

vi.mock('../netlify/functions/utils/database.js', () => ({
    getDB: () => vi.fn()
}), { virtual: true });

let applyPrivacyThreshold;
let hashUserId;
let validateDateRange;
let successResponse;
let encodeCursor;
let decodeCursor;

beforeAll(async () => {
    const adminAuthModule = await import('../netlify/functions/utils/admin-auth.js');
    ({
        applyPrivacyThreshold,
        hashUserId,
        validateDateRange,
        successResponse,
        encodeCursor,
        decodeCursor
    } = adminAuthModule);
});

describe('applyPrivacyThreshold', () => {
    it('suppresses counts below the minimum threshold', () => {
        expect(applyPrivacyThreshold(3)).toBeNull();
        expect(applyPrivacyThreshold(5)).toBe(5);
        expect(applyPrivacyThreshold(4, 10)).toBeNull();
        expect(applyPrivacyThreshold(12, 10)).toBe(12);
    });
});

describe('hashUserId', () => {
    it('produces deterministic, prefixed hashes', () => {
        const first = hashUserId('user-123');
        const second = hashUserId('user-123');
        const third = hashUserId('user-456');

        expect(first).toMatch(/^usr_[a-f0-9]{6}$/);
        expect(first).toBe(second);
        expect(first).not.toBe(third);
    });
});

describe('validateDateRange', () => {
    it('returns parsed dates for valid ranges', () => {
        const { fromDate, toDate } = validateDateRange('2024-01-01', '2024-02-01');
        expect(fromDate).toBeInstanceOf(Date);
        expect(toDate).toBeInstanceOf(Date);
        expect(fromDate.getTime()).toBeLessThan(toDate.getTime());
    });

    it('throws when the range is inverted or too wide', () => {
        expect(() => validateDateRange('2024-02-01', '2024-01-01')).toThrow('From date must be before to date');
        expect(() => validateDateRange('2020-01-01', '2025-05-01')).toThrow('Date range exceeds maximum (730 days)');
    });
});

describe('successResponse', () => {
    it('wraps admin metrics with metadata and headers', () => {
        const metrics = createAdminMetrics();
        const response = successResponse(metrics, { response_time_ms: 32 }, 'req-abc');

        expect(response.statusCode).toBe(200);
        expect(response.headers['X-Request-ID']).toBe('req-abc');

        const body = JSON.parse(response.body);
        expect(body.data.total_users).toBe(metrics.total_users);
        expect(body.meta.request_id).toBe('req-abc');
        expect(body.meta.generated_at).toBeDefined();
    });
});

describe('cursor encoding utilities', () => {
    it('round-trips cursor values', () => {
        const cursor = encodeCursor(150, 'user-789');
        const decoded = decodeCursor(cursor);
        expect(decoded).toEqual({ value: 150, id: 'user-789' });
    });

    it('throws on malformed cursors', () => {
        expect(() => decodeCursor('not-base64')).toThrow('Invalid cursor format');
    });
});
