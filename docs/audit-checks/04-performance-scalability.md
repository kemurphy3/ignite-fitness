# Performance & Scalability Analysis

## Executive Summary

**Performance Grade: B-** (Good foundation, needs optimization for scale)

### Strengths

- Comprehensive database indexing (55+ indexes)
- Materialized views for analytics
- Circuit breakers for external APIs
- Distributed locking mechanisms

### Critical Issues

- No connection pooling
- Missing pagination on key endpoints
- No caching layer
- Function timeout risks

## Database Performance Analysis

### ✅ Existing Indexes (Well-Optimized)

```sql
-- User lookups
CREATE INDEX idx_users_external_id ON users(external_id);
CREATE INDEX idx_users_role ON users(role) WHERE role = 'admin';

-- Session queries
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_user_date ON sessions(user_id, created_at);
CREATE INDEX idx_sessions_type_date ON sessions(session_type, created_at);
CREATE UNIQUE INDEX idx_sessions_hash ON sessions(session_hash);

-- Exercise lookups
CREATE INDEX idx_exercises_session_order ON session_exercises(session_id, order_index, created_at, id);
CREATE INDEX idx_exercises_request_hash ON session_exercises(user_id, request_hash);

-- Strava integration
CREATE INDEX idx_strava_tokens_expires_at ON strava_tokens(expires_at);
CREATE INDEX idx_integrations_strava_status ON integrations_strava(last_status);
```

### 🔴 Missing Critical Indexes

```sql
-- Add these for better performance
CREATE INDEX idx_users_email ON users(email);  -- Login queries
CREATE INDEX idx_sessions_user_type_date ON sessions(user_id, type, start_at DESC);  -- Filtered lists
CREATE INDEX idx_exercises_user_name ON exercises(user_id, name);  -- Exercise search
CREATE INDEX idx_sessions_payload_gin ON sessions USING gin(payload);  -- JSON search
```

### Materialized Views (Implemented)

```sql
-- Daily aggregates for fast analytics
CREATE MATERIALIZED VIEW mv_sessions_daily AS
SELECT
    date_utc,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) as total_sessions,
    AVG(duration_minutes) as avg_duration
FROM sessions
GROUP BY date_utc;

-- Refresh strategy needed
CREATE OR REPLACE FUNCTION refresh_mv_sessions_daily()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sessions_daily;
END;
$$ LANGUAGE plpgsql;

-- Schedule: Run daily at 2 AM UTC via cron
```

## 🔴 Connection Pooling Issue

### Current Problem

Each function creates a new database connection:

```javascript
// INEFFICIENT - Current implementation
exports.handler = async event => {
  const sql = neon(process.env.DATABASE_URL); // New connection!
  // ... query
};
```

### Required Fix

```javascript
// /netlify/functions/utils/db-pool.js
const { Pool } = require('@neondatabase/serverless');

let pool;
const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10, // Max connections
      min: 2, // Min idle connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      statement_timeout: 10000,
      query_timeout: 10000,
      ssl: { rejectUnauthorized: false },
    });

    // Handle pool errors
    pool.on('error', err => {
      console.error('Unexpected pool error', err);
    });
  }
  return pool;
};

// Usage in functions
exports.handler = async event => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT ...');
    return result;
  } finally {
    client.release();
  }
};
```

## Pagination Analysis

### ❌ Missing Pagination (High Risk)

**Affected Endpoints:**

- `sessions-list.js` - Could return thousands of records
- `admin-get-all-users.js` - Returns entire user table
- `sessions-exercises-list.js` - No limit on exercises

### ✅ Good Pagination Implementation

**admin-users-top.js** implements keyset pagination correctly:

```javascript
const query = after
  ? sql`SELECT * FROM users WHERE id > ${after} ORDER BY id LIMIT ${limit}`
  : sql`SELECT * FROM users ORDER BY id LIMIT ${limit}`;

return {
  data: results,
  pagination: {
    hasMore: results.length === limit,
    nextCursor: results[results.length - 1]?.id,
  },
};
```

### Recommended Pagination Pattern

```javascript
// Cursor-based pagination utility
class Paginator {
  static async paginate(query, params = {}) {
    const {
      cursor = null,
      limit = 20,
      orderBy = 'id',
      orderDir = 'DESC',
    } = params;

    const results = await query(cursor, limit + 1);
    const hasMore = results.length > limit;

    if (hasMore) results.pop();

    return {
      data: results,
      pagination: {
        hasMore,
        nextCursor: hasMore ? results[results.length - 1][orderBy] : null,
        limit,
      },
    };
  }
}
```

