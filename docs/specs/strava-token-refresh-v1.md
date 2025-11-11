# Strava Token Refresh Specification v1.0

**Feature:** Secure Strava OAuth Token Management with Auto-Refresh **Status:**
Ready for Implementation **Last Updated:** 2025-09-25

## 1. Overview

Implement a secure, scalable Strava token management system with automatic
refresh, proper encryption, and comprehensive error handling. This specification
addresses critical security concerns including race conditions, key management,
and token validation.

## 2. Data Model

### Primary Tables

```sql
-- Strava tokens table with enhanced security
CREATE TABLE strava_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT,
    athlete_id BIGINT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    encryption_key_version INTEGER NOT NULL DEFAULT 1,
    last_validated_at TIMESTAMP WITH TIME ZONE,
    last_refresh_at TIMESTAMP WITH TIME ZONE,
    refresh_count INTEGER DEFAULT 0,
    refresh_lock_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_strava UNIQUE(user_id)
);

-- Audit logs with retention policy
CREATE TABLE strava_token_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for audit cleanup
CREATE INDEX idx_audit_created_at ON strava_token_audit(created_at);

-- Rate limiting with sliding window
CREATE TABLE api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    request_hash VARCHAR(64),
    CONSTRAINT unique_request UNIQUE(user_id, endpoint, request_hash)
);

-- Circuit breaker state
CREATE TABLE circuit_breaker_state (
    service_name VARCHAR(100) PRIMARY KEY,
    state VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    next_attempt_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Encryption key versions for rotation
CREATE TABLE encryption_keys (
    version INTEGER PRIMARY KEY,
    key_id VARCHAR(255) NOT NULL,
    algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rotated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Function for automatic audit log cleanup
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM strava_token_audit
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job (if using pg_cron)
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT cleanup_old_audit_logs();');
```

## 3. Core Implementation

### 3.1 Enhanced Encryption with AWS KMS

```javascript
// utils/encryption.js
const {
  KMSClient,
  DecryptCommand,
  EncryptCommand,
} = require('@aws-sdk/client-kms');
const crypto = require('crypto');

class TokenEncryption {
  constructor() {
    this.kmsClient = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.keyCache = new Map();
    this.cacheExpiry = 3600000; // 1 hour
  }

  async getDecryptionKey(version = 1) {
    const cacheKey = `decrypt_${version}`;
    const cached = this.keyCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return cached.key;
    }

    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(process.env[`KMS_KEY_V${version}`], 'base64'),
      KeyId: process.env.KMS_KEY_ID,
    });

    const response = await this.kmsClient.send(command);
    const key = response.Plaintext;

    this.keyCache.set(cacheKey, {
      key,
      expiry: Date.now() + this.cacheExpiry,
    });

    return key;
  }

  async encrypt(data, keyVersion = 1) {
    const key = await this.getDecryptionKey(keyVersion);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted: `${keyVersion}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`,
      keyVersion,
    };
  }

  async decrypt(encryptedData) {
    const [version, ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const key = await this.getDecryptionKey(parseInt(version));

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### 3.2 Connection Pool Management

```javascript
// utils/database.js
const { Pool } = require('pg');
const { neon } = require('@neondatabase/serverless');

let pool;

function getConnectionPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      statement_timeout: 10000,
      query_timeout: 10000,
      ssl: { rejectUnauthorized: false },
    });

    pool.on('error', err => {
      console.error('Unexpected pool error', err);
    });
  }
  return pool;
}

// For serverless, use Neon's connection pooling
function getServerlessDB() {
  return neon(process.env.DATABASE_URL, {
    poolQueryViaFetch: true,
    fetchOptions: {
      priority: 'high',
    },
  });
}

module.exports = { getConnectionPool, getServerlessDB };
```

### 3.3 Circuit Breaker Implementation

```javascript
// utils/circuit-breaker.js
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 120000;

    this.state = 'CLOSED';
    this.failures = 0;
    this.nextAttempt = Date.now();
    this.successCount = 0;
    this.lastFailure = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  onFailure(error) {
    this.failures++;
    this.lastFailure = { error: error.message, timestamp: Date.now() };

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.recoveryTimeout;
      this.successCount = 0;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure,
      nextAttempt: this.state === 'OPEN' ? this.nextAttempt : null,
    };
  }
}

const stravaCircuit = new CircuitBreaker('strava-api', {
  failureThreshold: 5,
  recoveryTimeout: 60000,
});

