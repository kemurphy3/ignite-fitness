// Audit Logging System for Strava Token Management
// const { getDB } = require('./database'); // Unused

async function auditLog(sql, data) {
  try {
    const { user_id, action, status, error_message, ip_address, user_agent, metadata = {} } = data;

    // Validate required fields
    if (!user_id || !action || !status) {
      console.error('Audit log missing required fields:', { user_id, action, status });
      return { success: false, error: 'Missing required fields' };
    }

    // Sanitize IP address
    const sanitizedIP = sanitizeIPAddress(ip_address);

    // Sanitize user agent
    const sanitizedUserAgent = sanitizeUserAgent(user_agent);

    // Add timestamp and additional metadata
    const auditData = {
      user_id,
      action: action.toUpperCase(),
      status: status.toUpperCase(),
      error_message: error_message ? error_message.substring(0, 1000) : null,
      ip_address: sanitizedIP,
      user_agent: sanitizedUserAgent,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
    };

    await sql`
      INSERT INTO strava_token_audit (
        user_id, action, status, error_message, 
        ip_address, user_agent, metadata
      ) VALUES (
        ${auditData.user_id}, ${auditData.action}, ${auditData.status}, 
        ${auditData.error_message}, ${auditData.ip_address}, 
        ${auditData.user_agent}, ${JSON.stringify(auditData.metadata)}
      )
    `;

    return { success: true };
  } catch (error) {
    console.error('Audit logging failed:', error);
    return { success: false, error: error.message };
  }
}

function sanitizeIPAddress(ip) {
  if (!ip) {
    return null;
  }

  // Remove any non-IP characters and limit length
  const sanitized = ip.replace(/[^0-9.:]/g, '').substring(0, 45);

  // Basic IP validation
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  if (ipv4Regex.test(sanitized) || ipv6Regex.test(sanitized)) {
    return sanitized;
  }

  return 'invalid';
}

function sanitizeUserAgent(ua) {
  if (!ua) {
    return null;
  }

  // Remove potentially harmful characters and limit length
  return ua
    .replace(/[<>'"&]/g, '')
    .substring(0, 500)
    .trim();
}

// Get audit logs for a user
async function getAuditLogs(sql, userId, limit = 50, offset = 0) {
  try {
    const result = await sql`
      SELECT 
        id, action, status, error_message, 
        ip_address, user_agent, metadata, created_at
      FROM strava_token_audit 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return {
      success: true,
      logs: result,
      count: result.length,
    };
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return {
      success: false,
      error: error.message,
      logs: [],
    };
  }
}

// Get audit statistics
async function getAuditStats(sql, userId, days = 7) {
  try {
    const result = await sql`
      SELECT 
        action,
        status,
        COUNT(*) as count,
        MAX(created_at) as last_occurrence
      FROM strava_token_audit 
      WHERE user_id = ${userId}
        AND created_at > NOW() - INTERVAL '${days} days'
      GROUP BY action, status
      ORDER BY count DESC
    `;

    return {
      success: true,
      stats: result,
      period: `${days} days`,
    };
  } catch (error) {
    console.error('Failed to get audit stats:', error);
    return {
      success: false,
      error: error.message,
      stats: [],
    };
  }
}

// Clean up old audit logs
async function cleanupAuditLogs(sql, retentionDays = 90) {
  try {
    const result = await sql`
      DELETE FROM strava_token_audit 
      WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
    `;

    return {
      success: true,
      deleted: result.length,
      retentionDays,
    };
  } catch (error) {
    console.error('Audit cleanup failed:', error);
    return {
      success: false,
      error: error.message,
      deleted: 0,
    };
  }
}

// Log security events
async function logSecurityEvent(sql, event) {
  const securityEvent = {
    ...event,
    action: `SECURITY_${event.action}`,
    metadata: {
      ...event.metadata,
      security_event: true,
      severity: event.severity || 'medium',
    },
  };

  return await auditLog(sql, securityEvent);
}

// Log performance metrics
async function logPerformanceMetric(sql, metric) {
  const performanceEvent = {
    ...metric,
    action: `PERFORMANCE_${metric.action}`,
    metadata: {
      ...metric.metadata,
      performance_metric: true,
      duration_ms: metric.duration_ms,
      memory_usage: metric.memory_usage,
    },
  };

  return await auditLog(sql, performanceEvent);
}

module.exports = {
  auditLog,
  getAuditLogs,
  getAuditStats,
  cleanupAuditLogs,
  logSecurityEvent,
  logPerformanceMetric,
  sanitizeIPAddress,
  sanitizeUserAgent,
};
