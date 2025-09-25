const { 
  getDB, 
  authenticate, 
  checkRateLimit, 
  errorResponse, 
  successResponse, 
  preflightResponse,
  validateAge,
  validateWeight,
  validateHeight,
  validateSex,
  validateGoals,
  validateBaselineLifts
} = require('./_base');

exports.handler = async (event) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse();
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

    if (event.httpMethod === 'GET') {
      // GET user profile
      const result = await sql`
        SELECT age, weight, height, sex, goals, baseline_lifts, created_at, updated_at
        FROM users 
        WHERE id = ${userId}
      `;

      if (result.length === 0) {
        return errorResponse(404, 'NOT_FOUND', 'User profile not found');
      }

      const profile = result[0];
      return successResponse({
        user_id: userId,
        age: profile.age,
        weight: profile.weight,
        height: profile.height,
        sex: profile.sex,
        goals: profile.goals || [],
        baseline_lifts: profile.baseline_lifts || {},
        created_at: profile.created_at,
        updated_at: profile.updated_at
      });

    } else if (event.httpMethod === 'POST') {
      // POST create/update user profile
      const body = JSON.parse(event.body || '{}');
      
      // Validate input data
      const validatedData = {
        age: validateAge(body.age),
        weight: validateWeight(body.weight),
        height: validateHeight(body.height),
        sex: validateSex(body.sex),
        goals: validateGoals(body.goals),
        baseline_lifts: validateBaselineLifts(body.baseline_lifts),
        updated_at: new Date().toISOString()
      };

      // Check if user exists
      const existingUser = await sql`
        SELECT id FROM users WHERE id = ${userId}
      `;

      if (existingUser.length === 0) {
        // Create new user profile
        const result = await sql`
          INSERT INTO users (id, age, weight, height, sex, goals, baseline_lifts, created_at, updated_at)
          VALUES (${userId}, ${validatedData.age}, ${validatedData.weight}, ${validatedData.height}, 
                  ${validatedData.sex}, ${JSON.stringify(validatedData.goals)}, 
                  ${JSON.stringify(validatedData.baseline_lifts)}, 
                  ${validatedData.updated_at}, ${validatedData.updated_at})
          RETURNING created_at, updated_at
        `;

        return successResponse({
          user_id: userId,
          profile: {
            age: validatedData.age,
            weight: validatedData.weight,
            height: validatedData.height,
            sex: validatedData.sex,
            goals: validatedData.goals,
            baseline_lifts: validatedData.baseline_lifts
          },
          created_at: result[0].created_at,
          updated_at: result[0].updated_at
        }, 201);

      } else {
        // Update existing user profile
        const result = await sql`
          UPDATE users 
          SET age = ${validatedData.age},
              weight = ${validatedData.weight},
              height = ${validatedData.height},
              sex = ${validatedData.sex},
              goals = ${JSON.stringify(validatedData.goals)},
              baseline_lifts = ${JSON.stringify(validatedData.baseline_lifts)},
              updated_at = ${validatedData.updated_at}
          WHERE id = ${userId}
          RETURNING created_at, updated_at
        `;

        return successResponse({
          user_id: userId,
          profile: {
            age: validatedData.age,
            weight: validatedData.weight,
            height: validatedData.height,
            sex: validatedData.sex,
            goals: validatedData.goals,
            baseline_lifts: validatedData.baseline_lifts
          },
          created_at: result[0].created_at,
          updated_at: result[0].updated_at
        });
      }

    } else {
      return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    }

  } catch (error) {
    console.error('User Profile API Error:', error);
    
    // Handle validation errors
    if (error.message.includes('must be between') || 
        error.message.includes('must be one of') || 
        error.message.includes('Maximum') || 
        error.message.includes('must be less than')) {
      return errorResponse(400, 'VALIDATION_ERROR', error.message, { 
        field: error.message.split(' ')[0].toLowerCase() 
      });
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
