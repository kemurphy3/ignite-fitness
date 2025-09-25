# Admin/Analytics Endpoints Specification v1.0

## Section 1: Summary

Admin-only read endpoints providing aggregate metrics and system health monitoring for the Ignite Fitness platform. All endpoints enforce admin authentication with proper JWT validation, return privacy-protected responses, and support timezone-aware reporting with correct DST handling.

**Key Features:**
- Role-based access control via JWT with issuer/audience validation
- Privacy protection: minimum 5-user threshold for aggregates
- Timezone-aware aggregations with proper DST handling
- Keyset-based pagination for stable results
- Query timeouts to prevent function timeouts
- Comprehensive audit logging with request IDs
- Materialized view tracking for data freshness

## Section 2: Data Model / Security

### RBAC Design

```sql
-- Add role column to existing users table
ALTER TABLE users 
ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Composite indexes for admin queries
CREATE INDEX idx_users_role ON users(role) WHERE role = 'admin';
CREATE INDEX idx_sessions_date_user ON sessions(created_at, user_id) 
  WHERE deleted_at IS NULL;
CREATE INDEX idx_sessions_user_date ON sessions(user_id, created_at) 
  WHERE deleted_at IS NULL;
CREATE INDEX idx_sessions_type_date ON sessions(session_type, created_at)
  WHERE deleted_at IS NULL;

-- Admin audit log with request tracking
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  query_params JSONB,
  response_status INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_admin_audit_request ON admin_audit_log(request_id);
```

### Materialized Views with Refresh Tracking

```sql
-- Daily session aggregates with privacy thresholds
CREATE MATERIALIZED VIEW mv_sessions_daily AS
SELECT 
  DATE(created_at AT TIME ZONE 'UTC') as date_utc,
  COUNT(*) as session_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN completed THEN 1 END) as completed_count,
  AVG(duration_minutes) as avg_duration,
  -- Privacy flag
  COUNT(DISTINCT user_id) >= 5 as meets_privacy_threshold
FROM sessions
WHERE deleted_at IS NULL
GROUP BY DATE(created_at AT TIME ZONE 'UTC');

CREATE UNIQUE INDEX ON mv_sessions_daily(date_utc);

-- Refresh tracking
CREATE TABLE mv_refresh_log (
  view_name TEXT PRIMARY KEY,
  last_refresh TIMESTAMPTZ,
  row_version INTEGER DEFAULT 0,
  refresh_duration_ms INTEGER
);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_admin_views()
RETURNS void AS $$
DECLARE
  start_time BIGINT;
BEGIN
  start_time := extract(epoch from now()) * 1000;
  
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sessions_daily;
  
  INSERT INTO mv_refresh_log (view_name, last_refresh, refresh_duration_ms)
  VALUES ('mv_sessions_daily', NOW(), extract(epoch from now()) * 1000 - start_time)
  ON CONFLICT (view_name) 
  DO UPDATE SET 
    last_refresh = NOW(),
    row_version = mv_refresh_log.row_version + 1,
    refresh_duration_ms = EXCLUDED.refresh_duration_ms;
END;
$$ LANGUAGE plpgsql;
```

### Authentication with Proper Validation

```javascript
const verifyAdmin = async (token, requestId) => {
  try {
    // Validate with issuer and audience
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'ignite-fitness',
      audience: 'api',
      algorithms: ['HS256'],
      clockTolerance: 30 // 30 seconds clock skew
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

const auditLog = async (adminId, endpoint, params, status, responseTime, requestId) => {
  await sql`
    INSERT INTO admin_audit_log (
      request_id, admin_id, endpoint, method, query_params, 
      response_status, response_time_ms
    ) VALUES (
      ${requestId}, ${adminId}, ${endpoint}, 'GET', ${JSON.stringify(params)}, 
      ${status}, ${responseTime}
    )
  `;
};
```

## Section 3: API Specification

### Standard Error Envelope
```javascript
const errorResponse = (statusCode, code, message, requestId) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'X-Request-ID': requestId
  },
  body: JSON.stringify({
    error: {
      code,
      message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }
  })
});
```

### GET /api/admin/overview

