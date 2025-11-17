// GET /api/admin/sessions/by-type - Distribution of session types with privacy protection
// const { neon } = require('@neondatabase/serverless'); // Unused - using getNeonClient instead
const crypto = require('crypto');
const { auditLog, errorResponse, withTimeout, successResponse } = require('./utils/admin-auth');

const { safeQuery, validateBucket: _validateBucket } = require('./utils/safe-query');

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

    const { from, to } = event.queryStringParameters || {};

    // Validate and parse date parameters safely
    let fromDate = null;
    let toDate = null;

    if (from) {
      fromDate = new Date(from);
      if (isNaN(fromDate)) {
        return errorResponse(400, 'INVALID_DATE', 'Invalid from date format', requestId);
      }
    }

    if (to) {
      toDate = new Date(to);
      if (isNaN(toDate)) {
        return errorResponse(400, 'INVALID_DATE', 'Invalid to date format', requestId);
      }
    }

    // Get distribution with privacy thresholds using safe parameterized queries
    const distribution = await withTimeout(async () => {
      return await safeQuery(async () => {
        if (fromDate && toDate) {
          return await sql`
            WITH type_counts AS (
              SELECT 
                COALESCE(session_type, 'unspecified') as session_type,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users
              FROM sessions
              WHERE deleted_at IS NULL
                AND created_at >= ${fromDate}
                AND created_at <= ${toDate}
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
        } else if (fromDate) {
          return await sql`
            WITH type_counts AS (
              SELECT 
                COALESCE(session_type, 'unspecified') as session_type,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users
              FROM sessions
              WHERE deleted_at IS NULL
                AND created_at >= ${fromDate}
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
        } else if (toDate) {
          return await sql`
            WITH type_counts AS (
              SELECT 
                COALESCE(session_type, 'unspecified') as session_type,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users
              FROM sessions
              WHERE deleted_at IS NULL
                AND created_at <= ${toDate}
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
        } else {
          return await sql`
            WITH type_counts AS (
              SELECT 
                COALESCE(session_type, 'unspecified') as session_type,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users
              FROM sessions
              WHERE deleted_at IS NULL
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
        }
      });
    });

    const total = distribution.reduce((sum, row) => sum + row.count, 0);
    const privacyApplied = distribution.some(row => !row.meets_privacy_threshold);

    await auditLog(
      adminId,
      '/admin/sessions/by-type',
      'GET',
      { from, to },
      200,
      Date.now() - startTime,
      requestId
    );

    return successResponse(
      {
        distribution: distribution.map(row => ({
          session_type: row.session_type,
          count: row.count,
          percentage: row.percentage,
          unique_users: row.unique_users,
        })),
        total,
      },
      {
        privacy_applied: privacyApplied,
        privacy_threshold: 5,
        response_time_ms: Date.now() - startTime,
      },
      requestId,
      'private, max-age=300'
    );
  } catch (error) {
    const statusCode = error.message.includes('Authentication')
      ? 401
      : error.message.includes('Admin')
        ? 403
        : error.message.includes('Query timeout')
          ? 500
          : 500;

    await auditLog(
      null,
      '/admin/sessions/by-type',
      'GET',
      event.queryStringParameters,
      statusCode,
      Date.now() - startTime,
      requestId
    );

    if (error.message.includes('Authentication failed')) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }
    if (error.message.includes('Admin access')) {
      return errorResponse(403, 'FORBIDDEN', 'Admin access required', requestId);
    }
    if (error.message.includes('Query timeout')) {
      return errorResponse(500, 'QUERY_TIMEOUT', 'Query exceeded timeout limit', requestId);
    }
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'Failed to retrieve session distribution',
      requestId
    );
  }
};
