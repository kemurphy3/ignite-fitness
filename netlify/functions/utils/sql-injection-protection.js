/**
 * SQL Injection Protection Utilities
 *
 * Provides secure database query execution with parameterized queries
 * and comprehensive SQL injection protection.
 */

const { neon: _neon } = require('@neondatabase/serverless');

// Initialize database connection
const { getNeonClient } = require('./connection-pool');
const sql = getNeonClient();

/**
 * SQL Injection Protection Class
 */
class SQLInjectionProtection {
  constructor() {
    this.dangerousPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
      /(\b(UNION|OR|AND)\b.*\b(SELECT|INSERT|UPDATE|DELETE)\b)/gi,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)/gi,
      /(\b(CHAR|ASCII|SUBSTRING|LEN|LENGTH)\b)/gi,
      /(\b(WAITFOR|DELAY|BENCHMARK)\b)/gi,
      /(\b(INFORMATION_SCHEMA|SYS\.DATABASES|SYS\.TABLES)\b)/gi,
      /(\b(CAST|CONVERT)\b)/gi,
      /(\b(SP_|XP_)\b)/gi,
      /(\b(OPENROWSET|OPENDATASOURCE)\b)/gi,
      /(\b(BULK|BULKINSERT)\b)/gi,
    ];

    this.safeTableNames = new Set([
      'users',
      'user_preferences',
      'user_profiles',
      'sessions',
      'exercises',
      'sleep_sessions',
      'strava_activities',
      'external_sources',
      'activities',
      'activity_streams',
      'biometrics',
      'daily_aggregates',
      'ingest_log',
    ]);
  }

  /**
   * Validate and sanitize table name
   * @param {string} tableName - Table name to validate
   * @returns {string} - Validated table name
   * @throws {Error} - If table name is invalid
   */
  validateTableName(tableName) {
    if (!tableName || typeof tableName !== 'string') {
      throw new Error('Table name must be a non-empty string');
    }

    // Check against whitelist
    if (!this.safeTableNames.has(tableName.toLowerCase())) {
      throw new Error(`Table name '${tableName}' is not in the safe whitelist`);
    }

    // Check for dangerous characters
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(`Table name '${tableName}' contains invalid characters`);
    }

    return tableName;
  }

  /**
   * Validate and sanitize column name
   * @param {string} columnName - Column name to validate
   * @returns {string} - Validated column name
   * @throws {Error} - If column name is invalid
   */
  validateColumnName(columnName) {
    if (!columnName || typeof columnName !== 'string') {
      throw new Error('Column name must be a non-empty string');
    }

    // Check for dangerous characters
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) {
      throw new Error(`Column name '${columnName}' contains invalid characters`);
    }

    return columnName;
  }

  /**
   * Detect SQL injection patterns in input
   * @param {any} input - Input to check
   * @returns {boolean} - True if suspicious patterns found
   */
  detectSQLInjection(input) {
    if (typeof input !== 'string') {
      return false;
    }

    const upperInput = input.toUpperCase();

    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(upperInput)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitize input for safe database queries
   * @param {any} input - Input to sanitize
   * @returns {any} - Sanitized input
   * @throws {Error} - If SQL injection detected
   */
  sanitizeInput(input) {
    if (this.detectSQLInjection(input)) {
      throw new Error('Potential SQL injection detected in input');
    }

    if (typeof input === 'string') {
      // Remove potential SQL injection characters
      return input.replace(/['";-]/g, '');
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
      return input.map(item => this.sanitizeInput(item));
    }

    if (input && typeof input === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        // Sanitize object keys
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
        sanitized[safeKey] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Execute a safe parameterized query
   * @param {string} query - SQL query with parameter placeholders
   * @param {Array} params - Query parameters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Query results
   */
  async executeSafeQuery(query, params = [], options = {}) {
    try {
      // Validate query structure
      this.validateQueryStructure(query);

      // Sanitize all parameters
      const sanitizedParams = params.map(param => this.sanitizeInput(param));

      // Execute query with timeout
      const timeout = options.timeout || 30000; // 30 seconds default
      const startTime = Date.now();

      const result = await Promise.race([
        sql(query, sanitizedParams),
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
      console.error('Safe query execution failed:', {
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Validate query structure for safety
   * @param {string} query - SQL query to validate
   * @throws {Error} - If query structure is unsafe
   */
  validateQueryStructure(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    // Check for dangerous patterns in query
    if (this.detectSQLInjection(query)) {
      throw new Error('Query contains potentially dangerous SQL patterns');
    }

    // Ensure query uses parameter placeholders
    if (query.includes('${') && !query.includes('$$')) {
      throw new Error('Query uses unsafe template literals instead of parameter placeholders');
    }
  }

  /**
   * Build a safe SELECT query
   * @param {string} table - Table name
   * @param {Object} conditions - WHERE conditions
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Query results
   */
  async safeSelect(table, conditions = {}, options = {}) {
    const validatedTable = this.validateTableName(table);

    let query = `SELECT * FROM ${validatedTable}`;
    const params = [];

    // Build WHERE clause with parameterized queries
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.entries(conditions)
        .map(([key, value]) => {
          const validatedKey = this.validateColumnName(key);
          params.push(value);
          return `${validatedKey} = $${params.length}`;
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

    return this.executeSafeQuery(query, params, options);
  }

  /**
   * Build a safe INSERT query
   * @param {string} table - Table name
   * @param {Object} data - Data to insert
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Insert result
   */
  async safeInsert(table, data, options = {}) {
    const validatedTable = this.validateTableName(table);

    if (!data || typeof data !== 'object') {
      throw new Error('Data must be a non-empty object');
    }

    const columns = Object.keys(data).map(key => this.validateColumnName(key));
    const values = Object.values(data).map(value => this.sanitizeInput(value));
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
            INSERT INTO ${validatedTable} (${columns.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;

    return this.executeSafeQuery(query, values, options);
  }

  /**
   * Build a safe UPDATE query
   * @param {string} table - Table name
   * @param {Object} data - Data to update
   * @param {Object} conditions - WHERE conditions
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Update result
   */
  async safeUpdate(table, data, conditions = {}, options = {}) {
    const validatedTable = this.validateTableName(table);

    if (!data || typeof data !== 'object') {
      throw new Error('Data must be a non-empty object');
    }

    const updateFields = Object.entries(data).map(([key, _value], index) => {
      const validatedKey = this.validateColumnName(key);
      return `${validatedKey} = $${index + 1}`;
    });

    const updateValues = Object.values(data).map(value => this.sanitizeInput(value));

    let query = `UPDATE ${validatedTable} SET ${updateFields.join(', ')}`;

    // Build WHERE clause
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.entries(conditions)
        .map(([key, value]) => {
          const validatedKey = this.validateColumnName(key);
          updateValues.push(value);
          return `${validatedKey} = $${updateValues.length}`;
        })
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    query += ' RETURNING *';

    return this.executeSafeQuery(query, updateValues, options);
  }

  /**
   * Build a safe DELETE query
   * @param {string} table - Table name
   * @param {Object} conditions - WHERE conditions
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Delete result
   */
  async safeDelete(table, conditions = {}, options = {}) {
    const validatedTable = this.validateTableName(table);

    if (Object.keys(conditions).length === 0) {
      throw new Error('DELETE queries must have WHERE conditions');
    }

    const whereClause = Object.entries(conditions)
      .map(([key, _value], index) => {
        const validatedKey = this.validateColumnName(key);
        return `${validatedKey} = $${index + 1}`;
      })
      .join(' AND ');

    const params = Object.values(conditions).map(value => this.sanitizeInput(value));

    const query = `DELETE FROM ${validatedTable} WHERE ${whereClause} RETURNING *`;

    return this.executeSafeQuery(query, params, options);
  }
}

// Export singleton instance
const sqlProtection = new SQLInjectionProtection();

module.exports = {
  SQLInjectionProtection,
  sqlProtection,
  // Convenience methods
  safeQuery: (query, params, options) => sqlProtection.executeSafeQuery(query, params, options),
  safeSelect: (table, conditions, options) => sqlProtection.safeSelect(table, conditions, options),
  safeInsert: (table, data, options) => sqlProtection.safeInsert(table, data, options),
  safeUpdate: (table, data, conditions, options) =>
    sqlProtection.safeUpdate(table, data, conditions, options),
  safeDelete: (table, conditions, options) => sqlProtection.safeDelete(table, conditions, options),
};
