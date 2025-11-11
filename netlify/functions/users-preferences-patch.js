// PATCH /users/preferences - Update user preferences atomically
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const {
  errorResponse,
  noContentResponse,
  validatePreferences,
  coercePreferences,
  filterKnownFields,
  checkRequestSize,
  sanitizeForLog,
} = require('./utils/user-preferences');

const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

exports.handler = async event => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
        },
        body: '',
      };
    }

    // Check request size
    if (!checkRequestSize(event.body)) {
      return errorResponse(400, 'BODY_TOO_LARGE', 'Request body too large (max 10KB)');
    }

    // Verify JWT and extract user ID
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(401, 'AUTH_REQUIRED', 'Authorization header required');
    }

    const token = authHeader.substring(7);
    let externalId;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      externalId = decoded.sub;
    } catch (err) {
      console.error('JWT verification failed:', err.message);
      return errorResponse(401, 'AUTH_REQUIRED', 'Invalid or expired token');
    }

    if (!externalId) {
      return errorResponse(401, 'AUTH_REQUIRED', 'Invalid token format');
    }

    // Get internal user ID from external ID
    const userResult = await sql`
      SELECT id FROM users WHERE external_id = ${externalId}
    `;

    if (!userResult.length) {
      console.error('User not found for external_id:', sanitizeForLog({ external_id: externalId }));
      return errorResponse(403, 'USER_NOT_FOUND', 'User not found');
    }

    const userId = userResult[0].id;

    // Parse request body
    let preferences;
    try {
      preferences = JSON.parse(event.body || '{}');
    } catch (err) {
      console.error('Invalid JSON:', err.message);
      return errorResponse(400, 'INVALID_JSON', 'Invalid JSON format');
    }

    // Filter out unknown fields (silently ignored)
    const filteredPreferences = filterKnownFields(preferences);

    // If no valid fields provided, return 204 (no-op)
    if (Object.keys(filteredPreferences).length === 0) {
      return noContentResponse();
    }

    // Validate preferences
    const validationErrors = validatePreferences(filteredPreferences);
    if (validationErrors.length > 0) {
      console.error('Validation errors:', sanitizeForLog({ errors: validationErrors }));

      // Return specific error codes for each validation failure
      if (validationErrors.includes('Invalid timezone')) {
        return errorResponse(400, 'INVALID_TIMEZONE', 'Invalid timezone');
      }
      if (validationErrors.includes('Invalid units')) {
        return errorResponse(400, 'INVALID_UNITS', 'Invalid units');
      }
      if (validationErrors.includes('Invalid sleep goal hours')) {
        return errorResponse(
          400,
          'INVALID_SLEEP_GOAL',
          'Sleep goal must be between 0 and 14 hours'
        );
      }
      if (validationErrors.includes('Invalid workout goal per week')) {
        return errorResponse(
          400,
          'INVALID_WORKOUT_GOAL',
          'Workout goal must be between 0 and 14 per week'
        );
      }
      if (validationErrors.includes('Invalid notifications enabled')) {
        return errorResponse(400, 'INVALID_NOTIFICATIONS', 'Notifications enabled must be boolean');
      }
      if (validationErrors.includes('Invalid theme')) {
        return errorResponse(400, 'INVALID_THEME', 'Theme must be system, light, or dark');
      }

      return errorResponse(400, 'VALIDATION_FAILED', 'Validation failed', validationErrors);
    }

    // Coerce preferences to proper types
    const coercedPreferences = coercePreferences(filteredPreferences);

    // Update preferences atomically
    const updatedPreferences = await sql`
      SELECT 
        timezone,
        units,
        sleep_goal_hours,
        workout_goal_per_week,
        notifications_enabled,
        theme
      FROM update_user_preferences(
        ${userId},
        ${coercedPreferences.timezone || null},
        ${coercedPreferences.units || null},
        ${coercedPreferences.sleep_goal_hours || null},
        ${coercedPreferences.workout_goal_per_week || null},
        ${coercedPreferences.notifications_enabled || null},
        ${coercedPreferences.theme || null}
      )
    `;

    if (!updatedPreferences.length) {
      console.error('Failed to update preferences for user:', sanitizeForLog({ user_id: userId }));
      return errorResponse(500, 'DB_ERROR', 'Failed to update preferences');
    }

    // Return 204 No Content
    return noContentResponse();
  } catch (error) {
    console.error('PATCH preferences error:', sanitizeForLog({ error: error.message }));
    return errorResponse(500, 'DB_ERROR', 'Internal server error');
  }
};