module.exports = { CircuitBreaker, stravaCircuit };
```

### 3.4 Distributed Lock for Token Refresh

```javascript
// utils/distributed-lock.js
async function acquireRefreshLock(sql, userId, timeoutMs = 5000) {
  const lockId = hashUserId(userId);
  const unlockTime = new Date(Date.now() + timeoutMs);

  try {
    // Try to acquire PostgreSQL advisory lock
    const result = await sql`
      SELECT pg_try_advisory_lock(${lockId}) as acquired
    `;

    if (result[0].acquired) {
      // Also set a timeout in the tokens table as backup
      await sql`
        UPDATE strava_tokens 
        SET refresh_lock_until = ${unlockTime}
        WHERE user_id = ${userId}
        AND (refresh_lock_until IS NULL OR refresh_lock_until < NOW())
      `;
      return { lockId, acquired: true };
    }

    // Check if another process has the lock
    const lockStatus = await sql`
      SELECT refresh_lock_until 
      FROM strava_tokens 
      WHERE user_id = ${userId}
    `;

    if (lockStatus[0]?.refresh_lock_until > new Date()) {
      return {
        lockId: null,
        acquired: false,
        retryAfter: lockStatus[0].refresh_lock_until,
      };
    }

    return { lockId: null, acquired: false };
  } catch (error) {
    console.error('Lock acquisition failed:', error);
    return { lockId: null, acquired: false };
  }
}

async function releaseLock(sql, lockId, userId) {
  try {
    await sql`SELECT pg_advisory_unlock(${lockId})`;
    await sql`
      UPDATE strava_tokens 
      SET refresh_lock_until = NULL 
      WHERE user_id = ${userId}
    `;
  } catch (error) {
    console.error('Lock release failed:', error);
  }
}

function hashUserId(userId) {
  // Create a consistent integer hash for PostgreSQL advisory locks
  const hash = crypto.createHash('sha256').update(userId).digest();
  return Math.abs(hash.readInt32BE(0));
}
```

## 4. API Endpoints

### 4.1 POST /strava-oauth-exchange

Exchange authorization code for tokens with validation

```javascript
const { TokenEncryption } = require('./utils/encryption');
const { getServerlessDB } = require('./utils/database');
const { stravaCircuit } = require('./utils/circuit-breaker');
const { auditLog } = require('./utils/audit');

exports.handler = async event => {
  const sql = getServerlessDB();
  const encryption = new TokenEncryption();

  try {
    const { code, userId } = JSON.parse(event.body);

    // Input validation
    if (!code || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' }),
      };
    }

    // Exchange code for tokens using circuit breaker
    const tokens = await stravaCircuit.execute(async () => {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        throw new Error(`Strava API error: ${response.status}`);
      }

      return response.json();
    });

    // Validate token immediately
    const isValid = await validateStravaToken(tokens.access_token);
    if (!isValid) {
      throw new Error('Token validation failed');
    }

    // Encrypt tokens
    const { encrypted: encryptedAccess, keyVersion } = await encryption.encrypt(
      tokens.access_token
    );
    const { encrypted: encryptedRefresh } = await encryption.encrypt(
      tokens.refresh_token,
      keyVersion
    );

    // Store with transaction
    await sql.begin(async sql => {
      await sql`
        INSERT INTO strava_tokens (
          user_id, encrypted_access_token, encrypted_refresh_token,
          expires_at, scope, athlete_id, encryption_key_version,
          last_validated_at
        ) VALUES (
          ${userId}, ${encryptedAccess}, ${encryptedRefresh},
          ${new Date(Date.now() + tokens.expires_in * 1000)},
          ${tokens.scope}, ${tokens.athlete?.id}, ${keyVersion},
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          encrypted_access_token = EXCLUDED.encrypted_access_token,
          encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
          expires_at = EXCLUDED.expires_at,
          scope = EXCLUDED.scope,
          athlete_id = EXCLUDED.athlete_id,
          encryption_key_version = EXCLUDED.encryption_key_version,
          last_validated_at = NOW(),
          updated_at = NOW()
      `;

      await auditLog(sql, {
        user_id: userId,
        action: 'OAUTH_EXCHANGE',
        status: 'SUCCESS',
        ip_address: event.headers['x-forwarded-for'],
        user_agent: event.headers['user-agent'],
      });
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        athlete_id: tokens.athlete?.id,
      }),
    };
  } catch (error) {
    console.error('OAuth exchange error:', error);

    await auditLog(sql, {
      user_id: JSON.parse(event.body)?.userId,
      action: 'OAUTH_EXCHANGE',
      status: 'FAILURE',
      error_message: error.message,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Token exchange failed',
        retry: stravaCircuit.state !== 'OPEN',
      }),
    };
  }
};

