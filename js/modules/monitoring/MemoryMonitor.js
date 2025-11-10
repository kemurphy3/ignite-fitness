/**
 * MemoryMonitor - Tracks memory usage and detects leaks
 * Provides real-time memory monitoring and leak detection
 */
class MemoryMonitor {
    constructor(options = {}) {
        this.options = {
            checkInterval: options.checkInterval || 5000, // 5 seconds
            leakThreshold: options.leakThreshold || 10 * 1024 * 1024, // 10MB
            growthThreshold: options.growthThreshold || 5 * 1024 * 1024, // 5MB/hour
            maxHistory: options.maxHistory || 100,
            enableAlerts: options.enableAlerts !== false,
            enableDashboard: options.enableDashboard !== false,
            ...options
        };

        this.logger = window.SafeLogger || console;
        this.memoryHistory = [];
        this.leakDetector = new LeakDetector();
        this.performanceObserver = null;
        this.isMonitoring = false;
        this.checkTimer = null;

        this.stats = {
            currentMemory: 0,
            peakMemory: 0,
            averageMemory: 0,
            memoryGrowth: 0,
            leakCount: 0,
            gcCount: 0,
            lastGC: 0
        };

        this.init();
    }

    /**
     * Initialize memory monitor
     */
    init() {
        // Check if memory API is available
        if (!this.isMemoryAPIAvailable()) {
            this.logger.warn('Memory API not available, using fallback monitoring');
        }

        // Set up performance observer for memory events
        this.setupPerformanceObserver();

        // Start monitoring
        this.startMonitoring();

        // Set up dashboard if enabled
        if (this.options.enableDashboard) {
            this.setupDashboard();
        }

        this.logger.info('MemoryMonitor initialized');
    }

    /**
     * Check if memory API is available
     * @returns {boolean} API availability
     */
    isMemoryAPIAvailable() {
        return 'memory' in performance && 'usedJSHeapSize' in performance.memory;
    }

