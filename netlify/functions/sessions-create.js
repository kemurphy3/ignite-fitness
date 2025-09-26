const { 
  getDB, 
  authenticate, 
  checkRateLimit, 
  errorResponse, 
  successResponse, 
  preflightResponse,
  validateSessionType,
  validateSessionSource,
  validateFutureDate,
  validatePayloadSize
} = require('./_base');
// Note: getDB() now uses centralized connection pooling automatically

exports.handler = async (event) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse();
  }

  if (event.httpMethod !== 'POST') {
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

    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.type) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Type is required');
    }
    if (!body.source) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Source is required');
    }
    if (!body.start_at) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Start time is required');
    }

    // Validate data
    const validatedData = {
      type: validateSessionType(body.type),
      source: validateSessionSource(body.source),
      source_id: body.source_id || null,
      start_at: validateFutureDate(body.start_at, 'start_at'),
      end_at: body.end_at ? new Date(body.end_at) : null,
      payload: validatePayloadSize(body.payload)
    };

    const sql = getDB();

    // Check for duplicates
    let sessionHash;
    if (validatedData.source_id) {
      // Use source_id for deduplication
      const existing = await sql`
        SELECT id FROM sessions 
        WHERE user_id = ${userId} 
        AND source = ${validatedData.source} 
        AND source_id = ${validatedData.source_id}
      `;
      
      if (existing.length > 0) {
        return errorResponse(409, 'DUPLICATE_SESSION', 'Session with this source_id already exists', {
          session_id: existing[0].id
        });
      }
      
      // Generate hash for source_id based sessions
      const crypto = require('crypto');
      sessionHash = crypto.createHash('sha256')
        .update(`${userId}:${validatedData.source}:${validatedData.source_id}`)
        .digest('hex');
    } else {
      // Use start_at + type for deduplication
      const existing = await sql`
        SELECT id FROM sessions 
        WHERE user_id = ${userId} 
        AND start_at = ${validatedData.start_at} 
        AND type = ${validatedData.type}
      `;
      
      if (existing.length > 0) {
        return errorResponse(409, 'DUPLICATE_SESSION', 'Session with this start time and type already exists', {
          session_id: existing[0].id
        });
      }
      
      // Generate hash for time-based sessions
      const crypto = require('crypto');
      sessionHash = crypto.createHash('sha256')
        .update(`${userId}:${validatedData.start_at}:${validatedData.type}`)
        .digest('hex');
    }

    // Calculate duration if end_at is provided
    let duration = null;
    if (validatedData.end_at && validatedData.start_at) {
      duration = Math.round((validatedData.end_at - validatedData.start_at) / 1000); // seconds
    }

    // Insert session
    const result = await sql`
      INSERT INTO sessions (
        user_id, type, source, source_id, start_at, end_at, duration, 
        payload, session_hash, created_at, updated_at
      )
      VALUES (
        ${userId}, ${validatedData.type}, ${validatedData.source}, 
        ${validatedData.source_id}, ${validatedData.start_at}, 
        ${validatedData.end_at}, ${duration}, 
        ${JSON.stringify(validatedData.payload)}, ${sessionHash}, 
        NOW(), NOW()
      )
      RETURNING id, session_hash, created_at, updated_at
    `;

    return successResponse({
      id: result[0].id,
      session_hash: result[0].session_hash,
      type: validatedData.type,
      source: validatedData.source,
      source_id: validatedData.source_id,
      start_at: validatedData.start_at,
      end_at: validatedData.end_at,
      duration: duration,
      payload: validatedData.payload,
      created_at: result[0].created_at,
      updated_at: result[0].updated_at
    }, 201);

  } catch (error) {
    console.error('Sessions Create API Error:', error);
    
    // Handle validation errors
    if (error.message.includes('Invalid session') || 
        error.message.includes('must be a valid') || 
        error.message.includes('cannot be more than') ||
        error.message.includes('must be less than')) {
      return errorResponse(400, 'VALIDATION_ERROR', error.message);
    }

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