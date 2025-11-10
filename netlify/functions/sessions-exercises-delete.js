// DELETE /sessions/:sessionId/exercises/:exerciseId - Delete with History
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
    const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

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

            // Check if exercise exists and belongs to user's session (idempotency)
            const exerciseCheck = await sql`
                SELECT id FROM session_exercises
                WHERE id = ${exerciseId}
                AND session_id = ${sessionId}
            `;

            if (!exerciseCheck.length) {
                // Exercise doesn't exist - idempotent success
                return {
                    statusCode: 204,
                    headers,
                    body: ''
                };
            }

            // Delete and capture old data - verify exercise belongs to user's session
            const deleted = await sql`
                DELETE FROM session_exercises
                WHERE id = ${exerciseId}
                AND session_id = ${sessionId}
                AND session_id IN (SELECT id FROM sessions WHERE user_id = ${userId})
                RETURNING *
            `;

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