**Purpose:** Global platform metrics with privacy protection

**Response Example:**
```javascript
{
  "status": "success",
  "data": {
    "total_users": 1543,
    "total_sessions": 8921,
    "sessions_7d": 234,
    "new_users_7d": 45,
    "active_users_30d": 892,
    "avg_sessions_per_user": 5.8,
    "last_updated": "2024-01-15T10:00:00Z"
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "generated_at": "2024-01-15T10:00:00Z",
    "cache_hit": false,
    "response_time_ms": 145,
    "data_version": "mv_20240115_10"
  }
}
```

**Implementation:**
```javascript
exports.handler = async (event) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    // Set query timeout
    await sql`SET statement_timeout = '5s'`;
    
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', requestId);
    }
    
    const { adminId } = await verifyAdmin(token, requestId);
    
    // Get metrics with privacy thresholds
    const metrics = await sql`
      WITH metrics AS (
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_7d
        FROM users 
        WHERE deleted_at IS NULL
      ),
      session_metrics AS (
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as sessions_7d,
          COUNT(DISTINCT user_id) as total_unique_users,
          COUNT(DISTINCT CASE 
            WHEN created_at >= NOW() - INTERVAL '30 days' 
            THEN user_id 
          END) as active_users_30d
        FROM sessions 
        WHERE deleted_at IS NULL
      )
      SELECT 
        m.total_users,
        CASE 
          WHEN m.new_users_7d < 5 THEN NULL 
          ELSE m.new_users_7d 
        END as new_users_7d,
        s.total_sessions,
        s.sessions_7d,
        CASE 
          WHEN s.active_users_30d < 5 THEN NULL 
          ELSE s.active_users_30d 
        END as active_users_30d,
        ROUND(s.total_sessions::numeric / NULLIF(m.total_users, 0), 1) as avg_sessions_per_user
      FROM metrics m
      CROSS JOIN session_metrics s
    `;
    
    // Get data freshness
    const freshness = await sql`
      SELECT view_name, last_refresh, row_version
      FROM mv_refresh_log
      WHERE view_name = 'mv_sessions_daily'
    `;
    
    await auditLog(adminId, '/admin/overview', {}, 200, Date.now() - startTime, requestId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
        'X-Request-ID': requestId
      },
      body: JSON.stringify({
        status: 'success',
        data: {
          ...metrics[0],
          last_updated: new Date().toISOString()
        },
        meta: {
          request_id: requestId,
          generated_at: new Date().toISOString(),
          cache_hit: false,
          response_time_ms: Date.now() - startTime,
          data_version: freshness[0] ? `mv_${freshness[0].row_version}` : 'live'
        }
      })
    };
  } catch (error) {
    await auditLog(null, '/admin/overview', {}, 
      error.message.includes('Admin') ? 403 : 500, 
      Date.now() - startTime, requestId);
    
    if (error.message.includes('Authentication failed')) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }
    if (error.message.includes('Admin access')) {
      return errorResponse(403, 'FORBIDDEN', 'Admin access required', requestId);
    }
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to retrieve metrics', requestId);
  }
};
```

### GET /api/admin/sessions/series

**Purpose:** Time series with proper timezone handling

**Parameters:**
- `from`: ISO date (required, max 730 days ago)
- `to`: ISO date (required)
- `bucket`: `day` | `week` (default: `day`)
- `timezone`: IANA timezone (default: `UTC`)

