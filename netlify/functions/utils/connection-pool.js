let Pool;

try {
  const { Pool: PgPool } = require('pg');
  Pool = PgPool;
} catch (error) {
  // Mock Pool for test environments
  Pool = class MockPool {
    constructor(config) {
      this.config = config;
      this.connected = false;
      this.activeConnections = 0;
    }

    async query(_sql, _params) {
      return { rows: [], rowCount: 0 };
    }

    async connect() {
      this.activeConnections++;
      return {
        query: (sql, params) => this.query(sql, params),
        release: () => {
          this.activeConnections--;
        },
      };
    }

    async end() {
      this.connected = false;
      this.activeConnections = 0;
    }
  };
}

class ConnectionPoolManager {
  constructor() {
    this.pools = new Map();
    this.maxPools = 3;
    this.defaultConfig = {
      max: 10, // Maximum connections in pool
      idleTimeoutMillis: 30000, // 30 seconds
      connectionTimeoutMillis: 5000, // 5 seconds
      acquireTimeoutMillis: 10000, // 10 seconds
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }

  getPool(databaseUrl = process.env.DATABASE_URL) {
    if (!databaseUrl || databaseUrl.startsWith('mock://')) {
      // Return mock pool for test environment
      return new Pool({ connectionString: 'mock://test' });
    }

    if (this.pools.has(databaseUrl)) {
      return this.pools.get(databaseUrl);
    }

    if (this.pools.size >= this.maxPools) {
      throw new Error('Maximum number of connection pools reached');
    }

    const config = {
      ...this.defaultConfig,
      connectionString: databaseUrl,
    };

    const pool = new Pool(config);

    // Error handling
    pool.on('error', (err, _client) => {
      console.error('Pool error:', err);
    });

    pool.on('connect', client => {
      // Set session timezone and other defaults
      client.query('SET timezone = "UTC"');
    });

    this.pools.set(databaseUrl, pool);
    return pool;
  }

  async healthCheck(pool = null) {
    const testPool = pool || this.getPool();

    try {
      const result = await testPool.query('SELECT NOW() as current_time');
      return {
        healthy: true,
        timestamp: result.rows[0].current_time,
        poolSize: testPool.totalCount,
        idle: testPool.idleCount,
        waiting: testPool.waitingCount,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  async closeAll() {
    const promises = Array.from(this.pools.values()).map(pool => pool.end());
    await Promise.all(promises);
    this.pools.clear();
  }

  getStats() {
    const stats = {};

    for (const [url, pool] of this.pools.entries()) {
      const urlKey = url.includes('@') ? url.split('@')[1] : 'default';

      stats[urlKey] = {
        total: pool.totalCount || 0,
        idle: pool.idleCount || 0,
        waiting: pool.waitingCount || 0,
      };
    }

    return stats;
  }
}

// Singleton instance
const connectionManager = new ConnectionPoolManager();

module.exports = {
  ConnectionPoolManager,
  getPool: url => connectionManager.getPool(url),
  healthCheck: () => connectionManager.healthCheck(),
  getStats: () => connectionManager.getStats(),
  closeAll: () => connectionManager.closeAll(),
};
