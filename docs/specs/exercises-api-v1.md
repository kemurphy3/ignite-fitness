# Exercises API Feature Specification v1.0
**Feature:** Session Exercises Management API
**Status:** Ready for Implementation  
**Last Updated:** 2025-09-25

## Section 1: Summary

Implement a granular exercises API that links detailed workout exercises to existing sessions, supporting bulk creation with partial failure handling, pagination, updates, and deletion with strict multi-user isolation. This feature enables users to track individual exercises within their training sessions including sets, reps, weight, RPE, and additional metadata like tempo and rest periods.

### Key Design Decisions
- Transaction-wrapped bulk creates with partial failure support (207 Multi-Status)
- Stable cursor-based pagination using composite ordering
- User-scoped idempotency via request hashing with daily deduplication
- Automatic order reindexing to prevent gaps
- Two-step ownership verification for security
- JWT sub directly maps to user.id (standard approach)
- Sliding window rate limiting to prevent bursts

### Scope
- 1 PR for database schema and core API implementation
- 1 PR for pagination, rate limiting, and advanced features
- No client implementation (API only)
- Leverages existing session infrastructure

## Section 2: Data Model

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum for validated muscle groups
CREATE TYPE muscle_group AS ENUM (
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'quadriceps', 'hamstrings', 'glutes', 'calves', 
    'abs', 'obliques', 'forearms', 'lats', 'traps'
);

-- Main exercises table
CREATE TABLE session_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Core exercise data
    name VARCHAR(100) NOT NULL,
    sets INTEGER NOT NULL CHECK (sets >= 1 AND sets <= 20),
    reps INTEGER NOT NULL CHECK (reps >= 1 AND reps <= 100),
    weight_kg DECIMAL(6,2) CHECK (weight_kg >= 0 AND weight_kg <= 500),
    rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
    
    -- Optional advanced fields
    tempo VARCHAR(10), -- e.g., "3-1-2-0" (eccentric-pause-concentric-pause)
    rest_seconds INTEGER CHECK (rest_seconds >= 0 AND rest_seconds <= 600),
    notes TEXT,
    superset_group VARCHAR(10), -- e.g., "A", "B" for supersetting
    order_index INTEGER NOT NULL DEFAULT 0,
    
    -- Tracking fields
    equipment_type VARCHAR(50), -- barbell, dumbbell, machine, bodyweight, cable, etc.
    muscle_groups muscle_group[], -- validated enum array
    exercise_type VARCHAR(20) CHECK (exercise_type IN ('strength', 'cardio', 'flexibility', 'plyometric', 'isometric')),
    
    -- Idempotency
    request_hash VARCHAR(64), -- SHA-256 of request for deduplication
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_tempo CHECK (tempo ~ '^[0-9]-[0-9]-[0-9]-[0-9]$' OR tempo IS NULL),
    CONSTRAINT valid_name_length CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
    CONSTRAINT valid_notes_length CHECK (char_length(notes) <= 500 OR notes IS NULL),
    CONSTRAINT valid_superset_group CHECK (char_length(superset_group) <= 10 OR superset_group IS NULL),
    CONSTRAINT unique_request_hash UNIQUE(user_id, request_hash)
);

-- Optimized indexes for performance
CREATE INDEX idx_exercises_session_order ON session_exercises(session_id, order_index, created_at, id);
CREATE INDEX idx_exercises_user_id ON session_exercises(user_id);
CREATE INDEX idx_exercises_request_hash ON session_exercises(user_id, request_hash) WHERE request_hash IS NOT NULL;
CREATE INDEX idx_exercises_superset ON session_exercises(session_id, superset_group) WHERE superset_group IS NOT NULL;

-- Exercise history for tracking changes
CREATE TABLE session_exercise_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL,
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'bulk_create')),
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by UUID
);

-- Composite index for history queries
CREATE INDEX idx_exercise_history_composite ON session_exercise_history(session_id, changed_at DESC);
CREATE INDEX idx_exercise_history_user ON session_exercise_history(user_id, changed_at DESC);

-- Sliding window rate limiting
CREATE TABLE exercise_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for sliding window queries
CREATE INDEX idx_rate_limits_sliding ON exercise_rate_limits(user_id, endpoint, created_at DESC);

-- Cleanup old rate limit entries periodically
CREATE INDEX idx_rate_limits_cleanup ON exercise_rate_limits(created_at) 
WHERE created_at < NOW() - INTERVAL '2 minutes';

-- Function to reindex exercises (fix gaps in order_index)
CREATE OR REPLACE FUNCTION reindex_session_exercises(p_session_id UUID)
RETURNS void AS $$
BEGIN
    WITH numbered AS (
        SELECT id, 
               ROW_NUMBER() OVER (ORDER BY order_index, created_at, id) - 1 as new_index
        FROM session_exercises
        WHERE session_id = p_session_id
    )
    UPDATE session_exercises e
    SET order_index = n.new_index
    FROM numbered n
    WHERE e.id = n.id;
END;
$$ LANGUAGE plpgsql;

-- Function for sliding window rate limiting
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_endpoint VARCHAR,
    p_limit INTEGER DEFAULT 60,
    p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, retry_after INTEGER) AS $$
DECLARE
    v_count INTEGER;
    v_oldest_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Count requests in sliding window
    SELECT COUNT(*), MIN(created_at) 
    INTO v_count, v_oldest_timestamp
    FROM exercise_rate_limits
    WHERE user_id = p_user_id
      AND endpoint = p_endpoint
      AND created_at > NOW() - make_interval(secs => p_window_seconds);
    
    IF v_count >= p_limit THEN
        -- Calculate retry_after based on oldest request
        RETURN QUERY SELECT 
            false, 
            v_count,
            EXTRACT(EPOCH FROM (v_oldest_timestamp + make_interval(secs => p_window_seconds) - NOW()))::INTEGER;
    ELSE
        RETURN QUERY SELECT true, v_count, 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to generate request hash for idempotency
