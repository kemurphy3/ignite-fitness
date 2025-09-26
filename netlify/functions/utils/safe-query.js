/**
 * Safe Query Execution Utilities
 * 
 * Provides helper functions for secure database query execution
 * with built-in SQL injection protection and validation.
 */

const { neon } = require('@neondatabase/serverless');

// Initialize database connection
const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

/**
 * Sanitize input for safe database queries
 * @param {any} input - Input to sanitize
 * @returns {any} - Sanitized input
 */
function sanitizeInput(input) {
    if (typeof input === 'string') {
        // Remove potential SQL injection characters
        return input.replace(/['"\\;--]/g, '');
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
 * Execute a safe parameterized query
 * @param {string} query - SQL query template
 * @param {Array} params - Query parameters
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Query results
 */
async function safeQuery(query, params = [], options = {}) {
    try {
        // Validate query string
        if (typeof query !== 'string') {
            throw new Error('Query must be a string');
        }
        
        // Check for dangerous SQL patterns
        const dangerousPatterns = [
            /DROP\s+TABLE/i,
            /DELETE\s+FROM/i,
            /UPDATE\s+.*SET/i,
            /INSERT\s+INTO/i,
            /ALTER\s+TABLE/i,
            /CREATE\s+TABLE/i,
            /EXEC\s*\(/i,
            /xp_cmdshell/i,
            /sp_executesql/i
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(query)) {
                throw new Error('Dangerous SQL pattern detected');
            }
        }
        
        // Sanitize parameters
        const sanitizedParams = params.map(sanitizeInput);
        
        // Execute query with timeout
        const timeout = options.timeout || 30000; // 30 seconds default
        const startTime = Date.now();
        
        const result = await Promise.race([
            sql`${query}`.apply(null, sanitizedParams),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Query timeout')), timeout)
            )
        ]);
        
        const executionTime = Date.now() - startTime;
        
        // Log query execution (without sensitive data)
        console.log('Safe query executed:', {
            queryLength: query.length,
            paramCount: sanitizedParams.length,
            executionTime,
            resultCount: Array.isArray(result) ? result.length : 0,
            timestamp: new Date().toISOString()
        });
        
        return result;
        
    } catch (error) {
        console.error('Safe query error:', {
            error: error.message,
            queryLength: query.length,
            paramCount: params.length,
            timestamp: new Date().toISOString()
        });
        throw error;
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
        if (limit > 0 && limit <= 1000) { // Max 1000 records
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
        .map(([key, value], index) => {
            return `${key} = $${index + 1}`;
        })
        .join(', ');
    
    const whereClause = Object.entries(conditions)
        .map(([key, value], index) => {
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
        .map(([key, value], index) => {
            return `${key} = $${index + 1}`;
        })
        .join(' AND ');
    
    const query = `DELETE FROM ${table} WHERE ${whereClause} RETURNING *`;
    const params = Object.values(conditions);
    
    return safeQuery(query, params, options);
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
    validateOwnership
};
