// Enhanced Rate Limiting with Anomaly Detection
const crypto = require('crypto');
const { getDB } = require('./database');
const { auditLog } = require('./audit');

async function checkRateLimit(sql, userId, endpoint, limit = 100, window = 3600000) {
  const windowStart = new Date(Date.now() - window);
  
  try {
    // Get recent requests
    const requests = await sql`
      SELECT request_timestamp, request_hash
      FROM api_rate_limits
      WHERE user_id = ${userId}
        AND endpoint = ${endpoint}
        AND request_timestamp > ${windowStart}
      ORDER BY request_timestamp DESC
    `;
    
    // Check for anomalous patterns
    if (requests.length > 10) {
      const intervals = [];
      for (let i = 1; i < Math.min(requests.length, 20); i++) {
        intervals.push(
          requests[i-1].request_timestamp - requests[i].request_timestamp
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
    
    if (requests.length >= limit) {
      await auditLog(sql, {
        user_id: userId,
        action: 'RATE_LIMIT_EXCEEDED',
        status: 'BLOCKED',
        metadata: { 
          endpoint,
          requestCount: requests.length,
          limit
        }
      });
      
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded',
        type: 'limit',
        resetAt: new Date(requests[0].request_timestamp.getTime() + window),
        retryAfter: Math.ceil((requests[0].request_timestamp.getTime() + window - Date.now()) / 1000)
      };
    }
    
    // Log this request
    const requestHash = crypto
      .createHash('sha256')
      .update(`${userId}${endpoint}${Date.now()}`)
      .digest('hex');
      
    await sql`
      INSERT INTO api_rate_limits (user_id, endpoint, request_hash)
      VALUES (${userId}, ${endpoint}, ${requestHash})
      ON CONFLICT (user_id, endpoint, request_hash) DO NOTHING
    `;
    
    return { 
      allowed: true, 
      remaining: limit - requests.length - 1,
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
