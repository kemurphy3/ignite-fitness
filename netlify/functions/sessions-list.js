const { 
  getDB, 
  authenticate, 
  checkRateLimit, 
  errorResponse, 
  successResponse, 
  preflightResponse,
  validateSessionType
} = require('./_base');
const { 
  validatePaginationParams, 
  createPaginatedResponse, 
  getCursorDataForItem,
  buildCursorCondition,
  buildTimestampCondition,
  validatePaginationInput
} = require('./utils/pagination');

// Helper function to get total count
async function getTotalCount(sql, whereClause, params) {
  try {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sessions 
      WHERE ${whereClause}
    `;
    const countResult = await sql.unsafe(countQuery, params);
    return parseInt(countResult[0].total);
  } catch (error) {
    console.error('Error getting total count:', error);
    return null;
  }
}

exports.handler = async (event) => {
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

    const sql = getDB();
    const requestParams = event.queryStringParameters || {};

    // Validate pagination parameters
    const paginationErrors = validatePaginationInput(requestParams);
    if (paginationErrors.length > 0) {
      return errorResponse(400, 'VALIDATION_ERROR', paginationErrors.join(', '));
    }

    // Parse and validate query parameters
    const type = requestParams.type;
    const startDate = requestParams.start_date;
    const endDate = requestParams.end_date;
    const pagination = validatePaginationParams(requestParams);

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
            validationField: 'type'
          }
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

    // Build query conditions
    let whereConditions = [`user_id = ${userId}`];
    let queryParams = [userId];

    if (type) {
      whereConditions.push(`type = $${queryParams.length + 1}`);
      queryParams.push(type);
    }

    if (startDateObj) {
      whereConditions.push(`start_at >= $${queryParams.length + 1}`);
      queryParams.push(startDateObj);
    }

    if (endDateObj) {
      whereConditions.push(`start_at <= $${queryParams.length + 1}`);
      queryParams.push(endDateObj);
    }

    // Add cursor-based pagination condition
    const cursorCondition = buildCursorCondition(pagination.cursor, 'start_at DESC, id ASC');
    if (cursorCondition.condition) {
      whereConditions.push(cursorCondition.condition.replace('AND ', ''));
      queryParams.push(...cursorCondition.values);
    }

    // Add timestamp-based pagination condition
    const timestampCondition = buildTimestampCondition(pagination.before, pagination.after, 'start_at');
    if (timestampCondition.condition) {
      whereConditions.push(timestampCondition.condition.replace('AND ', ''));
      queryParams.push(...timestampCondition.values);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get sessions with pagination
    const sessionsQuery = `
      SELECT id, type, source, source_id, start_at, end_at, duration, 
             payload, session_hash, created_at, updated_at
      FROM sessions 
      WHERE ${whereClause}
      ORDER BY start_at DESC, id ASC
      LIMIT $${queryParams.length + 1}
    `;
    
    queryParams.push(pagination.limit + 1); // Get one extra to check if there are more

    const sessions = await sql.unsafe(sessionsQuery, queryParams);

    // Create paginated response
    const paginatedResponse = createPaginatedResponse(
      sessions,
      pagination.limit,
      (item) => getCursorDataForItem(item, 'sessions'),
      {
        includeTotal: sessions.length < 1000,
        total: sessions.length < 1000 ? await getTotalCount(sql, whereClause, queryParams.slice(0, -1)) : undefined
      }
    );

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
        updated_at: session.updated_at
      })),
      pagination: paginatedResponse.pagination
    });

  } catch (error) {
    const { handleError } = require('./utils/error-handler');
    
    // Handle database connection errors with specific status codes
    if (error.message.includes('DATABASE_URL not configured') || 
        error.message.includes('connection') ||
        error.message.includes('timeout')) {
      return handleError(error, {
        statusCode: 503,
        customMessage: 'Database service unavailable',
        context: {
          functionName: 'sessions-list',
          errorType: 'database_connection'
        }
      });
    }

    return handleError(error, {
      statusCode: 500,
      customMessage: 'Internal server error',
      context: {
        functionName: 'sessions-list'
      }
    });
  }
};