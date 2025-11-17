const { getNeonClient } = require('./utils/connection-pool');
const crypto = require('crypto');

/**
 * Validate environment variables on function startup
 */
function validateEnvironment() {
  const required = ['DATABASE_URL'];
  // Optional env vars are validated if present but not required
  const _optional = [
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'STRAVA_CLIENT_ID',
    'STRAVA_CLIENT_SECRET',
    'OPENAI_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT_SECRET strength if present
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
        throw new Error('DATABASE_URL must use postgresql:// or postgres:// protocol');
      }
    } catch (error) {
      if (error.message.includes('DATABASE_URL')) {
        throw error;
      }
      throw new Error('Invalid DATABASE_URL format');
    }
  }
}

// Validate environment on module load (only in production)
if (process.env.NODE_ENV === 'production') {
  try {
    validateEnvironment();
  } catch (error) {
    console.error('Environment validation failed:', error.message);
    // In production, fail hard
    throw error;
  }
}

// Use centralized connection pooling
const getDB = () => {
  return getNeonClient();
};

const authenticate = async headers => {
  const apiKey = headers['x-api-key'];
  if (!apiKey) {
    return null;
  }

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const sql = getDB();

  const result = await sql`
    SELECT user_id FROM api_keys 
    WHERE key_hash = ${keyHash} 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
  `;

  if (result.length === 0) {
    return null;
  }

  // Update last_used_at
  await sql`UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = ${keyHash}`;

  return result[0].user_id;
};

const checkRateLimit = async userId => {
  const sql = getDB();
  const windowKey = `${userId}:${Math.floor(Date.now() / 60000)}`;

  const result = await sql`
    INSERT INTO rate_limits (id, count, expires_at) 
    VALUES (${windowKey}, 1, NOW() + INTERVAL '1 minute')
    ON CONFLICT (id) 
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `;

  return result[0].count <= 100;
};

const errorResponse = (status, code, message, details = {}) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'X-Request-ID': crypto.randomUUID(),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  },
  body: JSON.stringify({
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  }),
});

const successResponse = (data, statusCode = 200) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'X-Request-ID': crypto.randomUUID(),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  },
  body: JSON.stringify({
    success: true,
    data,
  }),
});

const preflightResponse = () => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  },
  body: '',
});

// Validation helpers
const validateAge = age => {
  if (age === undefined || age === null) {
    return null;
  }
  const numAge = Number(age);
  if (isNaN(numAge) || numAge < 13 || numAge > 120) {
    throw new Error('Age must be between 13 and 120');
  }
  return numAge;
};

const validateWeight = weight => {
  if (weight === undefined || weight === null) {
    return null;
  }
  const numWeight = Number(weight);
  if (isNaN(numWeight) || numWeight < 20 || numWeight > 300) {
    throw new Error('Weight must be between 20 and 300 kg');
  }
  return numWeight;
};

const validateHeight = height => {
  if (height === undefined || height === null) {
    return null;
  }
  const numHeight = Number(height);
  if (isNaN(numHeight) || numHeight < 100 || numHeight > 250) {
    throw new Error('Height must be between 100 and 250 cm');
  }
  return numHeight;
};

const validateSex = sex => {
  if (sex === undefined || sex === null) {
    return null;
  }
  const validSexes = ['male', 'female', 'other'];
  if (!validSexes.includes(sex)) {
    throw new Error('Sex must be one of: male, female, other');
  }
  return sex;
};

const validateGoals = goals => {
  if (!goals || !Array.isArray(goals)) {
    return null;
  }
  if (goals.length > 5) {
    throw new Error('Maximum 5 goals allowed');
  }
  return goals;
};

const validateBaselineLifts = lifts => {
  if (!lifts || typeof lifts !== 'object') {
    return null;
  }
  const jsonStr = JSON.stringify(lifts);
  if (jsonStr.length > 1024) {
    throw new Error('Baseline lifts must be less than 1KB');
  }
  return lifts;
};

const validateSessionType = type => {
  const validTypes = [
    'workout',
    'soccer',
    'climbing',
    'recovery',
    'cardio',
    'strength',
    'flexibility',
    'sport_specific',
  ];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid session type. Must be one of: ${validTypes.join(', ')}`);
  }
  return type;
};

const validateSessionSource = source => {
  const validSources = ['manual', 'strava', 'apple_health', 'garmin', 'whoop', 'import'];
  if (!validSources.includes(source)) {
    throw new Error(`Invalid session source. Must be one of: ${validSources.join(', ')}`);
  }
  return source;
};

const validateDate = (dateStr, fieldName) => {
  if (!dateStr) {
    return null;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO 8601 date`);
  }
  return date;
};

const validateFutureDate = (dateStr, fieldName, maxHours = 24) => {
  const date = validateDate(dateStr, fieldName);
  if (!date) {
    return null;
  }

  const now = new Date();
  const maxFuture = new Date(now.getTime() + maxHours * 60 * 60 * 1000);

  if (date > maxFuture) {
    throw new Error(`${fieldName} cannot be more than ${maxHours} hours in the future`);
  }

  return date;
};

const validatePayloadSize = (payload, maxSize = 10240) => {
  if (!payload) {
    return null;
  }
  const jsonStr = JSON.stringify(payload);
  if (jsonStr.length > maxSize) {
    throw new Error(`Payload must be less than ${maxSize} bytes (currently ${jsonStr.length})`);
  }
  return payload;
};

// Transaction wrapper
const withTransaction = async (sql, callback) => {
  return await sql.begin(callback);
};

module.exports = {
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
  validateBaselineLifts,
  validateSessionType,
  validateSessionSource,
  validateDate,
  validateFutureDate,
  validatePayloadSize,
  withTransaction,
};