## Caching Strategy

### Current State: No Caching ❌

### Recommended Implementation

```javascript
// /netlify/functions/utils/cache.js
class Cache {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  set(key, value, ttlSeconds = 300) {
    this.store.set(key, value);
    this.ttls.set(key, Date.now() + ttlSeconds * 1000);

    // Auto-cleanup
    setTimeout(() => this.delete(key), ttlSeconds * 1000);
  }

  get(key) {
    const ttl = this.ttls.get(key);
    if (!ttl || Date.now() > ttl) {
      this.delete(key);
      return null;
    }
    return this.store.get(key);
  }

  delete(key) {
    this.store.delete(key);
    this.ttls.delete(key);
  }
}

// Usage example
const cache = new Cache();

exports.handler = async event => {
  const cacheKey = `user:${userId}:profile`;

  // Check cache
  let profile = cache.get(cacheKey);
  if (profile) {
    return {
      statusCode: 200,
      body: JSON.stringify(profile),
      headers: { 'X-Cache': 'HIT' },
    };
  }

  // Fetch from DB
  profile = await sql`SELECT * FROM user_profiles WHERE user_id = ${userId}`;

  // Cache for 5 minutes
  cache.set(cacheKey, profile, 300);

  return {
    statusCode: 200,
    body: JSON.stringify(profile),
    headers: { 'X-Cache': 'MISS' },
  };
};
```

## Function Timeout Configuration

### Current Issues

- Default Netlify timeout: 10 seconds
- Strava import may exceed this
- No timeout handling in long operations

### Recommended Configuration

```toml
# netlify.toml
[functions]
  # Default timeout
  timeout = 10

[functions."integrations-strava-import"]
  timeout = 26  # Max allowed

[functions."admin-sessions-series"]
  timeout = 15  # Complex aggregations
```

### Timeout Handling

```javascript
// Add timeout wrapper
const withTimeout = (fn, timeoutMs = 9000) => {
  return async (...args) => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Function timeout')), timeoutMs)
    );

    return Promise.race([fn(...args), timeoutPromise]);
  };
};
```

## N+1 Query Problems

### Found in:

1. **sessions-exercises-list.js** - Fetches session then exercises separately
2. **admin-overview.js** - Multiple queries for aggregates

### Fix with JOIN:

```javascript
// INEFFICIENT - N+1 queries
const session = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
for (const exercise of session.exercises) {
  const details = await sql`SELECT * FROM exercises WHERE id = ${exercise.id}`;
}

// EFFICIENT - Single query
const result = await sql`
    SELECT 
        s.*,
        json_agg(
            json_build_object(
                'id', e.id,
                'name', e.name,
                'sets', e.sets
            ) ORDER BY e.order_index
        ) as exercises
    FROM sessions s
    LEFT JOIN exercises e ON e.session_id = s.id
    WHERE s.id = ${sessionId}
    GROUP BY s.id
`;
```

## Rate Limiting Performance

### Current Implementation

Database-backed rate limiting adds latency:

```sql
CREATE TABLE exercise_rate_limits (
    user_id INTEGER,
    endpoint VARCHAR(100),
    created_at TIMESTAMP
);
```

### Optimized Approach

```javascript
// Memory-based sliding window
class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 100) {
    this.windows = new Map();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(key) {
    const now = Date.now();
    const window = this.windows.get(key) || [];

    // Remove old entries
    const validWindow = window.filter(time => now - time < this.windowMs);

    if (validWindow.length >= this.maxRequests) {
      return false;
    }

    validWindow.push(now);
    this.windows.set(key, validWindow);

    return true;
  }
}
```

## Performance Metrics

### Current Estimated Performance

| Metric               | Current   | Target  | Gap         |
| -------------------- | --------- | ------- | ----------- |
| Avg Response Time    | ~500ms    | <200ms  | -60%        |
| P95 Response Time    | ~2000ms   | <500ms  | -75%        |
| P99 Response Time    | ~5000ms   | <1000ms | -80%        |
| Max Concurrent Users | ~100      | 1000+   | 10x         |
| Requests per Second  | ~50       | 500+    | 10x         |
| Database Connections | Unlimited | 20      | Pool needed |
| Cache Hit Rate       | 0%        | 80%+    | Implement   |

