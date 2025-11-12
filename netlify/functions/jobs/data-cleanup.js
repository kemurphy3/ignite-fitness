/**
 * Data Cleanup Job - Automated data retention policies
 * Implements automated data lifecycle management with user notifications
 */

const { createClient } = require('@supabase/supabase-js');
const SafeLogger = require('./utils/safe-logging');

// Create safe logger for data cleanup
const logger = SafeLogger.create({
  enableMasking: true,
  visibleChars: 4,
  maskChar: '*',
});

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Data retention configuration
const RETENTION_CONFIG = {
  // Default retention periods (in days)
  defaultRetention: parseInt(process.env.DEFAULT_DATA_RETENTION) || 730, // 2 years
  maxRetention: parseInt(process.env.MAX_DATA_RETENTION) || 1095, // 3 years
  minRetention: parseInt(process.env.MIN_DATA_RETENTION) || 30, // 30 days

  // Specific data types
  workoutData: 730, // 2 years
  activityData: 365, // 1 year
  sessionData: 90, // 3 months
  auditLogs: 2555, // 7 years (compliance)
  consentHistory: 2555, // 7 years (compliance)
  errorLogs: 90, // 3 months
  cacheData: 7, // 1 week

  // Cleanup intervals
  cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
  notificationInterval: 7 * 24 * 60 * 60 * 1000, // 7 days

  // Batch sizes
  batchSize: 1000,
  maxBatchTime: 30 * 1000, // 30 seconds per batch
};

/**
 * Data Cleanup Job Handler
 */
exports.handler = async _event => {
  try {
    logger.info('Data cleanup job started', {
      timestamp: new Date().toISOString(),
      retention_config: RETENTION_CONFIG,
    });

    const results = {
      startTime: new Date().toISOString(),
      cleanupResults: {},
      notificationsSent: 0,
      errors: [],
      summary: {},
    };

    // Run cleanup for each data type
    const cleanupTasks = [
      { name: 'workout_data', handler: cleanupWorkoutData },
      { name: 'activity_data', handler: cleanupActivityData },
      { name: 'session_data', handler: cleanupSessionData },
      { name: 'audit_logs', handler: cleanupAuditLogs },
      { name: 'consent_history', handler: cleanupConsentHistory },
      { name: 'error_logs', handler: cleanupErrorLogs },
      { name: 'cache_data', handler: cleanupCacheData },
      { name: 'expired_tokens', handler: cleanupExpiredTokens },
    ];

    for (const task of cleanupTasks) {
      try {
        logger.info(`Starting cleanup for ${task.name}`);

        const taskResult = await task.handler();
        results.cleanupResults[task.name] = taskResult;

        logger.info(`Completed cleanup for ${task.name}`, {
          deleted_count: taskResult.deletedCount,
          affected_users: taskResult.affectedUsers,
        });
      } catch (error) {
        logger.error(`Cleanup failed for ${task.name}`, {
          error: error.message,
          stack: error.stack,
        });

        results.errors.push({
          task: task.name,
          error: error.message,
        });
      }
    }

    // Send notifications for affected users
    try {
      results.notificationsSent = await sendRetentionNotifications();
    } catch (error) {
      logger.error('Failed to send retention notifications', {
        error: error.message,
      });
      results.errors.push({
        task: 'notifications',
        error: error.message,
      });
    }

    // Generate summary
    results.summary = generateCleanupSummary(results.cleanupResults);
    results.endTime = new Date().toISOString();
    results.duration = new Date(results.endTime) - new Date(results.startTime);

    logger.info('Data cleanup job completed', {
      duration: results.duration,
      total_deleted: results.summary.totalDeleted,
      affected_users: results.summary.totalAffectedUsers,
      notifications_sent: results.notificationsSent,
      errors: results.errors.length,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        results,
      }),
    };
  } catch (error) {
    logger.error('Data cleanup job failed', {
      error: error.message,
      stack: error.stack,
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Data cleanup job failed',
        details: error.message,
      }),
    };
  }
};

/**
 * Cleanup workout data
 */
