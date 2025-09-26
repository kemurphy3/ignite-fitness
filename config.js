/**
 * Client-Side Configuration
 * 
 * ⚠️  WARNING: This file is loaded in the browser and is visible to users!
 * Only include PUBLIC configuration that is safe to expose to clients.
 * 
 * For server-side configuration, use environment variables in Netlify functions.
 * For sensitive data, use the /api/public-config endpoint.
 */

// Public configuration that can be safely exposed to clients
const PUBLIC_CONFIG = {
    // App information
    app: {
        name: 'Ignite Fitness',
        version: '1.0.0',
        description: 'AI-powered fitness tracking with Strava integration'
    },
    
    // Feature flags (public only)
    features: {
        stravaIntegration: true,
        aiWorkoutGeneration: true,
        offlineMode: true,
        pwa: true,
        analytics: true
    },
    
    // UI configuration
    ui: {
        theme: 'default',
        language: 'en',
        timezone: 'UTC',
        maxFileSize: '10MB',
        supportedImageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    },
    
    // Cache configuration
    cache: {
        defaultTtl: 300000, // 5 minutes
        maxSize: 1000,
        offlineTtl: 86400000 // 24 hours for offline mode
    },
    
    // API configuration (endpoints only, no keys)
    api: {
        baseUrl: '', // Will be populated from public-config endpoint
        timeout: 30000, // 30 seconds
        retryAttempts: 3
    }
};

// Configuration loader that fetches server-side config
class ConfigLoader {
    constructor() {
        this.config = { ...PUBLIC_CONFIG };
        this.loaded = false;
    }
    
    async load() {
        if (this.loaded) {
            return this.config;
        }
        
        try {
            const response = await fetch('/.netlify/functions/public-config');
            if (response.ok) {
                const serverConfig = await response.json();
                this.config = { ...this.config, ...serverConfig };
                this.loaded = true;
                console.log('✅ Configuration loaded from server');
            } else {
                console.warn('⚠️ Failed to load server configuration, using defaults');
            }
        } catch (error) {
            console.warn('⚠️ Error loading configuration:', error);
            console.warn('Using default configuration');
        }
        
        return this.config;
    }
    
    get(key) {
        return key ? this.config[key] : this.config;
    }
}

// Create global config instance
const configLoader = new ConfigLoader();

// Auto-load configuration when DOM is ready
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => configLoader.load());
    } else {
        configLoader.load();
    }
}

// Export for use in the main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PUBLIC_CONFIG, ConfigLoader, configLoader };
} else {
    // Make available globally for browser
    window.PUBLIC_CONFIG = PUBLIC_CONFIG;
    window.ConfigLoader = ConfigLoader;
    window.configLoader = configLoader;
}
