/**
 * ChartManager - Manages Chart.js rendering via Web Worker
 * Provides fallback for browsers without OffscreenCanvas support
 */
class ChartManager {
    constructor() {
        this.worker = null;
        this.charts = new Map();
        this.pendingRequests = new Map();
        this.supportsOffscreenCanvas = this.checkOffscreenCanvasSupport();
        
        this.init();
    }
    
    /**
     * Check if browser supports OffscreenCanvas
     */
    checkOffscreenCanvasSupport() {
        return typeof OffscreenCanvas !== 'undefined' && 
               typeof Worker !== 'undefined' &&
               'transferToImageBitmap' in OffscreenCanvas.prototype;
    }
    
    /**
     * Initialize chart manager
     */
    async init() {
        if (this.supportsOffscreenCanvas) {
            try {
                this.worker = new Worker('./js/workers/ChartWorker.js');
                this.worker.onmessage = this.handleWorkerMessage.bind(this);
                this.worker.onerror = this.handleWorkerError.bind(this);
                
                console.log('ChartManager: Web Worker initialized');
            } catch (error) {
                console.warn('ChartManager: Failed to initialize worker, falling back to main thread:', error);
                this.supportsOffscreenCanvas = false;
            }
        } else {
            console.log('ChartManager: OffscreenCanvas not supported, using main thread');
        }
    }
    
    /**
     * Handle messages from worker
     */
    handleWorkerMessage(event) {
        const { type, chartId, imageData, error } = event.data;
        
        switch (type) {
            case 'CHART_CREATED':
            case 'CHART_UPDATED':
            case 'CHART_RESIZED':
                this.updateChartDisplay(chartId, imageData);
                break;
                
            case 'CHART_DESTROYED':
                this.removeChartDisplay(chartId);
                break;
                
            case 'CHART_ERROR':
                console.error(`Chart error for ${chartId}:`, error);
                this.showChartError(chartId, error);
                break;
                
            case 'ERROR':
                console.error('Worker error:', error);
                break;
        }
    }
    
    /**
     * Handle worker errors
     */
    handleWorkerError(error) {
        console.error('ChartWorker error:', error);
        this.supportsOffscreenCanvas = false;
    }
    
    /**
     * Create a chart
     */
    async createChart(chartId, config, canvasElement) {
        const rect = canvasElement.getBoundingClientRect();
        
        if (this.supportsOffscreenCanvas && this.worker) {
            // Use web worker
            return this.createChartInWorker(chartId, config, {
                width: rect.width,
                height: rect.height
            });
        } else {
            // Fallback to main thread
            return this.createChartInMainThread(chartId, config, canvasElement);
        }
    }
    
    /**
     * Create chart in web worker
     */
    createChartInWorker(chartId, config, canvasData) {
        return new Promise((resolve, reject) => {
            const requestId = Date.now();
            this.pendingRequests.set(requestId, { resolve, reject });
            
            this.worker.postMessage({
                type: 'CREATE_CHART',
                data: { chartId, config, canvasData }
            });
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Chart creation timeout'));
                }
            }, 5000);
        });
    }
    
    /**
     * Create chart in main thread (fallback)
     */
    createChartInMainThread(chartId, config, canvasElement) {
        try {
            // Show loading state
            this.showChartLoading(canvasElement);
            
            // Import Chart.js dynamically
            return this.loadChartJS().then(Chart => {
                const chart = new Chart(canvasElement, {
                    ...config,
                    options: {
                        ...config.options,
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            duration: 0 // Disable animations for performance
                        }
                    }
                });
                
                this.charts.set(chartId, chart);
                this.hideChartLoading(canvasElement);
                
                return chart;
            });
            
        } catch (error) {
            console.error('Failed to create chart in main thread:', error);
            this.showChartError(canvasElement, error.message);
            throw error;
        }
    }
    
    /**
     * Update chart data
     */
    async updateChart(chartId, data) {
        if (this.supportsOffscreenCanvas && this.worker) {
            this.worker.postMessage({
                type: 'UPDATE_CHART',
                data: { chartId, data }
            });
        } else {
            const chart = this.charts.get(chartId);
            if (chart) {
                chart.data = data;
                chart.update('none');
            }
        }
    }
    
    /**
     * Resize chart
     */
    async resizeChart(chartId, width, height) {
        if (this.supportsOffscreenCanvas && this.worker) {
            this.worker.postMessage({
                type: 'RESIZE_CHART',
                data: { chartId, width, height }
            });
        } else {
            const chart = this.charts.get(chartId);
            if (chart) {
                chart.resize(width, height);
            }
        }
    }
    
    /**
     * Destroy chart
     */
    destroyChart(chartId) {
        if (this.supportsOffscreenCanvas && this.worker) {
            this.worker.postMessage({
                type: 'DESTROY_CHART',
                data: { chartId }
            });
        } else {
            const chart = this.charts.get(chartId);
            if (chart) {
                chart.destroy();
                this.charts.delete(chartId);
            }
        }
    }
    
    /**
     * Update chart display with image data from worker
     */
    updateChartDisplay(chartId, imageData) {
        const canvas = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(imageData, 0, 0);
            
            this.hideChartLoading(canvas);
        }
    }
    
    /**
     * Remove chart display
     */
    removeChartDisplay(chartId) {
        const canvas = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    /**
     * Show chart loading state
     */
    showChartLoading(canvas) {
        const container = canvas.parentElement;
        if (container) {
            container.classList.add('chart-loading');
            
            // Add loading spinner if not exists
            if (!container.querySelector('.chart-spinner')) {
                const spinner = document.createElement('div');
                spinner.className = 'chart-spinner';
                spinner.innerHTML = '<div class="spinner"></div><p>Loading chart...</p>';
                container.appendChild(spinner);
            }
        }
    }
    
    /**
     * Hide chart loading state
     */
    hideChartLoading(canvas) {
        const container = canvas.parentElement;
        if (container) {
            container.classList.remove('chart-loading');
            const spinner = container.querySelector('.chart-spinner');
            if (spinner) {
                spinner.remove();
            }
        }
    }
    
    /**
     * Show chart error
     */
    showChartError(canvas, error) {
        const container = canvas.parentElement;
        if (container) {
            container.classList.add('chart-error');
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'chart-error-message';
            errorDiv.innerHTML = `
                <div class="error-icon">⚠️</div>
                <p>Chart failed to load</p>
                <small>${error}</small>
            `;
            container.appendChild(errorDiv);
        }
    }
    
    /**
     * Load Chart.js dynamically
     */
    async loadChartJS() {
        if (window.Chart) {
            return window.Chart;
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js';
            script.onload = () => resolve(window.Chart);
            script.onerror = () => reject(new Error('Failed to load Chart.js'));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
        this.pendingRequests.clear();
    }
}

// Export for use in other modules
window.ChartManager = ChartManager;
