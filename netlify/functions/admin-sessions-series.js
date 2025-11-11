// GET /api/admin/sessions/series - Time series with proper timezone handling
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const {
  verifyAdmin,
  auditLog,
  errorResponse,
  validateDateRange,
  validateTimezone,
  withTimeout,
  successResponse,
} = require('./utils/admin-auth');

const { safeQuery, validateBucket } = require('./utils/safe-query');

const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

exports.handler = async event => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    await sql`SET statement_timeout = '5s'`;

    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', requestId);
    }

    const { adminId } = await verifyAdmin(token, requestId);

    const { from, to, bucket = 'day', timezone = 'UTC' } = event.queryStringParameters || {};

    // Validate required params
    if (!from || !to) {
      return errorResponse(400, 'MISSING_PARAMS', 'Parameters from and to are required', requestId);
    }

    // Validate date range, timezone, and bucket
    const { fromDate, toDate } = validateDateRange(from, to);
    const validatedTimezone = validateTimezone(timezone);
    const validatedBucket = validateBucket(bucket);

    // Proper timezone conversion with DST handling using safe queries
    const series = await withTimeout(async () => {
      return await safeQuery(async () => {
        if (validatedBucket === 'day') {
          return await sql`
            SELECT 
              (created_at AT TIME ZONE 'UTC' AT TIME ZONE ${validatedTimezone})::date as date,
              COUNT(*) as session_count,
              COUNT(DISTINCT user_id) as unique_users_raw,
              CASE 
                WHEN COUNT(DISTINCT user_id) < 5 THEN NULL
                ELSE COUNT(DISTINCT user_id)
              END as unique_users,
              COUNT(CASE WHEN completed THEN 1 END) as completed_count,
              COUNT(DISTINCT user_id) >= 5 as meets_privacy_threshold
            FROM sessions
            WHERE created_at >= ${fromDate}
              AND created_at < ${toDate}::date + INTERVAL '1 day'
              AND deleted_at IS NULL
            GROUP BY (created_at AT TIME ZONE 'UTC' AT TIME ZONE ${validatedTimezone})::date
            ORDER BY date ASC
          `;
        } else if (validatedBucket === 'week') {
          return await sql`
            SELECT 
              DATE_TRUNC('week', created_at AT TIME ZONE 'UTC' AT TIME ZONE ${validatedTimezone})::date as date,
              COUNT(*) as session_count,
              COUNT(DISTINCT user_id) as unique_users_raw,
              CASE 
                WHEN COUNT(DISTINCT user_id) < 5 THEN NULL
                ELSE COUNT(DISTINCT user_id)
              END as unique_users,
              COUNT(CASE WHEN completed THEN 1 END) as completed_count,
              COUNT(DISTINCT user_id) >= 5 as meets_privacy_threshold
            FROM sessions
            WHERE created_at >= ${fromDate}
              AND created_at < ${toDate}::date + INTERVAL '1 day'
              AND deleted_at IS NULL
            GROUP BY DATE_TRUNC('week', created_at AT TIME ZONE 'UTC' AT TIME ZONE ${validatedTimezone})
            ORDER BY date ASC
          `;
        } else if (validatedBucket === 'month') {
          return await sql`
            SELECT 
              DATE_TRUNC('month', created_at AT TIME ZONE 'UTC' AT TIME ZONE ${validatedTimezone})::date as date,
              COUNT(*) as session_count,
              COUNT(DISTINCT user_id) as unique_users_raw,
              CASE 
                WHEN COUNT(DISTINCT user_id) < 5 THEN NULL
                ELSE COUNT(DISTINCT user_id)
              END as unique_users,
              COUNT(CASE WHEN completed THEN 1 END) as completed_count,
              COUNT(DISTINCT user_id) >= 5 as meets_privacy_threshold
            FROM sessions
            WHERE created_at >= ${fromDate}
              AND created_at < ${toDate}::date + INTERVAL '1 day'
              AND deleted_at IS NULL
            GROUP BY DATE_TRUNC('month', created_at AT TIME ZONE 'UTC' AT TIME ZONE ${validatedTimezone})
            ORDER BY date ASC
          `;
        } else {
          throw new Error('Invalid bucket parameter');
        }
      });
    });

    // Calculate summary with privacy
    const summary = series.reduce(
      (acc, row) => ({
        total_sessions: acc.total_sessions + row.session_count,
        total_users: Math.max(acc.total_users, row.unique_users_raw || 0),
        completion_rate: null, // Calculate after
      }),
      { total_sessions: 0, total_users: 0 }
    );

    const totalCompleted = series.reduce((sum, row) => sum + row.completed_count, 0);
    summary.completion_rate =
      summary.total_sessions > 0
        ? Math.round((totalCompleted / summary.total_sessions) * 100) / 100
        : null;

    // Apply privacy threshold to summary
    if (summary.total_users < 5) {
      summary.total_users = null;
    }

    await auditLog(
      adminId,
      '/admin/sessions/series',
      'GET',
      { from, to, bucket, timezone },
      200,
      Date.now() - startTime,
      requestId
    );

    return successResponse(
      {
        series: series.map(row => ({
          date: row.date,
          session_count: row.session_count,
          unique_users: row.unique_users,
          completed_count: row.meets_privacy_threshold ? row.completed_count : null,
          privacy_applied: !row.meets_privacy_threshold,
        })),
        summary,
      },
      {
        timezone: validatedTimezone,
        bucket,
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
        : error.message.includes('Invalid date') || error.message.includes('Invalid timezone')
          ? 400
          : error.message.includes('Query timeout')
            ? 500
            : 500;

    await auditLog(
      null,
      '/admin/sessions/series',
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
    if (error.message.includes('Invalid date') || error.message.includes('Invalid timezone')) {
      return errorResponse(400, 'INVALID_PARAM', error.message, requestId);
    }
    if (error.message.includes('Query timeout')) {
      return errorResponse(500, 'QUERY_TIMEOUT', 'Query exceeded timeout limit', requestId);
    }
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to retrieve time series data', requestId);
  }
};