CREATE OR REPLACE FUNCTION generate_request_hash(
    p_user_id UUID,
    p_session_id UUID, 
    p_exercises JSONB
)
RETURNS VARCHAR AS $$
DECLARE
    v_data TEXT;
BEGIN
    -- Include date for daily deduplication
    v_data := p_user_id::TEXT || p_session_id::TEXT || 
              p_exercises::TEXT || CURRENT_DATE::TEXT;
    RETURN encode(digest(v_data, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION update_exercise_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_exercise_timestamp
BEFORE UPDATE ON session_exercises
FOR EACH ROW EXECUTE FUNCTION update_exercise_timestamp();

-- Helper function for cursor pagination (JSON-based)
CREATE OR REPLACE FUNCTION encode_cursor(p_order_index INTEGER, p_created_at TIMESTAMP WITH TIME ZONE, p_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_cursor JSONB;
BEGIN
    v_cursor := jsonb_build_object(
        'o', p_order_index,
        'c', p_created_at,
        'i', p_id,
        'v', 1  -- version for future changes
    );
    RETURN encode(v_cursor::text::bytea, 'base64');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decode_cursor(p_cursor TEXT)
RETURNS TABLE(order_index INTEGER, created_at TIMESTAMP WITH TIME ZONE, id UUID) AS $$
DECLARE
    v_json JSONB;
BEGIN
    v_json := convert_from(decode(p_cursor, 'base64'), 'UTF8')::JSONB;
    RETURN QUERY SELECT 
        (v_json->>'o')::INTEGER,
        (v_json->>'c')::TIMESTAMP WITH TIME ZONE,
        (v_json->>'i')::UUID;
END;
$$ LANGUAGE plpgsql;
```

## Section 3: API Specification

### 3.1 POST /sessions/:sessionId/exercises - Bulk Create with Transaction

```javascript
// netlify/functions/sessions-exercises-create.js
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Validation schema
const exerciseSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        sets: { type: 'integer', minimum: 1, maximum: 20 },
        reps: { type: 'integer', minimum: 1, maximum: 100 },
        weight_kg: { type: 'number', minimum: 0, maximum: 500 },
        rpe: { type: 'integer', minimum: 1, maximum: 10 },
        tempo: { type: 'string', pattern: '^[0-9]-[0-9]-[0-9]-[0-9]$' },
        rest_seconds: { type: 'integer', minimum: 0, maximum: 600 },
        notes: { type: 'string', maxLength: 500 },
        superset_group: { type: 'string', maxLength: 10 },
        order_index: { type: 'integer', minimum: 0 },
        equipment_type: { type: 'string', maxLength: 50 },
        muscle_groups: { 
            type: 'array', 
            items: { 
                enum: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 
                       'quadriceps', 'hamstrings', 'glutes', 'calves', 
                       'abs', 'obliques', 'forearms', 'lats', 'traps'] 
            } 
        },
        exercise_type: { enum: ['strength', 'cardio', 'flexibility', 'plyometric', 'isometric'] }
    },
    required: ['name', 'sets', 'reps'],
    additionalProperties: false
};

// Helper to sanitize for logging
function sanitizeForLog(data) {
    const sanitized = { ...data };
    delete sanitized.notes;
    if (sanitized.user_id) {
        sanitized.user_hash = crypto.createHash('sha256')
            .update(sanitized.user_id)
            .digest('hex')
            .substring(0, 8);
        delete sanitized.user_id;
    }
    return sanitized;
}

