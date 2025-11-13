/**
 * ChartManager - Manages Chart.js rendering via Web Worker
 * Provides fallback for browsers without OffscreenCanvas support
 */
class ChartManager {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.worker = null;
    this.charts = new Map();
    this.pendingRequests = new Map();
    this.workerReady = false;
    this._initLogged = false;
    this.supportsOffscreenCanvas = this.checkOffscreenCanvasSupport();

    this.init();
  }

  /**
   * Check if browser supports OffscreenCanvas
   */
  checkOffscreenCanvasSupport() {
    return (
      typeof OffscreenCanvas !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      'transferToImageBitmap' in OffscreenCanvas.prototype
    );
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

        // Set timeout to check if worker initializes successfully
        // If worker sends INIT_ERROR, it will be handled by handleWorkerMessage
        // If no message received within 1 second, assume worker failed
        const initTimeout = setTimeout(() => {
          if (this.supportsOffscreenCanvas && !this.workerReady) {
            const logger = window.SafeLogger || console;
            logger.warn('ChartManager: Worker did not respond, falling back to main thread');
            this.supportsOffscreenCanvas = false;
            if (this.worker) {
              this.worker.terminate();
              this.worker = null;
            }
          }
        }, 1000);

        // Mark worker as ready when we receive first non-error message
        const originalHandler = this.handleWorkerMessage.bind(this);
        this.worker.onmessage = event => {
          if (event.data.type !== 'INIT_ERROR') {
            if (!this.workerReady) {
              this.workerReady = true;
              clearTimeout(initTimeout);
              // Log only when worker becomes ready
            }
          }
          originalHandler(event);
        };

        // Only log once per instance to avoid duplicates
        if (!this._initLogged) {
          const logger = window.SafeLogger || console;
          logger.debug('ChartManager: Web Worker created, waiting for initialization');
          this._initLogged = true;
        }
      } catch (error) {
        const logger = window.SafeLogger || console;
        logger.warn('ChartManager: Failed to create worker, falling back to main thread', { error: error.message, stack: error.stack });
        this.supportsOffscreenCanvas = false;
      }
    } else {
      const logger = window.SafeLogger || console;
      logger.info('ChartManager: OffscreenCanvas not supported, using main thread');
    }
  }

  /**
   * Handle messages from worker
   */
  handleWorkerMessage(event) {
    const { type, chartId, imageData, error, message } = event.data;

    switch (type) {
      case 'INIT_ERROR':
        // Worker failed to initialize (usually CDN/CORS issue)
        // Use debug level since this is expected behavior in local dev
        const logger = window.SafeLogger || console;
        logger.debug('ChartWorker initialization failed, falling back to main thread', { message, error: error?.message || String(error) });
        this.supportsOffscreenCanvas = false;
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
        break;

      case 'CHART_CREATED':
      case 'CHART_UPDATED':
      case 'CHART_RESIZED':
        this.updateChartDisplay(chartId, imageData);
        break;

      case 'CHART_DESTROYED':
        this.removeChartDisplay(chartId);
        break;

      case 'CHART_ERROR':
        this.logger.error('Chart error', { chartId, error: error?.message || String(error), stack: error?.stack });
        this.showChartError(chartId, error);
        break;

      case 'ERROR':
        this.logger.error('Worker error', { error: error?.message || String(error), stack: error?.stack });
        break;
    }
  }

  /**
   * Handle worker errors
   */
  handleWorkerError(error) {
    this.logger.warn('ChartWorker error, falling back to main thread', { error: error.message || String(error), stack: error?.stack });
    this.supportsOffscreenCanvas = false;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Create a chart
   */
  async createChart(chartId, config, canvasElement) {
    const rect = canvasElement.getBoundingClientRect();

    // Only use worker if it's ready and available
    if (this.supportsOffscreenCanvas && this.worker && this.workerReady) {
      // Use web worker
      return this.createChartInWorker(chartId, config, {
        width: rect.width,
        height: rect.height,
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
        data: { chartId, config, canvasData },
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
              duration: 0, // Disable animations for performance
            },
          },
        });

        this.charts.set(chartId, chart);
        this.hideChartLoading(canvasElement);

        return chart;
      });
    } catch (error) {
      this.logger.error('Failed to create chart in main thread', { chartId, error: error.message, stack: error.stack });
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
        data: { chartId, data },
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
        data: { chartId, width, height },
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
        data: { chartId },
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
    if (!container) {
      return;
    }

    // Delay showing spinner by 500ms to avoid flicker on fast renders
    if (container.__chartLoadingTimer) {
      clearTimeout(container.__chartLoadingTimer);
      container.__chartLoadingTimer = null;
    }

    container.__chartLoadingTimer = setTimeout(() => {
      container.classList.add('chart-loading');
      if (!container.querySelector('.chart-spinner')) {
        const spinner = document.createElement('div');
        spinner.className = 'chart-spinner';
        spinner.innerHTML = '<div class="spinner"></div><p>Loading chart...</p>';
        container.appendChild(spinner);
      }
      window.LiveRegionManager?.announce('Loading chart', 'polite');
    }, 500);
  }

  /**
   * Hide chart loading state
   */
  hideChartLoading(canvas) {
    const container = canvas.parentElement;
    if (!container) {
      return;
    }
    if (container.__chartLoadingTimer) {
      clearTimeout(container.__chartLoadingTimer);
      container.__chartLoadingTimer = null;
    }
    container.classList.remove('chart-loading');
    const spinner = container.querySelector('.chart-spinner');
    if (spinner) {
      spinner.remove();
    }
    window.LiveRegionManager?.announce('Chart ready', 'polite');
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
