# Revised Plan: Core User Data Management & Session APIs

## Changes Summary (Before → After)

```diff
- JWT with JWKS verification → Simple API key auth (JWT deferred to Later)
- Redis rate limiting → Netlify Blobs stateless rate limiting
- /api/users/profile → /.netlify/functions/user-profile
- Optional source_id with broken dedup → Required source_id OR use session hash
- No transaction handling → Explicit transaction wrapper for bulk ops
- Unlimited payload size → 10KB limit with validation
- Base64 cursor pagination → Timestamp-based pagination
- Enum types in DB → Check constraints for flexibility
+ Added connection pooling and error handling
+ Added request ID tracking
+ Added consistent error response format
```

## Section 1: Summary

**Feature**: Implement robust user data management and session CRUD operations
with API key authentication, validation, and data synchronization.

**Scope**: Single PR with foundational APIs for user profile and session
management. JWT and advanced features deferred to "Later" list.

## Section 2: Data Model

### Schema Updates

```sql
-- Use check constraints instead of enums for flexibility
ALTER TABLE sessions
    ADD CONSTRAINT valid_session_type CHECK (
        type IN ('workout', 'soccer', 'climbing', 'recovery', 'cardio', 'strength', 'flexibility', 'sport_specific')
    ),
    ADD CONSTRAINT valid_session_source CHECK (
        source IN ('manual', 'strava', 'apple_health', 'garmin', 'whoop', 'import')
    );

-- Add deduplication support
ALTER TABLE sessions
    ADD COLUMN session_hash VARCHAR(64) GENERATED ALWAYS AS (
        CASE
            WHEN source_id IS NOT NULL THEN
                encode(sha256((user_id || ':' || source || ':' || source_id)::bytea), 'hex')
            ELSE
                encode(sha256((user_id || ':' || start_at || ':' || type)::bytea), 'hex')
        END
    ) STORED;

CREATE UNIQUE INDEX idx_sessions_hash ON sessions(session_hash);

-- Add payload size constraint
ALTER TABLE sessions
    ADD CONSTRAINT payload_size_limit CHECK (
        octet_length(payload::text) <= 10240  -- 10KB limit
    );

-- API key authentication (simpler than JWT for MVP)
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id VARCHAR(255) PRIMARY KEY,  -- user_id:window
    count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 minute'
);

-- Indexes for performance
CREATE INDEX idx_sessions_user_date ON sessions(user_id, start_at DESC);
CREATE INDEX idx_exercises_session_name ON exercises(session_id, name);
CREATE INDEX idx_rate_limits_expires ON rate_limits(expires_at);
```

## Section 3: API Spec

### Authentication

- **Method**: API Key in header
- **Format**: `X-API-Key: <key>`
- **Verification**: Hash key, lookup in api_keys table, check expiry and
  is_active
- **User Mapping**: api_keys.user_id → users.id

### Base Netlify Function Structure

```javascript
// netlify/functions/_base.js
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

let sql;
const getDB = () => {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
};

const authenticate = async headers => {
  const apiKey = headers['x-api-key'];
  if (!apiKey) return null;

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const sql = getDB();

  const result = await sql`
    SELECT user_id FROM api_keys 
    WHERE key_hash = ${keyHash} 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
  `;

  if (result.length === 0) return null;

  // Update last_used_at
  await sql`UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = ${keyHash}`;

  return result[0].user_id;
};

const checkRateLimit = async userId => {
  const sql = getDB();
  const windowKey = `${userId}:${Math.floor(Date.now() / 60000)}`;

  const result = await sql`
    INSERT INTO rate_limits (id, count, expires_at) 
    VALUES (${windowKey}, 1, NOW() + INTERVAL '1 minute')
    ON CONFLICT (id) 
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `;

  return result[0].count <= 100;
};

const errorResponse = (status, code, message, details = {}) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'X-Request-ID': crypto.randomUUID(),
  },
  body: JSON.stringify({
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  }),
});

module.exports = { getDB, authenticate, checkRateLimit, errorResponse };
```

### 1. POST /.netlify/functions/user-profile

**Purpose**: Create or update user profile

**Request**:

