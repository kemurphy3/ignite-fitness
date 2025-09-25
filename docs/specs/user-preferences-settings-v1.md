# User Preferences Settings API v1

## Section 1: Summary

Implement user preferences API to allow signed-in users to configure their personal settings affecting UX and defaults. The feature will use JWT authentication, store preferences in a dedicated PostgreSQL table, and provide GET/PATCH endpoints for reading and updating preferences. The implementation uses atomic upserts to handle concurrent updates and provides standardized error codes for client handling.

## Section 2: Data Model

### Table Migration SQL

```sql
-- Extend existing user_preferences table with new columns
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100),
ADD COLUMN IF NOT EXISTS units VARCHAR(10) DEFAULT 'imperial' CHECK (units IN ('metric', 'imperial')),
ADD COLUMN IF NOT EXISTS sleep_goal_hours DECIMAL(3,1) CHECK (sleep_goal_hours >= 0 AND sleep_goal_hours <= 14),
ADD COLUMN IF NOT EXISTS workout_goal_per_week INTEGER CHECK (workout_goal_per_week >= 0 AND workout_goal_per_week <= 14),
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS theme VARCHAR(16) DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 1;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Ensure unique constraint exists
ALTER TABLE user_preferences 
ADD CONSTRAINT user_preferences_user_id_unique UNIQUE (user_id) 
ON CONFLICT DO NOTHING;
```

### Default Values Strategy

When no preferences row exists:
- `timezone`: NULL (client falls back to browser timezone detection)
- `units`: 'imperial' 
- `sleep_goal_hours`: 8.0
- `workout_goal_per_week`: 3
- `notifications_enabled`: true
- `theme`: 'system'

### Atomic Upsert Strategy

Use PostgreSQL's INSERT...ON CONFLICT with RETURNING clause to handle concurrent requests:

```sql
INSERT INTO user_preferences (
  user_id, timezone, units, sleep_goal_hours,
  workout_goal_per_week, notifications_enabled, theme
) VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (user_id) 
DO UPDATE SET 
  timezone = COALESCE(EXCLUDED.timezone, user_preferences.timezone),
  units = COALESCE(EXCLUDED.units, user_preferences.units),
  -- ... other fields
  updated_at = NOW()
RETURNING *;
```

## Section 3: API Specification

### GET /users/preferences

**Auth**: Required (JWT Bearer token)

**Implementation Flow**:
1. Verify JWT and extract `sub` claim (external_id)
2. Query: `SELECT id FROM users WHERE external_id = $1`
3. If no user found, return 403
4. Atomic get-or-create preferences with defaults
5. Return preferences

**Response 200**:
```json
{
  "timezone": "America/Denver",
  "units": "imperial",
  "sleep_goal_hours": 8.0,
  "workout_goal_per_week": 3,
  "notifications_enabled": true,
  "theme": "system"
}
```

**Error Responses**:
```json
{
  "error": "Error Type",
  "message": "Human readable message",
  "code": "ERROR_CODE"
}
```

- 401: `AUTH_REQUIRED` - Missing/invalid JWT
- 403: `USER_NOT_FOUND` - Token valid but user not found
- 429: `RATE_LIMITED` - Too many requests
- 500: `DB_ERROR` - Server error

### PATCH /users/preferences

**Auth**: Required (JWT Bearer token)

**Request Body** (all fields optional):
```json
{
  "timezone": "Europe/London",
  "units": "metric",
  "sleep_goal_hours": 7.5,
  "workout_goal_per_week": 4,
  "notifications_enabled": false,
  "theme": "dark"
}
```

**Implementation Flow**:
1. Verify JWT and resolve user_id
2. Validate each provided field
3. Build UPDATE query with only valid fields
4. Execute atomic update with RETURNING
5. Return 204 No Content

**Response**: 204 No Content

**Error Codes**:
- 400: `INVALID_JSON` - Malformed JSON
- 400: `BODY_TOO_LARGE` - Request > 10KB
- 400: `INVALID_TIMEZONE` - Unknown IANA timezone
- 400: `INVALID_UNITS` - Not 'metric' or 'imperial'
- 400: `INVALID_SLEEP_GOAL` - Outside 0-14 range
- 400: `INVALID_WORKOUT_GOAL` - Outside 0-14 range
- 400: `INVALID_THEME` - Not 'system', 'light', or 'dark'
- 401: `AUTH_REQUIRED` - Missing/invalid JWT
- 403: `USER_NOT_FOUND` - Token valid but user not found
- 429: `RATE_LIMITED` - Too many requests
- 500: `DB_ERROR` - Server error