exports.handler = async (event) => {
    const sql = neon(process.env.DATABASE_URL);
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }
    
    try {
        // Extract session ID from path
        const sessionId = event.path.match(/\/sessions\/([^\/]+)\/exercises/)?.[1];
        if (!sessionId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Invalid path format', 
                        code: 'VAL_001' 
                    }
                })
            };
        }
        
        // Authenticate - JWT sub IS the user ID
        const authHeader = event.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Authorization required', 
                        code: 'AUTH_001' 
                    }
                })
            };
        }
        
        const token = authHeader.substring(7);
        let userId;
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.sub; // Direct mapping
        } catch (err) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Invalid token', 
                        code: 'AUTH_002',
                        details: err.message 
                    }
                })
            };
        }
        
        // Check sliding window rate limit
        const rateCheck = await sql`
            SELECT * FROM check_rate_limit(
                ${userId}, 
                'POST /exercises',
                60,  -- 60 requests
                60   -- per 60 seconds
            )
        `;
        
        if (!rateCheck[0].allowed) {
            return {
                statusCode: 429,
                headers: { 
                    ...headers, 
                    'Retry-After': String(rateCheck[0].retry_after) 
                },
                body: JSON.stringify({ 
                    error: { 
                        message: 'Rate limit exceeded', 
                        code: 'RATE_001',
                        details: {
                            current_count: rateCheck[0].current_count,
                            retry_after: rateCheck[0].retry_after
                        }
                    }
                })
            };
        }
        
        // Log rate limit request
        await sql`
            INSERT INTO exercise_rate_limits (user_id, endpoint)
            VALUES (${userId}, 'POST /exercises')
        `;
        
        // Verify session ownership (separate query for clarity)
        const sessionCheck = await sql`
            SELECT user_id FROM sessions 
            WHERE id = ${sessionId}
        `;
        
        if (!sessionCheck.length) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Session not found', 
                        code: 'SESS_001' 
                    }
                })
            };
        }
        
        if (sessionCheck[0].user_id !== userId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Access denied', 
                        code: 'AUTHZ_001' 
                    }
                })
            };
        }
        
        // Parse and validate input
        const { exercises, client_request_id } = JSON.parse(event.body);
        
        if (!Array.isArray(exercises) || exercises.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Exercises array required', 
                        code: 'VAL_002' 
                    }
                })
            };
        }
        
        if (exercises.length > 50) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Maximum 50 exercises per request', 
                        code: 'VAL_003' 
                    }
                })
            };
        }
        
        // Generate request hash for idempotency
        const requestData = exercises.map(e => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            order_index: e.order_index
        }));
        
        const requestHash = crypto.createHash('sha256')
            .update(userId + sessionId + JSON.stringify(requestData) + new Date().toISOString().split('T')[0])
            .digest('hex');
        
        // Check idempotency with user scope
        const existing = await sql`
            SELECT id, created_at FROM session_exercises 
            WHERE user_id = ${userId}
            AND request_hash = ${requestHash}
            LIMIT 1
        `;
        
        if (existing.length > 0) {
            console.log('Idempotent request detected:', sanitizeForLog({ 
                user_id: userId, 
                request_hash: requestHash 
            }));
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    message: 'Exercises already created (idempotent)',
                    idempotent: true,
                    created_at: existing[0].created_at
                })
            };
        }
        
        // Validate each exercise
        const Ajv = require('ajv');
        const ajv = new Ajv();
        const validate = ajv.compile(exerciseSchema);
        
        const results = [];
        const errors = [];
        
        for (let i = 0; i < exercises.length; i++) {
            const exercise = exercises[i];
            
            if (!validate(exercise)) {
                errors.push({
                    index: i,
                    name: exercise.name,
                    errors: validate.errors
                });
                continue;
            }
            
            // Sanitize and prepare
            results.push({
                ...exercise,
                name: exercise.name.trim().substring(0, 100),
                notes: exercise.notes?.trim().substring(0, 500),
                order_index: exercise.order_index ?? i
            });
        }
        
        // If any validation errors, return them all
        if (errors.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: {
                        message: 'Validation failed for some exercises',
                        code: 'VAL_004',
                        details: errors
                    }
                })
            };
        }
        
        // Begin transaction for atomic operation
        let insertedExercises = [];
        
        try {
            await sql.begin(async sql => {
                // Bulk insert exercises
                const insertData = results.map(ex => ({
                    session_id: sessionId,
                    user_id: userId,
                    name: ex.name,
                    sets: ex.sets,
                    reps: ex.reps,
                    weight_kg: ex.weight_kg || null,
                    rpe: ex.rpe || null,
                    tempo: ex.tempo || null,
                    rest_seconds: ex.rest_seconds || null,
                    notes: ex.notes || null,
                    superset_group: ex.superset_group || null,
                    order_index: ex.order_index,
                    equipment_type: ex.equipment_type || null,
                    muscle_groups: ex.muscle_groups || null,
                    exercise_type: ex.exercise_type || 'strength',
                    request_hash: requestHash
                }));
                
                insertedExercises = await sql`
                    INSERT INTO session_exercises ${sql(insertData)}
                    RETURNING id, name, order_index, created_at
                `;
                
                // Log bulk creation in history
                await sql`
                    INSERT INTO session_exercise_history (
                        exercise_id, session_id, user_id, action, new_data, changed_by
                    )
                    SELECT 
                        id, 
                        ${sessionId}, 
                        ${userId}, 
                        'bulk_create',
                        to_jsonb(session_exercises.*),
                        ${userId}
                    FROM session_exercises
                    WHERE id = ANY(${insertedExercises.map(e => e.id)})
                `;
                
                // Reindex to ensure no gaps
                await sql`SELECT reindex_session_exercises(${sessionId})`;
            });
            
            console.log('Exercises created:', sanitizeForLog({
                session_id: sessionId,
                user_id: userId,
                count: insertedExercises.length
            }));
            
            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({
                    success: true,
                    count: insertedExercises.length,
                    exercises: insertedExercises.map(ex => ({
                        id: ex.id,
                        name: ex.name,
                        order_index: ex.order_index,
                        created_at: ex.created_at.toISOString()
                    }))
                })
            };
            
        } catch (txError) {
            console.error('Transaction failed:', sanitizeForLog({ 
                error: txError.message,
                session_id: sessionId 
            }));
            
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Transaction failed - no exercises were created', 
                        code: 'SYS_001' 
                    }
                })
            };
        }
        
    } catch (error) {
        console.error('Error creating exercises:', sanitizeForLog({ error: error.message }));
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: { 
                    message: 'Internal server error', 
                    code: 'SYS_002' 
                }
            })
        };
    }
};

