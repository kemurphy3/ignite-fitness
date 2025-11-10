const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

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

// JWT verification with admin role check
function verifyAdminJWT(headers) {
    const authHeader = headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'MISSING_TOKEN', statusCode: 401 };
    }

    const token = authHeader.substring(7);

    try {
        const jwtSecret = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-at-least-32-characters';
        const decoded = jwt.verify(token, jwtSecret, {
            algorithms: ['HS256'],
            maxAge: '24h',
            clockTolerance: 30
        });

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

exports.handler = async (event) => {
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return okPreflight();
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return methodNotAllowed();
    }

    try {
        // Verify JWT authentication and admin role
        const authResult = verifyAdminJWT(event.headers);
        if (!authResult.success) {
            if (authResult.statusCode === 403) {
                return forbidden(authResult.error);
            }
            return unauthorized(authResult.error);
        }
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
            timestamp: new Date().toISOString(),
            requestedBy: authResult.userId,
            testMode: true
        });
    } catch (error) {
        console.error('Database connection test error:', {
            type: error.name,
            message: error.message,
            timestamp: new Date().toISOString()
        });
        return {
            statusCode: 500,
            headers: securityHeaders,
            body: JSON.stringify({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Database connection failed',
                code: 'DATABASE_ERROR',
                details: error.message
            })
        };
    }
};