    /**
     * Setup performance observer for memory events
     */
    setupPerformanceObserver() {
        if (!('PerformanceObserver' in window)) {
            return;
        }

        try {
            this.performanceObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (entry.entryType === 'measure' && entry.name.includes('memory')) {
                        this.handleMemoryEvent(entry);
                    }
                });
            });

            this.performanceObserver.observe({ entryTypes: ['measure'] });
        } catch (error) {
            this.logger.warn('Failed to setup performance observer:', error);
        }
    }

    /**
     * Start memory monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        this.checkTimer = setInterval(() => {
            this.checkMemory();
        }, this.options.checkInterval);

        this.logger.info('Memory monitoring started');
    }

    /**
     * Stop memory monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;

        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }

        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
            this.performanceObserver = null;
        }

        this.logger.info('Memory monitoring stopped');
    }

    /**
     * Check current memory usage
     */
    checkMemory() {
        const memoryInfo = this.getMemoryInfo();

        if (!memoryInfo) {
            return;
        }

        // Update stats
        this.stats.currentMemory = memoryInfo.usedJSHeapSize;
        this.stats.peakMemory = Math.max(this.stats.peakMemory, memoryInfo.totalJSHeapSize);

        // Add to history
        this.memoryHistory.push({
            timestamp: Date.now(),
            used: memoryInfo.usedJSHeapSize,
            total: memoryInfo.totalJSHeapSize,
            limit: memoryInfo.jsHeapSizeLimit
        });

        // Trim history
        if (this.memoryHistory.length > this.options.maxHistory) {
            this.memoryHistory.shift();
        }

        // Calculate average
        this.calculateAverageMemory();

        // Check for leaks
        this.checkForLeaks();

        // Check for excessive growth
        this.checkForGrowth();

        // Log memory info
        this.logger.debug('Memory check:', {
            used: this.formatBytes(memoryInfo.usedJSHeapSize),
            total: this.formatBytes(memoryInfo.totalJSHeapSize),
            limit: this.formatBytes(memoryInfo.jsHeapSizeLimit)
        });
    }

    /**
     * Get memory information
     * @returns {Object|null} Memory info
     */
    getMemoryInfo() {
        if (this.isMemoryAPIAvailable()) {
            return performance.memory;
        }

        // Fallback: estimate memory usage
        return this.estimateMemoryUsage();
    }

    /**
     * Estimate memory usage (fallback)
     * @returns {Object} Estimated memory info
     */
    estimateMemoryUsage() {
        // Rough estimation based on DOM elements and objects
        const domElements = document.querySelectorAll('*').length;
        const estimatedUsed = domElements * 1000; // 1KB per element estimate
        const estimatedTotal = estimatedUsed * 2;
        const estimatedLimit = 100 * 1024 * 1024; // 100MB estimate

        return {
            usedJSHeapSize: estimatedUsed,
            totalJSHeapSize: estimatedTotal,
            jsHeapSizeLimit: estimatedLimit
        };
    }

    /**
     * Calculate average memory usage
     */
    calculateAverageMemory() {
        if (this.memoryHistory.length === 0) {
            return;
        }

        const sum = this.memoryHistory.reduce((acc, entry) => acc + entry.used, 0);
        this.stats.averageMemory = sum / this.memoryHistory.length;
    }

    /**
     * Check for memory leaks
     */
    checkForLeaks() {
        if (this.memoryHistory.length < 10) {
            return;
        }

        const recent = this.memoryHistory.slice(-10);
        const older = this.memoryHistory.slice(-20, -10);

        if (older.length === 0) {
            return;
        }

        const recentAvg = recent.reduce((acc, entry) => acc + entry.used, 0) / recent.length;
        const olderAvg = older.reduce((acc, entry) => acc + entry.used, 0) / older.length;

        const growth = recentAvg - olderAvg;

        if (growth > this.options.leakThreshold) {
            this.handleLeakDetected(growth);
        }
    }

    /**
     * Check for excessive memory growth
     */
    checkForGrowth() {
        if (this.memoryHistory.length < 2) {
            return;
        }

        const first = this.memoryHistory[0];
        const last = this.memoryHistory[this.memoryHistory.length - 1];
        const timeDiff = (last.timestamp - first.timestamp) / (1000 * 60 * 60); // hours

        if (timeDiff > 0) {
            const growth = last.used - first.used;
            const growthRate = growth / timeDiff;

            this.stats.memoryGrowth = growthRate;

            if (growthRate > this.options.growthThreshold) {
                this.handleExcessiveGrowth(growthRate);
            }
        }
    }

    /**
     * Handle leak detection
     * @param {number} growth - Memory growth amount
     */
    handleLeakDetected(growth) {
        this.stats.leakCount++;

        const leakInfo = {
            timestamp: Date.now(),
            growth,
            currentMemory: this.stats.currentMemory,
            growthRate: this.stats.memoryGrowth
        };

        this.logger.warn('Memory leak detected:', leakInfo);

        if (this.options.enableAlerts) {
            this.showLeakAlert(leakInfo);
        }

        // Trigger garbage collection if available
        this.triggerGC();
    }

    /**
     * Handle excessive memory growth
     * @param {number} growthRate - Growth rate in bytes/hour
     */
    handleExcessiveGrowth(growthRate) {
        const growthInfo = {
            timestamp: Date.now(),
            growthRate,
            currentMemory: this.stats.currentMemory,
            threshold: this.options.growthThreshold
        };

        this.logger.warn('Excessive memory growth detected:', growthInfo);

        if (this.options.enableAlerts) {
            this.showGrowthAlert(growthInfo);
        }
    }

    /**
     * Show leak alert
     * @param {Object} leakInfo - Leak information
     */
    showLeakAlert(leakInfo) {
        const alert = document.createElement('div');
        alert.className = 'memory-leak-alert';
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 16px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        alert.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">Memory Leak Detected</div>
            <div style="font-size: 14px;">
                Growth: ${this.formatBytes(leakInfo.growth)}<br>
                Current: ${this.formatBytes(leakInfo.currentMemory)}
            </div>
            <button onclick="this.parentElement.remove()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                margin-top: 8px;
                cursor: pointer;
            ">Dismiss</button>
        `;

        document.body.appendChild(alert);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 10000);
    }

    /**
     * Show growth alert
     * @param {Object} growthInfo - Growth information
     */
    showGrowthAlert(growthInfo) {
        const alert = document.createElement('div');
        alert.className = 'memory-growth-alert';
        alert.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #f59e0b;
            color: white;
            padding: 16px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        alert.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">Excessive Memory Growth</div>
            <div style="font-size: 14px;">
                Rate: ${this.formatBytes(growthInfo.growthRate)}/hour<br>
                Current: ${this.formatBytes(growthInfo.currentMemory)}
            </div>
            <button onclick="this.parentElement.remove()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                margin-top: 8px;
                cursor: pointer;
            ">Dismiss</button>
        `;

        document.body.appendChild(alert);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 10000);
    }

    /**
     * Trigger garbage collection
     */
    triggerGC() {
        if (window.gc && typeof window.gc === 'function') {
            window.gc();
            this.stats.gcCount++;
            this.stats.lastGC = Date.now();
            this.logger.debug('Garbage collection triggered');
        }
    }

    /**
     * Setup memory dashboard
     */
    setupDashboard() {
        const dashboard = document.createElement('div');
        dashboard.id = 'memory-dashboard';
        dashboard.className = 'memory-dashboard';
        dashboard.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 16px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            min-width: 200px;
            display: none;
        `;

        document.body.appendChild(dashboard);

        // Toggle dashboard with Ctrl+Shift+M
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.shiftKey && event.key === 'M') {
                event.preventDefault();
                this.toggleDashboard();
            }
        });
    }

    /**
     * Toggle memory dashboard
     */
    toggleDashboard() {
        const dashboard = document.getElementById('memory-dashboard');
        if (dashboard) {
            const isVisible = dashboard.style.display !== 'none';
            dashboard.style.display = isVisible ? 'none' : 'block';

            if (!isVisible) {
                this.updateDashboard();
            }
        }
    }

    /**
     * Update memory dashboard
     */
    updateDashboard() {
        const dashboard = document.getElementById('memory-dashboard');
        if (!dashboard) {
            return;
        }

        const memoryInfo = this.getMemoryInfo();

        dashboard.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">Memory Monitor</div>
            <div>Used: ${this.formatBytes(this.stats.currentMemory)}</div>
            <div>Peak: ${this.formatBytes(this.stats.peakMemory)}</div>
            <div>Avg: ${this.formatBytes(this.stats.averageMemory)}</div>
            <div>Growth: ${this.formatBytes(this.stats.memoryGrowth)}/hr</div>
            <div>Leaks: ${this.stats.leakCount}</div>
            <div>GC: ${this.stats.gcCount}</div>
            <button onclick="document.getElementById('memory-dashboard').style.display='none'" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                margin-top: 8px;
                cursor: pointer;
            ">Close</button>
        `;
    }

    /**
     * Handle memory event from performance observer
     * @param {PerformanceEntry} entry - Performance entry
     */
    handleMemoryEvent(entry) {
        this.logger.debug('Memory event:', entry);
    }

    /**
     * Format bytes to human readable string
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) {return '0 B';}

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2)) } ${ sizes[i]}`;
    }

    /**
     * Get memory statistics
     * @returns {Object} Memory statistics
     */
    getStats() {
        return {
            ...this.stats,
            historyLength: this.memoryHistory.length,
            isMonitoring: this.isMonitoring
        };
    }

    /**
     * Get memory history
     * @returns {Array} Memory history
     */
    getHistory() {
        return [...this.memoryHistory];
    }

    /**
     * Clear memory history
     */
    clearHistory() {
        this.memoryHistory.length = 0;
        this.logger.info('Memory history cleared');
    }

    /**
     * Destroy memory monitor
     */
    destroy() {
        this.stopMonitoring();

        const dashboard = document.getElementById('memory-dashboard');
        if (dashboard) {
            dashboard.remove();
        }

        this.logger.info('MemoryMonitor destroyed');
    }
}