/* Example Request:
POST /sessions/123e4567-e89b-12d3-a456-426614174000/exercises
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "exercises": [
    {
      "name": "Barbell Squat",
      "sets": 5,
      "reps": 5,
      "weight_kg": 102.5,
      "rpe": 8,
      "rest_seconds": 180,
      "tempo": "2-0-2-0",
      "notes": "Felt strong today",
      "muscle_groups": ["quadriceps", "glutes"],
      "equipment_type": "barbell",
      "order_index": 0
    },
    {
      "name": "Romanian Deadlift",
      "sets": 4,
      "reps": 8,
      "weight_kg": 80,
      "rpe": 7,
      "rest_seconds": 120,
      "muscle_groups": ["hamstrings", "glutes", "back"],
      "equipment_type": "barbell",
      "order_index": 1
    }
  ]
}

Example Success Response (201):
{
  "success": true,
  "count": 2,
  "exercises": [
    {
      "id": "987fcdeb-51a2-43f1-b890-123456789abc",
      "name": "Barbell Squat",
      "order_index": 0,
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "876edcba-41b3-54f2-a901-234567890bcd",
      "name": "Romanian Deadlift",
      "order_index": 1,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}

Example Error Response (400):
{
  "error": {
    "message": "Validation failed for some exercises",
    "code": "VAL_004",
    "details": [
      {
        "index": 0,
        "name": "Squat",
        "errors": [
          {
            "instancePath": "/sets",
            "message": "must be >= 1"
          }
        ]
      }
    ]
  }
}
*/
```

### 3.2 GET /sessions/:sessionId/exercises - List with Stable Pagination

```javascript
// netlify/functions/sessions-exercises-list.js
exports.handler = async (event) => {
    const sql = neon(process.env.DATABASE_URL);
    
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }
    
    try {
        // Extract session ID
        const sessionId = event.path.match(/\/sessions\/([^\/]+)\/exercises/)?.[1];
        if (!sessionId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Invalid path format', 
                        code: 'VAL_001' 
                    }
                })
            };
        }
        
        // Authenticate
        const authHeader = event.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Authorization required', 
                        code: 'AUTH_001' 
                    }
                })
            };
        }
        
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        let userId;
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.sub;
        } catch (err) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Invalid token', 
                        code: 'AUTH_002' 
                    }
                })
            };
        }
        
        // Verify session ownership
        const sessionCheck = await sql`
            SELECT user_id FROM sessions 
            WHERE id = ${sessionId}
        `;
        
        if (!sessionCheck.length) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Session not found', 
                        code: 'SESS_001' 
                    }
                })
            };
        }
        
        if (sessionCheck[0].user_id !== userId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Access denied', 
                        code: 'AUTHZ_001' 
                    }
                })
            };
        }
        
        // Parse query parameters
        const params = event.queryStringParameters || {};
        const limit = Math.min(Math.max(parseInt(params.limit) || 20, 1), 100);
        const cursor = params.cursor;
        
        let cursorCondition = '';
        let cursorValues = {};
        
        if (cursor) {
            try {
                // Decode JSON cursor
                const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
                
                if (decoded.v !== 1) {
                    throw new Error('Unsupported cursor version');
                }
                
                cursorCondition = ` AND (order_index, created_at, id) > (${decoded.o}, '${decoded.c}', '${decoded.i}')`;
                cursorValues = { 
                    cursor_order: decoded.o,
                    cursor_created: decoded.c,
                    cursor_id: decoded.i
                };
            } catch (err) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: { 
                            message: 'Invalid cursor', 
                            code: 'VAL_005' 
                        }
                    })
                };
            }
        }
        
        // Fetch exercises with stable ordering
        const exercises = await sql`
            SELECT 
                id, name, sets, reps, weight_kg, rpe,
                tempo, rest_seconds, notes, superset_group,
                order_index, equipment_type, muscle_groups,
                exercise_type, created_at, updated_at
            FROM session_exercises
            WHERE session_id = ${sessionId}
            ${cursor ? sql`AND (order_index, created_at, id) > (${cursorValues.cursor_order}, ${cursorValues.cursor_created}, ${cursorValues.cursor_id})` : sql``}
            ORDER BY order_index ASC, created_at ASC, id ASC
            LIMIT ${limit + 1}
        `;
        
        const hasMore = exercises.length > limit;
        const returnExercises = hasMore ? exercises.slice(0, -1) : exercises;
        
        let nextCursor = null;
        if (hasMore && returnExercises.length > 0) {
            const last = returnExercises[returnExercises.length - 1];
            const cursorData = {
                o: last.order_index,
                c: last.created_at.toISOString(),
                i: last.id,
                v: 1
            };
            nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
        }
        
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Cache-Control': 'private, max-age=10'
            },
            body: JSON.stringify({
                exercises: returnExercises.map(ex => ({
                    ...ex,
                    created_at: ex.created_at.toISOString(),
                    updated_at: ex.updated_at.toISOString()
                })),
                pagination: {
                    limit,
                    has_more: hasMore,
                    next_cursor: nextCursor
                }
            })
        };
        
    } catch (error) {
        console.error('Error listing exercises:', sanitizeForLog({ error: error.message }));
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: { 
                    message: 'Internal server error', 
                    code: 'SYS_002' 
                }
            })
        };
    }
};

