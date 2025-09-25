// GET /api/admin/overview - Global platform metrics with privacy protection
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
    // Set query timeout
    await sql`SET statement_timeout = '5s'`;
    
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', requestId);
    }
    
    const { adminId } = await verifyAdmin(token, requestId);
    
    // Get metrics with privacy thresholds
    const metrics = await withTimeout(async () => {
      return await sql`
        WITH metrics AS (
          SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_7d
          FROM users 
          WHERE deleted_at IS NULL
        ),
        session_metrics AS (
          SELECT 
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as sessions_7d,
            COUNT(DISTINCT user_id) as total_unique_users,
            COUNT(DISTINCT CASE 
              WHEN created_at >= NOW() - INTERVAL '30 days' 
              THEN user_id 
            END) as active_users_30d
          FROM sessions 
          WHERE deleted_at IS NULL
        )
        SELECT 
          m.total_users,
          CASE 
            WHEN m.new_users_7d < 5 THEN NULL 
            ELSE m.new_users_7d 
          END as new_users_7d,
          s.total_sessions,
          s.sessions_7d,
          CASE 
            WHEN s.active_users_30d < 5 THEN NULL 
            ELSE s.active_users_30d 
          END as active_users_30d,
          ROUND(s.total_sessions::numeric / NULLIF(m.total_users, 0), 1) as avg_sessions_per_user
        FROM metrics m
        CROSS JOIN session_metrics s
      `;
    });
    
    // Get data freshness
    const freshness = await sql`
      SELECT view_name, last_refresh, row_version
      FROM mv_refresh_log
      WHERE view_name = 'mv_sessions_daily'
    `;
    
    await auditLog(adminId, '/admin/overview', 'GET', {}, 200, Date.now() - startTime, requestId);
    
    return successResponse(
      {
        ...metrics[0],
        last_updated: new Date().toISOString()
      },
      {
        cache_hit: false,
        response_time_ms: Date.now() - startTime,
        data_version: freshness[0] ? `mv_${freshness[0].row_version}` : 'live'
      },
      requestId
    );
    
  } catch (error) {
    await auditLog(null, '/admin/overview', 'GET', {}, 
      error.message.includes('Admin') ? 403 : 500, 
      Date.now() - startTime, requestId);
    
    if (error.message.includes('Authentication failed')) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }
    if (error.message.includes('Admin access')) {
      return errorResponse(403, 'FORBIDDEN', 'Admin access required', requestId);
    }
    if (error.message.includes('Query timeout')) {
      return errorResponse(500, 'QUERY_TIMEOUT', 'Query exceeded timeout limit', requestId);
    }
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to retrieve metrics', requestId);
  }
};
