// POST /sessions/:sessionId/exercises - Bulk Create with Transaction
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Ajv = require('ajv');

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
    const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

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
