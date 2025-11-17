/**
 * Safe Query Execution Utilities
 *
 * Provides helper functions for secure database query execution
 * with built-in SQL injection protection and validation.
 */

// const { neon } = require('@neondatabase/serverless'); // Unused - using getNeonClient instead

// Initialize database connection
const { getNeonClient } = require('./connection-pool');
const sql = getNeonClient();

/**
 * Sanitize input for safe database queries
 * @param {any} input - Input to sanitize
 * @returns {any} - Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input === 'string') {
    // Remove potential SQL injection characters
    return input.replace(/['"\\;-]/g, '');
  }
  if (typeof input === 'number') {
    // Ensure numbers are within safe ranges
    if (input > Number.MAX_SAFE_INTEGER || input < Number.MIN_SAFE_INTEGER) {
      throw new Error('Number out of safe range');
    }
    return input;
  }
  if (typeof input === 'boolean') {
    return input;
  }
  if (input instanceof Date) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (input && typeof input === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      // Sanitize object keys
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      sanitized[safeKey] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}

/**
 * Validate query for SQL injection patterns
 * @param {string} query - Query to validate
 * @param {Array} params - Query parameters
 * @returns {void}
 * @throws {Error} If query is potentially unsafe
 */
function validateQuery(query, params = []) {
  // Detect potential SQL injection patterns
  const dangerousPatterns = [
    /;\s*(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER)/i,
    /UNION\s+SELECT/i,
    /'.*OR.*'.*=.*'/i,
    /--/,
    /\/\*.*\*\//,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      throw new Error('Potentially unsafe query detected');
    }
  }

  // Ensure all dynamic values use parameters
  const dynamicValuePattern = /\$\d+/g;
  const expectedParams = (query.match(dynamicValuePattern) || []).length;

  if (params.length !== expectedParams && expectedParams > 0) {
    throw new Error(`Parameter count mismatch: expected ${expectedParams}, got ${params.length}`);
  }
}

/**
 * Hash query for logging
 * @param {string} query - Query to hash
 * @returns {string} Query hash
 */
function hashQuery(query) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(query).digest('hex').slice(0, 8);
}

/**
 * Execute a safe parameterized query using Neon template literals
 * @param {Function} queryFn - Function that returns a Neon template literal
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Query results
 */
async function safeQuery(queryFn, options = {}) {
  try {
    // Execute query with timeout
    const timeout = options.timeout || 30000; // 30 seconds default
    const startTime = Date.now();

    const result = await Promise.race([
      queryFn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), timeout)),
    ]);

    const executionTime = Date.now() - startTime;

    // Log query execution (without sensitive data)
    console.log('Safe query executed:', {
      executionTime,
      resultCount: Array.isArray(result) ? result.length : 0,
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    // Log error without exposing sensitive details
    console.error('Database query failed:', {
      error: error.message,
      queryHash: hashQuery(queryFn.toString()),
      timestamp: new Date().toISOString(),
    });
    throw new Error('Database operation failed');
  }
}

/**
 * Execute a safe SELECT query
 * @param {string} table - Table name
 * @param {Object} conditions - WHERE conditions
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Query results
 */
async function safeSelect(table, conditions = {}, options = {}) {
  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error('Invalid table name');
  }

  let query = `SELECT * FROM ${table}`;
  const params = [];

  // Build WHERE clause
  if (Object.keys(conditions).length > 0) {
    const whereClause = Object.entries(conditions)
      .map(([key, value], index) => {
        params.push(value);
        return `${key} = $${index + 1}`;
      })
      .join(' AND ');
    query += ` WHERE ${whereClause}`;
  }

  // Add ORDER BY if specified
  if (options.orderBy) {
    const orderBy = options.orderBy.replace(/[^a-zA-Z0-9_,\s]/g, '');
    query += ` ORDER BY ${orderBy}`;
  }

  // Add LIMIT if specified
  if (options.limit) {
    const limit = parseInt(options.limit);
    if (limit > 0 && limit <= 1000) {
      // Max 1000 records
      query += ` LIMIT ${limit}`;
    }
  }

  return safeQuery(query, params, options);
}

/**
 * Execute a safe INSERT query
 * @param {string} table - Table name
 * @param {Object} data - Data to insert
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Insert result
 */
async function safeInsert(table, data, options = {}) {
  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error('Invalid table name');
  }

  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

  const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;

  return safeQuery(query, values, options);
}

