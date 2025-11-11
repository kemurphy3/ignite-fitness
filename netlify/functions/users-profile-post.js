// POST /users/profile - Create User Profile
const { getServerlessDB } = require('./utils/database');
const { verifyJWT } = require('./utils/auth');
const {
  sanitizeForLog,
  generateRequestHash,
  validateInput,
  sanitizeInput,
} = require('./utils/security');
const convertUnits = require('./utils/units');
const Ajv = require('ajv');
const crypto = require('crypto');

// Input validation schema
const createProfileSchema = {
  type: 'object',
  properties: {
    age: { type: 'integer', minimum: 13, maximum: 120 },
    height: {
      oneOf: [
        { type: 'number', minimum: 50, maximum: 300 }, // cm
        {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { enum: ['cm', 'inches', 'feet'] },
            inches: { type: 'number', minimum: 0, maximum: 11 },
          },
          required: ['value', 'unit'],
        },
      ],
    },
    weight: {
      oneOf: [
        { type: 'number', minimum: 20, maximum: 500 }, // kg
        {
          type: 'object',
          properties: {
            value: { type: 'number' },
            unit: { enum: ['kg', 'lbs'] },
          },
          required: ['value', 'unit'],
        },
      ],
    },
    sex: { enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    preferred_units: { enum: ['metric', 'imperial'] },
    goals: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 10,
    },
    goal_priorities: {
      type: 'object',
      additionalProperties: { type: 'integer', minimum: 1, maximum: 10 },
    },
    bench_press_max: { type: 'number', minimum: 0, maximum: 500 },
    squat_max: { type: 'number', minimum: 0, maximum: 500 },
    deadlift_max: { type: 'number', minimum: 0, maximum: 500 },
    overhead_press_max: { type: 'number', minimum: 0, maximum: 300 },
    pull_ups_max: { type: 'integer', minimum: 0, maximum: 100 },
    push_ups_max: { type: 'integer', minimum: 0, maximum: 500 },
    mile_time_seconds: { type: 'integer', minimum: 240, maximum: 1800 },
  },
  required: ['age', 'sex'],
  additionalProperties: false,
};

exports.handler = async event => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed', code: 'METHOD_001' }),
    };
  }

  const sql = getServerlessDB();
  const ajv = new Ajv();
  const validate = ajv.compile(createProfileSchema);

  try {
    // Authenticate user via JWT
    const userId = await verifyJWT(event.headers);
    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized', code: 'AUTH_001' }),
      };
    }

    // Check rate limit
    const canUpdate = await sql`SELECT check_profile_rate_limit(${userId}) as allowed`;
    if (!canUpdate[0].allowed) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '3600',
        },
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          code: 'RATE_001',
          retry_after: 3600,
        }),
      };
    }

    // Generate request ID for tracking
    const requestId = crypto.randomUUID();
    const requestHash = generateRequestHash(event.body, userId, Date.now());

    // Check for duplicate request
    try {
      await sql`
                INSERT INTO profile_update_requests (
                    user_id, request_hash, ip_address, user_agent, endpoint
                ) VALUES (
                    ${userId}, ${requestHash}, 
                    ${event.headers['x-forwarded-for'] || event.headers['x-real-ip']},
                    ${event.headers['user-agent']},
                    'POST /users/profile'
                )
            `;
    } catch (error) {
      if (error.code === '23505') {
        // Unique violation
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Duplicate request',
            code: 'DUP_001',
          }),
        };
      }
      throw error;
    }

    // Parse and validate input
    const profileData = JSON.parse(event.body);

    // Validate input for security
    const inputValidation = validateInput(profileData);
    if (!inputValidation.valid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid input',
          code: 'SEC_001',
          reason: inputValidation.reason,
        }),
      };
    }

    // Sanitize input
    const sanitizedData = sanitizeInput(profileData);

    // Convert units if necessary
    if (sanitizedData.height && typeof sanitizedData.height === 'object') {
      sanitizedData.height_cm = convertUnits.toCm(sanitizedData.height);
      delete sanitizedData.height;
    } else if (sanitizedData.height) {
      sanitizedData.height_cm = sanitizedData.height;
      delete sanitizedData.height;
    }

    if (sanitizedData.weight && typeof sanitizedData.weight === 'object') {
      sanitizedData.weight_kg = convertUnits.toKg(sanitizedData.weight);
      delete sanitizedData.weight;
    } else if (sanitizedData.weight) {
      sanitizedData.weight_kg = sanitizedData.weight;
      delete sanitizedData.weight;
    }

    if (!validate(sanitizedData)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Validation failed',
          code: 'VAL_001',
          details: validate.errors,
        }),
      };
    }

    // Validate goals and check conflicts
    if (sanitizedData.goals && sanitizedData.goals.length > 0) {
      const validGoals = await sql`
                SELECT id FROM valid_goals 
                WHERE id = ANY(${sanitizedData.goals})
                AND is_active = true
            `;

      if (validGoals.length !== sanitizedData.goals.length) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Invalid goals specified',
            code: 'VAL_002',
            validGoals: validGoals.map(g => g.id),
          }),
        };
      }

      // Check for conflicting goals
      const conflicts = await sql`
                SELECT * FROM validate_goal_conflicts(${JSON.stringify(sanitizedData.goals)})
            `;

      if (conflicts.length > 0) {
        console.warn('Goal conflicts detected:', conflicts);
        // We'll allow but warn about conflicts
      }
    }

    // Check if profile already exists
    const existing = await sql`
            SELECT id FROM user_profiles WHERE user_id = ${userId}
        `;

    if (existing.length > 0) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Profile already exists. Use PUT or PATCH to update.',
          code: 'PROF_409',
        }),
      };
    }

    // Set request context for trigger
    await sql`SELECT set_config('app.request_id', ${requestId}, false)`;

    // Create profile
    const result = await sql`
            INSERT INTO user_profiles (
                user_id,
                age,
                height_cm,
                weight_kg,
                sex,
                preferred_units,
                goals,
                goal_priorities,
                bench_press_max,
                squat_max,
                deadlift_max,
                overhead_press_max,
                pull_ups_max,
                push_ups_max,
                mile_time_seconds,
                last_modified_by
            ) VALUES (
                ${userId},
                ${sanitizedData.age},
                ${sanitizedData.height_cm || null},
                ${sanitizedData.weight_kg || null},
                ${sanitizedData.sex},
                ${sanitizedData.preferred_units || 'metric'},
                ${JSON.stringify(sanitizedData.goals || [])},
                ${JSON.stringify(sanitizedData.goal_priorities || {})},
                ${sanitizedData.bench_press_max || null},
                ${sanitizedData.squat_max || null},
                ${sanitizedData.deadlift_max || null},
                ${sanitizedData.overhead_press_max || null},
                ${sanitizedData.pull_ups_max || null},
                ${sanitizedData.push_ups_max || null},
                ${sanitizedData.mile_time_seconds || null},
                ${userId}
            )
            RETURNING id, version, completeness_score, created_at
        `;

    // Log sanitized action (no PII)
    console.log('Profile created:', {
      userId: sanitizeForLog(userId),
      requestId,
      completeness: result[0].completeness_score,
      timestamp: result[0].created_at,
    });

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        profile_id: result[0].id,
        version: result[0].version,
        completeness_score: result[0].completeness_score,
        message: 'Profile created successfully',
      }),
    };
  } catch (error) {
    console.error('Profile creation error:', sanitizeForLog(error.message));

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        code: 'SYS_001',
      }),
    };
  }
};