async function validateStravaToken(accessToken) {
  try {
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

### 4.2 POST /strava-refresh-token

Refresh expired token with race condition prevention

```javascript
const { acquireRefreshLock, releaseLock } = require('./utils/distributed-lock');
const NodeCache = require('node-cache');
const tokenCache = new NodeCache({ stdTTL: 300 });

exports.handler = async event => {
  const sql = getServerlessDB();
  const encryption = new TokenEncryption();
  let lock = null;

  try {
    const { userId } = JSON.parse(event.body);

    // Check cache first
    const cachedToken = tokenCache.get(`token_${userId}`);
    if (
      cachedToken &&
      new Date(cachedToken.expires_at) > new Date(Date.now() + 60000)
    ) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, cached: true }),
      };
    }

    // Acquire distributed lock
    lock = await acquireRefreshLock(sql, userId);
    if (!lock.acquired) {
      return {
        statusCode: 423, // Locked
        headers: { 'Retry-After': '5' },
        body: JSON.stringify({
          error: 'Token refresh in progress',
          retryAfter: lock.retryAfter,
        }),
      };
    }

    // Get current token
    const result = await sql`
      SELECT * FROM strava_tokens 
      WHERE user_id = ${userId}
    `;

    if (!result.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No token found' }),
      };
    }

    const token = result[0];

    // Check if refresh is actually needed
    if (new Date(token.expires_at) > new Date(Date.now() + 300000)) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, refresh_not_needed: true }),
      };
    }

    // Decrypt refresh token
    const refreshToken = await encryption.decrypt(
      token.encrypted_refresh_token
    );

    // Refresh using circuit breaker
    const newTokens = await stravaCircuit.execute(async () => {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Strava refresh failed: ${error}`);
      }

      return response.json();
    });

    // Validate new token
    const isValid = await validateStravaToken(newTokens.access_token);
    if (!isValid) {
      throw new Error('New token validation failed');
    }

    // Encrypt and update
    const { encrypted: encryptedAccess, keyVersion } = await encryption.encrypt(
      newTokens.access_token
    );
    const { encrypted: encryptedRefresh } = await encryption.encrypt(
      newTokens.refresh_token,
      keyVersion
    );

    await sql`
      UPDATE strava_tokens SET
        encrypted_access_token = ${encryptedAccess},
        encrypted_refresh_token = ${encryptedRefresh},
        expires_at = ${new Date(Date.now() + newTokens.expires_in * 1000)},
        encryption_key_version = ${keyVersion},
        last_refresh_at = NOW(),
        last_validated_at = NOW(),
        refresh_count = refresh_count + 1,
        updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    // Update cache
    tokenCache.set(`token_${userId}`, {
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
    });

    await auditLog(sql, {
      user_id: userId,
      action: 'TOKEN_REFRESH',
      status: 'SUCCESS',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
      }),
    };
  } catch (error) {
    console.error('Token refresh error:', error);

    await auditLog(sql, {
      user_id: JSON.parse(event.body)?.userId,
      action: 'TOKEN_REFRESH',
      status: 'FAILURE',
      error_message: error.message,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Token refresh failed',
        circuit_state: stravaCircuit.getStatus(),
      }),
    };
  } finally {
    if (lock?.acquired) {
      await releaseLock(sql, lock.lockId, JSON.parse(event.body)?.userId);
    }
  }
};
```

### 4.3 GET /strava-token-status

Check token status with cache

```javascript
exports.handler = async event => {
  const sql = getServerlessDB();

  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User ID required' }),
      };
    }

    // Check cache first
    const cached = tokenCache.get(`status_${userId}`);
    if (cached) {
      return {
        statusCode: 200,
        headers: { 'X-Cache': 'HIT' },
        body: JSON.stringify(cached),
      };
    }

    const result = await sql`
      SELECT 
        expires_at,
        last_refresh_at,
        last_validated_at,
        refresh_count,
        CASE 
          WHEN expires_at > NOW() + INTERVAL '5 minutes' THEN 'valid'
          WHEN expires_at > NOW() THEN 'expiring_soon'
          ELSE 'expired'
        END as status,
        EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry
      FROM strava_tokens
      WHERE user_id = ${userId}
    `;

    if (!result.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No token found' }),
      };
    }

    const status = {
      ...result[0],
      circuit_breaker_status: stravaCircuit.getStatus(),
    };

    // Cache for 30 seconds
    tokenCache.set(`status_${userId}`, status, 30);

    return {
      statusCode: 200,
      headers: { 'X-Cache': 'MISS' },
      body: JSON.stringify(status),
    };
  } catch (error) {
    console.error('Status check error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Status check failed' }),
    };
  }
};
```

