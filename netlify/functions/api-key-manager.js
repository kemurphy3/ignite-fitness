const {
  getDB,
  authenticate,
  checkRateLimit,
  errorResponse,
  successResponse,
  preflightResponse,
} = require('./_base');
const crypto = require('crypto');

exports.handler = async event => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse();
  }

  try {
    // For this function, we'll use a special admin key or the first user
    // In production, you'd want proper admin authentication
    const adminKey = process.env.ADMIN_KEY;
    const providedKey = event.headers['x-api-key'] || event.headers['x-admin-key'];

    if (!adminKey || providedKey !== adminKey) {
      return errorResponse(401, 'AUTH_ERROR', 'Admin access required');
    }

    const sql = getDB();
    const body = JSON.parse(event.body || '{}');

    if (event.httpMethod === 'POST') {
      // Create new API key
      const { user_id, name, expires_in_days } = body;

      if (!user_id) {
        return errorResponse(400, 'VALIDATION_ERROR', 'user_id is required');
      }

      // Generate API key
      const apiKey = crypto.randomBytes(32).toString('hex');
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      // Calculate expiry
      const expiresAt = expires_in_days
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
        : null;

      // Insert API key
      const result = await sql`
        INSERT INTO api_keys (user_id, key_hash, name, expires_at, created_at)
        VALUES (${user_id}, ${keyHash}, ${name || 'Generated Key'}, ${expiresAt}, NOW())
        RETURNING id, name, created_at, expires_at
      `;

      return successResponse(
        {
          id: result[0].id,
          api_key: apiKey, // Only returned once during creation
          name: result[0].name,
          user_id,
          created_at: result[0].created_at,
          expires_at: result[0].expires_at,
        },
        201
      );
    } else if (event.httpMethod === 'GET') {
      // List API keys for a user
      const { user_id } = event.queryStringParameters || {};

      if (!user_id) {
        return errorResponse(400, 'VALIDATION_ERROR', 'user_id query parameter is required');
      }

      const keys = await sql`
        SELECT id, name, last_used_at, created_at, expires_at, is_active
        FROM api_keys 
        WHERE user_id = ${user_id}
        ORDER BY created_at DESC
      `;

      return successResponse({
        user_id,
        keys: keys.map(key => ({
          id: key.id,
          name: key.name,
          last_used_at: key.last_used_at,
          created_at: key.created_at,
          expires_at: key.expires_at,
          is_active: key.is_active,
        })),
      });
    } else if (event.httpMethod === 'PUT') {
      // Update API key (activate/deactivate)
      const { key_id, is_active } = body;

      if (!key_id) {
        return errorResponse(400, 'VALIDATION_ERROR', 'key_id is required');
      }

      const result = await sql`
        UPDATE api_keys 
        SET is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${key_id}
        RETURNING id, name, is_active, updated_at
      `;

      if (result.length === 0) {
        return errorResponse(404, 'NOT_FOUND', 'API key not found');
      }

      return successResponse({
        id: result[0].id,
        name: result[0].name,
        is_active: result[0].is_active,
        updated_at: result[0].updated_at,
      });
    } else if (event.httpMethod === 'DELETE') {
      // Delete API key
      const { key_id } = body;

      if (!key_id) {
        return errorResponse(400, 'VALIDATION_ERROR', 'key_id is required');
      }

      const result = await sql`
        DELETE FROM api_keys 
        WHERE id = ${key_id}
        RETURNING id, name
      `;

      if (result.length === 0) {
        return errorResponse(404, 'NOT_FOUND', 'API key not found');
      }

      return successResponse({
        message: 'API key deleted successfully',
        deleted_key: {
          id: result[0].id,
          name: result[0].name,
        },
      });
    } else {
      return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    }
  } catch (error) {
    console.error('API Key Manager Error:', error);

    // Handle database connection errors
    if (
      error.message.includes('DATABASE_URL not configured') ||
      error.message.includes('connection') ||
      error.message.includes('timeout')
    ) {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Database service unavailable');
    }

    // Generic error
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
};
