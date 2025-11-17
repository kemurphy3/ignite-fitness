const {
  authenticate,
  checkRateLimit,
  errorResponse,
  successResponse,
  preflightResponse,
  validateSessionType,
} = require('./_base');
const { getPool } = require('./utils/connection-pool');
const {
  validatePagination,
  buildPaginatedQuery,
  buildCountQuery,
  formatResponse,
} = require('./utils/pagination');

exports.handler = async event => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse();
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  try {
    // Authenticate user
    const userId = await authenticate(event.headers);
    if (!userId) {
      return errorResponse(401, 'AUTH_ERROR', 'Invalid or missing API key');
    }

    // Check rate limit
    const withinRateLimit = await checkRateLimit(userId);
    if (!withinRateLimit) {
      return errorResponse(429, 'RATE_LIMIT', 'Too many requests', { retry_after: 60 });
    }

    const pool = getPool();
    const requestParams = event.queryStringParameters || {};

    // Validate and normalize pagination parameters
    const pagination = validatePagination(requestParams);

    // Parse and validate query parameters
    const { type } = requestParams;
    const startDate = requestParams.start_date;
    const endDate = requestParams.end_date;

    // Validate type if provided
    if (type) {
      try {
        validateSessionType(type);
      } catch (error) {
        const { handleError } = require('./utils/error-handler');
        return handleError(error, {
          statusCode: 400,
          customMessage: 'Invalid session type',
          context: {
            functionName: 'sessions-list',
            validationField: 'type',
          },
        });
      }
    }

    // Validate dates if provided
    let startDateObj = null;
    let endDateObj = null;

    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Invalid start_date format');
      }
    }

    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Invalid end_date format');
      }
    }

    // Build WHERE conditions with parameterized queries
    const whereConditions = ['user_id = $1'];
    const queryParams = [userId];
    let paramIndex = 2;

    if (type) {
      whereConditions.push(`type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (startDateObj) {
      whereConditions.push(`start_at >= $${paramIndex}`);
      queryParams.push(startDateObj);
      paramIndex++;
    }

    if (endDateObj) {
      whereConditions.push(`start_at <= $${paramIndex}`);
      queryParams.push(endDateObj);
      paramIndex++;
    }

    // Add tag filtering
    const { tags } = requestParams;
    const { exclude_tags } = requestParams;

    if (tags) {
      const requiredTags = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t);
      if (requiredTags.length > 0) {
        whereConditions.push(`payload->'tags' @> $${paramIndex}::jsonb`);
        queryParams.push(JSON.stringify(requiredTags));
        paramIndex++;
      }
    }

    if (exclude_tags) {
      const excludedTags = exclude_tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t);
      if (excludedTags.length > 0) {
        whereConditions.push(`NOT (payload->'tags' ?| $${paramIndex})`);
        queryParams.push(excludedTags);
        paramIndex++;
      }
    }

    const whereClause = whereConditions.join(' AND ');

    // Base query without LIMIT/OFFSET
    const baseQuery = `
      SELECT id, type, source, source_id, start_at, end_at, duration, 
             payload, session_hash, created_at, updated_at
      FROM sessions 
      WHERE ${whereClause}
    `;

    // Get total count
    const countQuery = buildCountQuery(baseQuery);
    const countResult = await pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Get paginated data
    const dataQuery = buildPaginatedQuery(baseQuery, pagination, 'start_at DESC, id ASC');
    const dataParams = [...queryParams, pagination.limit, pagination.offset];
    const dataResult = await pool.query(dataQuery, dataParams);
    const sessions = dataResult.rows;

    // Format response with pagination metadata
    const paginatedResponse = formatResponse(sessions, pagination, totalCount);

    return successResponse({
      sessions: paginatedResponse.data.map(session => ({
        id: session.id,
        type: session.type,
        source: session.source,
        source_id: session.source_id,
        start_at: session.start_at,
        end_at: session.end_at,
        duration: session.duration,
        payload: session.payload,
        session_hash: session.session_hash,
        created_at: session.created_at,
        updated_at: session.updated_at,
      })),
      pagination: paginatedResponse.pagination,
    });
  } catch (error) {
    const { handleError } = require('./utils/error-handler');

    // Handle database connection errors with specific status codes
    if (
      error.message.includes('DATABASE_URL not configured') ||
      error.message.includes('connection') ||
      error.message.includes('timeout')
    ) {
      return handleError(error, {
        statusCode: 503,
        customMessage: 'Database service unavailable',
        context: {
          functionName: 'sessions-list',
          errorType: 'database_connection',
        },
      });
    }

    return handleError(error, {
      statusCode: 500,
      customMessage: 'Internal server error',
      context: {
        functionName: 'sessions-list',
      },
    });
  }
};
