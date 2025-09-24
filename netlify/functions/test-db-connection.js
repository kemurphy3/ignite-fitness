const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const okJson = (data) => ({
    statusCode: 200,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(data)
});

exports.handler = async (event) => {
    try {
        // Test basic connection
        const result = await sql`SELECT NOW() as current_time, version() as postgres_version`;
        
        // Test if tables exist
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `;
        
        // Test user count
        const userCount = await sql`SELECT COUNT(*) as user_count FROM users`;
        
        return okJson({
            success: true,
            message: 'Database connection successful',
            database: {
                currentTime: result[0].current_time,
                postgresVersion: result[0].postgres_version,
                tables: tables.map(t => t.table_name),
                userCount: userCount[0].user_count
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: false,
                error: 'Database connection failed',
                details: error.message 
            })
        };
    }
};
