/**
 * Health Check Script
 * Tests critical modules and functionality
 */

class HealthChecker {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
    }

    /**
     * Run all health checks
     */
    async runChecks() {
        const checks = [
            this.checkCoreModules,
            this.checkStorageManager,
            this.checkEventBus,
            this.checkRouter,
            this.checkServiceWorker,
            this.checkLocalStorage,
            this.checkNetworkConnectivity,
            this.checkAppReady
        ];

        for (const check of checks) {
            try {
                await check.call(this);
            } catch (error) {
                this.addResult('error', check.name, `Failed: ${error.message}`);
            }
        }

        this.displayResults();
    }

    /**
     * Check core modules are loaded
     */
    async checkCoreModules() {
        const modules = [
            'SafeLogger',
            'EventBus',
            'StorageManager',
            'AuthManager',
            'Router'
        ];

        const missing = modules.filter(module => !window[module]);
        
        if (missing.length === 0) {
            this.addResult('ok', 'Core Modules', 'All core modules loaded');
        } else {
            this.addResult('error', 'Core Modules', `Missing: ${missing.join(', ')}`);
        }
    }

    /**
     * Check StorageManager functionality
     */
    async checkStorageManager() {
        if (!window.StorageManager) {
            this.addResult('error', 'StorageManager', 'Not available');
            return;
        }

        try {
            const testKey = 'health_check_test';
            const testValue = { test: true, timestamp: Date.now() };
            
            // Test safe storage methods
            if (window.StorageManager.prototype.safeSetItem) {
                const success = window.StorageManager.prototype.safeSetItem.call(
                    window.StorageManager, testKey, testValue
                );
                if (success) {
                    const retrieved = window.StorageManager.prototype.safeGetItem.call(
                        window.StorageManager, testKey, null
                    );
                    if (retrieved && retrieved.test === true) {
                        this.addResult('ok', 'StorageManager', 'Read/write operations working');
                    } else {
                        this.addResult('warning', 'StorageManager', 'Read operation failed');
                    }
                } else {
                    this.addResult('error', 'StorageManager', 'Write operation failed');
                }
            } else {
                this.addResult('warning', 'StorageManager', 'Safe storage methods not available');
            }
        } catch (error) {
            this.addResult('error', 'StorageManager', `Error: ${error.message}`);
        }
    }

    /**
     * Check EventBus functionality
     */
    async checkEventBus() {
        if (!window.EventBus) {
            this.addResult('error', 'EventBus', 'Not available');
            return;
        }

        try {
            let eventReceived = false;
            const testTopic = 'health_check_test';
            
            // Listen for test event
            window.EventBus.on(testTopic, () => {
                eventReceived = true;
            });
            
            // Emit test event
            window.EventBus.emit(testTopic, { test: true });
            
            // Wait a bit for event to be processed
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (eventReceived) {
                this.addResult('ok', 'EventBus', 'Event system working');
            } else {
                this.addResult('warning', 'EventBus', 'Event system may not be working');
            }
        } catch (error) {
            this.addResult('error', 'EventBus', `Error: ${error.message}`);
        }
    }

    /**
     * Check Router functionality
     */
    async checkRouter() {
        if (!window.Router) {
            this.addResult('error', 'Router', 'Not available');
            return;
        }

        try {
            // Check if router has required methods
            const requiredMethods = ['navigate', 'isAuthenticated'];
            const missing = requiredMethods.filter(method => 
                typeof window.Router.prototype[method] !== 'function'
            );
            
            if (missing.length === 0) {
                this.addResult('ok', 'Router', 'Required methods available');
            } else {
                this.addResult('warning', 'Router', `Missing methods: ${missing.join(', ')}`);
            }
        } catch (error) {
            this.addResult('error', 'Router', `Error: ${error.message}`);
        }
    }

    /**
     * Check Service Worker status
     */
    async checkServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            this.addResult('warning', 'Service Worker', 'Not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                this.addResult('ok', 'Service Worker', 'Registered and active');
            } else {
                this.addResult('warning', 'Service Worker', 'Not registered');
            }
        } catch (error) {
            this.addResult('error', 'Service Worker', `Error: ${error.message}`);
        }
    }

    /**
     * Check localStorage availability
     */
    async checkLocalStorage() {
        try {
            const testKey = 'health_check_localStorage';
            const testValue = 'test';
            
            localStorage.setItem(testKey, testValue);
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            
            if (retrieved === testValue) {
                this.addResult('ok', 'LocalStorage', 'Available and working');
            } else {
                this.addResult('error', 'LocalStorage', 'Not working correctly');
            }
        } catch (error) {
            this.addResult('error', 'LocalStorage', `Error: ${error.message}`);
        }
    }

    /**
     * Check network connectivity
     */
    async checkNetworkConnectivity() {
        if (navigator.onLine) {
            this.addResult('ok', 'Network', 'Online');
        } else {
            this.addResult('warning', 'Network', 'Offline');
        }
    }

    /**
     * Check if app is ready
     */
    async checkAppReady() {
        if (window.appReady === true) {
            this.addResult('ok', 'App Ready', 'Application initialized');
        } else {
            this.addResult('warning', 'App Ready', 'Application not yet ready');
        }
    }

    /**
     * Add a result
     */
    addResult(type, component, message) {
        this.results.push({ type, component, message });
    }

    /**
     * Display results
     */
    displayResults() {
        const container = document.getElementById('health-status');
        const detailsContainer = document.getElementById('health-details');
        const timestampElement = document.getElementById('timestamp');
        
        // Clear loading message
        container.innerHTML = '';
        
        // Display results
        this.results.forEach(result => {
            const statusDiv = document.createElement('div');
            statusDiv.className = `status ${result.type}`;
            
            const icon = result.type === 'ok' ? '✅' : 
                        result.type === 'warning' ? '⚠️' : '❌';
            
            statusDiv.innerHTML = `
                <span class="status-icon">${icon}</span>
                <span><strong>${result.component}:</strong> ${result.message}</span>
            `;
            
            container.appendChild(statusDiv);
        });
        
        // Show details
        if (this.results.some(r => r.type === 'error' || r.type === 'warning')) {
            detailsContainer.style.display = 'block';
            detailsContainer.innerHTML = `
                <strong>Detailed Results:</strong><br>
                ${this.results.map(r => 
                    `${r.type.toUpperCase()}: ${r.component} - ${r.message}`
                ).join('<br>')}
            `;
        }
        
        // Show timestamp
        const duration = Date.now() - this.startTime;
        timestampElement.textContent = `Health check completed in ${duration}ms at ${new Date().toLocaleString()}`;
    }
}

// Run health checks when page loads
document.addEventListener('DOMContentLoaded', () => {
    const checker = new HealthChecker();
    checker.runChecks();
});

