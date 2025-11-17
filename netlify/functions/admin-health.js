// GET /api/admin/health - System health with proper auth
// const { neon } = require('@neondatabase/serverless'); // Unused - using getNeonClient instead
const crypto = require('crypto');
const { auditLog, errorResponse, withTimeout, successResponse } = require('./utils/admin-auth');

const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

exports.handler = async event => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    await sql`SET statement_timeout = '5s'`;

    // JWT Authentication Check - MUST BE FIRST
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Authentication required',
          message: 'Admin endpoints require Bearer token authentication',
        }),
      };
    }

    const token = authHeader.substring(7);
    const { JWT_SECRET } = process.env;
    if (!JWT_SECRET) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    try {
      // Simple JWT verification without external dependencies
      const [header, payload, signature] = token.split('.');
      if (!header || !payload || !signature) {
        throw new Error('Invalid token format');
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64');
      if (signature !== expectedSignature) {
        throw new Error('Invalid token signature');
      }

      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());

      // Check expiration
      if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }

      // Check admin role
      if (decodedPayload.role !== 'admin') {
        throw new Error('Admin access required');
      }
    } catch (error) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Access denied',
          message: 'Invalid or expired admin token',
        }),
      };
    }

    const adminId = 'admin'; // Simplified for inline auth

    // Database checks
    const _dbCheck = await withTimeout(async () => {
      return await sql`SELECT NOW() as time, version() as version`;
    });

    const migrations = await sql`
      SELECT version, applied_at 
      FROM schema_migrations 
      ORDER BY applied_at DESC 
      LIMIT 1
    `;

    // Materialized view freshness
    const viewFreshness = await sql`
      SELECT view_name, last_refresh, row_version,
        EXTRACT(EPOCH FROM (NOW() - last_refresh)) as seconds_stale
      FROM mv_refresh_log
    `;

    // Strava status
    const stravaStatus = await sql`
      SELECT 
        MAX(last_run_at) as last_import,
        COUNT(*) FILTER (WHERE import_in_progress = true) as active_imports
      FROM integrations_strava
      WHERE last_run_at IS NOT NULL
    `;

    const health = {
      database: {
        connected: true,
        migrations_version: migrations[0]?.version || 'unknown',
        views_freshness: viewFreshness.map(v => ({
          view: v.view_name,
          last_refresh: v.last_refresh,
          seconds_stale: Math.round(v.seconds_stale),
          stale: v.seconds_stale > 3600, // Flag if > 1 hour
        })),
      },
      integrations: {
        strava: {
          last_import: stravaStatus[0]?.last_import || null,
          active_imports: stravaStatus[0]?.active_imports || 0,
        },
      },
      config: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
      },
    };

    await auditLog(adminId, '/admin/health', 'GET', {}, 200, Date.now() - startTime, requestId);

    return successResponse(
      health,
      {
        response_time_ms: Date.now() - startTime,
      },
      requestId,
      'no-store'
    );
  } catch (error) {
    // Auth errors return proper status
    if (error.message.includes('Authentication failed')) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }
    if (error.message.includes('Admin access')) {
      return errorResponse(403, 'FORBIDDEN', 'Admin access required', requestId);
    }

    // Database error returns degraded status
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({
        status: 'degraded',
        data: {
          database: { connected: false },
          error: 'Database connection failed',
        },
        meta: {
          request_id: requestId,
          generated_at: new Date().toISOString(),
        },
      }),
    };
  }
};
