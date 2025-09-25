const { 
  getDB, 
  authenticate, 
  checkRateLimit, 
  errorResponse, 
  successResponse, 
  preflightResponse,
  validateSessionType
} = require('./_base');

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
    const queryParams = event.queryStringParameters || {};

    // Parse and validate query parameters
    const type = queryParams.type;
    const startDate = queryParams.start_date;
    const endDate = queryParams.end_date;
    const limit = Math.min(parseInt(queryParams.limit) || 20, 100);
    const before = queryParams.before;

    // Validate type if provided
    if (type) {
      try {
        validateSessionType(type);
      } catch (error) {
        return errorResponse(400, 'VALIDATION_ERROR', error.message);
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

    // Validate before timestamp if provided
    let beforeDate = null;
    if (before) {
      beforeDate = new Date(before);
      if (isNaN(beforeDate.getTime())) {
        return errorResponse(400, 'VALIDATION_ERROR', 'Invalid before timestamp format');
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

    if (beforeDate) {
      whereConditions.push(`start_at < $${queryParams.length + 1}`);
      queryParams.push(beforeDate);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get sessions with pagination
    const sessionsQuery = `
      SELECT id, type, source, source_id, start_at, end_at, duration, 
             payload, session_hash, created_at, updated_at
      FROM sessions 
      WHERE ${whereClause}
      ORDER BY start_at DESC
      LIMIT $${queryParams.length + 1}
    `;
    
    queryParams.push(limit + 1); // Get one extra to check if there are more

    const sessions = await sql.unsafe(sessionsQuery, queryParams);

    // Check if there are more results
    const hasMore = sessions.length > limit;
    const sessionsToReturn = hasMore ? sessions.slice(0, limit) : sessions;
    
    // Get next_before timestamp
    let nextBefore = null;
    if (hasMore && sessionsToReturn.length > 0) {
      nextBefore = sessionsToReturn[sessionsToReturn.length - 1].start_at;
    }

    // Get total count (only if less than 1000 for performance)
    let total = null;
    if (sessionsToReturn.length < 1000) {
      const countQuery = `
        SELECT COUNT(*) as total
        FROM sessions 
        WHERE ${whereClause}
      `;
      const countResult = await sql.unsafe(countQuery, queryParams.slice(0, -1));
      total = parseInt(countResult[0].total);
    }

    return successResponse({
      sessions: sessionsToReturn.map(session => ({
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
      pagination: {
        has_more: hasMore,
        next_before: nextBefore,
        count: sessionsToReturn.length,
        total: total
      }
    });

  } catch (error) {
    console.error('Sessions List API Error:', error);
    
    // Handle database connection errors
    if (error.message.includes('DATABASE_URL not configured') || 
        error.message.includes('connection') ||
        error.message.includes('timeout')) {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Database service unavailable');
    }

    // Generic error
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
};