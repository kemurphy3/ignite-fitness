/**
 * ConfigManager - Client-side configuration loader
 * Loads non-sensitive configuration from server-side endpoint
 * Replaces all client-side environment variable references
 */
class ConfigManager {
  constructor() {
    this.config = null;
    this.loaded = false;
    this.loadingPromise = null;
  }

  /**
   * Load configuration from server
   * @returns {Promise<Object>} Configuration object
   */
  async loadConfig() {
    if (this.loaded) {
      return this.config;
    }

    // If already loading, return the same promise
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      try {
        const response = await fetch('/.netlify/functions/public-config');
        if (!response.ok) {
          throw new Error('Failed to load configuration');
        }

        this.config = await response.json();
        this.loaded = true;
        return this.config;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Configuration loading failed:', error);
        // Fallback configuration
        this.config = {
          apiBaseUrl: window.location.origin,
          environment: 'development',
          features: {
            stravaIntegration: false,
            aiCoaching: false,
            analytics: false,
          },
        };
        this.loaded = true;
        return this.config;
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @returns {*} Configuration value
   */
  get(key) {
    if (!this.loaded) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config[key];
  }

  /**
   * Get feature flag
   * @param {string} feature - Feature name
   * @returns {boolean} Whether feature is enabled
   */
  getFeature(feature) {
    if (!this.loaded) {
      return false;
    }
    return this.config.features?.[feature] || false;
  }

  /**
   * Get API base URL
   * @returns {string} API base URL
   */
  getApiBaseUrl() {
    if (!this.loaded) {
      return window.location.origin;
    }
    return this.config.apiBaseUrl || window.location.origin;
  }

  /**
   * Get environment
   * @returns {string} Environment name
   */
  getEnvironment() {
    if (!this.loaded) {
      return 'development';
    }
    return this.config.environment || 'development';
  }

  /**
   * Check if running in production
   * @returns {boolean} Whether in production
   */
  isProduction() {
    return this.getEnvironment() === 'production';
  }
}

// Singleton instance
const configManager = new ConfigManager();

export default configManager;