/**
 * LeakDetector - Advanced leak detection using weak references
 */
class LeakDetector {
    constructor() {
        this.weakRefs = new Map();
        this.leakThreshold = 1000; // objects
        this.checkInterval = 30000; // 30 seconds
        this.checkTimer = null;

        this.logger = window.SafeLogger || console;

        this.startDetection();
    }

    /**
     * Start leak detection
     */
    startDetection() {
        this.checkTimer = setInterval(() => {
            this.checkForLeaks();
        }, this.checkInterval);
    }

    /**
     * Add object to leak detection
     * @param {string} name - Object name
     * @param {Object} obj - Object to track
     */
    addObject(name, obj) {
        if (typeof WeakRef !== 'undefined') {
            this.weakRefs.set(name, new WeakRef(obj));
        }
    }

    /**
     * Check for leaks
     */
    checkForLeaks() {
        if (typeof WeakRef === 'undefined') {
            return;
        }

        let aliveCount = 0;
        const deadRefs = [];

        this.weakRefs.forEach((weakRef, name) => {
            if (weakRef.deref()) {
                aliveCount++;
            } else {
                deadRefs.push(name);
            }
        });

        // Remove dead references
        deadRefs.forEach(name => {
            this.weakRefs.delete(name);
        });

        // Check for potential leaks
        if (aliveCount > this.leakThreshold) {
            this.logger.warn(`Potential leak detected: ${aliveCount} objects alive`);
        }
    }

    /**
     * Stop leak detection
     */
    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }
}

// Export for use in other modules
window.MemoryMonitor = MemoryMonitor;
window.LeakDetector = LeakDetector;