### CORS Headers

All responses include:
```javascript
{
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}
```

## Section 4: Validation & Security

### Field Validation

**timezone**:
```javascript
const moment = require('moment-timezone');

function isValidTimezone(tz) {
  if (!tz || tz === null) return true; // NULL is valid
  if (typeof tz !== 'string') return false;
  if (tz.length > 100) return false;
  return moment.tz.names().includes(tz);
}
```

**units**:
- Enum: ['metric', 'imperial'] only
- Case-insensitive input, stored lowercase
- Validation: `['metric', 'imperial'].includes(value.toLowerCase())`

**sleep_goal_hours**:
- Range: 0.0 to 14.0
- Precision: 0.1 (rounded)
- Validation: 
```javascript
const n = Number(value);
if (isNaN(n) || n < 0 || n > 14) return false;
// Round to 0.1 precision
const rounded = Math.round(n * 10) / 10;
```

**workout_goal_per_week**:
- Range: 0 to 14
- Integer only
- Validation: `Number.isInteger(n) && n >= 0 && n <= 14`

**notifications_enabled**:
- Boolean only
- Accepts: true/false, 1/0, "true"/"false"
- Coercion: `Boolean(value)`

**theme**:
- Enum: ['system', 'light', 'dark']
- Max length: 16 characters
- Case-insensitive, stored lowercase

### Security Measures

1. **JWT Validation**:
```javascript
const { verifyJWT } = require('./utils/auth');

const externalId = await verifyJWT(event.headers);
if (!externalId) {
  return errorResponse('AUTH_REQUIRED');
}
```

2. **User Resolution**:
```sql
-- Get internal user ID from external ID
SELECT id FROM users WHERE external_id = $1
```

3. **Request Size Limit**:
```javascript
if (event.body && event.body.length > 10240) {
  return errorResponse('BODY_TOO_LARGE');
}
```

4. **Unknown Fields**:
- Silently ignored (no error)
- Only known fields are processed

5. **Logging**:
- No user IDs or PII in logs
- Log sanitized error messages only:
```javascript
console.error('Database error:', error.message); // No user data
```

6. **Rate Limiting**:
- 10 requests per minute per user
- Implemented via existing rate-limiter utility

## Section 5: Acceptance Criteria

- [ ] GET /users/preferences returns current user's preferences
- [ ] GET atomically creates default preferences if none exist
- [ ] GET handles concurrent requests without race conditions
- [ ] PATCH /users/preferences updates only provided fields
- [ ] PATCH silently ignores unknown fields
- [ ] PATCH handles concurrent updates (last write wins)
- [ ] Invalid timezone returns 400 with code `INVALID_TIMEZONE`
- [ ] Timezone validation uses moment-timezone library
- [ ] Invalid units returns 400 with code `INVALID_UNITS`
- [ ] sleep_goal_hours is rounded to 0.1 precision
- [ ] sleep_goal_hours outside 0-14 returns 400 with code `INVALID_SLEEP_GOAL`
- [ ] workout_goal_per_week outside 0-14 returns 400 with code `INVALID_WORKOUT_GOAL`
- [ ] Non-boolean notifications_enabled returns 400
- [ ] Invalid theme returns 400 with code `INVALID_THEME`
- [ ] Missing JWT returns 401 with code `AUTH_REQUIRED`
- [ ] Invalid/expired JWT returns 401 with code `AUTH_REQUIRED`
- [ ] Valid JWT for non-existent user returns 403 with code `USER_NOT_FOUND`
- [ ] User can only access their own preferences (ownership check)
- [ ] Preferences persist across sessions
- [ ] NULL timezone doesn't break GET response
- [ ] Empty PATCH body returns 204 (no-op)
- [ ] Request body > 10KB returns 400 with code `BODY_TOO_LARGE`
- [ ] All responses include proper CORS headers
- [ ] No PII appears in server logs
- [ ] Rate limiting enforced (10 req/min per user)

## Section 6: Test Plan

### Unit Tests

1. **Timezone Validation**:
```javascript
describe('Timezone validation', () => {
  test('Valid IANA timezones', () => {
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Europe/London')).toBe(true);
    expect(isValidTimezone(null)).toBe(true); // NULL allowed
  });
  
  test('Invalid timezone formats', () => {
    expect(isValidTimezone('UTC+5')).toBe(false);
    expect(isValidTimezone('EST')).toBe(false);
    expect(isValidTimezone('US/Eastern')).toBe(false); // Deprecated
    expect(isValidTimezone('')).toBe(false);
  });
});
```

