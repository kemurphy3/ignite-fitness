/**
 * StorageManager - Unified storage schema with sync queue pattern
 * Provides idempotent writes and offline-first architecture
 *
 * Tables: user_profiles, readiness_logs, session_logs, progression_events, injury_flags, preferences
 * Each table keyed by (user_id, date) for idempotent writes
 */
class StorageManager {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;

    // Storage key prefixes
    this.PREFIXES = {
      PROFILES: 'ignitefitness_user_profiles',
      READINESS: 'ignitefitness_readiness_logs',
      SESSIONS: 'ignitefitness_session_logs',
      PROGRESSION: 'ignitefitness_progression_events',
      INJURY_FLAGS: 'ignitefitness_injury_flags',
      PREFERENCES: 'ignitefitness_preferences',
      SYNC_QUEUE: 'ignitefitness_sync_queue',
    };

    this.initializeEventListeners();
    this.loadSyncQueue();
  }

  /**
   * Initialize event listeners for online/offline state
   */
  initializeEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.attemptSync();
      this.eventBus.emit(this.eventBus.TOPICS.OFFLINE_STATE_CHANGED, { isOnline: true });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.eventBus.emit(this.eventBus.TOPICS.OFFLINE_STATE_CHANGED, { isOnline: false });
    });
  }

  /**
   * Get compound key from user_id and date
   * @param {string} userId - User ID
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {string} Compound key
   */
  getCompoundKey(userId, date) {
    return `${userId}_${date}`;
  }

  /**
   * Safely read from localStorage with error handling
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if read fails
   * @returns {*} Parsed value or default
   */
  safeGetItem(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return defaultValue;
      }

      // Handle empty string
      if (raw === '') {
        return defaultValue;
      }

      // Try to parse as JSON
      return JSON.parse(raw);
    } catch (error) {
      this.logger.warn(`Failed to parse localStorage item ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Safely write to localStorage with error handling
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {boolean} Success status
   */
  safeSetItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      this.logger.error(`Failed to write localStorage item ${key}:`, error);
      return false;
    }
  }

  /**
   * Safely remove from localStorage with error handling
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  safeRemoveItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove localStorage item ${key}:`, error);
      return false;
    }
  }

  /**
   * Save user profile
   * @param {string} userId - User ID
   * @param {Object} profile - Profile data
   * @returns {Promise<void>}
   */
  async saveUserProfile(userId, profile) {
    try {
      const profiles = this.getUserProfiles();
      profiles[userId] = {
        ...profile,
        userId,
        updatedAt: new Date().toISOString(),
      };

      if (!this.safeSetItem(this.PREFIXES.PROFILES, profiles)) {
        throw new Error('Failed to save profile to localStorage');
      }

      // Emit event
      this.eventBus.emit(this.eventBus.TOPICS.PROFILE_UPDATED, { userId, profile });

      // Add to sync queue if offline
      if (!this.isOnline) {
        this.addToSyncQueue('user_profiles', userId, profile);
      }
    } catch (error) {
      this.logger.error('Failed to save user profile:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   * @param {string} userId - User ID
   * @returns {Object|null} User profile
   */
  getUserProfile(userId) {
    const profiles = this.getUserProfiles();
    return profiles[userId] || null;
  }

  /**
   * Get all user profiles
   * @returns {Object} All user profiles
   */
  getUserProfiles() {
    return this.safeGetItem(this.PREFIXES.PROFILES, {});
  }

  /**
   * Save readiness log
   * @param {string} userId - User ID
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {Object} readiness - Readiness data
   * @returns {Promise<void>}
   */
  async saveReadinessLog(userId, date, readiness) {
    try {
      const key = this.getCompoundKey(userId, date);
      const logs = this.getReadinessLogs();

      logs[key] = {
        userId,
        date,
        ...readiness,
        updatedAt: new Date().toISOString(),
      };

      this.setStorage(this.PREFIXES.READINESS, logs);

      // Emit event
      this.eventBus.emit(this.eventBus.TOPICS.READINESS_UPDATED, { userId, date, readiness });

      // Add to sync queue if offline
      if (!this.isOnline) {
        this.addToSyncQueue('readiness_logs', key, logs[key]);
      }
    } catch (error) {
      this.logger.error('Failed to save readiness log:', error);
      throw error;
    }
  }

  /**
   * Get readiness log
   * @param {string} userId - User ID
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Object|null} Readiness log
   */
  getReadinessLog(userId, date) {
    const key = this.getCompoundKey(userId, date);
    const logs = this.getReadinessLogs();
    return logs[key] || null;
  }

  /**
   * Get all readiness logs
   * @returns {Object} All readiness logs
   */
  getReadinessLogs() {
    return this.getStorage(this.PREFIXES.READINESS, {});
  }

  /**
   * Save session log
   * @param {string} userId - User ID
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {Object} session - Session data
   * @returns {Promise<void>}
   */
  async saveSessionLog(userId, date, session) {
    try {
      const key = this.getCompoundKey(userId, date);
      const logs = this.getSessionLogs();

      logs[key] = {
        userId,
        date,
        ...session,
        updatedAt: new Date().toISOString(),
      };

      this.setStorage(this.PREFIXES.SESSIONS, logs);

      // Emit event
      this.eventBus.emit(this.eventBus.TOPICS.SESSION_COMPLETED, { userId, date, session });

      // Add to sync queue if offline
      if (!this.isOnline) {
        this.addToSyncQueue('session_logs', key, logs[key]);
      }
    } catch (error) {
      this.logger.error('Failed to save session log:', error);
      throw error;
    }
  }

  /**
   * Get session log
   * @param {string} userId - User ID
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {Object|null} Session log
   */
  getSessionLog(userId, date) {
    const key = this.getCompoundKey(userId, date);
    const logs = this.getSessionLogs();
    return logs[key] || null;
  }

  /**
   * Get all session logs
   * @returns {Object} All session logs
   */
  getSessionLogs() {
    return this.getStorage(this.PREFIXES.SESSIONS, {});
  }

  /**
   * Save progression event
   * @param {string} userId - User ID
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {Object} event - Progression event data
   * @returns {Promise<void>}
   */
  async saveProgressionEvent(userId, date, event) {
    try {
      const key = this.getCompoundKey(userId, date);
      const events = this.getProgressionEvents();

      events[key] = {
        userId,
        date,
        ...event,
        updatedAt: new Date().toISOString(),
      };

      this.setStorage(this.PREFIXES.PROGRESSION, events);

      // Add to sync queue if offline
      if (!this.isOnline) {
        this.addToSyncQueue('progression_events', key, events[key]);
      }
    } catch (error) {
      this.logger.error('Failed to save progression event:', error);
      throw error;
    }
  }

  /**
   * Get progression events
   * @returns {Object} All progression events
   */
  getProgressionEvents() {
    return this.getStorage(this.PREFIXES.PROGRESSION, {});
  }

  /**
   * Save injury flag
   * @param {string} userId - User ID
   * @param {string} date - Date string (YYYY-MM-DD)
   * @param {Object} flag - Injury flag data
   * @returns {Promise<void>}
   */
  async saveInjuryFlag(userId, date, flag) {
    try {
      const key = this.getCompoundKey(userId, date);
      const flags = this.getInjuryFlags();

      flags[key] = {
        userId,
        date,
        ...flag,
        updatedAt: new Date().toISOString(),
      };

      this.setStorage(this.PREFIXES.INJURY_FLAGS, flags);

      // Add to sync queue if offline
      if (!this.isOnline) {
        this.addToSyncQueue('injury_flags', key, flags[key]);
      }
    } catch (error) {
      this.logger.error('Failed to save injury flag:', error);
      throw error;
    }
  }

  /**
   * Get injury flags
   * @returns {Object} All injury flags
   */
  getInjuryFlags() {
    return this.getStorage(this.PREFIXES.INJURY_FLAGS, {});
  }

  /**
   * Save preference
   * @param {string} userId - User ID
   * @param {Object} preferences - Preference data
   * @returns {Promise<void>}
   */
  async savePreferences(userId, preferences) {
    try {
      const allPreferences = this.getPreferences();

      allPreferences[userId] = {
        userId,
        ...preferences,
        updatedAt: new Date().toISOString(),
      };

      this.setStorage(this.PREFIXES.PREFERENCES, allPreferences);

      // Add to sync queue if offline
      if (!this.isOnline) {
        this.addToSyncQueue('preferences', userId, allPreferences[userId]);
      }
    } catch (error) {
      this.logger.error('Failed to save preferences:', error);
      throw error;
    }
  }

  /**
   * Get preferences
   * @param {string} userId - User ID
   * @returns {Object|null} User preferences
   */
  getPreferences(userId = null) {
    const allPreferences = this.getStorage(this.PREFIXES.PREFERENCES, {});
    return userId ? allPreferences[userId] || null : allPreferences;
  }

  /**
   * Add item to sync queue
   * @param {string} table - Table name
   * @param {string} key - Item key
   * @param {Object} data - Data to sync
   */
  addToSyncQueue(table, key, data) {
    const queueItem = {
      table,
      key,
      data,
      timestamp: Date.now(),
      attempts: 0,
    };

    this.syncQueue.push(queueItem);
    this.saveSyncQueue();

    this.eventBus.emit(this.eventBus.TOPICS.SYNC_QUEUE_UPDATED, {
      queueLength: this.syncQueue.length,
    });
  }

  /**
   * Load sync queue from storage
   */
  loadSyncQueue() {
    try {
      const queue = this.safeGetItem(this.PREFIXES.SYNC_QUEUE, []);
      this.syncQueue = Array.isArray(queue) ? queue : [];
    } catch (error) {
      this.logger.error('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Save sync queue to storage
   */
  saveSyncQueue() {
    try {
      if (!this.safeSetItem(this.PREFIXES.SYNC_QUEUE, this.syncQueue)) {
        this.logger.error('Failed to save sync queue to localStorage');
      }
    } catch (error) {
      this.logger.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Attempt to sync queue
   */
  async attemptSync() {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      const itemsToSync = [...this.syncQueue];
      const total = itemsToSync.length;
      let completed = 0;

      for (const item of itemsToSync) {
        try {
          // Attempt to sync to server
          const success = await this.syncItem(item);

          if (success) {
            // Remove from queue on success
            const index = this.syncQueue.findIndex(q => q === item);
            if (index !== -1) {
              this.syncQueue.splice(index, 1);
            }
          } else {
            // Increment attempt count
            item.attempts++;
            // Small progressive backoff (max 5s)
            const backoff = Math.min(500 * Math.pow(2, item.attempts - 1), 5000);
            await new Promise(r => setTimeout(r, backoff));
          }
        } catch (error) {
          this.logger.error('Failed to sync item:', error);
          item.attempts++;
        }
        completed++;
        this.eventBus.emit(this.eventBus.TOPICS?.SYNC_PROGRESS || 'sync:progress', {
          completed,
          total,
          remaining: this.syncQueue.length,
        });
      }

      this.saveSyncQueue();
      this.eventBus.emit(this.eventBus.TOPICS.SYNC_QUEUE_UPDATED, {
        queueLength: this.syncQueue.length,
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync a single item
   * @param {Object} item - Sync queue item
   * @returns {Promise<boolean>} Success status
   */
  async syncItem(item) {
    // Basic validation
    if (!item || !item.table || !item.key || !item.data) {
      this.logger.warn('syncItem: invalid item', item);
      return false;
    }

    // Prepare payload with checksum for idempotency
    const payload = {
      table: item.table,
      key: item.key,
      data: item.data,
      updated_at: item.data?.updatedAt || new Date().toISOString(),
      checksum: this.computeChecksum(item),
    };

    const token =
      window.AuthManager?.getToken?.() || window.AuthManager?.getAuthState?.().token || null;

    try {
      const res = await fetch('/.netlify/functions/sync-upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 200 || res.status === 201 || res.status === 204) {
        return true;
      }

      if (res.status === 409) {
        // Conflict: assume server already has same/newer data, mark as synced
        return true;
      }

      if (res.status === 422 || res.status === 400) {
        const body = await res.json().catch(() => ({}));
        this.logger.warn('syncItem: validation failed', body);
        // Drop item to prevent infinite loop when invalid
        return true;
      }

      if (res.status === 401 || res.status === 403) {
        this.logger.warn('syncItem: unauthorized, will retry later');
        return false;
      }

      this.logger.warn('syncItem: unexpected status', res.status);
      return false;
    } catch (error) {
      this.logger.error('syncItem: network error', error.message || error);
      return false;
    }
  }

  computeChecksum(item) {
    try {
      const str = JSON.stringify({ t: item.table, k: item.key, d: item.data });
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return (hash >>> 0).toString(16);
    } catch (e) {
      return '0';
    }
  }

  /**
   * Get sync queue status
   * @returns {Object} Queue status
   */
  getSyncQueueStatus() {
    return {
      queueLength: this.syncQueue.length,
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
    };
  }

  /**
   * Generic storage getter
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value
   * @returns {any} Stored value
   */
  getStorage(key, defaultValue = null) {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      this.logger.error(`Failed to get storage for key ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Generic storage setter
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   */
  setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Failed to set storage for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async clearAllData() {
    try {
      Object.values(this.PREFIXES).forEach(prefix => {
        localStorage.removeItem(prefix);
      });

      this.syncQueue = [];
      this.saveSyncQueue();
    } catch (error) {
      this.logger.error('Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage statistics
   */
  getStorageStats() {
    const stats = {};

    Object.entries(this.PREFIXES).forEach(([name, key]) => {
      const data = this.getStorage(key, {});
      const count = typeof data === 'object' && data !== null ? Object.keys(data).length : 0;
      const { size } = new Blob([JSON.stringify(data)]);

      stats[name] = {
        count,
        size,
        sizeKB: (size / 1024).toFixed(2),
      };
    });

    return stats;
  }
}

// Create global instance
window.StorageManager = new StorageManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
