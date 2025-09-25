// Database Connection Management for Strava Token System
const { neon } = require('@neondatabase/serverless');

let sql;
let connectionPool;

function getServerlessDB() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }
    
    sql = neon(process.env.DATABASE_URL, {
      poolQueryViaFetch: true,
      fetchOptions: {
        priority: 'high',
      }
    });
  }
  return sql;
}

// For traditional PostgreSQL connections (if needed)
function getConnectionPool() {
  if (!connectionPool) {
    const { Pool } = require('pg');
    
    connectionPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      statement_timeout: 10000,
      query_timeout: 10000,
      ssl: { rejectUnauthorized: false }
    });

    connectionPool.on('error', (err) => {
      console.error('Unexpected pool error', err);
    });
  }
  return connectionPool;
}

// Health check for database connection
async function checkDatabaseHealth() {
  try {
    const sql = getServerlessDB();
    const result = await sql`SELECT NOW() as current_time`;
    return {
      healthy: true,
      timestamp: result[0].current_time,
      connection: 'active'
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      connection: 'failed'
    };
  }
}

// Execute a transaction with proper error handling
async function withTransaction(sql, callback) {
  return await sql.begin(callback);
}

// Clean up old rate limit entries
async function cleanupRateLimits() {
  try {
    const sql = getServerlessDB();
    const result = await sql`
      DELETE FROM api_rate_limits 
      WHERE request_timestamp < NOW() - INTERVAL '1 hour'
    `;
    return { deleted: result.length, success: true };
  } catch (error) {
    console.error('Rate limit cleanup failed:', error);
    return { deleted: 0, success: false, error: error.message };
  }
}

// Clean up expired locks
async function cleanupExpiredLocks() {
  try {
    const sql = getServerlessDB();
    const result = await sql`
      UPDATE strava_tokens 
      SET refresh_lock_until = NULL 
      WHERE refresh_lock_until < NOW()
    `;
    return { updated: result.length, success: true };
  } catch (error) {
    console.error('Lock cleanup failed:', error);
    return { updated: 0, success: false, error: error.message };
  }
}

// Get database statistics
async function getDatabaseStats() {
  try {
    const sql = getServerlessDB();
    
    const [tokens, audit, rateLimits, circuitBreakers] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM strava_tokens`,
      sql`SELECT COUNT(*) as count FROM strava_token_audit WHERE created_at > NOW() - INTERVAL '24 hours'`,
      sql`SELECT COUNT(*) as count FROM api_rate_limits WHERE request_timestamp > NOW() - INTERVAL '1 hour'`,
      sql`SELECT COUNT(*) as count FROM circuit_breaker_state`
    ]);
    
    return {
      tokens: parseInt(tokens[0].count),
      auditLogs24h: parseInt(audit[0].count),
      rateLimits1h: parseInt(rateLimits[0].count),
      circuitBreakers: parseInt(circuitBreakers[0].count),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Database stats failed:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { 
  getServerlessDB, 
  getConnectionPool, 
  checkDatabaseHealth,
  withTransaction,
  cleanupRateLimits,
  cleanupExpiredLocks,
  getDatabaseStats
};
