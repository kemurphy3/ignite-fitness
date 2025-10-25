// Enhanced Rate Limiting with Database Storage and Security
const crypto = require('crypto');
const { getDB } = require('./database');
const { auditLog } = require('./audit');

async function checkRateLimit(sql, userId, endpoint, limit = 100, window = 3600000) {
  const windowStart = new Date(Date.now() - window);
  const scope = getScopeFromEndpoint(endpoint);
  const ipHash = crypto.createHash('sha256').update('client-ip').digest('hex').substring(0, 16);
  
  try {
    // Get recent requests using new schema
    const requests = await sql`
      SELECT window_start, count
      FROM rate_limits
      WHERE scope = ${scope}
        AND user_id = ${userId || 0}
        AND ip_hash = ${ipHash}
        AND route = ${endpoint}
        AND window_start > ${windowStart}
      ORDER BY window_start DESC
    `;
    
    // Check for anomalous patterns
    if (requests.length > 10) {
      const intervals = [];
      for (let i = 1; i < Math.min(requests.length, 20); i++) {
        intervals.push(
          requests[i-1].window_start - requests[i].window_start
        );
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval < 100) { // Less than 100ms between requests
        await auditLog(sql, {
          user_id: userId,
          action: 'RATE_LIMIT_ANOMALY',
          status: 'BLOCKED',
          metadata: { 
            avgInterval, 
            pattern: 'bot-like',
            endpoint,
            requestCount: requests.length
          }
        });
        return { 
          allowed: false, 
          reason: 'Anomalous pattern detected',
          type: 'anomaly',
          retryAfter: 300 // 5 minutes
        };
      }
    }
    
    const totalCount = requests.reduce((sum, req) => sum + req.count, 0);
    if (totalCount >= limit) {
      await auditLog(sql, {
        user_id: userId,
        action: 'RATE_LIMIT_EXCEEDED',
        status: 'BLOCKED',
        metadata: { 
          endpoint,
          requestCount: totalCount,
          limit
        }
      });
      
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded',
        type: 'limit',
        resetAt: new Date(windowStart.getTime() + window),
        retryAfter: Math.ceil((windowStart.getTime() + window - Date.now()) / 1000)
      };
    }
    
    // Upsert rate limit record
    await sql`
      INSERT INTO rate_limits (scope, user_id, ip_hash, route, window_start, count)
      VALUES (${scope}, ${userId || 0}, ${ipHash}, ${endpoint}, ${windowStart}, 1)
      ON CONFLICT (scope, user_id, ip_hash, route, window_start)
      DO UPDATE SET count = rate_limits.count + 1
    `;
    
    return { 
      allowed: true, 
      remaining: limit - totalCount - 1,
      resetAt: new Date(Date.now() + window)
    };
    
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limiting fails
    return { 
      allowed: true, 
      reason: 'Rate limit check failed',
      error: error.message
    };
  }
}

// Helper function to determine scope from endpoint
function getScopeFromEndpoint(endpoint) {
  if (endpoint.includes('/admin')) return 'admin';
  if (endpoint.includes('/auth') || endpoint.includes('/login')) return 'auth';
  return 'public';
}

// Check rate limit with custom limits per endpoint
async function checkEndpointRateLimit(sql, userId, endpoint) {
  const limits = {
    '/strava-oauth-exchange': { limit: 10, window: 3600000 }, // 10 per hour
    '/strava-refresh-token': { limit: 20, window: 3600000 }, // 20 per hour
    '/strava-token-status': { limit: 100, window: 3600000 }, // 100 per hour
    '/strava-activities': { limit: 200, window: 3600000 }, // 200 per hour
    'default': { limit: 100, window: 3600000 } // 100 per hour default
  };
  
  const config = limits[endpoint] || limits.default;
  return await checkRateLimit(sql, userId, endpoint, config.limit, config.window);
}

// Get rate limit status for a user
async function getRateLimitStatus(sql, userId) {
  try {
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    const result = await sql`
      SELECT 
        endpoint,
        COUNT(*) as request_count,
        MAX(request_timestamp) as last_request
      FROM api_rate_limits
      WHERE user_id = ${userId}
        AND request_timestamp > ${oneHourAgo}
      GROUP BY endpoint
      ORDER BY request_count DESC
    `;
    
    return {
      success: true,
      status: result,
      period: '1 hour'
    };
  } catch (error) {
    console.error('Failed to get rate limit status:', error);
    return {
      success: false,
      error: error.message,
      status: []
    };
  }
}

// Clean up old rate limit entries
async function cleanupRateLimits(sql, olderThanHours = 1) {
  try {
    const cutoff = new Date(Date.now() - (olderThanHours * 3600000));
    
    const result = await sql`
      DELETE FROM api_rate_limits 
      WHERE request_timestamp < ${cutoff}
    `;
    
    return {
      success: true,
      deleted: result.length,
      cutoff: cutoff.toISOString()
    };
  } catch (error) {
    console.error('Rate limit cleanup failed:', error);
    return {
      success: false,
      error: error.message,
      deleted: 0
    };
  }
}

// Check if user is temporarily blocked
async function isUserBlocked(sql, userId) {
  try {
    const oneHourAgo = new Date(Date.now() - 3600000);
    
    const result = await sql`
      SELECT COUNT(*) as anomaly_count
      FROM strava_token_audit
      WHERE user_id = ${userId}
        AND action = 'RATE_LIMIT_ANOMALY'
        AND created_at > ${oneHourAgo}
    `;
    
    const anomalyCount = parseInt(result[0].anomaly_count);
    
    if (anomalyCount >= 3) {
      return {
        blocked: true,
        reason: 'Multiple anomaly detections',
        anomalyCount,
        retryAfter: 3600 // 1 hour
      };
    }
    
    return { blocked: false };
  } catch (error) {
    console.error('Block check failed:', error);
    return { blocked: false, error: error.message };
  }
}

// Get rate limit headers for response
function getRateLimitHeaders(rateLimitResult) {
  const headers = {};
  
  if (rateLimitResult.allowed) {
    headers['X-RateLimit-Limit'] = rateLimitResult.limit || 100;
    headers['X-RateLimit-Remaining'] = rateLimitResult.remaining || 0;
    headers['X-RateLimit-Reset'] = rateLimitResult.resetAt ? Math.ceil(rateLimitResult.resetAt.getTime() / 1000) : '';
  } else {
    headers['X-RateLimit-Limit'] = rateLimitResult.limit || 100;
    headers['X-RateLimit-Remaining'] = 0;
    headers['X-RateLimit-Reset'] = rateLimitResult.resetAt ? Math.ceil(rateLimitResult.resetAt.getTime() / 1000) : '';
    
    if (rateLimitResult.retryAfter) {
      headers['Retry-After'] = rateLimitResult.retryAfter;
    }
  }
  
  return headers;
}

module.exports = {
  checkRateLimit,
  checkEndpointRateLimit,
  getRateLimitStatus,
  cleanupRateLimits,
  isUserBlocked,
  getRateLimitHeaders
};