async function cleanupWorkoutData() {
  const retentionDays = RETENTION_CONFIG.workoutData;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;
  const affectedUsers = new Set();
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Get old workout data in batches
    const { data: oldWorkouts, error } = await supabase
      .from('workouts')
      .select('id, user_id, created_at')
      .lt('created_at', cutoffDate.toISOString())
      .range(offset, offset + RETENTION_CONFIG.batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch old workouts: ${error.message}`);
    }

    if (!oldWorkouts || oldWorkouts.length === 0) {
      break;
    }

    // Delete workouts in batch
    const workoutIds = oldWorkouts.map(w => w.id);
    const { error: deleteError } = await supabase.from('workouts').delete().in('id', workoutIds);

    if (deleteError) {
      throw new Error(`Failed to delete workouts: ${deleteError.message}`);
    }

    deletedCount += oldWorkouts.length;
    oldWorkouts.forEach(w => affectedUsers.add(w.user_id));

    offset += RETENTION_CONFIG.batchSize;

    // Yield to prevent timeout
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    deletedCount,
    affectedUsers: Array.from(affectedUsers),
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
  };
}

/**
 * Cleanup activity data
 */
async function cleanupActivityData() {
  const retentionDays = RETENTION_CONFIG.activityData;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;
  const affectedUsers = new Set();
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: oldActivities, error } = await supabase
      .from('activities')
      .select('id, user_id, start_date')
      .lt('start_date', cutoffDate.toISOString())
      .range(offset, offset + RETENTION_CONFIG.batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch old activities: ${error.message}`);
    }

    if (!oldActivities || oldActivities.length === 0) {
      break;
    }

    const activityIds = oldActivities.map(a => a.id);
    const { error: deleteError } = await supabase.from('activities').delete().in('id', activityIds);

    if (deleteError) {
      throw new Error(`Failed to delete activities: ${deleteError.message}`);
    }

    deletedCount += oldActivities.length;
    oldActivities.forEach(a => affectedUsers.add(a.user_id));

    offset += RETENTION_CONFIG.batchSize;

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    deletedCount,
    affectedUsers: Array.from(affectedUsers),
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
  };
}

/**
 * Cleanup session data
 */
async function cleanupSessionData() {
  const retentionDays = RETENTION_CONFIG.sessionData;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;
  const affectedUsers = new Set();
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: oldSessions, error } = await supabase
      .from('user_sessions')
      .select('id, user_id, created_at')
      .lt('created_at', cutoffDate.toISOString())
      .range(offset, offset + RETENTION_CONFIG.batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch old sessions: ${error.message}`);
    }

    if (!oldSessions || oldSessions.length === 0) {
      break;
    }

    const sessionIds = oldSessions.map(s => s.id);
    const { error: deleteError } = await supabase
      .from('user_sessions')
      .delete()
      .in('id', sessionIds);

    if (deleteError) {
      throw new Error(`Failed to delete sessions: ${deleteError.message}`);
    }

    deletedCount += oldSessions.length;
    oldSessions.forEach(s => affectedUsers.add(s.user_id));

    offset += RETENTION_CONFIG.batchSize;

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    deletedCount,
    affectedUsers: Array.from(affectedUsers),
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
  };
}

/**
 * Cleanup audit logs
 */
async function cleanupAuditLogs() {
  const retentionDays = RETENTION_CONFIG.auditLogs;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: oldLogs, error } = await supabase
      .from('audit_logs')
      .select('id, created_at')
      .lt('created_at', cutoffDate.toISOString())
      .range(offset, offset + RETENTION_CONFIG.batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch old audit logs: ${error.message}`);
    }

    if (!oldLogs || oldLogs.length === 0) {
      break;
    }

    const logIds = oldLogs.map(l => l.id);
    const { error: deleteError } = await supabase.from('audit_logs').delete().in('id', logIds);

    if (deleteError) {
      throw new Error(`Failed to delete audit logs: ${deleteError.message}`);
    }

    deletedCount += oldLogs.length;
    offset += RETENTION_CONFIG.batchSize;

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    deletedCount,
    affectedUsers: [],
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
  };
}

/**
 * Cleanup consent history
 */
async function cleanupConsentHistory() {
  const retentionDays = RETENTION_CONFIG.consentHistory;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;
  const affectedUsers = new Set();
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: oldConsent, error } = await supabase
      .from('consent_history')
      .select('id, user_id, timestamp')
      .lt('timestamp', cutoffDate.toISOString())
      .range(offset, offset + RETENTION_CONFIG.batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch old consent history: ${error.message}`);
    }

    if (!oldConsent || oldConsent.length === 0) {
      break;
    }

    const consentIds = oldConsent.map(c => c.id);
    const { error: deleteError } = await supabase
      .from('consent_history')
      .delete()
      .in('id', consentIds);

    if (deleteError) {
      throw new Error(`Failed to delete consent history: ${deleteError.message}`);
    }

    deletedCount += oldConsent.length;
    oldConsent.forEach(c => affectedUsers.add(c.user_id));

    offset += RETENTION_CONFIG.batchSize;

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    deletedCount,
    affectedUsers: Array.from(affectedUsers),
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
  };
}

/**
 * Cleanup error logs
 */
async function cleanupErrorLogs() {
  const retentionDays = RETENTION_CONFIG.errorLogs;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: oldErrors, error } = await supabase
      .from('error_logs')
      .select('id, created_at')
      .lt('created_at', cutoffDate.toISOString())
      .range(offset, offset + RETENTION_CONFIG.batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch old error logs: ${error.message}`);
    }

    if (!oldErrors || oldErrors.length === 0) {
      break;
    }

    const errorIds = oldErrors.map(e => e.id);
    const { error: deleteError } = await supabase.from('error_logs').delete().in('id', errorIds);

    if (deleteError) {
      throw new Error(`Failed to delete error logs: ${deleteError.message}`);
    }

    deletedCount += oldErrors.length;
    offset += RETENTION_CONFIG.batchSize;

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    deletedCount,
    affectedUsers: [],
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
  };
}

