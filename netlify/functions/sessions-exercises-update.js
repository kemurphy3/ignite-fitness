// PUT /sessions/:sessionId/exercises/:exerciseId - Update with Ownership Check
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const Ajv = require('ajv');

// Validation schema (same as create)
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
        sanitized.user_hash = require('crypto').createHash('sha256')
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
