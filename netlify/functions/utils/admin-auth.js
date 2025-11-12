// Admin Authentication and Authorization Utilities
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
// const { neon } = require('@neondatabase/serverless'); // Unused - using getNeonClient instead

const { getNeonClient } = require('./connection-pool');
const sql = getNeonClient();

// Verify admin authentication with proper JWT validation
const verifyAdmin = async (token, requestId) => {
  try {
    // Validate with issuer and audience
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'ignite-fitness',
      audience: 'api',
      algorithms: ['HS256'],
      clockTolerance: 30, // 30 seconds clock skew
    });

    // Check admin role in database
    const user = await sql`
      SELECT id, role 
      FROM users 
      WHERE id = ${decoded.sub} 
        AND role = 'admin'
        AND deleted_at IS NULL
    `;

    if (!user.length) {
      throw new Error('Unauthorized: Admin access required');
    }

    return { adminId: user[0].id };
  } catch (error) {
    console.error(`Auth failed for request ${requestId}:`, error.message);
    throw new Error('Authentication failed');
  }
};

// Audit logging for admin requests
const auditLog = async (adminId, endpoint, method, params, status, responseTime, requestId) => {
  try {
    await sql`
      INSERT INTO admin_audit_log (
        request_id, admin_id, endpoint, method, query_params, 
        response_status, response_time_ms
      ) VALUES (
        ${requestId}, ${adminId}, ${endpoint}, ${method}, ${JSON.stringify(params)}, 
        ${status}, ${responseTime}
      )
    `;
  } catch (error) {
    console.error('Failed to log admin audit:', error.message);
  }
};

// Standard error response
const errorResponse = (statusCode, code, message, requestId) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'X-Request-ID': requestId,
  },
  body: JSON.stringify({
    error: {
      code,
      message,
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
  }),
});

// Input validation functions
const validateDateRange = (from, to) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate) || isNaN(toDate)) {
    throw new Error('Invalid date format');
  }

  const maxRange = 730 * 24 * 60 * 60 * 1000; // 730 days (2 years)
  if (toDate - fromDate > maxRange) {
    throw new Error('Date range exceeds maximum (730 days)');
  }

  if (fromDate > toDate) {
    throw new Error('From date must be before to date');
  }

  return { fromDate, toDate };
};

const validateTimezone = timezone => {
  // Use Intl API to validate timezone
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch (e) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
};

// Privacy protection functions
const applyPrivacyThreshold = (count, threshold = 5) => {
  return count < threshold ? null : count;
};

const hashUserId = userId => {
  const hash = crypto
    .createHash('md5')
    .update(userId + (process.env.HASH_SALT || 'default'))
    .digest('hex');
  return `usr_${hash.substring(0, 6)}`;
};

// Rate limiting check
const checkRateLimit = async adminId => {
  const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000); // 1-minute window

  try {
    const result = await sql`
      INSERT INTO admin_rate_limits (admin_id, window_start, attempts)
      VALUES (${adminId}, ${windowStart}, 1)
      ON CONFLICT (admin_id, window_start)
      DO UPDATE SET attempts = admin_rate_limits.attempts + 1
      RETURNING attempts
    `;

    if (result[0].attempts > 60) {
      throw new Error('Rate limit exceeded');
    }
  } catch (error) {
    if (error.message.includes('Rate limit exceeded')) {
      throw error;
    }
    console.error('Rate limit check failed:', error.message);
  }
};

// Keyset pagination utilities
const encodeCursor = (value, id) => {
  const cursor = { v: value, id };
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
};

const decodeCursor = cursor => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    return { value: decoded.v, id: decoded.id };
  } catch (e) {
    throw new Error('Invalid cursor format');
  }
};

// Query timeout wrapper
const withTimeout = async (queryFn, timeoutMs = 5000) => {
  const timeout = setTimeout(() => {
    throw new Error('Query timeout');
  }, timeoutMs);

  try {
    await sql`SET statement_timeout = '5s'`;
    const result = await queryFn();
    clearTimeout(timeout);
    return result;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
};

// Common response headers
const getResponseHeaders = (requestId, cacheControl = 'private, max-age=60') => ({
  'Content-Type': 'application/json',
  'Cache-Control': cacheControl,
  'Access-Control-Allow-Origin': '*',
  'X-Request-ID': requestId,
});

// Success response helper
const successResponse = (data, meta, requestId, cacheControl = 'private, max-age=60') => ({
  statusCode: 200,
  headers: getResponseHeaders(requestId, cacheControl),
  body: JSON.stringify({
    status: 'success',
    data,
    meta: {
      ...meta,
      request_id: requestId,
      generated_at: new Date().toISOString(),
    },
  }),
});

module.exports = {
  verifyAdmin,
  auditLog,
  errorResponse,
  validateDateRange,
  validateTimezone,
  applyPrivacyThreshold,
  hashUserId,
  checkRateLimit,
  encodeCursor,
  decodeCursor,
  withTimeout,
  getResponseHeaders,
  successResponse,
};
