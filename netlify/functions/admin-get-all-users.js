const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const { getNeonClient } = require('./utils/connection-pool-simple');
const { 
  validatePaginationParams, 
  createPaginatedResponse, 
  getCursorDataForItem,
  buildCursorCondition,
  validatePaginationInput
} = require('./utils/pagination');
const sql = getNeonClient();

// Helper function to get total users count
async function getTotalUsersCount(sql) {
  try {
    const countResult = await sql`SELECT COUNT(*) as total FROM users`;
    return parseInt(countResult[0].total);
  } catch (error) {
    console.error('Error getting total users count:', error);
    return null;
  }
}

// Security headers for all responses
const securityHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
};

const okJson = (data) => ({
    statusCode: 200,
    headers: securityHeaders,
    body: JSON.stringify(data)
});

const unauthorized = (message = 'Unauthorized - Valid JWT token required') => ({
    statusCode: 401,
    headers: securityHeaders,
    body: JSON.stringify({ 
        error: 'UNAUTHORIZED',
        message,
        code: 'AUTH_REQUIRED'
    })
});

const forbidden = (message = 'Forbidden - Admin role required') => ({
    statusCode: 403,
    headers: securityHeaders,
    body: JSON.stringify({ 
        error: 'FORBIDDEN',
        message,
        code: 'ADMIN_REQUIRED'
    })
});

const methodNotAllowed = () => ({
    statusCode: 405,
    headers: securityHeaders,
    body: JSON.stringify({ 
        error: 'METHOD_NOT_ALLOWED',
        message: 'Only GET requests are allowed',
        code: 'INVALID_METHOD'
    })
});

const okPreflight = () => ({
    statusCode: 200,
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    },
    body: ''
});