/**
 * Execute a safe UPDATE query
 * @param {string} table - Table name
 * @param {Object} data - Data to update
 * @param {Object} conditions - WHERE conditions
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Update result
 */
async function safeUpdate(table, data, conditions, options = {}) {
  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error('Invalid table name');
  }

  const updateClause = Object.entries(data)
    .map(([key, _value], index) => {
      return `${key} = $${index + 1}`;
    })
    .join(', ');

  const whereClause = Object.entries(conditions)
    .map(([key, _value], index) => {
      return `${key} = $${index + Object.keys(data).length + 1}`;
    })
    .join(' AND ');

  const query = `UPDATE ${table} SET ${updateClause} WHERE ${whereClause} RETURNING *`;
  const params = [...Object.values(data), ...Object.values(conditions)];

  return safeQuery(query, params, options);
}

/**
 * Execute a safe DELETE query
 * @param {string} table - Table name
 * @param {Object} conditions - WHERE conditions
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Delete result
 */
async function safeDelete(table, conditions, options = {}) {
  // Validate table name
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error('Invalid table name');
  }

  const whereClause = Object.entries(conditions)
    .map(([key, _value], index) => {
      return `${key} = $${index + 1}`;
    })
    .join(' AND ');

  const query = `DELETE FROM ${table} WHERE ${whereClause} RETURNING *`;
  const params = Object.values(conditions);

  return safeQuery(query, params, options);
}

/**
 * Validate column name against whitelist
 * @param {string} column - Column name to validate
 * @param {Array} allowedColumns - Array of allowed column names
 * @returns {boolean} - Whether column is valid
 */
function validateColumnName(column, allowedColumns) {
  if (!column || typeof column !== 'string') {
    return false;
  }
  return allowedColumns.includes(column);
}

/**
 * Validate sort direction
 * @param {string} direction - Sort direction to validate
 * @returns {string} - Validated sort direction
 */
function validateSortDirection(direction) {
  const validDirections = ['ASC', 'DESC', 'asc', 'desc'];
  if (validDirections.includes(direction)) {
    return direction.toUpperCase();
  }
  throw new Error('Invalid sort direction. Must be ASC or DESC');
}

/**
 * Validate metric parameter
 * @param {string} metric - Metric to validate
 * @param {Array} allowedMetrics - Array of allowed metrics
 * @returns {string} - Validated metric
 */
function validateMetric(metric, allowedMetrics) {
  if (!metric || typeof metric !== 'string') {
    throw new Error('Metric parameter is required');
  }
  if (!allowedMetrics.includes(metric)) {
    throw new Error(`Invalid metric. Must be one of: ${allowedMetrics.join(', ')}`);
  }
  return metric;
}

/**
 * Validate bucket parameter for time series
 * @param {string} bucket - Bucket to validate
 * @returns {string} - Validated bucket
 */
function validateBucket(bucket) {
  const allowedBuckets = ['day', 'week', 'month'];
  if (!bucket || typeof bucket !== 'string') {
    return 'day'; // default
  }
  if (!allowedBuckets.includes(bucket)) {
    throw new Error(`Invalid bucket. Must be one of: ${allowedBuckets.join(', ')}`);
  }
  return bucket;
}

/**
 * Validate session type parameter
 * @param {string} sessionType - Session type to validate
 * @param {Array} allowedTypes - Array of allowed session types
 * @returns {string} - Validated session type
 */
function validateSessionType(sessionType, allowedTypes) {
  if (!sessionType || typeof sessionType !== 'string') {
    return 'unspecified'; // default
  }
  if (!allowedTypes.includes(sessionType)) {
    throw new Error(`Invalid session type. Must be one of: ${allowedTypes.join(', ')}`);
  }
  return sessionType;
}

/**
 * Validate user ownership of resource
 * @param {string} table - Table name
 * @param {string} resourceId - Resource ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether user owns resource
 */
async function validateOwnership(table, resourceId, userId) {
  try {
    const result = await safeSelect(table, { id: resourceId, user_id: userId });
    return result.length > 0;
  } catch (error) {
    console.error('Ownership validation error:', error);
    return false;
  }
}

module.exports = {
  sql,
  sanitizeInput,
  safeQuery,
  safeSelect,
  safeInsert,
  safeUpdate,
  safeDelete,
  validateColumnName,
  validateSortDirection,
  validateMetric,
  validateBucket,
  validateSessionType,
  validateOwnership,
  validateQuery,
  hashQuery,
};
