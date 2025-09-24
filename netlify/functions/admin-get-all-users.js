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

const unauthorized = () => ({
    statusCode: 401,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: 'Unauthorized - Admin access required' })
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
        // Simple admin check - in production, use proper authentication
        const { adminKey } = event.queryStringParameters || {};
        if (adminKey !== 'ignitefitness_admin_2024') {
            return unauthorized();
        }

        // Get all users with their data
        const users = await sql`
            SELECT 
                u.*,
                up.age, up.weight, up.height, up.sex, up.goals, up.baseline_lifts, up.workout_schedule,
                COUNT(DISTINCT s.id) as session_count,
                COUNT(DISTINCT sl.id) as sleep_count,
                COUNT(DISTINCT sa.id) as strava_count,
                MAX(s.start_at) as last_workout,
                MAX(sl.start_at) as last_sleep,
                MAX(sa.start_date) as last_strava_activity
            FROM users u
            LEFT JOIN user_preferences up ON u.id = up.user_id
            LEFT JOIN sessions s ON u.id = s.user_id
            LEFT JOIN sleep_sessions sl ON u.id = sl.user_id
            LEFT JOIN strava_activities sa ON u.id = sa.user_id
            GROUP BY u.id, up.id
            ORDER BY u.created_at DESC
        `;

        // Get recent activity summary
        const recentActivity = await sql`
            SELECT 
                u.external_id,
                u.username,
                s.type,
                COUNT(*) as count,
                MAX(s.start_at) as last_activity
            FROM users u
            JOIN sessions s ON u.id = s.user_id
            WHERE s.start_at >= NOW() - INTERVAL '7 days'
            GROUP BY u.external_id, u.username, s.type
            ORDER BY last_activity DESC
        `;

        // Get database statistics
        const stats = await sql`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM sessions) as total_sessions,
                (SELECT COUNT(*) FROM sleep_sessions) as total_sleep_sessions,
                (SELECT COUNT(*) FROM strava_activities) as total_strava_activities,
                (SELECT COUNT(*) FROM exercises) as total_exercises,
                (SELECT COUNT(*) FROM user_preferences) as users_with_preferences
        `;

        const adminData = {
            users: users,
            recentActivity: recentActivity,
            statistics: stats[0],
            generatedAt: new Date().toISOString(),
            totalUsers: users.length
        };

        return okJson({ 
            success: true, 
            data: adminData,
            message: `Retrieved data for ${users.length} users`
        });
    } catch (error) {
        console.error('Error getting admin data:', error);
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
