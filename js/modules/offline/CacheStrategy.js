/**
 * CacheStrategy - Client-side cache management for service worker
 * Provides high-level cache operations and monitoring
 */
class CacheStrategy {
  constructor() {
    this.serviceWorker = null;
    this.cacheStats = {
      static: { size: 0, entries: 0 },
      api: { size: 0, entries: 0 },
      workout: { size: 0, entries: 0 },
    };

    this.logger = window.SafeLogger || console;

    this.init();
  }

  /**
   * Initialize cache strategy
   */
  async init() {
    try {
      // Register service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js');
        this.serviceWorker = registration.active || registration.waiting || registration.installing;

        this.logger.info('Service Worker registered:', registration);

        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.logger.info('New service worker available');
              this.notifyUpdate();
            }
          });
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));

        // Update cache stats
        await this.updateCacheStats();
      } else {
        this.logger.warn('Service Worker not supported');
      }
    } catch (error) {
      this.logger.error('Failed to initialize cache strategy:', error);
    }
  }

  /**
   * Cache workout data
   * @param {string} url - Data URL
   * @param {Object} data - Data to cache
   */
  async cacheWorkoutData(url, data) {
    if (!this.serviceWorker) {
      this.logger.warn('Service Worker not available for caching');
      return;
    }

    try {
      this.serviceWorker.postMessage({
        type: 'CACHE_WORKOUT_DATA',
        data: { url, data },
      });

      this.logger.debug('Workout data cached:', url);
    } catch (error) {
      this.logger.error('Failed to cache workout data:', error);
    }
  }

  /**
   * Preload critical resources
   * @param {Array} urls - URLs to preload
   */
  async preloadResources(urls) {
    if (!this.serviceWorker) {
      return;
    }

    try {
      const cache = await caches.open('ignite-fitness-static-v1');

      const preloadPromises = urls.map(async url => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            this.logger.debug('Preloaded resource:', url);
          }
        } catch (error) {
          this.logger.warn('Failed to preload resource:', url, error);
        }
      });

      await Promise.all(preloadPromises);
      this.logger.info(`Preloaded ${urls.length} resources`);
    } catch (error) {
      this.logger.error('Failed to preload resources:', error);
    }
  }

  /**
   * Clear specific cache
   * @param {string} cacheName - Cache name to clear
   */
  async clearCache(cacheName) {
    if (!this.serviceWorker) {
      return;
    }

    try {
      this.serviceWorker.postMessage({
        type: 'CLEAR_CACHE',
        data: { cacheName },
      });

      this.logger.info('Cache cleared:', cacheName);
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  async getCacheStats() {
    if (!this.serviceWorker) {
      return this.cacheStats;
    }

    try {
      const messageChannel = new MessageChannel();

      return new Promise(resolve => {
        messageChannel.port1.onmessage = event => {
          this.cacheStats = event.data;
          resolve(event.data);
        };

        this.serviceWorker.postMessage(
          {
            type: 'GET_CACHE_STATS',
          },
          [messageChannel.port2]
        );
      });
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return this.cacheStats;
    }
  }

  /**
   * Update cache statistics
   */
  async updateCacheStats() {
    this.cacheStats = await this.getCacheStats();
  }

  /**
   * Check if resource is cached
   * @param {string} url - URL to check
   * @returns {boolean} Cached status
   */
  async isCached(url) {
    try {
      const cache = await caches.open('ignite-fitness-static-v1');
      const response = await cache.match(url);
      return !!response;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached data
   * @param {string} url - URL to get
   * @returns {Object|null} Cached data or null
   */
  async getCachedData(url) {
    try {
      const cache = await caches.open('ignite-fitness-workout-v1');
      const response = await cache.match(url);

      if (response) {
        return await response.json();
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Handle messages from service worker
   * @param {MessageEvent} event - Message event
   */
  handleMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case 'CACHE_UPDATED':
        this.logger.debug('Cache updated:', data);
        break;
      case 'CACHE_ERROR':
        this.logger.error('Cache error:', data);
        break;
    }
  }

  /**
   * Notify user about service worker update
   */
  notifyUpdate() {
    // Create update notification
    const notification = document.createElement('div');
    notification.className = 'sw-update-notification';
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-primary);
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            font-weight: 500;
        `;

    notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 20px;">🔄</span>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px;">Update Available</div>
                    <div style="font-size: 14px; opacity: 0.9;">A new version is ready</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove(); window.location.reload();" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                ">Update</button>
            </div>
        `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  /**
   * Monitor cache performance
   */
  startPerformanceMonitoring() {
    setInterval(async () => {
      await this.updateCacheStats();

      const totalSize = Object.values(this.cacheStats).reduce((sum, stat) => sum + stat.size, 0);
      const totalEntries = Object.values(this.cacheStats).reduce(
        (sum, stat) => sum + stat.entries,
        0
      );

      if (totalSize > 40 * 1024 * 1024) {
        // 40MB
        this.logger.warn('Cache size approaching limit:', totalSize);
      }

      this.logger.debug('Cache stats:', {
        totalSize: `${Math.round(totalSize / 1024 / 1024)}MB`,
        totalEntries,
        hitRate: this.calculateHitRate(),
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Calculate cache hit rate
   * @returns {number} Hit rate percentage
   */
  calculateHitRate() {
    // This would need to be implemented with actual hit/miss tracking
    // For now, return a placeholder
    return 85; // 85% hit rate
  }

  /**
   * Get offline status
   * @returns {boolean} Offline status
   */
  isOffline() {
    return !navigator.onLine;
  }

  /**
   * Handle offline/online events
   */
  setupOfflineHandling() {
    window.addEventListener('online', () => {
      this.logger.info('Back online');
      this.dispatchEvent('online');
    });

    window.addEventListener('offline', () => {
      this.logger.info('Gone offline');
      this.dispatchEvent('offline');
    });
  }

  /**
   * Dispatch custom events
   */
  dispatchEvent(eventName, detail) {
    const event = new CustomEvent(eventName, { detail });
    window.dispatchEvent(event);
  }
}

// Export for use in other modules
window.CacheStrategy = CacheStrategy;
