// POST /users/profile/validate - Dry-run Validation
const { getServerlessDB } = require('./utils/database');
const { verifyJWT } = require('./utils/auth');
const { sanitizeForLog, validateInput } = require('./utils/security');
const convertUnits = require('./utils/units');
const Ajv = require('ajv');

// Import the same schema for validation
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
  const _validate = ajv.compile(createProfileSchema);

  try {
    // Authenticate user
    const userId = await verifyJWT(event.headers);
    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized', code: 'AUTH_001' }),
      };
    }

    const { fields } = JSON.parse(event.body);
    const validationResults = {};
    const warnings = [];

    // Validate input for security
    const inputValidation = validateInput(fields);
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

    // Convert units for validation
    const convertedFields = { ...fields };
    if (convertedFields.height && typeof convertedFields.height === 'object') {
      try {
        convertedFields.height_cm = convertUnits.toCm(convertedFields.height);
        delete convertedFields.height;
      } catch (error) {
        validationResults.height = {
          valid: false,
          errors: [{ message: `Height conversion error: ${error.message}` }],
        };
      }
    }

    if (convertedFields.weight && typeof convertedFields.weight === 'object') {
      try {
        convertedFields.weight_kg = convertUnits.toKg(convertedFields.weight);
        delete convertedFields.weight;
      } catch (error) {
        validationResults.weight = {
          valid: false,
          errors: [{ message: `Weight conversion error: ${error.message}` }],
        };
      }
    }

    // Validate each field
    for (const [key, value] of Object.entries(convertedFields)) {
      if (createProfileSchema.properties[key]) {
        const fieldSchema = {
          type: 'object',
          properties: { [key]: createProfileSchema.properties[key] },
        };
        const validateField = ajv.compile(fieldSchema);

        validationResults[key] = {
          valid: validateField({ [key]: value }),
          errors: validateField.errors || [],
        };
      } else {
        validationResults[key] = {
          valid: false,
          errors: [{ message: 'Unknown field' }],
        };
      }
    }

    // Check physical consistency
    if (convertedFields.height_cm && convertedFields.weight_kg) {
      const bmi = convertedFields.weight_kg / Math.pow(convertedFields.height_cm / 100, 2);
      if (bmi < 15 || bmi > 50) {
        warnings.push({
          field: 'bmi',
          message: 'Height/weight ratio appears unusual',
          value: Math.round(bmi * 100) / 100,
        });
      }
    }

    // Check lift ratios
    if (convertedFields.bench_press_max && convertedFields.weight_kg) {
      const ratio = convertedFields.bench_press_max / convertedFields.weight_kg;
      if (ratio > 3) {
        warnings.push({
          field: 'bench_press_max',
          message: 'Bench press exceeds typical ratio',
          ratio: Math.round(ratio * 100) / 100,
        });
      }
    }

    // Check deadlift vs squat ratio
    if (convertedFields.deadlift_max && convertedFields.squat_max) {
      const ratio = convertedFields.deadlift_max / convertedFields.squat_max;
      if (ratio < 0.7) {
        warnings.push({
          field: 'deadlift_max',
          message: 'Deadlift is unusually low compared to squat',
          ratio: Math.round(ratio * 100) / 100,
        });
      }
    }

    // Check goal conflicts
    if (convertedFields.goals && convertedFields.goals.length > 0) {
      try {
        const conflicts = await sql`
                    SELECT * FROM validate_goal_conflicts(${JSON.stringify(convertedFields.goals)})
                `;

        if (conflicts.length > 0) {
          warnings.push({
            field: 'goals',
            message: 'Conflicting goals detected',
            conflicts: conflicts.map(c => c.conflict_pair),
          });
        }
      } catch (error) {
        console.error('Goal conflict check failed:', error);
      }
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [];
    for (const [key, value] of Object.entries(convertedFields)) {
      if (typeof value === 'string') {
        const patterns = require('./utils/security').detectSuspiciousPatterns(value);
        if (patterns.suspicious) {
          suspiciousPatterns.push({
            field: key,
            patterns: patterns.patterns,
          });
        }
      }
    }

    if (suspiciousPatterns.length > 0) {
      warnings.push({
        field: 'input',
        message: 'Suspicious patterns detected in input',
        patterns: suspiciousPatterns,
      });
    }

    const allValid = Object.values(validationResults).every(r => r.valid);

    // Log sanitized validation attempt
    console.log('Profile validation:', {
      userId: sanitizeForLog(userId),
      fields: Object.keys(fields),
      valid: allValid,
      warnings: warnings.length,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid: allValid,
        fields: validationResults,
        warnings: warnings.length > 0 ? warnings : null,
        converted_fields: convertedFields,
      }),
    };
  } catch (error) {
    console.error('Validation error:', sanitizeForLog(error.message));

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