```json
{
  "age": 25, // optional, 13-120
  "weight": 75.5, // optional, kg, 20-300
  "height": 180, // optional, cm, 100-250
  "sex": "male", // optional, male|female|other
  "goals": ["strength", "endurance"], // optional, max 5
  "baseline_lifts": {
    // optional, max 1KB
    "squat": 100,
    "bench": 80,
    "deadlift": 120
  }
}
```

**Response 200/201**:

```json
{
  "success": true,
  "data": {
    "user_id": 123,
    "profile": { ...submitted data... },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T00:00:00Z"
  }
}
```

**Error Responses**:

- `400`:
  `{error: {code: "VALIDATION_ERROR", message: "Age must be between 13 and 120", details: {field: "age", value: 12}}}`
- `401`: `{error: {code: "AUTH_ERROR", message: "Invalid or missing API key"}}`
- `429`:
  `{error: {code: "RATE_LIMIT", message: "Too many requests", details: {retry_after: 60}}}`

### 2. GET /.netlify/functions/user-profile

**Purpose**: Retrieve current user's profile

**Response 200**:

```json
{
  "success": true,
  "data": {
    "user_id": 123,
    "age": 25,
    "weight": 75.5,
    "height": 180,
    "sex": "male",
    "goals": ["strength", "endurance"],
    "baseline_lifts": {...},
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 3. POST /.netlify/functions/sessions-create

**Purpose**: Create a new session (already exists, updating spec)

**Request**:

```json
{
  "type": "workout", // required, validated against constraint
  "source": "manual", // required, validated against constraint
  "source_id": "unique_123", // optional, but recommended for dedup
  "start_at": "2024-01-15T10:00:00Z", // required, ISO8601 UTC
  "end_at": "2024-01-15T11:00:00Z", // optional
  "payload": {
    // optional, max 10KB
    "notes": "Great workout",
    "rpe": 7
  }
}
```

**Deduplication Logic**:

- If source_id provided: Unique on (user_id, source, source_id)
- If no source_id: Unique on (user_id, start_at, type) via hash

**Response 201**:

```json
{
  "success": true,
  "data": {
    "id": 456,
    "session_hash": "abc123...",
    ...request_data
  }
}
```

### 4. GET /.netlify/functions/sessions-list

**Purpose**: List sessions with timestamp pagination

**Query Parameters**:

- `type`: Filter by session type
- `start_date`: ISO date string (inclusive)
- `end_date`: ISO date string (inclusive)
- `limit`: 1-100, default 20
- `before`: Timestamp for pagination (exclusive)

**Response 200**:

```json
{
  "success": true,
  "data": {
    "sessions": [...],
    "pagination": {
      "has_more": true,
      "next_before": "2024-01-15T10:00:00.000Z",
      "count": 20,
      "total": 150  // Only if count < 1000
    }
  }
}
```

### 5. POST /.netlify/functions/exercises-bulk-create

**Purpose**: Add exercises to a session (with transaction)

**Request**:

```json
{
  "session_id": 456, // required
  "exercises": [
    // required, 1-50 items
    {
      "name": "Squat", // required, 1-100 chars, trimmed
      "sets": 3, // required, 1-20
      "reps": 10, // required, 1-100
      "weight": 100, // optional, 0-500 kg
      "rpe": 7, // optional, 1-10
      "notes": "Good" // optional, max 500 chars
    }
  ]
}
```

**Implementation with transaction**:

```javascript
const { withTransaction } = require('./_db');