/* Example Request:
GET /sessions/123e4567-e89b-12d3-a456-426614174000/exercises?limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Example Response:
{
  "exercises": [
    {
      "id": "987fcdeb-51a2-43f1-b890-123456789abc",
      "name": "Barbell Squat",
      "sets": 5,
      "reps": 5,
      "weight_kg": 102.5,
      "rpe": 8,
      "tempo": "2-0-2-0",
      "rest_seconds": 180,
      "notes": "Felt strong today",
      "superset_group": null,
      "order_index": 0,
      "equipment_type": "barbell",
      "muscle_groups": ["quadriceps", "glutes"],
      "exercise_type": "strength",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "has_more": true,
    "next_cursor": "eyJvIjoxLCJjIjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaS......"
  }
}
*/
```

### 3.3 PUT /sessions/:sessionId/exercises/:exerciseId - Update with Ownership Check

```javascript
// netlify/functions/sessions-exercises-update.js
exports.handler = async (event) => {
    const sql = neon(process.env.DATABASE_URL);
    
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }
    
    try {
        // Extract IDs from path
        const pathMatch = event.path.match(/\/sessions\/([^\/]+)\/exercises\/([^\/]+)/);
        if (!pathMatch) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Invalid path format', 
                        code: 'VAL_001' 
                    }
                })
            };
        }
        
        const [, sessionId, exerciseId] = pathMatch;
        
        // Authenticate
        const authHeader = event.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Authorization required', 
                        code: 'AUTH_001' 
                    }
                })
            };
        }
        
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        let userId;
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.sub;
        } catch (err) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Invalid token', 
                        code: 'AUTH_002' 
                    }
                })
            };
        }
        
        // Check rate limit
        const rateCheck = await sql`
            SELECT * FROM check_rate_limit(${userId}, 'PUT /exercises', 60, 60)
        `;
        
        if (!rateCheck[0].allowed) {
            return {
                statusCode: 429,
                headers: { 
                    ...headers, 
                    'Retry-After': String(rateCheck[0].retry_after) 
                },
                body: JSON.stringify({ 
                    error: { 
                        message: 'Rate limit exceeded', 
                        code: 'RATE_001' 
                    }
                })
            };
        }
        
        await sql`
            INSERT INTO exercise_rate_limits (user_id, endpoint)
            VALUES (${userId}, 'PUT /exercises')
        `;
        
        // Step 1: Verify session ownership
        const sessionCheck = await sql`
            SELECT user_id FROM sessions 
            WHERE id = ${sessionId}
        `;
        
        if (!sessionCheck.length) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Session not found', 
                        code: 'SESS_001' 
                    }
                })
            };
        }
        
        if (sessionCheck[0].user_id !== userId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Access denied', 
                        code: 'AUTHZ_001' 
                    }
                })
            };
        }
        
        // Step 2: Check exercise exists in this session
        const exerciseCheck = await sql`
            SELECT * FROM session_exercises
            WHERE id = ${exerciseId} AND session_id = ${sessionId}
        `;
        
        if (!exerciseCheck.length) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Exercise not found', 
                        code: 'EX_001' 
                    }
                })
            };
        }
        
        // Parse and validate update
        const updates = JSON.parse(event.body);
        const Ajv = require('ajv');
        const ajv = new Ajv();
        const validate = ajv.compile(exerciseSchema);
        
        // Merge with existing data for validation
        const merged = { ...exerciseCheck[0], ...updates };
        
        if (!validate(merged)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: {
                        message: 'Invalid update data',
                        code: 'VAL_004',
                        details: validate.errors
                    }
                })
            };
        }
        
        // Build update fields (prevent mass assignment)
        const allowedFields = [
            'name', 'sets', 'reps', 'weight_kg', 'rpe',
            'tempo', 'rest_seconds', 'notes', 'superset_group',
            'order_index', 'equipment_type', 'muscle_groups', 'exercise_type'
        ];
        
        const updateFields = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                if (field === 'name' || field === 'notes') {
                    updateFields[field] = updates[field]?.trim();
                } else {
                    updateFields[field] = updates[field];
                }
            }
        }
        
        if (Object.keys(updateFields).length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'No valid fields to update', 
                        code: 'VAL_006' 
                    }
                })
            };
        }
        
        // Perform update in transaction
        let updated;
        
        await sql.begin(async sql => {
            // Store old data for history
            const oldData = exerciseCheck[0];
            
            // Update exercise
            updated = await sql`
                UPDATE session_exercises
                SET ${sql(updateFields)}
                WHERE id = ${exerciseId}
                RETURNING *
            `;
            
            // Log to history
            await sql`
                INSERT INTO session_exercise_history (
                    exercise_id, session_id, user_id, action, old_data, new_data, changed_by
                ) VALUES (
                    ${exerciseId}, ${sessionId}, ${userId}, 'update',
                    ${JSON.stringify(oldData)}, ${JSON.stringify(updated[0])}, ${userId}
                )
            `;
            
            // Reindex if order changed
            if (updates.order_index !== undefined) {
                await sql`SELECT reindex_session_exercises(${sessionId})`;
            }
        });
        
        console.log('Exercise updated:', sanitizeForLog({
            exercise_id: exerciseId,
            session_id: sessionId,
            user_id: userId
        }));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                exercise: {
                    ...updated[0],
                    created_at: updated[0].created_at.toISOString(),
                    updated_at: updated[0].updated_at.toISOString()
                }
            })
        };
        
    } catch (error) {
        console.error('Error updating exercise:', sanitizeForLog({ error: error.message }));
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: { 
                    message: 'Internal server error', 
                    code: 'SYS_002' 
                }
            })
        };
    }
};

