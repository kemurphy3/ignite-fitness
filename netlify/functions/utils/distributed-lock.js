// Distributed Lock Implementation for Token Refresh Race Condition Prevention
const crypto = require('crypto');
const { getDB } = require('./database');

async function acquireRefreshLock(sql, userId, timeoutMs = 5000) {
  const lockId = hashUserId(userId);
  const unlockTime = new Date(Date.now() + timeoutMs);

  try {
    // Try to acquire PostgreSQL advisory lock
    const result = await sql`
      SELECT pg_try_advisory_lock(${lockId}) as acquired
    `;

    if (result[0].acquired) {
      // Also set a timeout in the tokens table as backup
      const updateResult = await sql`
        UPDATE strava_tokens 
        SET refresh_lock_until = ${unlockTime}
        WHERE user_id = ${userId}
        AND (refresh_lock_until IS NULL OR refresh_lock_until < NOW())
        RETURNING id
      `;

      if (updateResult.length > 0) {
        return { lockId, acquired: true, lockExpiry: unlockTime };
      } else {
        // Release the advisory lock if we couldn't update the table
        await sql`SELECT pg_advisory_unlock(${lockId})`;
        return { lockId: null, acquired: false, reason: 'Token not found or already locked' };
      }
    }

    // Check if another process has the lock
    const lockStatus = await sql`
      SELECT refresh_lock_until 
      FROM strava_tokens 
      WHERE user_id = ${userId}
    `;

    if (lockStatus.length > 0 && lockStatus[0].refresh_lock_until && lockStatus[0].refresh_lock_until > new Date()) {
      return {
        lockId: null,
        acquired: false,
        retryAfter: lockStatus[0].refresh_lock_until,
        reason: 'Another process is refreshing this token'
      };
    }

    return { lockId: null, acquired: false, reason: 'Could not acquire lock' };
  } catch (error) {
    console.error('Lock acquisition failed:', error);
    return { lockId: null, acquired: false, reason: error.message };
  }
}

async function releaseLock(sql, lockId, userId) {
  try {
    if (lockId) {
      await sql`SELECT pg_advisory_unlock(${lockId})`;
    }

    await sql`
      UPDATE strava_tokens 
      SET refresh_lock_until = NULL 
      WHERE user_id = ${userId}
    `;

    return { success: true };
  } catch (error) {
    console.error('Lock release failed:', error);
    return { success: false, error: error.message };
  }
}

function hashUserId(userId) {
  // Create a consistent integer hash for PostgreSQL advisory locks
  const hash = crypto.createHash('sha256').update(userId.toString()).digest();
  return Math.abs(hash.readInt32BE(0));
}

// Check if a lock is still valid
async function isLockValid(sql, userId) {
  try {
    const result = await sql`
      SELECT refresh_lock_until 
      FROM strava_tokens 
      WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return { valid: false, reason: 'Token not found' };
    }

    const lockExpiry = result[0].refresh_lock_until;
    if (!lockExpiry) {
      return { valid: false, reason: 'No lock set' };
    }

    const now = new Date();
    if (lockExpiry > now) {
      return {
        valid: true,
        expiresAt: lockExpiry,
        timeRemaining: lockExpiry.getTime() - now.getTime()
      };
    }

    return { valid: false, reason: 'Lock expired' };
  } catch (error) {
    console.error('Lock validation failed:', error);
    return { valid: false, reason: error.message };
  }
}

// Force release a lock (for admin operations)
async function forceReleaseLock(sql, userId) {
  try {
    const lockId = hashUserId(userId);

    // Release advisory lock
    await sql`SELECT pg_advisory_unlock(${lockId})`;

    // Clear database lock
    await sql`
      UPDATE strava_tokens 
      SET refresh_lock_until = NULL 
      WHERE user_id = ${userId}
    `;

    return { success: true, message: 'Lock force released' };
  } catch (error) {
    console.error('Force lock release failed:', error);
    return { success: false, error: error.message };
  }
}

// Get lock status for monitoring
async function getLockStatus(sql, userId) {
  try {
    const result = await sql`
      SELECT 
        refresh_lock_until,
        last_refresh_at,
        refresh_count,
        CASE 
          WHEN refresh_lock_until IS NULL THEN 'unlocked'
          WHEN refresh_lock_until > NOW() THEN 'locked'
          ELSE 'expired'
        END as lock_status
      FROM strava_tokens 
      WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return { status: 'not_found' };
    }

    const token = result[0];
    return {
      status: token.lock_status,
      lockedUntil: token.refresh_lock_until,
      lastRefresh: token.last_refresh_at,
      refreshCount: token.refresh_count
    };
  } catch (error) {
    console.error('Lock status check failed:', error);
    return { status: 'error', error: error.message };
  }
}

module.exports = {
  acquireRefreshLock,
  releaseLock,
  isLockValid,
  forceReleaseLock,
  getLockStatus,
  hashUserId
};