const result = await withTransaction(sql, async tx => {
  // Verify session ownership
  const session = await tx`
    SELECT id FROM sessions 
    WHERE id = ${session_id} AND user_id = ${userId}
  `;
  if (!session.length) throw new Error('Session not found');

  // Bulk insert exercises
  const exercises = await tx`
    INSERT INTO exercises ${tx(
      exerciseData,
      'session_id',
      'user_id',
      'name',
      'sets',
      'reps',
      'weight',
      'rpe',
      'notes'
    )}
    RETURNING id
  `;

  return exercises;
});
```

## Section 4: Acceptance Criteria

### Authentication & Rate Limiting

- ✓ API key required for all endpoints
- ✓ Invalid/expired keys return 401 with clear error
- ✓ Rate limit of 100 req/min enforced per user
- ✓ Rate limit headers included: X-RateLimit-Limit, X-RateLimit-Remaining
- ✓ Clean up expired rate_limits rows periodically

### User Profile

- ✓ Creates profile on first POST, updates on subsequent
- ✓ Age validation: 13-120 only
- ✓ Weight validation: 20-300 kg only
- ✓ Goals array max 5 items
- ✓ Baseline_lifts JSON max 1KB
- ✓ Returns 404 if no profile exists on GET

### Sessions

- ✓ Validates type and source against allowed values
- ✓ Rejects start_at more than 24 hours in future
- ✓ Deduplication works with AND without source_id
- ✓ Payload limited to 10KB, larger payloads rejected
- ✓ List returns max 100 items with timestamp pagination
- ✓ Empty result returns empty array with has_more: false

### Exercises

- ✓ Transaction ensures all-or-nothing bulk insert
- ✓ Validates session ownership before insert
- ✓ Name trimmed to 100 chars
- ✓ Sets/reps/weight within valid ranges
- ✓ Returns 404 if session doesn't exist
- ✓ Returns 403 if session belongs to another user

### Error Handling

- ✓ Database connection failures return 503 Service Unavailable
- ✓ All errors follow consistent format with code, message, details
- ✓ Request ID included in all responses for debugging
- ✓ No sensitive data (keys, passwords) in error messages

## Section 5: Test Plan

### Unit Tests

**auth.test.js**

- `test_valid_api_key`: Valid key returns correct user_id
- `test_expired_key_rejected`: Expired key returns null
- `test_inactive_key_rejected`: is_active=false returns null
- `test_missing_key_returns_null`: No header returns null

**validation.test.js**

- `test_age_validation`: 12→fail, 13→pass, 120→pass, 121→fail
- `test_weight_validation`: 19→fail, 20→pass, 300→pass, 301→fail
- `test_session_type_validation`: 'invalid'→fail, 'workout'→pass
- `test_future_date_validation`: >24h future→fail, past→pass
- `test_payload_size`: 10KB→pass, 10.1KB→fail

**rate-limit.test.js**

- `test_rate_limit_increment`: Counter increases correctly
- `test_rate_limit_window_reset`: New minute = new window
- `test_rate_limit_exceeded`: 101st request returns false

### Integration Tests

**profile.integration.test.js**

- `test_create_update_flow`: POST creates, second POST updates
- `test_profile_isolation`: User A cannot see User B's profile
- `test_invalid_data_rejected`: Bad age returns 400 with details

**sessions.integration.test.js**

- `test_dedup_with_source_id`: Duplicate source_id returns 409
- `test_dedup_without_source_id`: Same time+type allowed for different users
- `test_pagination_flow`: Create 25, page through with limit=10
- `test_date_filtering`: Returns only sessions in date range
- `test_transaction_rollback`: Failed exercise insert rolls back session

**exercises.integration.test.js**

- `test_bulk_insert_transaction`: 10 exercises inserted atomically
- `test_session_ownership`: Cannot add to other user's session (403)
- `test_session_not_found`: Non-existent session returns 404

**e2e.test.js**

- `test_full_user_journey`: Create API key → Profile → Session → Exercises →
  List

### Manual Testing Checklist

- [ ] Deploy to Netlify with DATABASE_URL set
- [ ] Test with missing DATABASE_URL (should return 503)
- [ ] Test with invalid DATABASE_URL (should return 503)
- [ ] Test rate limiting across function invocations
- [ ] Verify request IDs appear in Netlify function logs

## Later (Deferred Items)

1. **JWT Authentication** - Deferred because API keys simpler for MVP, JWT needs
   key rotation strategy
2. **Redis/Upstash Rate Limiting** - Postgres solution works for <1000 users
3. **Soft Deletes** - Not critical for MVP, add when audit trail needed
4. **JWKS Endpoint** - Needs after moving to JWT
5. **Circuit Breaker** - Add when traffic justifies complexity
6. **Cursor Encryption** - Timestamp pagination sufficient for MVP
7. **Webhook Events** - Add when third-party integrations needed
8. **GraphQL API** - Consider if frontend needs flexible queries