/**
 * Cleanup cache data
 */
async function cleanupCacheData() {
  const retentionDays = RETENTION_CONFIG.cacheData;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: oldCache, error } = await supabase
      .from('cache_data')
      .select('id, created_at')
      .lt('created_at', cutoffDate.toISOString())
      .range(offset, offset + RETENTION_CONFIG.batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch old cache data: ${error.message}`);
    }

    if (!oldCache || oldCache.length === 0) {
      break;
    }

    const cacheIds = oldCache.map(c => c.id);
    const { error: deleteError } = await supabase.from('cache_data').delete().in('id', cacheIds);

    if (deleteError) {
      throw new Error(`Failed to delete cache data: ${deleteError.message}`);
    }

    deletedCount += oldCache.length;
    offset += RETENTION_CONFIG.batchSize;

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    deletedCount,
    affectedUsers: [],
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
  };
}

/**
 * Cleanup expired tokens
 */
async function cleanupExpiredTokens() {
  const now = new Date().toISOString();

  let deletedCount = 0;
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: expiredTokens, error } = await supabase
      .from('user_tokens')
      .select('id, expires_at')
      .lt('expires_at', now)
      .range(offset, offset + RETENTION_CONFIG.batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch expired tokens: ${error.message}`);
    }

    if (!expiredTokens || expiredTokens.length === 0) {
      break;
    }

    const tokenIds = expiredTokens.map(t => t.id);
    const { error: deleteError } = await supabase.from('user_tokens').delete().in('id', tokenIds);

    if (deleteError) {
      throw new Error(`Failed to delete expired tokens: ${deleteError.message}`);
    }

    deletedCount += expiredTokens.length;
    offset += RETENTION_CONFIG.batchSize;

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    deletedCount,
    affectedUsers: [],
    retentionDays: 0,
    cutoffDate: now,
  };
}

/**
 * Send retention notifications to affected users
 */
async function sendRetentionNotifications() {
  let notificationsSent = 0;

  try {
    // Get users who had data deleted
    const { data: affectedUsers, error } = await supabase
      .from('user_profiles')
      .select('user_id, email, name')
      .not('email', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch affected users: ${error.message}`);
    }

    for (const user of affectedUsers) {
      try {
        await sendRetentionNotification(user);
        notificationsSent++;
      } catch (err) {
        logger.error('Failed to send retention notification', {
          user_id: user.user_id,
          error: err.message,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to send retention notifications', {
      error: error.message,
    });
  }

  return notificationsSent;
}

/**
 * Send retention notification to user
 */
async function sendRetentionNotification(user) {
  try {
    const notification = {
      user_id: user.user_id,
      type: 'data_retention',
      title: 'Data Retention Notice',
      message:
        'Some of your old data has been automatically deleted according to our retention policy. You can adjust your retention preferences in your privacy settings.',
      action_url: '/settings/privacy',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('user_notifications').insert(notification);

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    logger.info('Retention notification sent', {
      user_id: user.user_id,
    });
  } catch (error) {
    logger.error('Failed to send retention notification', {
      user_id: user.user_id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Generate cleanup summary
 */
function generateCleanupSummary(cleanupResults) {
  const summary = {
    totalDeleted: 0,
    totalAffectedUsers: 0,
    dataTypes: {},
    retentionPolicies: {},
  };

  Object.entries(cleanupResults).forEach(([dataType, result]) => {
    summary.totalDeleted += result.deletedCount;
    summary.totalAffectedUsers += result.affectedUsers.length;

    summary.dataTypes[dataType] = {
      deletedCount: result.deletedCount,
      affectedUsers: result.affectedUsers.length,
      retentionDays: result.retentionDays,
    };

    summary.retentionPolicies[dataType] = {
      retentionDays: result.retentionDays,
      cutoffDate: result.cutoffDate,
    };
  });

  return summary;
}

/**
 * Manual cleanup endpoint
 */
exports.manualCleanup = async event => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { data_type, user_id: _user_id, retention_days: _retention_days } = JSON.parse(event.body || '{}');

    if (!data_type) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Data type is required' }),
      };
    }

    let result;

    switch (data_type) {
      case 'workout_data':
        result = await cleanupWorkoutData();
        break;
      case 'activity_data':
        result = await cleanupActivityData();
        break;
      case 'session_data':
        result = await cleanupSessionData();
        break;
      default:
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Invalid data type' }),
        };
    }

    logger.info('Manual cleanup completed', {
      data_type,
      deleted_count: result.deletedCount,
      affected_users: result.affectedUsers.length,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        result,
      }),
    };
  } catch (error) {
    logger.error('Manual cleanup failed', {
      error: error.message,
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
