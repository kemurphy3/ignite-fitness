const {
  getDB,
  authenticate,
  checkRateLimit,
  errorResponse,
  successResponse,
  preflightResponse,
  withTransaction
} = require('./_base');

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
    if (!body.session_id) {
      return errorResponse(400, 'VALIDATION_ERROR', 'session_id is required');
    }
    if (!body.exercises || !Array.isArray(body.exercises)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'exercises array is required');
    }
    if (body.exercises.length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'At least one exercise is required');
    }
    if (body.exercises.length > 50) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Maximum 50 exercises allowed per request');
    }

    const sessionId = parseInt(body.session_id);
    if (isNaN(sessionId)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'session_id must be a valid integer');
    }

    // Validate each exercise
    const validatedExercises = [];
    for (let i = 0; i < body.exercises.length; i++) {
      const exercise = body.exercises[i];

      if (!exercise.name || typeof exercise.name !== 'string') {
        return errorResponse(400, 'VALIDATION_ERROR', `Exercise ${i + 1}: name is required and must be a string`);
      }

      if (!exercise.sets || !Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20) {
        return errorResponse(400, 'VALIDATION_ERROR', `Exercise ${i + 1}: sets must be an integer between 1 and 20`);
      }

      if (!exercise.reps || !Number.isInteger(exercise.reps) || exercise.reps < 1 || exercise.reps > 100) {
        return errorResponse(400, 'VALIDATION_ERROR', `Exercise ${i + 1}: reps must be an integer between 1 and 100`);
      }

      const validatedExercise = {
        name: exercise.name.trim().substring(0, 100), // Trim and limit to 100 chars
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight ? Math.max(0, Math.min(500, Number(exercise.weight))) : null,
        rpe: exercise.rpe ? Math.max(1, Math.min(10, Number(exercise.rpe))) : null,
        notes: exercise.notes ? exercise.notes.trim().substring(0, 500) : null // Trim and limit to 500 chars
      };

      validatedExercises.push(validatedExercise);
    }

    const sql = getDB();

    // Use transaction to ensure all-or-nothing insert
    const result = await withTransaction(sql, async (tx) => {
      // Verify session ownership
      const session = await tx`
        SELECT id FROM sessions 
        WHERE id = ${sessionId} AND user_id = ${userId}
      `;

      if (session.length === 0) {
        throw new Error('Session not found or access denied');
      }

      // Prepare exercise data for bulk insert
      const exerciseData = validatedExercises.map(exercise => ({
        session_id: sessionId,
        user_id: userId,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        rpe: exercise.rpe,
        notes: exercise.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Bulk insert exercises
      const insertedExercises = await tx`
        INSERT INTO exercises (session_id, user_id, name, sets, reps, weight, rpe, notes, created_at, updated_at)
        VALUES ${tx(exerciseData, 'session_id', 'user_id', 'name', 'sets', 'reps', 'weight', 'rpe', 'notes', 'created_at', 'updated_at')}
        RETURNING id, name, sets, reps, weight, rpe, notes, created_at, updated_at
      `;

      return insertedExercises;
    });

    return successResponse({
      session_id: sessionId,
      exercises: result.map(exercise => ({
        id: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        rpe: exercise.rpe,
        notes: exercise.notes,
        created_at: exercise.created_at,
        updated_at: exercise.updated_at
      })),
      count: result.length
    }, 201);

  } catch (error) {
    console.error('Exercises Bulk Create API Error:', error);

    // Handle specific errors
    if (error.message.includes('Session not found')) {
      return errorResponse(404, 'SESSION_NOT_FOUND', 'Session not found or access denied');
    }

    if (error.message.includes('access denied')) {
      return errorResponse(403, 'ACCESS_DENIED', 'You do not have permission to add exercises to this session');
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