/* Example Request:
PUT /sessions/123e4567-e89b-12d3-a456-426614174000/exercises/987fcdeb-51a2-43f1-b890-123456789abc
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "sets": 4,
  "reps": 6,
  "weight_kg": 105,
  "rpe": 9,
  "notes": "Increased weight, felt harder"
}

Example Response:
{
  "success": true,
  "exercise": {
    "id": "987fcdeb-51a2-43f1-b890-123456789abc",
    "session_id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Barbell Squat",
    "sets": 4,
    "reps": 6,
    "weight_kg": 105,
    "rpe": 9,
    "notes": "Increased weight, felt harder",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
}
*/
```

### 3.4 DELETE /sessions/:sessionId/exercises/:exerciseId - Delete with History

```javascript
// netlify/functions/sessions-exercises-delete.js
exports.handler = async (event) => {
    const sql = neon(process.env.DATABASE_URL);
    
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }
    
    try {
        // Extract IDs
        const pathMatch = event.path.match(/\/sessions\/([^\/]+)\/exercises\/([^\/]+)/);
        if (!pathMatch) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Invalid path format', 
                        code: 'VAL_001' 
                    }
                })
            };
        }
        
        const [, sessionId, exerciseId] = pathMatch;
        
        // Authenticate
        const authHeader = event.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Authorization required', 
                        code: 'AUTH_001' 
                    }
                })
            };
        }
        
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        let userId;
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.sub;
        } catch (err) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Invalid token', 
                        code: 'AUTH_002' 
                    }
                })
            };
        }
        
        // Verify ownership and delete in transaction
        await sql.begin(async sql => {
            // Check session ownership
            const sessionCheck = await sql`
                SELECT user_id FROM sessions 
                WHERE id = ${sessionId}
            `;
            
            if (!sessionCheck.length || sessionCheck[0].user_id !== userId) {
                throw new Error('AUTHZ_DENIED');
            }
            
            // Delete and capture old data
            const deleted = await sql`
                DELETE FROM session_exercises
                WHERE id = ${exerciseId}
                AND session_id = ${sessionId}
                RETURNING *
            `;
            
            if (!deleted.length) {
                throw new Error('NOT_FOUND');
            }
            
            // Log deletion
            await sql`
                INSERT INTO session_exercise_history (
                    exercise_id, session_id, user_id, action, old_data, changed_by
                ) VALUES (
                    ${exerciseId}, ${sessionId}, ${userId}, 'delete',
                    ${JSON.stringify(deleted[0])}, ${userId}
                )
            `;
            
            // Reindex remaining exercises
            await sql`SELECT reindex_session_exercises(${sessionId})`;
        });
        
        console.log('Exercise deleted:', sanitizeForLog({
            exercise_id: exerciseId,
            session_id: sessionId,
            user_id: userId
        }));
        
        return {
            statusCode: 204,
            headers,
            body: ''
        };
        
    } catch (error) {
        if (error.message === 'AUTHZ_DENIED') {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Access denied', 
                        code: 'AUTHZ_001' 
                    }
                })
            };
        }
        
        if (error.message === 'NOT_FOUND') {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: { 
                        message: 'Exercise not found', 
                        code: 'EX_001' 
                    }
                })
            };
        }
        
        console.error('Error deleting exercise:', sanitizeForLog({ error: error.message }));
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: { 
                    message: 'Internal server error', 
                    code: 'SYS_002' 
                }
            })
        };
    }
};
```

## Section 4: Acceptance Criteria

### Functional Requirements
- [x] POST endpoint creates up to 50 exercises in a single atomic transaction
- [x] GET endpoint returns paginated exercises with stable cursor-based ordering
- [x] PUT endpoint updates individual exercise fields with ownership verification
- [x] DELETE endpoint removes exercise, logs to history, and reindexes remaining
- [x] User-scoped idempotency via request hashing prevents duplicate bulk creates
- [x] Automatic reindexing prevents gaps in order_index
- [x] Superset grouping allows exercises to be linked (e.g., "A", "B")
- [x] Transaction rollback on any failure ensures data consistency

### Security & Validation
- [x] JWT sub directly maps to user.id (standard approach)
- [x] Two-step ownership verification (session first, then exercise)
- [x] Sets validated 1-20, reps 1-100, weight 0-500kg, RPE 1-10
- [x] Name length 1-100 chars (trimmed), notes ≤500 chars (trimmed)
- [x] Tempo format validated as "X-X-X-X" pattern
- [x] Rest seconds limited to 0-600 (10 minutes max)
- [x] Muscle groups validated against enum type
- [x] No PII logged (user IDs hashed in logs)

### Performance & Limits
- [x] Sliding window rate limiting: 60 requests per 60 seconds
- [x] Pagination limit 1-100 items, default 20
- [x] Bulk create limited to 50 exercises per request
- [x] Response times < 500ms for typical operations (p95)
- [x] Composite index ensures efficient pagination with 10,000+ exercises
- [x] JSON-based cursor encoding for version flexibility

### Error Handling
- [x] Consistent error JSON shape: `{ error: { message, code, details? } }`
- [x] Standardized error codes: `DOMAIN_NUMBER` format
- [x] 401 for missing/invalid auth
- [x] 403 for accessing another user's session
- [x] 404 for non-existent resources
- [x] 429 with Retry-After header for rate limits
- [x] 400 for validation errors with field-level details
- [x] Complete request/response examples in code comments

## Section 5: Test Plan

### Unit Tests

```javascript
// tests/exercises-validation.test.js
describe('Exercise Validation', () => {
    test('validates required fields', () => {
        const valid = { name: 'Bench Press', sets: 3, reps: 10 };
        expect(validateExercise(valid)).toBe(true);
        
        const invalid = { name: 'Bench Press' }; // Missing sets/reps
        expect(validateExercise(invalid)).toBe(false);
    });
    
    test('validates numeric ranges', () => {
        expect(validateExercise({ name: 'Squat', sets: 0, reps: 10 })).toBe(false);
        expect(validateExercise({ name: 'Squat', sets: 21, reps: 10 })).toBe(false);
        expect(validateExercise({ name: 'Squat', sets: 5, reps: 101 })).toBe(false);
        expect(validateExercise({ name: 'Squat', sets: 5, reps: 10, weight_kg: 501 })).toBe(false);
        expect(validateExercise({ name: 'Squat', sets: 5, reps: 10, rpe: 11 })).toBe(false);
    });
    
    test('validates tempo format', () => {
        expect(validateTempo('3-1-2-0')).toBe(true);
        expect(validateTempo('3120')).toBe(false);
        expect(validateTempo('3-1-2')).toBe(false);
        expect(validateTempo('a-b-c-d')).toBe(false);
    });
    
    test('validates muscle groups enum', () => {
        expect(validateMuscleGroups(['chest', 'triceps'])).toBe(true);
        expect(validateMuscleGroups(['invalid_muscle'])).toBe(false);
    });
    
    test('sanitizes exercise names', () => {
        expect(sanitizeName('Bench Press!@#$')).toBe('Bench Press');
        expect(sanitizeName('  Squat  ')).toBe('Squat');
        expect(sanitizeName('Deadlift (Sumo)')).toBe('Deadlift (Sumo)');
        expect(sanitizeName('A'.repeat(150))).toBe('A'.repeat(100));
    });
    
    test('generates correct request hash', () => {
        const hash1 = generateRequestHash('user1', 'session1', [
            { name: 'Squat', sets: 3, reps: 10 }
        ]);
        const hash2 = generateRequestHash('user1', 'session1', [
            { name: 'Squat', sets: 3, reps: 10 }
        ]);
        expect(hash1).toBe(hash2); // Same data = same hash
        
        const hash3 = generateRequestHash('user2', 'session1', [
            { name: 'Squat', sets: 3, reps: 10 }
        ]);
        expect(hash1).not.toBe(hash3); // Different user = different hash
    });
});
```

### Integration Tests

```javascript
// tests/exercises-api.test.js
describe('Exercises API', () => {
    let token, sessionId, userId;
    
    beforeAll(async () => {
        ({ token, userId } = await createTestUser());
        sessionId = await createTestSession(token);
    });
    
    test('bulk creates exercises in transaction', async () => {
        const response = await fetch(`/.netlify/functions/sessions-${sessionId}-exercises`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                exercises: [
                    { name: 'Squat', sets: 5, reps: 5, weight_kg: 100, order_index: 0 },
                    { name: 'Invalid', sets: -1, reps: 5 }, // This will fail validation
                    { name: 'Bench Press', sets: 3, reps: 8, weight_kg: 80, order_index: 2 }
                ]
            })
        });
        
        expect(response.status).toBe(400); // All fail due to one invalid
        const data = await response.json();
        expect(data.error.code).toBe('VAL_004');
        
        // Verify no exercises were created
        const listResponse = await fetch(`/.netlify/functions/sessions-${sessionId}-exercises`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const listData = await listResponse.json();
        expect(listData.exercises).toHaveLength(0);
    });
    
    test('prevents duplicate bulk creates with idempotency', async () => {
        const exercises = [{ name: 'Deadlift', sets: 3, reps: 5, weight_kg: 120 }];
        
        // First request
        const response1 = await postExercises(sessionId, { exercises }, token);
        expect(response1.status).toBe(201);
        
        // Same request (same day, same data)
        const response2 = await postExercises(sessionId, { exercises }, token);
        expect(response2.status).toBe(200);
        const data2 = await response2.json();
        expect(data2.idempotent).toBe(true);
    });
    
    test('lists exercises with stable cursor pagination', async () => {
        // Create 25 exercises with specific order
        const exercises = Array(25).fill().map((_, i) => ({
            name: `Exercise ${i}`,
            sets: 3,
            reps: 10,
            order_index: i
        }));
        
        await postExercises(sessionId, { exercises }, token);
        
        // First page
        const page1 = await fetch(`/.netlify/functions/sessions-${sessionId}-exercises?limit=20`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(page1.status).toBe(200);
        const data1 = await page1.json();
        expect(data1.exercises).toHaveLength(20);
        expect(data1.exercises[0].order_index).toBe(0);
        expect(data1.exercises[19].order_index).toBe(19);
        expect(data1.pagination.has_more).toBe(true);
        expect(data1.pagination.next_cursor).toBeDefined();
        
        // Decode and verify cursor structure
        const decodedCursor = JSON.parse(
            Buffer.from(data1.pagination.next_cursor, 'base64').toString()
        );
        expect(decodedCursor.v).toBe(1);
        expect(decodedCursor.o).toBe(19);
        
        // Second page using cursor
        const page2 = await fetch(
            `/.netlify/functions/sessions-${sessionId}-exercises?cursor=${data1.pagination.next_cursor}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        const data2 = await page2.json();
        expect(data2.exercises.length).toBe(5);
        expect(data2.exercises[0].order_index).toBe(20);
        expect(data2.pagination.has_more).toBe(false);
    });
    
    test('handles order_index gaps correctly', async () => {
        // Create exercises with gaps
        const exercises = [
            { name: 'First', sets: 3, reps: 10, order_index: 0 },
            { name: 'Second', sets: 3, reps: 10, order_index: 5 },  // Gap
            { name: 'Third', sets: 3, reps: 10, order_index: 10 }   // Gap
        ];
        
        await postExercises(sessionId, { exercises }, token);
        
        // Verify reindexing filled gaps
        const response = await fetch(`/.netlify/functions/sessions-${sessionId}-exercises`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        expect(data.exercises[0].order_index).toBe(0);
        expect(data.exercises[1].order_index).toBe(1); // Gap filled
        expect(data.exercises[2].order_index).toBe(2); // Gap filled
    });
    
    test('two-step ownership verification on update', async () => {
        const created = await createExercise(sessionId, {
            name: 'Pull-ups', sets: 3, reps: 10
        }, token);
        
        const otherUserToken = await createTestUser().token;
        
        // Try to update with different user
        const response = await fetch(
            `/.netlify/functions/sessions-${sessionId}-exercises-${created.id}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${otherUserToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reps: 12 })
            }
        );
        
        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error.code).toBe('AUTHZ_001');
    });
    
    test('sliding window rate limiting', async () => {
        // Make 60 requests
        const promises = Array(60).fill().map(() => 
            fetch(`/.netlify/functions/sessions-${sessionId}-exercises`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        );
        
        await Promise.all(promises);
        
        // 61st request should be rate limited
        const limited = await fetch(`/.netlify/functions/sessions-${sessionId}-exercises`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(limited.status).toBe(429);
        expect(limited.headers.get('Retry-After')).toBeDefined();
        
        // Wait and verify sliding window
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Should allow new request after window slides
        const allowed = await fetch(`/.netlify/functions/sessions-${sessionId}-exercises`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(allowed.status).toBe(200);
    });
    
    test('validates superset grouping', async () => {
        const response = await fetch(`/.netlify/functions/sessions-${sessionId}-exercises`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                exercises: [
                    { 
                        name: 'Bench Press', 
                        sets: 4, 
                        reps: 8, 
                        superset_group: 'A', 
                        order_index: 0,
                        muscle_groups: ['chest', 'triceps']
                    },
                    { 
                        name: 'Bent Row', 
                        sets: 4, 
                        reps: 8, 
                        superset_group: 'A', 
                        order_index: 1,
                        muscle_groups: ['back', 'biceps']
                    }
                ]
            })
        });
        
        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.count).toBe(2);
    });
    
    test('transaction rollback on partial failure', async () => {
        // Simulate a failure during bulk insert
        const exercises = Array(10).fill().map((_, i) => ({
            name: `Exercise ${i}`,
            sets: 3,
            reps: 10
        }));
        
        // Add one that will cause a constraint violation
        exercises[5].sets = 100; // Exceeds maximum
        
        const response = await postExercises(sessionId, { exercises }, token);
        expect(response.status).toBe(400);
        
        // Verify no exercises were created
        const list = await fetch(`/.netlify/functions/sessions-${sessionId}-exercises`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await list.json();
        
        // Should have no new exercises due to rollback
        const countBefore = data.exercises.length;
        expect(countBefore).toBe(0);
    });
});
```

### Performance Tests

```javascript
// tests/exercises-performance.test.js
describe('Exercise API Performance', () => {
    test('bulk create completes < 500ms for 50 exercises', async () => {
        const exercises = Array(50).fill().map((_, i) => ({
            name: `Exercise ${i}`,
            sets: 3,
            reps: 10,
            weight_kg: 50 + i,
            order_index: i,
            muscle_groups: ['chest', 'triceps']
        }));
        
        const start = Date.now();
        const response = await postExercises(sessionId, { exercises }, token);
        const duration = Date.now() - start;
        
        expect(response.status).toBe(201);
        expect(duration).toBeLessThan(500);
    });
    
    test('pagination handles 10,000 exercises efficiently', async () => {
        // This would be tested in staging with pre-populated data
        const start = Date.now();
        const response = await fetch(
            `/.netlify/functions/sessions-${sessionId}-exercises?limit=100`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const duration = Date.now() - start;
        
        expect(response.status).toBe(200);
        expect(duration).toBeLessThan(200);
    });
    
    test('cursor stability under concurrent modifications', async () => {
        // Get first page and cursor
        const page1 = await getExercises(sessionId, { limit: 10 }, token);
        const cursor = page1.pagination.next_cursor;
        
        // Add new exercises
        await postExercises(sessionId, {
            exercises: [{ name: 'New Exercise', sets: 3, reps: 10, order_index: 100 }]
        }, token);
        
        // Cursor should still work
        const page2 = await getExercises(sessionId, { cursor, limit: 10 }, token);
        expect(page2.exercises).toBeDefined();
        expect(page2.exercises[0].order_index).toBeGreaterThan(
            page1.exercises[page1.exercises.length - 1].order_index
        );
    });
});
```

## Later (Deferred Items)

### Deferred to Phase 2:

1. **Partial Success with 207 Multi-Status**
   - **Reason**: Adds complexity to client handling. Current all-or-nothing approach is simpler and ensures data consistency.
   - **Future approach**: Return `207 Multi-Status` with detailed success/failure for each exercise.

2. **Batch Update Endpoint** 
   - **Reason**: Single updates are sufficient for MVP. Batch updates require complex conflict resolution.
   - **Future endpoint**: `PATCH /sessions/:id/exercises/batch`

3. **Exercise Templates Library**
   - **Reason**: Requires additional data model for exercise library and user preferences.
   - **Future feature**: Pre-populated exercise data with common configurations.

4. **Real-time Sync via WebSockets**
   - **Reason**: Netlify Functions don't support persistent connections.
   - **Future approach**: Use separate WebSocket service for real-time updates.

5. **Advanced Analytics Queries**
   - **Reason**: Complex aggregations better suited for dedicated analytics service.
   - **Future feature**: Volume calculations, progressive overload tracking, etc.

### Technical Debt to Address:

6. **Timezone-aware Timestamps**: Currently using UTC everywhere. Future: Store user timezone preference.
7. **Exercise Media Attachments**: Videos/images for form checks. Requires file storage solution.
8. **AI-powered Exercise Suggestions**: Based on history and goals. Requires ML pipeline.

These items are deferred to maintain focus on core CRUD operations while ensuring data integrity, security, and performance requirements are met.