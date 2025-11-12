/**
 * User Data Retention Netlify Function
 * Handles GDPR-compliant data deletion requests
 */

const { createClient } = require('@supabase/supabase-js');
const UserDataRetentionManager = require('./user-data-retention-manager');
const { createLogger } = require('./utils/safe-logging');

const logger = createLogger('UserDataRetentionHandler');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' }),
    };
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const retentionManager = new UserDataRetentionManager(supabase);

    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    const { userId, action, retentionDays, deleteUser } = body;

    // Validate required parameters
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'User ID is required',
        }),
      };
    }

    // Handle different actions
    switch (action) {
      case 'get_settings': {
        const settings = await retentionManager.getUserRetentionSettings(userId);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            settings,
          }),
        };
      }

      case 'update_settings': {
        const { retentionDays: newRetentionDays, autoDeleteEnabled } = body;
        if (!newRetentionDays) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: 'Retention days is required for update',
            }),
          };
        }

        const updatedSettings = await retentionManager.updateUserRetentionSettings(userId, {
          retentionDays: newRetentionDays,
          autoDeleteEnabled: autoDeleteEnabled || false,
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            settings: updatedSettings,
          }),
        };
      }

      case 'process_retention': {
        const results = await retentionManager.processDataRetention(userId, {
          retentionDays: retentionDays || 365,
          deleteUser: deleteUser || false,
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            results,
          }),
        };
      }

      case 'delete_account': {
        const deletionResults = await retentionManager.processDataRetention(userId, {
          retentionDays: 0, // Delete all data
          deleteUser: true,
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Account and all data deleted successfully',
            results: deletionResults,
          }),
        };
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error:
              'Invalid action. Supported actions: get_settings, update_settings, process_retention, delete_account',
          }),
        };
    }
  } catch (error) {
    logger.error('Data retention handler error', {
      error: error.message,
      stack: error.stack,
      event: {
        httpMethod: event.httpMethod,
        path: event.path,
        body: event.body,
      },
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};
