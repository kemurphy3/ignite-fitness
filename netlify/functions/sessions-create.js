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
    if (event.httpMethod !== 'POST') return methodNotAllowed();

    try {
        const { userId, type, source = 'manual', sourceId = null, startAt, endAt, timezone = 'America/Denver', payload } = JSON.parse(event.body || '{}');
        
        if (!userId || !type || !startAt || !endAt) {
            return badReq('Missing required fields: userId, type, startAt, endAt');
        }

        // Upsert user row by external_id
        const user = await sql`
            INSERT INTO users (external_id, username) 
            VALUES (${userId}, ${userId})
            ON CONFLICT (external_id) DO UPDATE SET external_id = EXCLUDED.external_id
            RETURNING id
        `;
        const user_id = user[0].id;

        // Insert session
        const rows = await sql`
            INSERT INTO sessions (user_id, type, source, source_id, start_at, end_at, timezone, payload)
            VALUES (${user_id}, ${type}, ${source}, ${sourceId}, ${startAt}, ${endAt}, ${timezone}, ${payload ? JSON.stringify(payload) : null})
            RETURNING *
        `;

        return okJson({ success: true, session: rows[0] });
    } catch (error) {
        console.error('Error creating session:', error);
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
