# Sessions API v1 Documentation

## Overview

This API provides comprehensive user data management and session CRUD operations
with API key authentication, validation, and data synchronization.

## Base URL

```
https://your-netlify-site.netlify.app/.netlify/functions
```

## Authentication

All endpoints require an API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key-here" \
     https://your-site.netlify.app/.netlify/functions/user-profile
```

## Rate Limiting

- **Limit**: 100 requests per minute per user
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- **Exceeded**: Returns `429 Too Many Requests`

## Error Format

All errors follow this consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "additional_info"
    },
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

## Endpoints

### 1. User Profile

#### GET `/user-profile`

Retrieve current user's profile.

**Response 200:**

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
    "baseline_lifts": {
      "squat": 100,
      "bench": 80,
      "deadlift": 120
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T00:00:00Z"
  }
}
```

#### POST `/user-profile`

Create or update user profile.

**Request:**

```json
{
  "age": 25,
  "weight": 75.5,
  "height": 180,
  "sex": "male",
  "goals": ["strength", "endurance"],
  "baseline_lifts": {
    "squat": 100,
    "bench": 80,
    "deadlift": 120
  }
}
```

**Validation:**

- `age`: 13-120 (optional)
- `weight`: 20-300 kg (optional)
- `height`: 100-250 cm (optional)
- `sex`: "male", "female", "other" (optional)
- `goals`: Array, max 5 items (optional)
- `baseline_lifts`: JSON object, max 1KB (optional)

### 2. Sessions

#### POST `/sessions-create`

Create a new session.

**Request:**

```json
{
  "type": "workout",
  "source": "manual",
  "source_id": "unique_123",
  "start_at": "2024-01-15T10:00:00Z",
  "end_at": "2024-01-15T11:00:00Z",
  "payload": {
    "notes": "Great workout",
    "rpe": 7
  }
}
```

**Validation:**

- `type`: Required, must be one of: workout, soccer, climbing, recovery, cardio,
  strength, flexibility, sport_specific
- `source`: Required, must be one of: manual, strava, apple_health, garmin,
  whoop, import
- `source_id`: Optional, used for deduplication
- `start_at`: Required, ISO 8601 UTC, max 24 hours in future
- `end_at`: Optional, ISO 8601 UTC
- `payload`: Optional, max 10KB JSON

**Deduplication:**

- With `source_id`: Unique on (user_id, source, source_id)
- Without `source_id`: Unique on (user_id, start_at, type)

#### GET `/sessions-list`

List sessions with pagination.

**Query Parameters:**

- `type`: Filter by session type
- `start_date`: ISO date string (inclusive)
- `end_date`: ISO date string (inclusive)
- `limit`: 1-100, default 20
- `before`: Timestamp for pagination (exclusive)

**Response:**

```json
{
  "success": true,
  "data": {
    "sessions": [...],
    "pagination": {
      "has_more": true,
      "next_before": "2024-01-15T10:00:00.000Z",
      "count": 20,
      "total": 150
    }
  }
}
```

### 3. Exercises

#### POST `/exercises-bulk-create`

Add exercises to a session.

**Request:**

```json
{
  "session_id": 456,
  "exercises": [
    {
      "name": "Squat",
      "sets": 3,
      "reps": 10,
      "weight": 100,
      "rpe": 7,
      "notes": "Good form"
    }
  ]
}
```

**Validation:**

- `session_id`: Required, must exist and belong to user
- `exercises`: Required array, 1-50 items
- `name`: Required, 1-100 characters, trimmed
- `sets`: Required, 1-20
- `reps`: Required, 1-100
- `weight`: Optional, 0-500 kg
- `rpe`: Optional, 1-10
- `notes`: Optional, max 500 characters

**Transaction:** All exercises are inserted atomically - either all succeed or
all fail.

### 4. API Key Management

#### POST `/api-key-manager`

Create new API key (admin only).

**Request:**

```json
{
  "user_id": 123,
  "name": "My App Key",
  "expires_in_days": 365
}
```

#### GET `/api-key-manager?user_id=123`

List API keys for user (admin only).

#### PUT `/api-key-manager`

Update API key status (admin only).

**Request:**

```json
{
  "key_id": 456,
  "is_active": false
}
```

#### DELETE `/api-key-manager`

Delete API key (admin only).

**Request:**

```json
{
  "key_id": 456
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (access denied)
- `404` - Not Found
- `409` - Conflict (duplicate session)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable (database error)

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    age INTEGER CHECK (age >= 13 AND age <= 120),
    weight DECIMAL(5,2) CHECK (weight >= 20 AND weight <= 300),
    height INTEGER CHECK (height >= 100 AND height <= 250),
    sex VARCHAR(10) CHECK (sex IN ('male', 'female', 'other')),
    goals JSONB,
    baseline_lifts JSONB CHECK (octet_length(baseline_lifts::text) <= 1024),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Sessions Table

```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('workout', 'soccer', 'climbing', 'recovery', 'cardio', 'strength', 'flexibility', 'sport_specific')),
    source VARCHAR(20) CHECK (source IN ('manual', 'strava', 'apple_health', 'garmin', 'whoop', 'import')),
    source_id VARCHAR(255),
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    payload JSONB CHECK (octet_length(payload::text) <= 10240),
    session_hash VARCHAR(64) GENERATED ALWAYS AS (
        CASE
            WHEN source_id IS NOT NULL THEN
                encode(sha256((user_id || ':' || source || ':' || source_id)::bytea), 'hex')
            ELSE
                encode(sha256((user_id || ':' || start_at || ':' || type)::bytea), 'hex')
        END
    ) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_hash)
);
```

### Exercises Table

```sql
CREATE TABLE exercises (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sets INTEGER CHECK (sets >= 1 AND sets <= 20),
    reps INTEGER CHECK (reps >= 1 AND reps <= 100),
    weight DECIMAL(6,2) CHECK (weight >= 0 AND weight <= 500),
    rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
    notes VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Testing

Run the test suite:

```bash
npm install node-fetch
node test-api-endpoints.js
```

## Deployment

1. Update database schema:

```bash
psql $DATABASE_URL -f database-schema-update.sql
```

2. Deploy to Netlify:

```bash
netlify deploy --prod
```

3. Set environment variables in Netlify dashboard:

- `DATABASE_URL`
- `ADMIN_KEY`

## Security Notes

- API keys are hashed with SHA-256 before storage
- Rate limiting prevents abuse
- Input validation prevents injection attacks
- CORS headers allow cross-origin requests
- Request IDs help with debugging and monitoring

## Support

For issues or questions, please check the error response format and status codes
above. All errors include a request ID for debugging purposes.
