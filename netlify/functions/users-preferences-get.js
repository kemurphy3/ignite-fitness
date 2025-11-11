// GET /users/preferences - Get user preferences with atomic creation
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const { errorResponse, successResponse, sanitizeForLog } = require('./utils/user-preferences');

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

    // Get or create preferences atomically
    const preferences = await sql`
      SELECT 
        timezone,
        units,
        sleep_goal_hours,
        workout_goal_per_week,
        notifications_enabled,
        theme
      FROM get_or_create_user_preferences(${userId})
    `;

    if (!preferences.length) {
      console.error(
        'Failed to get/create preferences for user:',
        sanitizeForLog({ user_id: userId })
      );
      return errorResponse(500, 'DB_ERROR', 'Failed to retrieve preferences');
    }

    const prefs = preferences[0];

    // Return preferences
    return successResponse({
      timezone: prefs.timezone,
      units: prefs.units,
      sleep_goal_hours: prefs.sleep_goal_hours,
      workout_goal_per_week: prefs.workout_goal_per_week,
      notifications_enabled: prefs.notifications_enabled,
      theme: prefs.theme,
    });
  } catch (error) {
    console.error('GET preferences error:', sanitizeForLog({ error: error.message }));
    return errorResponse(500, 'DB_ERROR', 'Internal server error');
  }
};
