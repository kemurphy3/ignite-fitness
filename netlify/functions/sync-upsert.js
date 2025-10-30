// POST /.netlify/functions/sync-upsert
// Secure upsert endpoint for client sync queue

const { getNeonClient } = require('./utils/connection-pool');
const {
  verifyUser, // validate JWT and return userId
  errorResponse,
  successResponse
} = require('./utils/admin-auth');

const sql = getNeonClient();

const TABLES = new Set([
  'user_profiles',
  'readiness_logs',
  'session_logs',
  'progression_events',
  'injury_flags',
  'preferences'
]);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) return errorResponse(401, 'MISSING_TOKEN', 'Authorization required');

    const { userId } = await verifyUser(token);

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {
      return errorResponse(400, 'BAD_JSON', 'Invalid JSON body');
    }

    const { table, key, data, updated_at } = body || {};
    if (!TABLES.has(table) || !key || !data) {
      return errorResponse(422, 'INVALID_PAYLOAD', 'Missing or invalid fields');
    }

    // Basic server-side validation: enforce ownership
    if (data.userId && data.userId !== userId) {
      return errorResponse(403, 'FORBIDDEN', 'Cannot write data for another user');
    }

    // Route by table - upsert with conflict key patterns used by the client
    // NOTE: This expects DB schema with appropriate unique constraints
    if (table === 'user_profiles') {
      await sql`INSERT INTO user_profiles ${sql({ user_id: userId, ...data })}
                ON CONFLICT (user_id) DO UPDATE SET
                  profile = EXCLUDED.profile,
                  updated_at = NOW()`;
    } else if (table === 'preferences') {
      await sql`INSERT INTO preferences ${sql({ user_id: userId, ...data })}
                ON CONFLICT (user_id) DO UPDATE SET
                  preferences = EXCLUDED.preferences,
                  updated_at = NOW()`;
    } else if (table === 'readiness_logs' || table === 'session_logs' || table === 'progression_events' || table === 'injury_flags') {
      // Compound key is provided in 'key' as userId_date; extract date
      const parts = String(key).split('_');
      const date = parts.length > 1 ? parts.slice(1).join('_') : data.date || data.logged_at || null;
      if (!date) return errorResponse(422, 'INVALID_KEY', 'Date missing in key');

      const base = { user_id: userId, date, ...data };

      // Dynamic table upsert
      await sql`INSERT INTO ${sql(table)} ${sql(base)}
                ON CONFLICT (user_id, date) DO UPDATE SET
                  payload = EXCLUDED.payload,
                  updated_at = NOW()`;
    } else {
      return errorResponse(422, 'UNSUPPORTED_TABLE', 'Unsupported table');
    }

    return successResponse({ ok: true, table, key, updated_at: updated_at || new Date().toISOString() });
  } catch (error) {
    const message = error?.message || 'Internal error';
    return errorResponse(500, 'SERVER_ERROR', message);
  }
};


