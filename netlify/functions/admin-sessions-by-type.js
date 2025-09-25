// GET /api/admin/sessions/by-type - Distribution of session types with privacy protection
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
    
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', requestId);
    }
    
    const { adminId } = await verifyAdmin(token, requestId);
    
    const { from, to } = event.queryStringParameters || {};
    
    // Build date filter
    let whereConditions = ['deleted_at IS NULL'];
    const params = [];
    
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate)) {
        whereConditions.push(`created_at >= $${params.length + 1}`);
        params.push(fromDate);
      }
    }
    
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate)) {
        whereConditions.push(`created_at <= $${params.length + 1}`);
        params.push(toDate);
      }
    }
    
    // Get distribution with privacy thresholds
    const distribution = await withTimeout(async () => {
      return await sql`
        WITH type_counts AS (
          SELECT 
            COALESCE(session_type, 'unspecified') as session_type,
            COUNT(*) as count,
            COUNT(DISTINCT user_id) as unique_users
          FROM sessions
          WHERE deleted_at IS NULL
            ${from ? sql`AND created_at >= ${new Date(from)}` : sql``}
            ${to ? sql`AND created_at <= ${new Date(to)}` : sql``}
          GROUP BY session_type
        ),
        totals AS (
          SELECT SUM(count) as total FROM type_counts
        )
        SELECT 
          tc.session_type,
          tc.count,
          ROUND(tc.count::numeric / NULLIF(t.total, 0) * 100, 1) as percentage,
          CASE 
            WHEN tc.unique_users < 5 THEN NULL
            ELSE tc.unique_users
          END as unique_users,
          tc.unique_users >= 5 as meets_privacy_threshold
        FROM type_counts tc
        CROSS JOIN totals t
        ORDER BY tc.count DESC
      `;
    });
    
    const total = distribution.reduce((sum, row) => sum + row.count, 0);
    const privacyApplied = distribution.some(row => !row.meets_privacy_threshold);
    
    await auditLog(adminId, '/admin/sessions/by-type', 'GET', 
      { from, to }, 200, Date.now() - startTime, requestId);
    
    return successResponse(
      {
        distribution: distribution.map(row => ({
          session_type: row.session_type,
          count: row.count,
          percentage: row.percentage,
          unique_users: row.unique_users
        })),
        total
      },
      {
        privacy_applied: privacyApplied,
        privacy_threshold: 5,
        response_time_ms: Date.now() - startTime
      },
      requestId,
      'private, max-age=300'
    );
    
  } catch (error) {
    const statusCode = error.message.includes('Authentication') ? 401 :
                      error.message.includes('Admin') ? 403 :
                      error.message.includes('Query timeout') ? 500 : 500;
    
    await auditLog(null, '/admin/sessions/by-type', 'GET', 
      event.queryStringParameters, statusCode, Date.now() - startTime, requestId);
    
    if (error.message.includes('Authentication failed')) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }
    if (error.message.includes('Admin access')) {
      return errorResponse(403, 'FORBIDDEN', 'Admin access required', requestId);
    }
    if (error.message.includes('Query timeout')) {
      return errorResponse(500, 'QUERY_TIMEOUT', 'Query exceeded timeout limit', requestId);
    }
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to retrieve session distribution', requestId);
  }
};
