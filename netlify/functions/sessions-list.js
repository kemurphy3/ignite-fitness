const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const okJson = (data) => ({
    statusCode: 200,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: JSON.stringify(data)
});

const badReq = (message) => ({
    statusCode: 400,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: message })
});

const methodNotAllowed = () => ({
    statusCode: 405,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: 'Method not allowed' })
});

const okPreflight = () => ({
    statusCode: 200,
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: ''
});

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return okPreflight();
    if (event.httpMethod !== 'GET') return methodNotAllowed();

    try {
        const { userId, type, limit = 50, offset = 0 } = event.queryStringParameters || {};
        
        if (!userId) {
            return badReq('Missing required parameter: userId');
        }

        let query = sql`
            SELECT s.*, e.name as exercise_name, e.weight, e.reps, e.sets, e.rpe, e.notes as exercise_notes
            FROM sessions s
            LEFT JOIN exercises e ON s.id = e.session_id
            WHERE s.user_id = (SELECT id FROM users WHERE external_id = ${userId})
        `;

        if (type) {
            query = sql`
                SELECT s.*, e.name as exercise_name, e.weight, e.reps, e.sets, e.rpe, e.notes as exercise_notes
                FROM sessions s
                LEFT JOIN exercises e ON s.id = e.session_id
                WHERE s.user_id = (SELECT id FROM users WHERE external_id = ${userId})
                AND s.type = ${type}
            `;
        }

        query = sql`
            ${query}
            ORDER BY s.start_at DESC
            LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;

        const sessions = await query;

        // Group exercises by session
        const sessionMap = {};
        sessions.forEach(row => {
            if (!sessionMap[row.id]) {
                sessionMap[row.id] = {
                    id: row.id,
                    type: row.type,
                    source: row.source,
                    source_id: row.source_id,
                    start_at: row.start_at,
                    end_at: row.end_at,
                    timezone: row.timezone,
                    payload: row.payload,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    exercises: []
                };
            }
            
            if (row.exercise_name) {
                sessionMap[row.id].exercises.push({
                    name: row.exercise_name,
                    weight: row.weight,
                    reps: row.reps,
                    sets: row.sets,
                    rpe: row.rpe,
                    notes: row.exercise_notes
                });
            }
        });

        const result = Object.values(sessionMap);

        return okJson({ 
            success: true, 
            sessions: result,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: result.length
            }
        });
    } catch (error) {
        console.error('Error listing sessions:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