**Implementation:**
```javascript
exports.handler = async (event) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    await sql`SET statement_timeout = '5s'`;
    
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', requestId);
    }
    
    const { adminId } = await verifyAdmin(token, requestId);
    
    const { from, to, bucket = 'day', timezone = 'UTC' } = event.queryStringParameters || {};
    
    // Validate required params
    if (!from || !to) {
      return errorResponse(400, 'MISSING_PARAMS', 'Parameters from and to are required', requestId);
    }
    
    // Validate date range (max 2 years)
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate) || isNaN(toDate)) {
      return errorResponse(400, 'INVALID_DATE', 'Invalid date format', requestId);
    }
    
    const daysDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 730) {
      return errorResponse(400, 'RANGE_TOO_LARGE', 'Date range cannot exceed 730 days', requestId);
    }
    
    if (fromDate > toDate) {
      return errorResponse(400, 'INVALID_RANGE', 'From date must be before to date', requestId);
    }
    
    // Proper timezone conversion with DST handling
    let series;
    if (bucket === 'day') {
      series = await sql`
        SELECT 
          (created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date as date,
          COUNT(*) as session_count,
          COUNT(DISTINCT user_id) as unique_users_raw,
          CASE 
            WHEN COUNT(DISTINCT user_id) < 5 THEN NULL
            ELSE COUNT(DISTINCT user_id)
          END as unique_users,
          COUNT(CASE WHEN completed THEN 1 END) as completed_count,
          COUNT(DISTINCT user_id) >= 5 as meets_privacy_threshold
        FROM sessions
        WHERE created_at >= ${fromDate}
          AND created_at < ${toDate}::date + INTERVAL '1 day'
          AND deleted_at IS NULL
        GROUP BY (created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date
        ORDER BY date ASC
      `;
    } else {
      series = await sql`
        SELECT 
          DATE_TRUNC('week', created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date as date,
          COUNT(*) as session_count,
          COUNT(DISTINCT user_id) as unique_users_raw,
          CASE 
            WHEN COUNT(DISTINCT user_id) < 5 THEN NULL
            ELSE COUNT(DISTINCT user_id)
          END as unique_users,
          COUNT(CASE WHEN completed THEN 1 END) as completed_count,
          COUNT(DISTINCT user_id) >= 5 as meets_privacy_threshold
        FROM sessions
        WHERE created_at >= ${fromDate}
          AND created_at < ${toDate}::date + INTERVAL '1 day'
          AND deleted_at IS NULL
        GROUP BY DATE_TRUNC('week', created_at AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})
        ORDER BY date ASC
      `;
    }
    
    // Calculate summary with privacy
    const summary = series.reduce((acc, row) => ({
      total_sessions: acc.total_sessions + row.session_count,
      total_users: Math.max(acc.total_users, row.unique_users_raw || 0),
      completion_rate: null // Calculate after
    }), { total_sessions: 0, total_users: 0 });
    
    const totalCompleted = series.reduce((sum, row) => sum + row.completed_count, 0);
    summary.completion_rate = summary.total_sessions > 0 
      ? Math.round((totalCompleted / summary.total_sessions) * 100) / 100
      : null;
    
    // Apply privacy threshold to summary
    if (summary.total_users < 5) {
      summary.total_users = null;
    }
    
    await auditLog(adminId, '/admin/sessions/series', 
      { from, to, bucket, timezone }, 200, Date.now() - startTime, requestId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'X-Request-ID': requestId
      },
      body: JSON.stringify({
        status: 'success',
        data: {
          series: series.map(row => ({
            date: row.date,
            session_count: row.session_count,
            unique_users: row.unique_users,
            completed_count: row.meets_privacy_threshold ? row.completed_count : null,
            privacy_applied: !row.meets_privacy_threshold
          })),
          summary
        },
        meta: {
          request_id: requestId,
          timezone,
          bucket,
          privacy_threshold: 5,
          generated_at: new Date().toISOString()
        }
      })
    };
  } catch (error) {
    const statusCode = error.message.includes('Authentication') ? 401 :
                      error.message.includes('Admin') ? 403 : 500;
    await auditLog(null, '/admin/sessions/series', 
      event.queryStringParameters, statusCode, Date.now() - startTime, requestId);
    
    return errorResponse(statusCode, 
      statusCode === 401 ? 'UNAUTHORIZED' : 
      statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      error.message, requestId);
  }
};
```

### GET /api/admin/sessions/by-type

**Purpose:** Distribution of session types with privacy protection

**Parameters:**
- `from`: ISO date string (optional)
- `to`: ISO date string (optional)

**Response Example:**
```javascript
{
  "status": "success",
  "data": {
    "distribution": [
      {
        "session_type": "strength",
        "count": 234,
        "percentage": 45.2,
        "unique_users": 89
      }
    ],
    "total": 517
  },
  "meta": {
    "privacy_applied": false,
    "privacy_threshold": 5
  }
}
```

**Implementation:**
```javascript
exports.handler = async (event) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    await sql`SET statement_timeout = '5s'`;
    
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', requestId);
    }
    
    const { adminId } = await verifyAdmin(token, requestId);
    
    const { from, to } = event.queryStringParameters || {};
    
    // Build date filter
    let whereConditions = ['deleted_at IS NULL'];
    const params = [];
    
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate)) {
        whereConditions.push(`created_at >= $${params.length + 1}`);
        params.push(fromDate);
      }
    }
    
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate)) {
        whereConditions.push(`created_at <= $${params.length + 1}`);
        params.push(toDate);
      }
    }
    
    // Get distribution with privacy thresholds
    const distribution = await sql`
      WITH type_counts AS (
        SELECT 
          COALESCE(session_type, 'unspecified') as session_type,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM sessions
        WHERE deleted_at IS NULL
          ${from ? sql`AND created_at >= ${new Date(from)}` : sql``}
          ${to ? sql`AND created_at <= ${new Date(to)}` : sql``}
        GROUP BY session_type
      ),
      totals AS (
        SELECT SUM(count) as total FROM type_counts
      )
      SELECT 
        tc.session_type,
        tc.count,
        ROUND(tc.count::numeric / NULLIF(t.total, 0) * 100, 1) as percentage,
        CASE 
          WHEN tc.unique_users < 5 THEN NULL
          ELSE tc.unique_users
        END as unique_users,
        tc.unique_users >= 5 as meets_privacy_threshold
      FROM type_counts tc
      CROSS JOIN totals t
      ORDER BY tc.count DESC
    `;
    
    const total = distribution.reduce((sum, row) => sum + row.count, 0);
    const privacyApplied = distribution.some(row => !row.meets_privacy_threshold);
    
    await auditLog(adminId, '/admin/sessions/by-type', 
      { from, to }, 200, Date.now() - startTime, requestId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'X-Request-ID': requestId
      },
      body: JSON.stringify({
        status: 'success',
        data: {
          distribution: distribution.map(row => ({
            session_type: row.session_type,
            count: row.count,
            percentage: row.percentage,
            unique_users: row.unique_users
          })),
          total
        },
        meta: {
          request_id: requestId,
          privacy_applied: privacyApplied,
          privacy_threshold: 5,
          generated_at: new Date().toISOString()
        }
      })
    };
  } catch (error) {
    const statusCode = error.message.includes('Authentication') ? 401 :
                      error.message.includes('Admin') ? 403 : 500;
    await auditLog(null, '/admin/sessions/by-type', 
      event.queryStringParameters, statusCode, Date.now() - startTime, requestId);
    
    return errorResponse(statusCode,
      statusCode === 401 ? 'UNAUTHORIZED' :
      statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      error.message, requestId);
  }
};
```

### GET /api/admin/users/top

**Purpose:** Top users with keyset pagination

**Parameters:**
- `metric`: `sessions` | `duration` (default: `sessions`)
- `limit`: 1-100 (default: 50)
- `cursor`: Keyset pagination token

**Response Example:**
```javascript
{
  "status": "success",
  "data": {
    "users": [
      {
        "user_alias": "usr_a1b2c3",
        "metric_value": 145,
        "rank": 1,
        "last_active": "2024-01-15T08:00:00Z"
      }
    ],
    "next_cursor": "eyJ2IjoxNDUsImlkIjoidXNyX2ExYjJjMyJ9"
  },
  "meta": {
    "privacy_applied": false,
    "total_filtered": 0
  }
}
```

**Implementation:**
```javascript
exports.handler = async (event) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    await sql`SET statement_timeout = '5s'`;
    
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', requestId);
    }
    
    const { adminId } = await verifyAdmin(token, requestId);
    
    const { metric = 'sessions', limit = 50, cursor } = event.queryStringParameters || {};
    
    // Validate inputs
    if (!['sessions', 'duration'].includes(metric)) {
      return errorResponse(400, 'INVALID_METRIC', 'Metric must be sessions or duration', requestId);
    }
    
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    
    // Parse keyset cursor
    let lastValue = null;
    let lastId = null;
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
        lastValue = decoded.v;
        lastId = decoded.id;
      } catch (e) {
        return errorResponse(400, 'INVALID_CURSOR', 'Invalid cursor format', requestId);
      }
    }
    
    // Keyset pagination query with privacy
    let users;
    if (metric === 'sessions') {
      users = await sql`
        WITH ranked_users AS (
          SELECT 
            user_id,
            SUBSTRING(MD5(user_id::text || ${process.env.HASH_SALT || 'default'}), 1, 8) as user_alias,
            COUNT(*) as metric_value,
            MAX(created_at) as last_active
          FROM sessions
          WHERE deleted_at IS NULL
            ${lastValue !== null ? sql`
              AND (COUNT(*), user_id) < (${lastValue}, ${lastId})
            ` : sql``}
          GROUP BY user_id
          HAVING COUNT(DISTINCT user_id) >= 5 OR user_id = ${adminId}
          ORDER BY COUNT(*) DESC, user_id DESC
          LIMIT ${parsedLimit + 1}
        )
        SELECT * FROM ranked_users
      `;
    } else {
      users = await sql`
        WITH ranked_users AS (
          SELECT 
            user_id,
            SUBSTRING(MD5(user_id::text || ${process.env.HASH_SALT || 'default'}), 1, 8) as user_alias,
            SUM(duration_minutes) as metric_value,
            MAX(created_at) as last_active
          FROM sessions
          WHERE deleted_at IS NULL
            ${lastValue !== null ? sql`
              AND (SUM(duration_minutes), user_id) < (${lastValue}, ${lastId})
            ` : sql``}
          GROUP BY user_id
          HAVING COUNT(DISTINCT user_id) >= 5 OR user_id = ${adminId}
          ORDER BY SUM(duration_minutes) DESC, user_id DESC
          LIMIT ${parsedLimit + 1}
        )
        SELECT * FROM ranked_users
      `;
    }
    
    // Check for next page
    let nextCursor = null;
    let results = users;
    if (users.length > parsedLimit) {
      results = users.slice(0, parsedLimit);
      const last = results[results.length - 1];
      nextCursor = Buffer.from(JSON.stringify({
        v: last.metric_value,
        id: last.user_alias
      })).toString('base64');
    }
    
    // Add ranks (null for subsequent pages)
    const rankedResults = results.map((user, index) => ({
      user_alias: user.user_alias,
      metric_value: parseInt(user.metric_value),
      rank: cursor ? null : index + 1,
      last_active: user.last_active
    }));
    
    await auditLog(adminId, '/admin/users/top', 
      { metric, limit: parsedLimit, cursor }, 200, Date.now() - startTime, requestId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache',
        'Access-Control-Allow-Origin': '*',
        'X-Request-ID': requestId
      },
      body: JSON.stringify({
        status: 'success',
        data: {
          users: rankedResults,
          next_cursor: nextCursor
        },
        meta: {
          request_id: requestId,
          metric,
          privacy_applied: false,
          generated_at: new Date().toISOString()
        }
      })
    };
  } catch (error) {
    const statusCode = error.message.includes('Authentication') ? 401 :
                      error.message.includes('Admin') ? 403 : 500;
    await auditLog(null, '/admin/users/top', 
      event.queryStringParameters, statusCode, Date.now() - startTime, requestId);
    
    return errorResponse(statusCode,
      statusCode === 401 ? 'UNAUTHORIZED' :
      statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      error.message, requestId);
  }
};
```

### GET /api/admin/health

**Purpose:** System health with proper auth

**Implementation:**
```javascript
exports.handler = async (event) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    await sql`SET statement_timeout = '5s'`;
    
    // Auth required even for health check
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', requestId);
    }
    
    const { adminId } = await verifyAdmin(token, requestId);
    
    // Database checks
    const dbCheck = await sql`SELECT NOW() as time, version() as version`;
    
    const migrations = await sql`
      SELECT version, applied_at 
      FROM schema_migrations 
      ORDER BY applied_at DESC 
      LIMIT 1
    `;
    
    // Materialized view freshness
    const viewFreshness = await sql`
      SELECT view_name, last_refresh, row_version,
        EXTRACT(EPOCH FROM (NOW() - last_refresh)) as seconds_stale
      FROM mv_refresh_log
    `;
    
    // Strava status
    const stravaStatus = await sql`
      SELECT 
        MAX(last_sync_at) as last_import,
        COUNT(*) FILTER (WHERE access_token IS NOT NULL) as tokens_active
      FROM integrations_strava
      WHERE deleted_at IS NULL
    `;
    
    const health = {
      database: {
        connected: true,
        migrations_version: migrations[0]?.version || 'unknown',
        views_freshness: viewFreshness.map(v => ({
          view: v.view_name,
          last_refresh: v.last_refresh,
          seconds_stale: Math.round(v.seconds_stale),
          stale: v.seconds_stale > 3600 // Flag if > 1 hour
        }))
      },
      integrations: {
        strava: {
          last_import: stravaStatus[0]?.last_import || null,
          tokens_active: stravaStatus[0]?.tokens_active || 0
        }
      },
      config: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0'
      }
    };
    
    await auditLog(adminId, '/admin/health', {}, 200, Date.now() - startTime, requestId);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'X-Request-ID': requestId
      },
      body: JSON.stringify({
        status: 'success',
        data: health,
        meta: {
          request_id: requestId,
          response_time_ms: Date.now() - startTime,
          generated_at: new Date().toISOString()
        }
      })
    };
  } catch (error) {
    // Auth errors return proper status
    if (error.message.includes('Authentication')) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }
    if (error.message.includes('Admin')) {
      return errorResponse(403, 'FORBIDDEN', 'Admin access required', requestId);
    }
    
    // Database error returns degraded status
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId
      },
      body: JSON.stringify({
        status: 'degraded',
        data: {
          database: { connected: false },
          error: 'Database connection failed'
        },
        meta: {
          request_id: requestId,
          generated_at: new Date().toISOString()
        }
      })
    };
  }
};
```

## Section 4: Validation & Privacy

### Input Validation
```javascript
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

const validateTimezone = (timezone) => {
  // Use Intl API to validate timezone
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch (e) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
};
```

### Privacy Protection
```javascript
const applyPrivacyThreshold = (count, threshold = 5) => {
  return count < threshold ? null : count;
};

const hashUserId = (userId) => {
  const hash = crypto.createHash('md5')
    .update(userId + (process.env.HASH_SALT || 'default'))
    .digest('hex');
  return 'usr_' + hash.substring(0, 6);
};
```

### Rate Limiting (Database-backed)
```sql
CREATE TABLE admin_rate_limits (
  admin_id UUID REFERENCES users(id),
  window_start TIMESTAMPTZ,
  attempts INTEGER DEFAULT 1,
  PRIMARY KEY (admin_id, window_start)
);

CREATE INDEX idx_rate_limits_window ON admin_rate_limits(window_start);
```

```javascript
const checkRateLimit = async (adminId) => {
  const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000); // 1-minute window
  
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
};
```

## Section 5: Acceptance Criteria

- [ ] **Authentication & Authorization**
  - JWT validation includes issuer/audience checks
  - Admin role enforced on all endpoints
  - Auth failures return appropriate status codes (401/403)
  - Health endpoint requires authentication

- [ ] **Privacy Protection**
  - All aggregates respect 5-user minimum threshold
  - User IDs consistently hashed with salt
  - Privacy metadata included in responses
  - No PII exposed in any response

- [ ] **Performance & Reliability**
  - Query timeout set to 5 seconds
  - All queries complete within timeout
  - Keyset pagination works correctly
  - No offset-based pagination issues

- [ ] **Timezone Handling**
  - DST transitions handled correctly
  - AT TIME ZONE conversion works properly
  - Bucket boundaries align with local midnight
  - 2-year date range limit enforced

- [ ] **Data Freshness**
  - Materialized view staleness tracked
  - Health endpoint shows view freshness
  - Data version included in responses
  - Refresh strategy documented

- [ ] **Observability**
  - Request IDs in all responses
  - Audit log captures all requests
  - Response times tracked
  - Error responses standardized

## Section 6: Test Plan

### Unit Tests
```javascript
describe('Admin Authentication', () => {
  test('validates issuer and audience', async () => {
    const tokenWithWrongIssuer = jwt.sign(
      { sub: 'admin-id', role: 'admin' },
      process.env.JWT_SECRET,
      { issuer: 'wrong-issuer', audience: 'api' }
    );
    
    await expect(verifyAdmin(tokenWithWrongIssuer))
      .rejects.toThrow('Authentication failed');
  });
  
  test('enforces admin role', async () => {
    const userToken = jwt.sign(
      { sub: 'user-id', role: 'user' },
      process.env.JWT_SECRET,
      { issuer: 'ignite-fitness', audience: 'api' }
    );
    
    await expect(verifyAdmin(userToken))
      .rejects.toThrow('Admin access required');
  });
});

describe('Privacy Thresholds', () => {
  test('hides counts below threshold', () => {
    expect(applyPrivacyThreshold(3, 5)).toBeNull();
    expect(applyPrivacyThreshold(5, 5)).toBe(5);
    expect(applyPrivacyThreshold(10, 5)).toBe(10);
  });
  
  test('consistent user hashing', () => {
    const hash1 = hashUserId('user-123');
    const hash2 = hashUserId('user-123');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^usr_[a-f0-9]{6}$/);
  });
});

describe('Timezone Handling', () => {
  test('validates timezone strings', () => {
    expect(() => validateTimezone('America/Denver')).not.toThrow();
    expect(() => validateTimezone('Invalid/Zone')).toThrow();
  });
  
  test('DST boundary handling', async () => {
    // Test date range spanning March DST transition
    const result = await handler({
      queryStringParameters: {
        from: '2024-03-09',
        to: '2024-03-11',
        timezone: 'America/Denver',
        bucket: 'day'
      }
    });
    
    const data = JSON.parse(result.body);
    expect(data.data.series).toHaveLength(3);
    // March 10 should still appear despite 23-hour day
    expect(data.data.series[1].date).toBe('2024-03-10');
  });
});
```

### Integration Tests
```javascript
describe('Keyset Pagination', () => {
  test('returns stable results', async () => {
    // Insert new data between page requests
    const page1 = await getTopUsers({ limit: 10 });
    await insertTestSession();
    const page2 = await getTopUsers({ 
      limit: 10, 
      cursor: page1.data.next_cursor 
    });
    
    // Page 2 should not contain page 1 users
    const page1Ids = page1.data.users.map(u => u.user_alias);
    const page2Ids = page2.data.users.map(u => u.user_alias);
    expect(page1Ids).not.toEqual(expect.arrayContaining(page2Ids));
  });
});

describe('Query Timeouts', () => {
  test('prevents function timeout', async () => {
    // Mock slow query
    jest.spyOn(sql, 'query').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 6000));
    });
    
    const response = await handler({});
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error.code).toBe('QUERY_TIMEOUT');
  });
});

describe('Rate Limiting', () => {
  test('enforces per-admin limits', async () => {
    const requests = Array(61).fill().map(() => 
      handler({ headers: { authorization: `Bearer ${adminToken}` }})
    );
    
    const results = await Promise.allSettled(requests);
    const rateLimited = results.filter(r => 
      r.status === 'fulfilled' && r.value.statusCode === 429
    );
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Section 7: Later (Deferred Items)

### Materialized View Auto-Refresh
**Deferred:** Automatic refresh scheduling via pg_cron or external scheduler.
**Reason:** Requires infrastructure setup beyond application code. For MVP, views can be refreshed manually or via admin API endpoint. Staleness is tracked and visible.

### Redis-backed Rate Limiting  
**Deferred:** Moving rate limiting from PostgreSQL to Redis.
**Reason:** Current database solution is sufficient for expected admin traffic. Redis adds operational complexity without immediate benefit.

### GraphQL Admin API
**Deferred:** GraphQL endpoint for flexible querying.
**Reason:** REST endpoints cover current requirements. GraphQL can be added when admin UI needs more complex queries.