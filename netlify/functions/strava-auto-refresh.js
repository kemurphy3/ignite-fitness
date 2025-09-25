// Automatic Strava Token Refresh Scheduler
const { getDB } = require('./utils/database');
const { auditLog } = require('./utils/audit');

exports.handler = async (event) => {
  // This function is triggered by Netlify Scheduled Functions
  // Schedule: every 5 minutes
  
  const sql = getDB();
  
  try {
    console.log('Starting automatic token refresh...');
    
    // Find tokens expiring soon (within 10 minutes)
    const expiringTokens = await sql`
      SELECT user_id, expires_at, athlete_id
      FROM strava_tokens
      WHERE expires_at < NOW() + INTERVAL '10 minutes'
        AND expires_at > NOW()
        AND (refresh_lock_until IS NULL OR refresh_lock_until < NOW())
      ORDER BY expires_at ASC
      LIMIT 50
    `;
    
    console.log(`Found ${expiringTokens.length} tokens expiring soon`);
    
    const results = [];
    
    for (const token of expiringTokens) {
      try {
        // Call refresh endpoint
        const response = await fetch(`${process.env.URL || 'https://your-site.netlify.app'}/.netlify/functions/strava-refresh-token`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'Strava-Auto-Refresh/1.0'
          },
          body: JSON.stringify({ userId: token.user_id })
        });
        
        const responseData = await response.json();
        
        results.push({
          user_id: token.user_id,
          athlete_id: token.athlete_id,
          success: response.ok,
          status: response.status,
          cached: responseData.cached || false,
          refresh_not_needed: responseData.refresh_not_needed || false
        });
        
        // Log the auto-refresh attempt
        await auditLog(sql, {
          user_id: token.user_id,
          action: 'AUTO_REFRESH',
          status: response.ok ? 'SUCCESS' : 'FAILURE',
          metadata: {
            athlete_id: token.athlete_id,
            status_code: response.status,
            cached: responseData.cached || false,
            refresh_not_needed: responseData.refresh_not_needed || false,
            expires_at: token.expires_at
          }
        });
        
      } catch (error) {
        console.error(`Auto-refresh failed for user ${token.user_id}:`, error);
        
        results.push({
          user_id: token.user_id,
          athlete_id: token.athlete_id,
          success: false,
          error: error.message
        });
        
        // Log the error
        await auditLog(sql, {
          user_id: token.user_id,
          action: 'AUTO_REFRESH',
          status: 'FAILURE',
          error_message: error.message,
          metadata: {
            athlete_id: token.athlete_id,
            error_type: error.constructor.name
          }
        });
      }
    }
    
    // Clean up old rate limits and expired locks
    const [rateLimitCleanup, lockCleanup] = await Promise.all([
      cleanupRateLimits(sql),
      cleanupExpiredLocks(sql)
    ]);
    
    const summary = {
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      cached: results.filter(r => r.cached).length,
      not_needed: results.filter(r => r.refresh_not_needed).length,
      rate_limit_cleanup: rateLimitCleanup,
      lock_cleanup: lockCleanup,
      timestamp: new Date().toISOString()
    };
    
    console.log('Auto-refresh completed:', summary);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary)
    };
    
  } catch (error) {
    console.error('Auto-refresh error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Auto-refresh failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

async function cleanupRateLimits(sql) {
  try {
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

async function cleanupExpiredLocks(sql) {
  try {
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
