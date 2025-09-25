// GET /api/admin/health - System health with proper auth
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const { 
  verifyAdmin, 
  auditLog, 
  errorResponse, 
  withTimeout,
  successResponse 
} = require('./utils/admin-auth');

const sql = neon(process.env.DATABASE_URL);

exports.handler = async (event) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    await sql`SET statement_timeout = '5s'`;
    
    // Auth required even for health check
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', requestId);
    }
    
    const { adminId } = await verifyAdmin(token, requestId);
    
    // Database checks
    const dbCheck = await withTimeout(async () => {
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
          stale: v.seconds_stale > 3600 // Flag if > 1 hour
        }))
      },
      integrations: {
        strava: {
          last_import: stravaStatus[0]?.last_import || null,
          active_imports: stravaStatus[0]?.active_imports || 0
        }
      },
      config: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0'
      }
    };
    
    await auditLog(adminId, '/admin/health', 'GET', {}, 200, Date.now() - startTime, requestId);
    
    return successResponse(
      health,
      {
        response_time_ms: Date.now() - startTime
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
        'X-Request-ID': requestId
      },
      body: JSON.stringify({
        status: 'degraded',
        data: {
          database: { connected: false },
          error: 'Database connection failed'
        },
        meta: {
          request_id: requestId,
          generated_at: new Date().toISOString()
        }
      })
    };
  }
};