### Load Testing Script

```javascript
// load-test.js
const autocannon = require('autocannon');

const result = await autocannon({
  url: 'https://your-app.netlify.app/.netlify/functions/sessions-list',
  connections: 100,
  pipelining: 10,
  duration: 30,
  headers: {
    'X-API-Key': 'test-key',
  },
});

console.log('Latency (mean):', result.latency.mean);
console.log('Requests/sec:', result.requests.mean);
console.log('Errors:', result.errors);
```

## Scalability Bottlenecks

### 1. Database Connection Limits

- **Neon Free Tier:** 100 connections max
- **Current Usage:** 1 per request (wasteful)
- **Fix:** Connection pooling (10-20 connections)

### 2. Netlify Function Limits

- **Free Tier:** 125k invocations/month
- **At 100 users:** ~150k/month (exceeds)
- **Fix:** Implement caching, reduce calls

### 3. Memory Usage

- **Function Memory:** 1024MB default
- **Large Result Sets:** OOM risk
- **Fix:** Pagination, streaming responses

### 4. Cold Start Times

- **Current:** ~1-2 seconds
- **Mitigation:** Keep-warm strategy

```javascript
// Keep-warm scheduled function
exports.handler = async event => {
  if (event.httpMethod === 'POST' && event.headers['x-keep-warm']) {
    return { statusCode: 200, body: 'warm' };
  }
  // Regular logic...
};
```

## Optimization Priorities

### Immediate (Day 1)

1. ⚡ Implement connection pooling
2. ⚡ Add pagination to list endpoints
3. ⚡ Fix N+1 queries

### Short-term (Week 1)

1. 📦 Implement caching layer
2. 📦 Add missing database indexes
3. 📦 Configure function timeouts

### Medium-term (Month 1)

1. 🚀 Set up CDN for static assets
2. 🚀 Implement request batching
3. 🚀 Add response compression

### Long-term

1. 🎯 Consider edge functions
2. 🎯 Implement GraphQL for efficient queries
3. 🎯 Add read replicas for scaling

## Cost Optimization

### Current Monthly Costs (100 users)

- Netlify Functions: $0 (under limit)
- Neon Database: $0 (free tier)
- API Calls: ~$24 (OpenAI/Anthropic)

### At Scale (1000 users)

- Netlify Functions: $25 (Pro plan)
- Neon Database: $19 (10GB)
- API Calls: ~$240
- **Total:** ~$284/month

### Cost Reduction Strategies

1. Cache AI responses (60% reduction)
2. Batch similar requests (30% reduction)
3. Use cheaper models when possible (40% reduction)
4. Implement smart prefetching

## Performance Checklist

| Optimization         | Status | Priority | Impact |
| -------------------- | ------ | -------- | ------ |
| Connection Pooling   | ❌     | CRITICAL | High   |
| Query Pagination     | ❌     | CRITICAL | High   |
| Response Caching     | ❌     | HIGH     | High   |
| Database Indexes     | ⚠️     | HIGH     | Medium |
| N+1 Query Prevention | ⚠️     | MEDIUM   | Medium |
| Function Timeouts    | ❌     | MEDIUM   | Low    |
| Rate Limiting        | ✅     | LOW      | Low    |
| Circuit Breakers     | ✅     | LOW      | Low    |
| Response Compression | ❌     | LOW      | Low    |
| CDN Integration      | ❌     | LOW      | Medium |

## Recommended Monitoring

### Add Performance Tracking

```javascript
// Add to all functions
const startTime = Date.now();

// ... function logic

const duration = Date.now() - startTime;
console.log('Performance:', {
  function: context.functionName,
  duration,
  memory: process.memoryUsage(),
  requestId,
});
```

### Metrics to Track

1. Response time percentiles (P50, P95, P99)
2. Error rates by endpoint
3. Database query times
4. Cache hit rates
5. Memory usage patterns
6. Cold start frequency

## Conclusion

The application has good foundational performance features (indexes,
materialized views) but lacks critical optimizations for production scale.
Implementing connection pooling and pagination are immediate requirements. With
the recommended optimizations, the system could handle 10x current load with
better response times and lower costs.
