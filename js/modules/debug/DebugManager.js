/**
 * DebugManager - Centralized debugging utilities for Ignite Fitness
 * Provides comprehensive debugging tools for localStorage, data validation, and system diagnostics
 */
class DebugManager {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.isEnabled = this.checkDebugMode();
        this.debugPrefix = 'ignitefitness_';

        // Initialize debug tools
        this.initializeDebugTools();
    }

    /**
     * Check if debug mode is enabled
     * @returns {boolean} True if debug mode is enabled
     */
    checkDebugMode() {
        // Enable debug mode if localStorage has debug flag or URL has debug parameter
        const urlParams = new URLSearchParams(window.location.search);
        const hasDebugParam = urlParams.get('debug') === 'true';
        const hasDebugFlag = localStorage.getItem('ignitefitness_debug_mode') === 'true';

        return hasDebugParam || hasDebugFlag;
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        if (enabled) {
            localStorage.setItem('ignitefitness_debug_mode', 'true');
            this.logger.info('Debug mode enabled');
        } else {
            localStorage.removeItem('ignitefitness_debug_mode');
            this.logger.info('Debug mode disabled');
        }
        this.isEnabled = enabled;
    }

    /**
     * Initialize debug tools and make them globally available
     */
    initializeDebugTools() {
        // Make debug manager globally available
        window.DebugManager = this;

        // Make individual debug functions globally available
        window.checkSavedData = () => this.checkSavedData();
        window.debugStorage = () => this.debugStorage();
        window.debugUsers = () => this.debugUsers();
        window.debugPerformance = () => this.debugPerformance();
        window.clearDebugData = () => this.clearDebugData();
        window.exportDebugData = () => this.exportDebugData();

        if (this.isEnabled) {
            this.logger.info('Debug tools initialized and available globally');
        }
    }

    /**
     * Comprehensive localStorage data checker
     * @returns {Object} Detailed data analysis
     */
    checkSavedData() {
        this.logger.log('=== Ignite Fitness Data Check ===');

        // Get all localStorage keys that start with 'ignitefitness_'
        const allKeys = Object.keys(localStorage).filter(key => key.startsWith(this.debugPrefix));

        this.logger.log(`Found ${allKeys.length} Ignite Fitness keys in localStorage:`, allKeys);

        const data = {};
        let totalSize = 0;
        const parseErrors = [];

        // Check each key
        allKeys.forEach(key => {
            try {
                const rawData = localStorage.getItem(key);
                const dataSize = rawData ? new Blob([rawData]).size : 0;
                totalSize += dataSize;

                data[key] = {
                    raw: rawData,
                    size: dataSize,
                    parsed: null,
                    error: null,
                    lastModified: this.getKeyLastModified(key)
                };

                // Try to parse as JSON
                if (rawData) {
                    try {
                        data[key].parsed = JSON.parse(rawData);
                    } catch (parseError) {
                        data[key].error = `Parse error: ${parseError.message}`;
                        parseErrors.push({ key, error: parseError.message });
                    }
                }
            } catch (error) {
                data[key] = {
                    raw: null,
                    size: 0,
                    parsed: null,
                    error: `Access error: ${error.message}`,
                    lastModified: null
                };
                parseErrors.push({ key, error: error.message });
            }
        });

        // Display summary
        this.logger.log('=== DATA SUMMARY ===');
        this.logger.log(`Total keys: ${allKeys.length}`);
        this.logger.log(`Total size: ${(totalSize / 1024).toFixed(2)} KB`);
        this.logger.log(`Parse errors: ${parseErrors.length}`);

        if (parseErrors.length > 0) {
            this.logger.warn('Parse errors found:', parseErrors);
        }

        // Display detailed data for each key
        this.logger.log('=== DETAILED DATA ===');
        Object.entries(data).forEach(([key, info]) => {
            this.logger.group(`📁 ${key}`);
            this.logger.log(`Size: ${(info.size / 1024).toFixed(2)} KB`);
            this.logger.log(`Last Modified: ${info.lastModified || 'Unknown'}`);

            if (info.error) {
                this.logger.error(`❌ Error: ${info.error}`);
            } else if (info.parsed) {
                this.logger.log('✅ Parsed data:', info.parsed);
            } else if (info.raw) {
                this.logger.log('📄 Raw data:', info.raw);
            } else {
                this.logger.log('📭 No data');
            }
            this.logger.groupEnd();
        });

        // Check for critical data
        const criticalKeys = [
            'ignitefitness_users',
            'ignitefitness_current_user',
            'ignitefitness_personal_info',
            'ignitefitness_goals',
            'ignitefitness_session_data'
        ];

        this.logger.log('=== CRITICAL DATA STATUS ===');
        criticalKeys.forEach(key => {
            const hasData = data[key] && data[key].parsed;
            this.logger.log(`${hasData ? '✅' : '❌'} ${key}: ${hasData ? 'Present' : 'Missing'}`);
        });

        // Storage usage info
        this.getStorageInfo();

        return {
            keys: allKeys,
            data,
            totalSize,
            parseErrors,
            summary: {
                totalKeys: allKeys.length,
                totalSizeKB: (totalSize / 1024).toFixed(2),
                parseErrors: parseErrors.length
            }
        };
    }

    /**
     * Get storage usage information
     */
    async getStorageInfo() {
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                this.logger.log('=== STORAGE INFO ===');
                this.logger.log(`Used: ${(estimate.usage / 1024 / 1024).toFixed(2)} MB`);
                this.logger.log(`Available: ${(estimate.quota / 1024 / 1024).toFixed(2)} MB`);
                this.logger.log(`Usage: ${((estimate.usage / estimate.quota) * 100).toFixed(2)}%`);
            } catch (error) {
                this.logger.error('Failed to get storage info:', error);
            }
        }
    }

    /**
     * Debug user data specifically
     */
    debugUsers() {
        this.logger.log('=== USER DATA DEBUG ===');

        const usersData = localStorage.getItem('ignitefitness_users');
        if (!usersData) {
            this.logger.warn('No users data found');
            return;
        }

        try {
            const users = JSON.parse(usersData);
            this.logger.log(`Total users: ${Object.keys(users).length}`);

            Object.entries(users).forEach(([username, userData]) => {
                this.logger.group(`👤 User: ${username}`);
                this.logger.log('Email:', userData.email || 'Not set');
                this.logger.log('Last Login:', userData.lastLogin || 'Never');
                this.logger.log('Data Keys:', Object.keys(userData));
                this.logger.groupEnd();
            });
        } catch (error) {
            this.logger.error('Error parsing users data:', error);
        }
    }

    /**
     * Debug storage performance and health
     */
    debugStorage() {
        this.logger.log('=== STORAGE DEBUG ===');

        // Test localStorage performance
        const testKey = 'ignitefitness_debug_test';
        const testData = JSON.stringify({ test: 'data', timestamp: Date.now() });

        const startTime = performance.now();
        localStorage.setItem(testKey, testData);
        const readTime = performance.now();
        const retrieved = localStorage.getItem(testKey);
        const endTime = performance.now();

        localStorage.removeItem(testKey);

        this.logger.log(`Write time: ${(readTime - startTime).toFixed(2)}ms`);
        this.logger.log(`Read time: ${(endTime - readTime).toFixed(2)}ms`);
        this.logger.log(`Data integrity: ${retrieved === testData ? '✅ Pass' : '❌ Fail'}`);

        // Check for storage quota issues
        this.getStorageInfo();
    }

    /**
     * Debug application performance
     */
    debugPerformance() {
        this.logger.log('=== PERFORMANCE DEBUG ===');

        if (performance.memory) {
            this.logger.log(`Memory used: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
            this.logger.log(`Memory total: ${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
            this.logger.log(`Memory limit: ${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
        }

        // Check for memory leaks
        const allKeys = Object.keys(localStorage).filter(key => key.startsWith(this.debugPrefix));
        this.logger.log(`Ignite Fitness keys: ${allKeys.length}`);

        // Check for duplicate or orphaned data
        const duplicateKeys = this.findDuplicateKeys();
        if (duplicateKeys.length > 0) {
            this.logger.warn('Potential duplicate keys found:', duplicateKeys);
        }
    }

    /**
     * Clear debug data (non-destructive)
     */
    clearDebugData() {
        this.logger.log('=== CLEARING DEBUG DATA ===');

        const debugKeys = Object.keys(localStorage).filter(key =>
            key.startsWith('ignitefitness_debug_') ||
            key.startsWith('ignitefitness_test_')
        );

        debugKeys.forEach(key => {
            localStorage.removeItem(key);
            this.logger.log(`Removed: ${key}`);
        });

        this.logger.log(`Cleared ${debugKeys.length} debug keys`);
    }

    /**
     * Export debug data for analysis
     */
    exportDebugData() {
        this.logger.log('=== EXPORTING DEBUG DATA ===');

        const debugData = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            localStorage: {},
            performance: {}
        };

        // Export localStorage data
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(this.debugPrefix)) {
                try {
                    debugData.localStorage[key] = JSON.parse(localStorage.getItem(key));
                } catch {
                    debugData.localStorage[key] = localStorage.getItem(key);
                }
            }
        });

        // Export performance data
        if (performance.memory) {
            debugData.performance.memory = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }

        // Create downloadable file
        const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ignitefitness-debug-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.logger.log('Debug data exported successfully');
    }

    /**
     * Get last modified time for a localStorage key (approximation)
     * @param {string} key - localStorage key
     * @returns {string} Last modified time
     */
    getKeyLastModified(key) {
        // This is an approximation since localStorage doesn't store timestamps
        // We'll use the current time for now
        return new Date().toISOString();
    }

    /**
     * Find potential duplicate keys
     * @returns {Array} Array of duplicate key patterns
     */
    findDuplicateKeys() {
        const keys = Object.keys(localStorage).filter(key => key.startsWith(this.debugPrefix));
        const duplicates = [];

        // Look for keys that might be duplicates (same base name with different suffixes)
        const baseKeys = {};
        keys.forEach(key => {
            const base = key.replace(/_\d+$/, ''); // Remove numeric suffixes
            if (!baseKeys[base]) {
                baseKeys[base] = [];
            }
            baseKeys[base].push(key);
        });

        Object.entries(baseKeys).forEach(([base, variants]) => {
            if (variants.length > 1) {
                duplicates.push({ base, variants });
            }
        });

        return duplicates;
    }

    /**
     * Validate data integrity
     * @returns {Object} Validation results
     */
    validateDataIntegrity() {
        this.logger.log('=== DATA INTEGRITY VALIDATION ===');

        const results = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Check critical keys
        const criticalKeys = ['ignitefitness_users', 'ignitefitness_current_user'];
        criticalKeys.forEach(key => {
            const data = localStorage.getItem(key);
            if (!data) {
                results.errors.push(`Missing critical key: ${key}`);
                results.valid = false;
            } else {
                try {
                    JSON.parse(data);
                } catch (error) {
                    results.errors.push(`Invalid JSON in ${key}: ${error.message}`);
                    results.valid = false;
                }
            }
        });

        // Check for data consistency
        const currentUser = localStorage.getItem('ignitefitness_current_user');
        const usersData = localStorage.getItem('ignitefitness_users');

        if (currentUser && usersData) {
            try {
                const users = JSON.parse(usersData);
                if (!users[currentUser]) {
                    results.warnings.push(`Current user ${currentUser} not found in users data`);
                }
            } catch (error) {
                results.errors.push(`Error validating user consistency: ${error.message}`);
                results.valid = false;
            }
        }

        this.logger.log(`Validation ${results.valid ? '✅ PASSED' : '❌ FAILED'}`);
        if (results.errors.length > 0) {
            this.logger.error('Errors:', results.errors);
        }
        if (results.warnings.length > 0) {
            this.logger.warn('Warnings:', results.warnings);
        }

        return results;
    }
}

// Create global instance
window.DebugManager = new DebugManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugManager;
}
