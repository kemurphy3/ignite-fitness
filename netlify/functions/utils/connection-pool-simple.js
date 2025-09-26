// connection-pool-simple.js
// Simplified connection pooling using only Neon (no pg dependency)

const { neon } = require('@neondatabase/serverless');

class SimpleConnectionPoolManager {
  constructor() {
    this.neonClient = null;
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      lastReset: new Date()
    };
  }

  // Get Neon serverless client with connection pooling
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
      this.connectionStats.totalConnections = 1;
    }
    return this.neonClient;
  }

  // Execute a query with automatic retry
  async executeQuery(query, params = []) {
    const client = this.getNeonClient();
    
    try {
      if (params.length > 0) {
        return await client(query, params);
      } else {
        return await client(query);
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  // Health check for Neon connection
  async healthCheck() {
    const results = {
      neon: { healthy: false, error: null },
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

    return results;
  }

  // Get connection statistics
  getStats() {
    return {
      ...this.connectionStats,
      neonClient: this.neonClient ? 'initialized' : 'not_initialized',
      timestamp: new Date().toISOString()
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🔄 Shutting down connection pool...');
    
    // Neon client doesn't need explicit shutdown
    this.neonClient = null;
    this.connectionStats.totalConnections = 0;
    this.connectionStats.activeConnections = 0;
    
    console.log('✅ Connection pool shut down successfully');
  }

  // Reset connection stats
  resetStats() {
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      lastReset: new Date()
    };
  }
}

// Singleton instance
const connectionPoolManager = new SimpleConnectionPoolManager();

// Export convenience functions
const getNeonClient = () => connectionPoolManager.getNeonClient();
const executeQuery = (query, params) => connectionPoolManager.executeQuery(query, params);
const healthCheck = () => connectionPoolManager.healthCheck();
const getStats = () => connectionPoolManager.getStats();
const shutdown = () => connectionPoolManager.shutdown();

module.exports = {
  connectionPoolManager,
  getNeonClient,
  executeQuery,
  healthCheck,
  getStats,
  shutdown
};
