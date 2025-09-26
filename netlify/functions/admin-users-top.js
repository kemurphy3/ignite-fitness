// GET /api/admin/users/top - Top users with keyset pagination
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const { 
  verifyAdmin, 
  auditLog, 
  errorResponse, 
  decodeCursor,
  encodeCursor,
  withTimeout,
  successResponse 
} = require('./utils/admin-auth');

const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

exports.handler = async (event) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    await sql`SET statement_timeout = '5s'`;
    
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', requestId);
    }
    
    const { adminId } = await verifyAdmin(token, requestId);
    
    const { metric = 'sessions', limit = 50, cursor } = event.queryStringParameters || {};
    
    // Validate inputs
    if (!['sessions', 'duration'].includes(metric)) {
      return errorResponse(400, 'INVALID_METRIC', 'Metric must be sessions or duration', requestId);
    }
    
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    
    // Parse keyset cursor
    let lastValue = null;
    let lastId = null;
    if (cursor) {
      try {
        const decoded = decodeCursor(cursor);
        lastValue = decoded.value;
        lastId = decoded.id;
      } catch (e) {
        return errorResponse(400, 'INVALID_CURSOR', 'Invalid cursor format', requestId);
      }
    }
    
    // Keyset pagination query with privacy
    let users;
    if (metric === 'sessions') {
      users = await withTimeout(async () => {
        return await sql`
          WITH ranked_users AS (
            SELECT 
              user_id,
              SUBSTRING(MD5(user_id::text || ${process.env.HASH_SALT || 'default'}), 1, 8) as user_alias,
              COUNT(*) as metric_value,
              MAX(created_at) as last_active
            FROM sessions
            WHERE deleted_at IS NULL
              ${lastValue !== null ? sql`
                AND (COUNT(*), user_id) < (${lastValue}, ${lastId})
              ` : sql``}
            GROUP BY user_id
            HAVING COUNT(DISTINCT user_id) >= 5 OR user_id = ${adminId}
            ORDER BY COUNT(*) DESC, user_id DESC
            LIMIT ${parsedLimit + 1}
          )
          SELECT * FROM ranked_users
        `;
      });
    } else {
      users = await withTimeout(async () => {
        return await sql`
          WITH ranked_users AS (
            SELECT 
              user_id,
              SUBSTRING(MD5(user_id::text || ${process.env.HASH_SALT || 'default'}), 1, 8) as user_alias,
              SUM(duration_minutes) as metric_value,
              MAX(created_at) as last_active
            FROM sessions
            WHERE deleted_at IS NULL
              ${lastValue !== null ? sql`
                AND (SUM(duration_minutes), user_id) < (${lastValue}, ${lastId})
              ` : sql``}
            GROUP BY user_id
            HAVING COUNT(DISTINCT user_id) >= 5 OR user_id = ${adminId}
            ORDER BY SUM(duration_minutes) DESC, user_id DESC
            LIMIT ${parsedLimit + 1}
          )
          SELECT * FROM ranked_users
        `;
      });
    }
    
    // Check for next page
    let nextCursor = null;
    let results = users;
    if (users.length > parsedLimit) {
      results = users.slice(0, parsedLimit);
      const last = results[results.length - 1];
      nextCursor = encodeCursor(last.metric_value, last.user_alias);
    }
    
    // Add ranks (null for subsequent pages)
    const rankedResults = results.map((user, index) => ({
      user_alias: user.user_alias,
      metric_value: parseInt(user.metric_value),
      rank: cursor ? null : index + 1,
      last_active: user.last_active
    }));
    
    await auditLog(adminId, '/admin/users/top', 'GET', 
      { metric, limit: parsedLimit, cursor }, 200, Date.now() - startTime, requestId);
    
    return successResponse(
      {
        users: rankedResults,
        next_cursor: nextCursor
      },
      {
        metric,
        privacy_applied: false,
        total_filtered: 0,
        response_time_ms: Date.now() - startTime
      },
      requestId,
      'private, no-cache'
    );
    
  } catch (error) {
    const statusCode = error.message.includes('Authentication') ? 401 :
                      error.message.includes('Admin') ? 403 :
                      error.message.includes('Invalid') ? 400 :
                      error.message.includes('Query timeout') ? 500 : 500;
    
    await auditLog(null, '/admin/users/top', 'GET', 
      event.queryStringParameters, statusCode, Date.now() - startTime, requestId);
    
    if (error.message.includes('Authentication failed')) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }
    if (error.message.includes('Admin access')) {
      return errorResponse(403, 'FORBIDDEN', 'Admin access required', requestId);
    }
    if (error.message.includes('Invalid')) {
      return errorResponse(400, 'INVALID_PARAM', error.message, requestId);
    }
    if (error.message.includes('Query timeout')) {
      return errorResponse(500, 'QUERY_TIMEOUT', 'Query exceeded timeout limit', requestId);
    }
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to retrieve top users', requestId);
  }
};
