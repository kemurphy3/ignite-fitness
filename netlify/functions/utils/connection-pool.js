// Connection Pool Management for IgniteFitness
// Centralized database connection pooling to prevent connection exhaustion

const { neon } = require('@neondatabase/serverless');
const { Pool } = require('pg');

class ConnectionPoolManager {
  constructor() {
    this.neonClient = null;
    this.pgPool = null;
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      lastReset: new Date()
    };
  }

  // Get Neon serverless client (preferred for serverless functions)
  getNeonClient() {
    if (!this.neonClient) {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL not configured');
      }

      this.neonClient = neon(process.env.DATABASE_URL, {
        poolQueryViaFetch: true,
        fetchOptions: {
          priority: 'high',
          // Connection pooling settings
          keepalive: true,
          timeout: 30000,
          // Retry configuration
          retry: {
            retries: 3,
            retryDelay: 1000,
            retryCondition: (error) => {
              // Retry on network errors, timeouts, and temporary failures
              return error.code === 'ECONNRESET' || 
                     error.code === 'ETIMEDOUT' ||
                     error.message.includes('timeout') ||
                     error.message.includes('connection');
            }
          }
        }
      });

      console.log('✅ Neon client initialized with connection pooling');
    }
    return this.neonClient;
  }

  // Get PostgreSQL connection pool (for complex operations)
  getPgPool() {
    if (!this.pgPool) {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL not configured');
      }

      this.pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // Pool configuration
        max: 20,                    // Maximum connections in pool
        min: 2,                     // Minimum connections in pool
        idleTimeoutMillis: 30000,   // Close idle connections after 30s
        connectionTimeoutMillis: 5000, // Timeout for new connections
        statement_timeout: 30000,   // Query timeout
        query_timeout: 30000,       // Query timeout
        // SSL configuration
        ssl: { 
          rejectUnauthorized: false 
        },
        // Connection lifecycle
        allowExitOnIdle: true
      });

      // Pool event handlers
      this.pgPool.on('connect', (client) => {
        this.connectionStats.totalConnections++;
        this.connectionStats.activeConnections++;
        console.log(`📊 New connection established. Active: ${this.connectionStats.activeConnections}`);
      });

      this.pgPool.on('acquire', (client) => {
        this.connectionStats.activeConnections++;
        this.connectionStats.idleConnections = Math.max(0, this.connectionStats.idleConnections - 1);
      });

      this.pgPool.on('release', (client) => {
        this.connectionStats.activeConnections = Math.max(0, this.connectionStats.activeConnections - 1);
        this.connectionStats.idleConnections++;
      });

      this.pgPool.on('remove', (client) => {
        this.connectionStats.totalConnections = Math.max(0, this.connectionStats.totalConnections - 1);
        this.connectionStats.activeConnections = Math.max(0, this.connectionStats.activeConnections - 1);
        console.log(`📊 Connection removed. Total: ${this.connectionStats.totalConnections}`);
      });

      this.pgPool.on('error', (err, client) => {
        console.error('❌ Unexpected pool error:', err);
        this.connectionStats.activeConnections = Math.max(0, this.connectionStats.activeConnections - 1);
      });

      console.log('✅ PostgreSQL connection pool initialized');
    }
    return this.pgPool;
  }

  // Get the appropriate client based on operation type
  getClient(operationType = 'query') {
    // Use Neon for simple queries (serverless optimized)
    if (operationType === 'query' || operationType === 'simple') {
      return this.getNeonClient();
    }
    
    // Use PG pool for complex operations, transactions, or when connection reuse is critical
    if (operationType === 'transaction' || operationType === 'complex' || operationType === 'pool') {
      return this.getPgPool();
    }

    // Default to Neon for serverless functions
    return this.getNeonClient();
  }

  // Execute a query with automatic client selection
  async executeQuery(query, params = [], operationType = 'query') {
    const client = this.getClient(operationType);
    
    try {
      if (operationType === 'transaction' || operationType === 'complex') {
        // Use PG pool for complex operations
        const result = await client.query(query, params);
        return result.rows;
      } else {
        // Use Neon for simple queries
        if (params.length > 0) {
          return await client(query, params);
        } else {
          return await client(query);
        }
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  // Execute a transaction with proper connection management
  async executeTransaction(callback) {
    const pool = this.getPgPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Health check for both connection types
  async healthCheck() {
    const results = {
      neon: { healthy: false, error: null },
      pgPool: { healthy: false, error: null },
      stats: this.connectionStats
    };

    // Test Neon connection
    try {
      const neonClient = this.getNeonClient();
      await neonClient`SELECT NOW() as current_time`;
      results.neon.healthy = true;
    } catch (error) {
      results.neon.error = error.message;
    }

    // Test PG pool connection
    try {
      const pool = this.getPgPool();
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time');
      client.release();
      results.pgPool.healthy = true;
    } catch (error) {
      results.pgPool.error = error.message;
    }

    return results;
  }

  // Get connection statistics
  getStats() {
    return {
      ...this.connectionStats,
      neonClient: this.neonClient ? 'initialized' : 'not_initialized',
      pgPool: this.pgPool ? 'initialized' : 'not_initialized',
      timestamp: new Date().toISOString()
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🔄 Shutting down connection pools...');
    
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
    
    // Neon client doesn't need explicit shutdown
    this.neonClient = null;
    
    console.log('✅ Connection pools shut down successfully');
  }

  // Reset connection stats
  resetStats() {
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      lastReset: new Date()
    };
  }
}

// Singleton instance
const connectionPoolManager = new ConnectionPoolManager();

// Export convenience functions
const getNeonClient = () => connectionPoolManager.getNeonClient();
const getPgPool = () => connectionPoolManager.getPgPool();
const getClient = (operationType) => connectionPoolManager.getClient(operationType);
const executeQuery = (query, params, operationType) => connectionPoolManager.executeQuery(query, params, operationType);
const executeTransaction = (callback) => connectionPoolManager.executeTransaction(callback);
const healthCheck = () => connectionPoolManager.healthCheck();
const getStats = () => connectionPoolManager.getStats();
const shutdown = () => connectionPoolManager.shutdown();

module.exports = {
  connectionPoolManager,
  getNeonClient,
  getPgPool,
  getClient,
  executeQuery,
  executeTransaction,
  healthCheck,
  getStats,
  shutdown
};
