// GET /sessions/:sessionId/exercises - List with Stable Pagination
// const { neon } = require('@neondatabase/serverless'); // Unused - using getNeonClient instead
const jwt = require('jsonwebtoken');
const {
  validatePaginationParams,
  createPaginatedResponse,
  getCursorDataForItem,
  buildCursorCondition,
  validatePaginationInput,
} = require('./utils/pagination');

// Helper to sanitize for logging
function sanitizeForLog(data) {
  const sanitized = { ...data };
  if (sanitized.user_id) {
    sanitized.user_hash = require('crypto')
      .createHash('sha256')
      .update(sanitized.user_id)
      .digest('hex')
      .substring(0, 8);
    delete sanitized.user_id;
  }
  return sanitized;
}

exports.handler = async event => {
  const { getNeonClient } = require('./utils/connection-pool');
  const sql = getNeonClient();

  const headers = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    // Extract session ID
    const sessionId = event.path.match(/\/sessions\/([^/]+)\/exercises/)?.[1];
    if (!sessionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: {
            message: 'Invalid path format',
            code: 'VAL_001',
          },
        }),
      };
    }

    // Authenticate
    const authHeader = event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: {
            message: 'Authorization required',
            code: 'AUTH_001',
          },
        }),
      };
    }

    const token = authHeader.substring(7);
    let userId;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.sub;
    } catch (err) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: {
            message: 'Invalid token',
            code: 'AUTH_002',
          },
        }),
      };
    }

    // Verify session ownership
    const sessionCheck = await sql`
            SELECT user_id FROM sessions 
            WHERE id = ${sessionId}
        `;

    if (!sessionCheck.length) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: {
            message: 'Session not found',
            code: 'SESS_001',
          },
        }),
      };
    }

    if (sessionCheck[0].user_id !== userId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: {
            message: 'Access denied',
            code: 'AUTHZ_001',
          },
        }),
      };
    }

    // Parse and validate query parameters
    const params = event.queryStringParameters || {};

    // Validate pagination parameters
    const paginationErrors = validatePaginationInput(params);
    if (paginationErrors.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: {
            message: paginationErrors.join(', '),
            code: 'VAL_005',
          },
        }),
      };
    }

    const pagination = validatePaginationParams(params);

    // Build cursor condition for exercises
    const cursorCondition = buildCursorCondition(pagination.cursor, 'created_at ASC, id ASC', 'e');

    // Fetch exercises with stable ordering and pagination using safe parameterized query
    const exercisesQuery = `
            SELECT 
                id, name, sets, reps, weight, rpe,
                notes, created_at, updated_at
            FROM exercises e
            WHERE session_id = $1 ${cursorCondition.condition}
            ORDER BY created_at ASC, id ASC
            LIMIT $${cursorCondition.values.length + 2}
        `;

    const queryParams = [sessionId, ...cursorCondition.values, pagination.limit + 1];
    const exercises = await sql(exercisesQuery, queryParams);

    // Create paginated response
    const paginatedResponse = createPaginatedResponse(
      exercises,
      pagination.limit,
      item => getCursorDataForItem(item, 'exercises'),
      {
        includeTotal: exercises.length < 1000,
      }
    );

    // Log sanitized action
    console.log(
      'Exercises listed:',
      sanitizeForLog({
        session_id: sessionId,
        user_id: userId,
        count: paginatedResponse.data.length,
        has_more: paginatedResponse.pagination.has_more,
      })
    );

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Cache-Control': 'private, max-age=10',
      },
      body: JSON.stringify({
        exercises: paginatedResponse.data.map(ex => ({
          ...ex,
          created_at: ex.created_at.toISOString(),
          updated_at: ex.updated_at.toISOString(),
        })),
        pagination: paginatedResponse.pagination,
      }),
    };
  } catch (error) {
    console.error('Error listing exercises:', sanitizeForLog({ error: error.message }));

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: {
          message: 'Internal server error',
          code: 'SYS_002',
        },
      }),
    };
  }
};