2. **Decimal Precision**:
```javascript
test('sleep_goal_hours precision', () => {
  expect(roundSleepGoal(7.55)).toBe(7.6);
  expect(roundSleepGoal(7.54)).toBe(7.5);
  expect(roundSleepGoal(7.500000001)).toBe(7.5);
});
```

### Integration Tests

1. **Concurrent Updates**:
```javascript
test('Concurrent PATCH requests', async () => {
  const token = generateTestToken('user123');
  
  // Fire simultaneously
  const [res1, res2] = await Promise.all([
    patchPreferences(token, { theme: 'dark' }),
    patchPreferences(token, { units: 'metric' })
  ]);
  
  expect(res1.status).toBe(204);
  expect(res2.status).toBe(204);
  
  // Verify both changes applied
  const final = await getPreferences(token);
  expect(final.theme).toBe('dark');
  expect(final.units).toBe('metric');
});
```

2. **Race Condition on Creation**:
```javascript
test('Concurrent GET for new user', async () => {
  const token = generateTestToken('newuser');
  
  // Fire 5 simultaneous GET requests
  const results = await Promise.all([
    getPreferences(token),
    getPreferences(token),
    getPreferences(token),
    getPreferences(token),
    getPreferences(token)
  ]);
  
  // All should succeed with same data
  results.forEach(r => {
    expect(r.status).toBe(200);
    expect(r.data.units).toBe('imperial'); // Default
  });
  
  // Should only create one row
  const count = await sql`
    SELECT COUNT(*) FROM user_preferences 
    WHERE user_id = (SELECT id FROM users WHERE external_id = 'newuser')
  `;
  expect(count[0].count).toBe(1);
});
```

3. **Error Cases**:
```javascript
test('User resolution failures', async () => {
  // Valid JWT but user doesn't exist
  const token = generateTestToken('nonexistent');
  const res = await getPreferences(token);
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('USER_NOT_FOUND');
});

test('Validation errors have proper codes', async () => {
  const token = generateTestToken('user123');
  
  const res = await patchPreferences(token, {
    timezone: 'Invalid/Zone',
    units: 'kilometers',
    sleep_goal_hours: 25,
    workout_goal_per_week: -1
  });
  
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('VALIDATION_FAILED');
  expect(res.body.details).toContain('Invalid timezone');
});
```

### Manual Testing Checklist

- [ ] Login as user, verify default preferences load
- [ ] Change timezone to various zones (America/*, Europe/*, Asia/*)
- [ ] Verify NULL timezone doesn't break UI
- [ ] Switch between metric/imperial multiple times
- [ ] Set sleep_goal to decimal values (7.5, 8.3)
- [ ] Try invalid values via browser console
- [ ] Open two tabs, update preferences in both simultaneously
- [ ] Verify changes persist after logout/login
- [ ] Check DevTools Network tab for no PII in requests
- [ ] Trigger rate limiting with rapid requests
- [ ] Verify CORS headers present in all responses

### Performance Benchmarks

- GET response time < 100ms (p95)
- PATCH response time < 150ms (p95)
- Database query time < 50ms
- Concurrent request handling > 100 req/sec

## Section 7: Later (Deferred Features)

### Unit Conversion in API Responses

**Deferred to Phase 2**

All weight/distance values in other endpoints will continue using the stored format. Server-side unit conversion will be implemented in Phase 2:

- Affects: `/sessions-list`, `/exercises-list`, `/sessions-create`
- Implementation: Response transformation layer
- Reason: Requires auditing all endpoints that return measurements

### Audit Trail

**Deferred to Phase 2**

Schema for future implementation:
```sql
CREATE TABLE user_preferences_audit (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  request_id VARCHAR(100)
);
```

Reason: Not critical for MVP; adds complexity to initial implementation

### Advanced Notification Preferences

**Deferred to Phase 3**

Future structure:
```json
{
  "notifications": {
    "workout_reminders": true,
    "achievement_alerts": false,
    "weekly_summary": true,
    "email_enabled": true,
    "push_enabled": false
  }
}
```

Reason: Single boolean sufficient for MVP; granular control adds UI complexity

### Timezone Display Formatting

**Deferred to Client Implementation**

Server stores IANA timezone string (e.g., "America/Denver"). Client responsible for:
- Displaying user-friendly format (MST, MDT, Mountain Time)
- Handling DST transitions
- Using Intl.DateTimeFormat for localization

Reason: Display formatting is presentation layer concern