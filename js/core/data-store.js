// Data Store Module
// Centralized data management with smart caching and conflict resolution

class DataStore {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.cache = new Map();
    this.pendingWrites = new Map();
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    this.conflictResolution = 'timestamp'; // local, remote, merge, timestamp
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.maxCacheSize = 1000;

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Start sync interval
    setInterval(() => this.processSyncQueue(), 30000); // Every 30 seconds
  }

  // Get data with caching
  async get(key, options = {}) {
    const { useCache = true, forceRefresh = false } = options;

    // Check cache first
    if (useCache && !forceRefresh) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    // Fetch from source
    try {
      const data = await this.fetchFromSource(key);

      // Cache the result
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      this.logger.error('Error fetching data', { key, error: error.message, stack: error.stack });

      // Return cached data if available
      const cached = this.cache.get(key);
      if (cached) {
        return cached.data;
      }

      throw error;
    }
  }

  // Set data with conflict resolution
  async set(key, data, options = {}) {
    const { priority = 'local', conflictResolution = this.conflictResolution } = options;

    // Check for conflicts
    const existing = this.cache.get(key);
    if (existing && this.hasConflict(existing.data, data)) {
      const resolved = this.resolveConflict(existing.data, data, conflictResolution);
      data = resolved;
    }

    // Store in cache
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      priority,
    });

    // Queue for sync if online
    if (this.isOnline) {
      this.syncQueue.push({ key, data, timestamp: Date.now() });
    } else {
      // Store pending write
      this.pendingWrites.set(key, { data, timestamp: Date.now() });
    }

    // Save to localStorage as backup
    this.saveToLocalStorage(key, data);
  }

  // Fetch from source (localStorage or API)
  async fetchFromSource(key) {
    // Try localStorage first
    const localData = this.loadFromLocalStorage(key);
    if (localData) {
      return localData;
    }

    // Try API if online
    if (this.isOnline) {
      try {
        return await this.fetchFromAPI(key);
      } catch (error) {
        this.logger.warn('API fetch failed, using local data', { key, error: error.message });
        return localData;
      }
    }

    return localData;
  }

  // Load from localStorage
  loadFromLocalStorage(key) {
    try {
      const data = localStorage.getItem(`ignitefitness_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error('Error loading from localStorage', {
        key,
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }

  // Save to localStorage
  saveToLocalStorage(key, data) {
    try {
      localStorage.setItem(`ignitefitness_${key}`, JSON.stringify(data));
    } catch (error) {
      this.logger.error('Error saving to localStorage', {
        key,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  // Fetch from API
  async fetchFromAPI(key) {
    const endpoints = {
      user_data: '/.netlify/functions/get-user-data',
      sessions: '/.netlify/functions/sessions-list',
      all_users: '/.netlify/functions/admin-get-all-users',
    };

    const endpoint = endpoints[key];
    if (!endpoint) {
      throw new Error(`No API endpoint for key: ${key}`);
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  }

  // Check for data conflicts
  hasConflict(existing, incoming) {
    // Simple conflict detection based on timestamp
    if (existing.timestamp && incoming.timestamp) {
      const timeDiff = Math.abs(existing.timestamp - incoming.timestamp);
      return timeDiff > 1000; // 1 second threshold
    }
    return false;
  }

  // Resolve conflicts
  resolveConflict(existing, incoming, strategy) {
    switch (strategy) {
      case 'local':
        return existing;
      case 'remote':
        return incoming;
      case 'merge':
        return this.mergeData(existing, incoming);
      case 'timestamp':
      default:
        return existing.timestamp > incoming.timestamp ? existing : incoming;
    }
  }

  // Merge data objects
  mergeData(existing, incoming) {
    const merged = { ...existing };

    for (const key in incoming) {
      if (incoming[key] !== undefined) {
        if (typeof incoming[key] === 'object' && !Array.isArray(incoming[key])) {
          merged[key] = this.mergeData(existing[key] || {}, incoming[key]);
        } else {
          merged[key] = incoming[key];
        }
      }
    }

    return merged;
  }

  // Process sync queue
  async processSyncQueue() {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    const batch = this.syncQueue.splice(0, 10); // Process 10 items at a time

    for (const item of batch) {
      try {
        await this.syncToAPI(item.key, item.data);
      } catch (error) {
        this.logger.error('Sync failed', {
          key: item.key,
          error: error.message,
          stack: error.stack,
        });
        // Re-queue for retry
        this.syncQueue.push(item);
      }
    }
  }

  // Sync to API
  async syncToAPI(key, data) {
    const endpoints = {
      user_data: '/.netlify/functions/save-user-data',
      sessions: '/.netlify/functions/sessions-create',
      preferences: '/.netlify/functions/save-user-data',
      goals: '/.netlify/functions/save-user-data',
      workout_schedule: '/.netlify/functions/save-user-data',
      strava_activities: '/.netlify/functions/save-user-data',
    };

    const endpoint = endpoints[key];
    if (!endpoint) {
      throw new Error(`No sync endpoint for key: ${key}`);
    }

    // Prepare data for database sync based on data type
    let requestBody;
    if (key === 'user_data') {
      requestBody = {
        userId: this.currentUser,
        dataType: 'all',
        data,
      };
    } else if (['preferences', 'goals', 'workout_schedule', 'strava_activities'].includes(key)) {
      requestBody = {
        userId: this.currentUser,
        dataType: key,
        data,
      };
    } else {
      requestBody = data;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Sync failed: ${response.status}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage += ` - ${errorData.error || errorText}`;
        } catch {
          errorMessage += ` - ${errorText}`;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      this.logger.info('Successfully synced to database', { key, result });

      // Update last sync time
      this.lastSyncTime = Date.now();
      localStorage.setItem('ignitefitness_last_sync', this.lastSyncTime.toString());

      return result;
    } catch (error) {
      this.logger.error('Sync error', { key, error: error.message, stack: error.stack });

      // If it's a network error, queue for retry
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        throw new Error(`Network error: ${error.message}`);
      }

      // For other errors, re-throw
      throw error;
    }
  }

  // Handle online event
  handleOnline() {
    this.isOnline = true;
    this.updateSyncStatus();

    // Process pending writes
    for (const [key, write] of this.pendingWrites) {
      this.syncQueue.push({ key, data: write.data, timestamp: write.timestamp });
    }
    this.pendingWrites.clear();
  }

  // Handle offline event
  handleOffline() {
    this.isOnline = false;
    this.updateSyncStatus();
  }

  // Update sync status indicator
  updateSyncStatus() {
    const indicator = document.getElementById('sync-status');
    if (indicator) {
      indicator.textContent = this.isOnline ? '🟢 Online' : '🔴 Offline';
      indicator.style.color = this.isOnline ? '#68d391' : '#fc8181';
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      pendingWrites: this.pendingWrites.size,
      syncQueue: this.syncQueue.length,
      isOnline: this.isOnline,
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DataStore };
} else {
  // Make available globally for browser
  window.DataStore = DataStore;
}