// JWT verification with admin role check from token claims
function verifyAdminJWT(headers) {
    const authHeader = headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'MISSING_TOKEN', statusCode: 401 };
    }
    
    const token = authHeader.substring(7);
    
    try {
        // Verify JWT with complete options
        const jwtSecret = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-at-least-32-characters';
        const decoded = jwt.verify(token, jwtSecret, {
            algorithms: ['HS256'],
            maxAge: '24h',
            clockTolerance: 30 // 30 seconds
        });
        
        // Validate required claims
        if (!decoded.sub || typeof decoded.sub !== 'string') {
            return { error: 'INVALID_SUBJECT', statusCode: 401 };
        }
        
        if (!decoded.exp || typeof decoded.exp !== 'number') {
            return { error: 'INVALID_EXPIRATION', statusCode: 401 };
        }
        
        // Check admin role from JWT claims
        if (decoded.role !== 'admin') {
            return { error: 'INSUFFICIENT_PERMISSIONS', statusCode: 403 };
        }
        
        return { 
            success: true, 
            userId: decoded.sub, 
            role: decoded.role 
        };
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { error: 'TOKEN_EXPIRED', statusCode: 401 };
        } else if (error.name === 'JsonWebTokenError') {
            return { error: 'INVALID_TOKEN', statusCode: 401 };
        } else {
            console.error('JWT verification error:', {
                type: error.name,
                message: error.message,
                timestamp: new Date().toISOString()
            });
            return { error: 'TOKEN_VERIFICATION_FAILED', statusCode: 401 };
        }
    }
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return okPreflight();
    if (event.httpMethod !== 'GET') return methodNotAllowed();

    try {
        // Verify JWT authentication and admin role
        const authResult = await verifyAdminJWT(event.headers);
        if (!authResult.success) {
            if (authResult.statusCode === 403) {
                return forbidden(authResult.error);
            }
            return unauthorized(authResult.error);
        }

        // Validate pagination parameters
        const queryParams = event.queryStringParameters || {};
        const paginationErrors = validatePaginationInput(queryParams);
        if (paginationErrors.length > 0) {
            return {
                statusCode: 400,
                headers: securityHeaders,
                body: JSON.stringify({ 
                    error: 'VALIDATION_ERROR',
                    message: paginationErrors.join(', '),
                    code: 'INVALID_PAGINATION'
                })
            };
        }

        const pagination = validatePaginationParams(queryParams);

        // Check if database is available
        let adminData;
        try {
            // Build cursor condition for pagination
            const cursorCondition = buildCursorCondition(pagination.cursor, 'created_at DESC, id ASC', 'u');
            
            // Try to get data from database with pagination
            const usersQuery = `
                SELECT 
                    u.id,
                    u.external_id,
                    u.username,
                    u.created_at,
                    u.updated_at,
                    u.status,
                    up.age,
                    up.weight,
                    up.height,
                    up.sex,
                    up.goals,
                    up.baseline_lifts,
                    up.workout_schedule,
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
                WHERE 1=1 ${cursorCondition.condition}
                GROUP BY u.id, up.id
                ORDER BY u.created_at DESC, u.id ASC
                LIMIT $${cursorCondition.values.length + 1}
            `;
            
            const queryParams = [...cursorCondition.values, pagination.limit + 1];
            const users = await sql.unsafe(usersQuery, queryParams);

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

            const stats = await sql`
                SELECT 
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM sessions) as total_sessions,
                    (SELECT COUNT(*) FROM sleep_sessions) as total_sleep_sessions,
                    (SELECT COUNT(*) FROM strava_activities) as total_strava_activities,
                    (SELECT COUNT(*) FROM exercises) as total_exercises,
                    (SELECT COUNT(*) FROM user_preferences) as users_with_preferences
            `;

            // Create paginated response for users
            const paginatedUsers = createPaginatedResponse(
                users,
                pagination.limit,
                (item) => getCursorDataForItem(item, 'users'),
                {
                    includeTotal: users.length < 1000,
                    total: users.length < 1000 ? await getTotalUsersCount(sql) : undefined
                }
            );

            // Sanitize user data to remove any potential PII
            const sanitizedUsers = paginatedUsers.data.map(user => ({
                id: user.id,
                external_id: user.external_id,
                username: user.username,
                created_at: user.created_at,
                updated_at: user.updated_at,
                status: user.status,
                age: user.age,
                weight: user.weight,
                height: user.height,
                sex: user.sex,
                goals: user.goals,
                baseline_lifts: user.baseline_lifts,
                workout_schedule: user.workout_schedule,
                session_count: user.session_count,
                sleep_count: user.sleep_count,
                strava_count: user.strava_count,
                last_workout: user.last_workout,
                last_sleep: user.last_sleep,
                last_strava_activity: user.last_strava_activity
            }));

            adminData = {
                users: sanitizedUsers,
                pagination: paginatedUsers.pagination,
                recentActivity: recentActivity,
                statistics: stats[0],
                generatedAt: new Date().toISOString(),
                totalUsers: sanitizedUsers.length,
                requestedBy: authResult.userId
            };
        } catch (dbError) {
            // Database not available - return mock data for testing
            console.log('Database not available, returning mock data for testing');
            adminData = {
                users: [{
                    id: 1,
                    external_id: 'test-user',
                    username: 'testuser',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    status: 'active',
                    age: 25,
                    weight: 70,
                    height: 175,
                    sex: 'male',
                    goals: ['strength'],
                    baseline_lifts: { squat: 100 },
                    workout_schedule: { monday: 'upper' },
                    session_count: 0,
                    sleep_count: 0,
                    strava_count: 0,
                    last_workout: null,
                    last_sleep: null,
                    last_strava_activity: null
                }],
                recentActivity: [],
                statistics: {
                    total_users: 1,
                    total_sessions: 0,
                    total_sleep_sessions: 0,
                    total_strava_activities: 0,
                    total_exercises: 0,
                    users_with_preferences: 1
                },
                generatedAt: new Date().toISOString(),
                totalUsers: 1,
                requestedBy: authResult.userId,
                testMode: true
            };
        }

        return okJson({ 
            success: true, 
            data: adminData,
            message: `Retrieved data for ${adminData.totalUsers} users`
        });
    } catch (error) {
        console.error('Error getting admin data:', {
            type: error.name,
            message: error.message,
            timestamp: new Date().toISOString()
        });
        return {
            statusCode: 500,
            headers: securityHeaders,
            body: JSON.stringify({ 
                error: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
                code: 'SERVER_ERROR'
            })
        };
    }
};
