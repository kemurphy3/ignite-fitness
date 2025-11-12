// GET /api/admin/users/top - Top users with keyset pagination
// const { neon } = require('@neondatabase/serverless'); // Unused - using getNeonClient instead
const crypto = require('crypto');
const {
  verifyAdmin,
  auditLog,
  errorResponse,
  decodeCursor,
  encodeCursor,
  withTimeout,
  successResponse,
} = require('./utils/admin-auth');

const { safeQuery, validateMetric } = require('./utils/safe-query');

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

    const { metric = 'sessions', limit = 50, cursor } = event.queryStringParameters || {};

    // Validate inputs using safe validation
    const allowedMetrics = ['sessions', 'duration'];
    const validatedMetric = validateMetric(metric, allowedMetrics);

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

    // Keyset pagination query with privacy using safe queries
    const users = await withTimeout(async () => {
      return await safeQuery(async () => {
        if (validatedMetric === 'sessions') {
          return await sql`
            WITH ranked_users AS (
              SELECT 
                user_id,
                SUBSTRING(MD5(user_id::text || ${process.env.HASH_SALT || 'default'}), 1, 8) as user_alias,
                COUNT(*) as metric_value,
                MAX(created_at) as last_active
              FROM sessions
              WHERE deleted_at IS NULL
                ${
                  lastValue !== null
                    ? sql`
                  AND (COUNT(*), user_id) < (${lastValue}, ${lastId})
                `
                    : sql``
                }
              GROUP BY user_id
              HAVING COUNT(DISTINCT user_id) >= 5 OR user_id = ${adminId}
              ORDER BY COUNT(*) DESC, user_id DESC
              LIMIT ${parsedLimit + 1}
            )
            SELECT * FROM ranked_users
          `;
        } else {
          return await sql`
            WITH ranked_users AS (
              SELECT 
                user_id,
                SUBSTRING(MD5(user_id::text || ${process.env.HASH_SALT || 'default'}), 1, 8) as user_alias,
                SUM(duration_minutes) as metric_value,
                MAX(created_at) as last_active
              FROM sessions
              WHERE deleted_at IS NULL
                ${
                  lastValue !== null
                    ? sql`
                  AND (SUM(duration_minutes), user_id) < (${lastValue}, ${lastId})
                `
                    : sql``
                }
              GROUP BY user_id
              HAVING COUNT(DISTINCT user_id) >= 5 OR user_id = ${adminId}
              ORDER BY SUM(duration_minutes) DESC, user_id DESC
              LIMIT ${parsedLimit + 1}
            )
            SELECT * FROM ranked_users
          `;
        }
      });
    });

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
      last_active: user.last_active,
    }));

    await auditLog(
      adminId,
      '/admin/users/top',
      'GET',
      { metric, limit: parsedLimit, cursor },
      200,
      Date.now() - startTime,
      requestId
    );

    return successResponse(
      {
        users: rankedResults,
        next_cursor: nextCursor,
      },
      {
        metric,
        privacy_applied: false,
        total_filtered: 0,
        response_time_ms: Date.now() - startTime,
      },
      requestId,
      'private, no-cache'
    );
  } catch (error) {
    const { handleError } = require('./utils/error-handler');

    // Log audit with error
    await auditLog(
      null,
      '/admin/users/top',
      'GET',
      event.queryStringParameters,
      500,
      Date.now() - startTime,
      requestId
    );

    return handleError(error, {
      statusCode: 500,
      context: {
        requestId,
        functionName: 'admin-users-top',
        endpoint: '/admin/users/top',
      },
    });
  }
};
