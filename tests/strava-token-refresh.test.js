// tests/strava-token-refresh.test.js
// Test file for Strava token refresh functionality
// Tests strava-refresh-token.js and related token management

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStravaTokenRecord } from './factories/strava.js';
import { createMockStravaFetch } from './mocks/strava-api.js';

vi.mock(
  'pg',
  () => {
    class MockPool {
      async connect() {
        return {
          release: () => {},
        };
      }
      async end() {}
    }
    return { Pool: MockPool, default: MockPool };
  },
  { virtual: true }
);

vi.mock(
  '@neondatabase/serverless',
  () => ({
    neon: vi.fn(() => vi.fn()),
  }),
  { virtual: true }
);

vi.mock(
  '../netlify/functions/utils/connection-pool.js',
  () => ({
    getNeonClient: vi.fn(() => vi.fn()),
    releaseClient: vi.fn(() => {}),
  }),
  { virtual: true }
);

const originalFetch = global.fetch;
const mockState = {
  tokens: new Map(),
};

function createQuerySignature(parts) {
  return parts.join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function createMockSql(state) {
  const fn = vi.fn(async (strings, ...values) => {
    const query = createQuerySignature(strings);

    if (query.startsWith('SELECT * FROM STRAVA_TOKENS')) {
      const userId = values[0];
      const record = state.tokens.get(userId);
      return record ? [{ ...record }] : [];
    }

    if (query.startsWith('SELECT ENCRYPTED_ACCESS_TOKEN')) {
      const userId = values[0];
      const record = state.tokens.get(userId);
      return record ? [{ encrypted_access_token: record.encrypted_access_token }] : [];
    }

    if (query.startsWith('UPDATE STRAVA_TOKENS SET')) {
      const [encryptedAccess, encryptedRefresh, expiresAt, keyVersion, userId] = values;
      const record = state.tokens.get(userId);
      if (record) {
        record.encrypted_access_token = encryptedAccess;
        record.encrypted_refresh_token = encryptedRefresh;
        record.expires_at = expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
        record.encryption_key_version = keyVersion;
        record.refresh_count = (record.refresh_count || 0) + 1;
        record.updated_at = new Date().toISOString();
        record.last_refresh_at = record.updated_at;
      }
      return [];
    }

    return [];
  });

  return fn;
}

async function loadHandler({
  tokenRecord,
  fetchImpl,
  rateLimitAllowed = true,
  lockAcquired = true,
} = {}) {
  if (tokenRecord) {
    mockState.tokens.set(tokenRecord.user_id, { ...tokenRecord });
  }

  const mockSql = createMockSql(mockState);

  vi.mock(
    '../netlify/functions/utils/database.js',
    () => ({
      getDB: () => mockSql,
    }),
    { virtual: true }
  );

  vi.mock(
    '../netlify/functions/utils/encryption.js',
    () => ({
      TokenEncryption: class {
        async decrypt(value) {
          if (typeof value === 'string' && value.startsWith('enc_')) {
            return value.replace(/^enc_/, '');
          }
          return value;
        }

        async encrypt(value, keyVersion = 1) {
          return { encrypted: `enc_${value}`, keyVersion };
        }
      },
    }),
    { virtual: true }
  );

  const circuitState = { state: 'CLOSED' };
  vi.mock(
    '../netlify/functions/utils/circuit-breaker.js',
    () => ({
      stravaCircuit: {
        execute: async fn => fn(),
        getStatus: () => circuitState,
      },
    }),
    { virtual: true }
  );

  vi.mock(
    '../netlify/functions/utils/distributed-lock.js',
    () => ({
      acquireRefreshLock: vi.fn(async () =>
        lockAcquired
          ? { acquired: true, lockId: 'lock-1' }
          : { acquired: false, retryAfter: 5, reason: 'BUSY' }
      ),
      releaseLock: vi.fn(async () => {}),
    }),
    { virtual: true }
  );

  vi.mock(
    '../netlify/functions/utils/rate-limiter.js',
    () => ({
      checkEndpointRateLimit: vi.fn(async () =>
        rateLimitAllowed ? { allowed: true } : { allowed: false, reason: 'LIMIT', retryAfter: 30 }
      ),
      getRateLimitHeaders: vi.fn(() => ({})),
    }),
    { virtual: true }
  );

  vi.mock(
    '../netlify/functions/utils/audit.js',
    () => ({
      auditLog: vi.fn(async () => {}),
    }),
    { virtual: true }
  );

  vi.mock(
    '../netlify/functions/utils/safe-logging.js',
    () => ({
      createLogger: () => ({
        tokenRefresh: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      }),
    }),
    { virtual: true }
  );

  if (fetchImpl) {
    global.fetch = fetchImpl;
  }

  return import('../netlify/functions/strava-refresh-token.js');
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockState.tokens.clear();
  process.env.STRAVA_CLIENT_ID = 'test-client-id';
  process.env.STRAVA_CLIENT_SECRET = 'test-client-secret';
  global.fetch = originalFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('Strava Token Refresh handler', () => {
  it('returns 400 when userId is missing', async () => {
    const { handler } = await loadHandler();
    const response = await handler({ httpMethod: 'POST', body: JSON.stringify({}) });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('User ID is required');
  });

  it('returns refresh_not_needed when token is still valid', async () => {
    const tokenRecord = createStravaTokenRecord({
      user_id: 'athlete-1',
      expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      refresh_count: 2,
    });

    const { handler } = await loadHandler({ tokenRecord });
    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId: 'athlete-1' }),
    });

    const payload = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.refresh_not_needed).toBe(true);
    expect(mockState.tokens.get('athlete-1').refresh_count).toBe(2);
  });

  it('refreshes expired token and updates storage', async () => {
    const tokenRecord = createStravaTokenRecord({
      user_id: 'athlete-2',
      expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      refresh_count: 1,
    });

    const fetchImpl = createMockStravaFetch({
      tokenResponse: {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
      },
    });

    const { handler } = await loadHandler({ tokenRecord, fetchImpl });
    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId: 'athlete-2' }),
    });

    const payload = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockState.tokens.get('athlete-2').encrypted_access_token).toBe('enc_new_access_token');
    expect(mockState.tokens.get('athlete-2').refresh_count).toBe(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns 500 when Strava refresh fails', async () => {
    const tokenRecord = createStravaTokenRecord({
      user_id: 'athlete-3',
      expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      refresh_count: 0,
    });

    const fetchImpl = createMockStravaFetch({ tokenStatus: 500, failText: 'bad-token' });

    const { handler } = await loadHandler({ tokenRecord, fetchImpl });
    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId: 'athlete-3' }),
    });

    const payload = JSON.parse(response.body);
    expect(response.statusCode).toBe(500);
    expect(payload.error).toBe('Token refresh failed');
    expect(mockState.tokens.get('athlete-3').encrypted_access_token).toBe('enc_access_token');
  });
});
