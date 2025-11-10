const { neon } = require('@neondatabase/serverless');

const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

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
    if (event.httpMethod === 'OPTIONS') {return okPreflight();}
    if (event.httpMethod !== 'GET') {return methodNotAllowed();}

    try {
        const { userId } = event.queryStringParameters || {};

        if (!userId) {
            return badReq('Missing required parameter: userId');
        }

        // Get user by external_id
        const user = await sql`
            SELECT * FROM users WHERE external_id = ${userId}
        `;

        if (user.length === 0) {
            return okJson({
                success: true,
                data: null,
                message: 'User not found'
            });
        }

        const userId_db = user[0].id;

        // Get user preferences
        const preferences = await sql`
            SELECT * FROM user_preferences WHERE user_id = ${userId_db}
        `;

        // Get recent sessions (last 30 days)
        const sessions = await sql`
            SELECT s.*, e.name as exercise_name, e.weight, e.reps, e.sets, e.rpe, e.notes as exercise_notes
            FROM sessions s
            LEFT JOIN exercises e ON s.id = e.session_id
            WHERE s.user_id = ${userId_db}
            AND s.start_at >= NOW() - INTERVAL '30 days'
            ORDER BY s.start_at DESC
            LIMIT 100
        `;

        // Get sleep sessions (last 30 days)
        const sleepSessions = await sql`
            SELECT * FROM sleep_sessions 
            WHERE user_id = ${userId_db}
            AND start_at >= NOW() - INTERVAL '30 days'
            ORDER BY start_at DESC
            LIMIT 30
        `;

        // Get Strava activities (last 30 days)
        const stravaActivities = await sql`
            SELECT * FROM strava_activities 
            WHERE user_id = ${userId_db}
            AND start_date >= NOW() - INTERVAL '30 days'
            ORDER BY start_date DESC
            LIMIT 50
        `;

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

        const userData = {
            // Basic user info
            external_id: user[0].external_id,
            username: user[0].username,
            email: user[0].email,
            created_at: user[0].created_at,
            updated_at: user[0].updated_at,

            // User preferences
            preferences: preferences[0] || {},

            // Recent activity data
            sessions: Object.values(sessionMap),
            sleepSessions,
            stravaActivities,

            // Metadata
            dataRetrieved: new Date().toISOString(),
            recordCounts: {
                sessions: Object.keys(sessionMap).length,
                sleepSessions: sleepSessions.length,
                stravaActivities: stravaActivities.length
            }
        };

        return okJson({
            success: true,
            data: userData
        });
    } catch (error) {
        console.error('Error getting user data:', error);
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
