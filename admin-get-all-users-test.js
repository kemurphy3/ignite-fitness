/**
 * Test Version: Admin Get All Users
 * 
 * This version works without database access for testing JWT authentication.
 * It mocks the database response to focus on authentication testing.
 */

const jwt = require('jsonwebtoken');

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

// Mock database response for testing
function getMockAdminData() {
    return {
        users: [
            {
                id: 1,
                external_id: 'test-user-1',
                username: 'testuser1',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'active',
                age: 25,
                weight: 70,
                height: 175,
                sex: 'male',
                goals: ['strength', 'endurance'],
                baseline_lifts: { squat: 100, bench: 80, deadlift: 120 },
                workout_schedule: { monday: 'upper', wednesday: 'lower' },
                session_count: 15,
                sleep_count: 20,
                strava_count: 5,
                last_workout: new Date().toISOString(),
                last_sleep: new Date().toISOString(),
                last_strava_activity: new Date().toISOString()
            }
        ],
        recentActivity: [
            {
                external_id: 'test-user-1',
                username: 'testuser1',
                type: 'workout',
                count: 3,
                last_activity: new Date().toISOString()
            }
        ],
        statistics: {
            total_users: 1,
            total_sessions: 15,
            total_sleep_sessions: 20,
            total_strava_activities: 5,
            total_exercises: 45,
            users_with_preferences: 1
        }
    };
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return okPreflight();
    if (event.httpMethod !== 'GET') return methodNotAllowed();

    try {
        // Verify JWT authentication and admin role
        const authResult = verifyAdminJWT(event.headers);
        if (!authResult.success) {
            if (authResult.statusCode === 403) {
                return forbidden(authResult.error);
            }
            return unauthorized(authResult.error);
        }

        // Get mock admin data (no database required)
        const mockData = getMockAdminData();
        
        const adminData = {
            ...mockData,
            generatedAt: new Date().toISOString(),
            totalUsers: mockData.users.length,
            requestedBy: authResult.userId,
            testMode: true
        };

        return okJson({ 
            success: true, 
            data: adminData,
            message: `Retrieved data for ${mockData.users.length} users (test mode)`
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