### 4.4 Enhanced Rate Limiting

```javascript
// utils/rate-limiter.js
async function checkRateLimit(
  sql,
  userId,
  endpoint,
  limit = 100,
  window = 3600000
) {
  const windowStart = new Date(Date.now() - window);

  // Get recent requests
  const requests = await sql`
    SELECT request_timestamp, request_hash
    FROM api_rate_limits
    WHERE user_id = ${userId}
      AND endpoint = ${endpoint}
      AND request_timestamp > ${windowStart}
    ORDER BY request_timestamp DESC
  `;

  // Check for anomalous patterns
  if (requests.length > 10) {
    const intervals = [];
    for (let i = 1; i < Math.min(requests.length, 20); i++) {
      intervals.push(
        requests[i - 1].request_timestamp - requests[i].request_timestamp
      );
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avgInterval < 100) {
      // Less than 100ms between requests
      await auditLog(sql, {
        user_id: userId,
        action: 'RATE_LIMIT_ANOMALY',
        status: 'BLOCKED',
        metadata: { avgInterval, pattern: 'bot-like' },
      });
      return { allowed: false, reason: 'Anomalous pattern detected' };
    }
  }

  if (requests.length >= limit) {
    return {
      allowed: false,
      reason: 'Rate limit exceeded',
      resetAt: new Date(requests[0].request_timestamp.getTime() + window),
    };
  }

  // Log this request
  const requestHash = crypto
    .createHash('sha256')
    .update(`${userId}${endpoint}${Date.now()}`)
    .digest('hex');

  await sql`
    INSERT INTO api_rate_limits (user_id, endpoint, request_hash)
    VALUES (${userId}, ${endpoint}, ${requestHash})
    ON CONFLICT (user_id, endpoint, request_hash) DO NOTHING
  `;

  return { allowed: true, remaining: limit - requests.length - 1 };
}
```

## 5. Auto-Refresh Implementation

```javascript
// netlify/functions/strava-auto-refresh.js
exports.handler = async event => {
  const sql = getServerlessDB();

  // This function is triggered by Netlify Scheduled Functions
  // Schedule: every 5 minutes

  try {
    // Find tokens expiring soon (within 10 minutes)
    const expiringTokens = await sql`
      SELECT user_id, expires_at
      FROM strava_tokens
      WHERE expires_at < NOW() + INTERVAL '10 minutes'
        AND expires_at > NOW()
        AND (refresh_lock_until IS NULL OR refresh_lock_until < NOW())
      ORDER BY expires_at ASC
      LIMIT 50
    `;

    const results = [];

    for (const token of expiringTokens) {
      try {
        // Call refresh endpoint
        const response = await fetch(
          `${process.env.URL}/.netlify/functions/strava-refresh-token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: token.user_id }),
          }
        );

        results.push({
          userId: token.user_id,
          success: response.ok,
          status: response.status,
        });
      } catch (error) {
        results.push({
          userId: token.user_id,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        processed: results.length,
        results,
      }),
    };
  } catch (error) {
    console.error('Auto-refresh error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Auto-refresh failed' }),
    };
  }
};
```

## 6. Security Headers

```javascript
// utils/security.js
function getSecurityHeaders(origin) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
  const corsOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0];

  return {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
  };
}
```

## 7. Environment Variables

```bash
# AWS KMS Configuration
AWS_REGION=us-east-1
KMS_KEY_ID=arn:aws:kms:us-east-1:123456789:key/abc-def
KMS_KEY_V1=<base64-encoded-encrypted-key>
KMS_KEY_V2=<base64-encoded-encrypted-key-for-rotation>

# Strava OAuth
STRAVA_CLIENT_ID=<your-client-id>
STRAVA_CLIENT_SECRET=<your-client-secret>

# Database
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Security
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com

# Application
URL=https://yourapp.netlify.app
```

## 8. Testing Strategy

### Unit Tests

```javascript
// tests/encryption.test.js
describe('TokenEncryption', () => {
  test('should encrypt and decrypt tokens correctly', async () => {
    const encryption = new TokenEncryption();
    const token = 'test-access-token-12345';

    const { encrypted, keyVersion } = await encryption.encrypt(token);
    expect(encrypted).toBeDefined();
    expect(keyVersion).toBe(1);

    const decrypted = await encryption.decrypt(encrypted);
    expect(decrypted).toBe(token);
  });

  test('should handle key rotation', async () => {
    const encryption = new TokenEncryption();
    const token = 'test-token';

    const { encrypted: v1 } = await encryption.encrypt(token, 1);
    const { encrypted: v2 } = await encryption.encrypt(token, 2);

    expect(v1).not.toBe(v2);
    expect(await encryption.decrypt(v1)).toBe(token);
    expect(await encryption.decrypt(v2)).toBe(token);
  });
});

