// GET /sessions/:sessionId/exercises - List with Stable Pagination
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

// Helper to sanitize for logging
function sanitizeForLog(data) {
    const sanitized = { ...data };
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
        
        // Log sanitized action
        console.log('Exercises listed:', sanitizeForLog({
            session_id: sessionId,
            user_id: userId,
            count: returnExercises.length,
            has_more: hasMore
        }));
        
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
