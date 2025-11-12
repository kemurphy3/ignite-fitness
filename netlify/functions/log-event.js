// POST /.netlify/functions/log-event
// Accepts structured logs from SafeLogger remote transport

const { successResponse, errorResponse } = require('./utils/admin-auth');

exports.handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return errorResponse(400, 'BAD_JSON', 'Invalid JSON');
    }

    const { level, message, timestamp, args: _args, url, userAgent: _userAgent } = body || {};
    if (!level || !message) {
      return errorResponse(422, 'INVALID_LOG', 'Missing level or message');
    }

    // For MVP: just echo success; real implementation would persist to logs table or provider
    return successResponse({ ok: true, received: { level, message, timestamp, url } });
  } catch (e) {
    return errorResponse(500, 'SERVER_ERROR', e.message || 'error');
  }
};