describe('CircuitBreaker', () => {
  test('should open after threshold failures', async () => {
    const breaker = new CircuitBreaker('test', { failureThreshold: 3 });
    const failingFn = async () => {
      throw new Error('API Error');
    };

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingFn);
      } catch {}
    }

    expect(breaker.state).toBe('OPEN');

    await expect(breaker.execute(failingFn)).rejects.toThrow(
      'Circuit breaker is OPEN'
    );
  });
});

describe('RateLimiter', () => {
  test('should detect anomalous patterns', async () => {
    const sql = getServerlessDB();

    // Simulate rapid requests
    for (let i = 0; i < 15; i++) {
      await sql`
        INSERT INTO api_rate_limits (user_id, endpoint, request_timestamp)
        VALUES (${'test-user'}, ${'/test'}, ${new Date()})
      `;
    }

    const result = await checkRateLimit(sql, 'test-user', '/test');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('pattern');
  });
});
```

### Integration Tests

```javascript
// tests/integration/token-refresh.test.js
describe('Token Refresh Integration', () => {
  test('should prevent race conditions', async () => {
    const userId = 'test-user-123';

    // Simulate concurrent refresh attempts
    const promises = Array(5)
      .fill()
      .map(() =>
        fetch('/.netlify/functions/strava-refresh-token', {
          method: 'POST',
          body: JSON.stringify({ userId }),
        })
      );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status === 200).length;
    const lockedCount = results.filter(r => r.status === 423).length;

    expect(successCount).toBe(1);
    expect(lockedCount).toBe(4);
  });
});
```

## 9. Monitoring & Alerts

```javascript
// utils/monitoring.js
async function reportMetrics(metric, value, tags = {}) {
  // Send to monitoring service (DataDog, CloudWatch, etc.)
  console.log('Metric:', { metric, value, tags, timestamp: new Date() });

  // Critical alerts
  if (metric === 'circuit_breaker_open') {
    await sendAlert('Circuit breaker opened for Strava API', 'high');
  }

  if (metric === 'token_refresh_failure_rate' && value > 0.1) {
    await sendAlert(`High token refresh failure rate: ${value}`, 'medium');
  }
}

async function sendAlert(message, severity) {
  // Send to PagerDuty, Slack, etc.
  console.error(`ALERT [${severity}]:`, message);
}
```

## 10. Acceptance Criteria

- [x] Tokens encrypted with AWS KMS managed keys
- [x] Key rotation support with versioning
- [x] PostgreSQL advisory locks prevent race conditions
- [x] Circuit breaker protects against Strava API failures
- [x] Connection pooling optimizes database usage
- [x] Token validation after every refresh
- [x] Sliding window rate limiting with anomaly detection
- [x] In-memory caching reduces database load
- [x] Automatic audit log cleanup after 90 days
- [x] Comprehensive error handling with retry hints
- [x] Security headers properly configured
- [x] Auto-refresh runs every 5 minutes
- [x] Monitoring and alerting integrated

## 11. Later (Deferred Items)

### Deferred to Phase 2:

1. **Multi-region support**: Current implementation is single-region.
   Multi-region would require:
   - Global database replication
   - Region-aware routing
   - Cross-region token synchronization
   - Reason: Adds significant complexity for initial MVP

2. **Webhook subscriptions**: Strava webhook support for instant token
   revocation
   - Requires public endpoint setup
   - Webhook validation logic
   - Event processing queue
   - Reason: Not critical for MVP; polling approach sufficient

3. **Advanced ML-based anomaly detection**: Current pattern detection is
   rule-based
   - Would require training data collection
   - ML model deployment infrastructure
   - Reason: Simple patterns catch most abuse cases

4. **Token usage analytics dashboard**: Track token usage patterns
   - Requires additional data collection
   - Frontend dashboard development
   - Reason: Focus on core functionality first

5. **Backup encryption provider**: Currently only AWS KMS
   - Would add HashiCorp Vault or Azure Key Vault
   - Reason: AWS KMS is sufficient for initial deployment

### Deferred to Future:

6. **GraphQL API layer**: REST is sufficient for current needs
7. **Token sharing between users**: Complex permission system required
8. **Bulk token operations**: Not needed for current scale

These items are deferred to maintain focus on core security and reliability
features while keeping initial implementation complexity manageable.
