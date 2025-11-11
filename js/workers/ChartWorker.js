/**
 * ChartWorker - Web Worker for Chart.js rendering
 * Offloads chart rendering to prevent main thread blocking
 */

// Try to import Chart.js from CDN, but catch errors since CORS may block it
// Note: importScripts() throws synchronously if it fails, which will prevent
// the rest of this script from executing. However, if we catch it here,
// we can at least send an error message before the worker becomes unusable.
let chartJSAvailable = false;
let initError = null;

try {
  importScripts('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js');
  chartJSAvailable = typeof Chart !== 'undefined';
} catch (error) {
  // If CDN import fails (CORS, network, etc.), the worker cannot function
  // Try to notify main thread - but note: if importScripts throws,
  // this catch block may not execute in all browsers
  initError = {
    type: 'INIT_ERROR',
    error: 'Failed to load Chart.js - CORS or network issue. Worker cannot be used.',
    message: error.message || 'Unknown error',
  };
  chartJSAvailable = false;

  // Try to send message - but if importScripts throws, execution may stop
  try {
    self.postMessage(initError);
  } catch (e) {
    // If postMessage fails, worker is unusable anyway
    console.error('ChartWorker: Cannot send error message', e);
  }
}

// Only proceed if Chart.js is available
if (!chartJSAvailable) {
  // Already sent INIT_ERROR above, just prevent class initialization
  // Worker will remain alive but unusable
}

class ChartWorker {
  constructor() {
    if (typeof Chart === 'undefined') {
      console.error('ChartWorker: Chart.js not available');
      self.postMessage({
        type: 'INIT_ERROR',
        error: 'Chart.js not available',
        message: 'Chart.js is undefined',
      });
      return;
    }

    this.charts = new Map();
    this.canvas = null;
    this.ctx = null;

    // Listen for messages from main thread
    self.addEventListener('message', this.handleMessage.bind(this));

    console.log('ChartWorker initialized');
  }

  /**
   * Handle messages from main thread
   */
  handleMessage(event) {
    const { type, data } = event.data;

    try {
      switch (type) {
        case 'CREATE_CHART':
          this.createChart(data);
          break;
        case 'UPDATE_CHART':
          this.updateChart(data);
          break;
        case 'DESTROY_CHART':
          this.destroyChart(data);
          break;
        case 'RESIZE_CHART':
          this.resizeChart(data);
          break;
        default:
          console.warn('Unknown message type:', type);
      }
    } catch (error) {
      console.error('ChartWorker error:', error);
      self.postMessage({
        type: 'ERROR',
        error: error.message,
        originalType: type,
      });
    }
  }

  /**
   * Create a new chart
   */
  createChart({ chartId, config, canvasData }) {
    try {
      // Create OffscreenCanvas
      this.canvas = new OffscreenCanvas(canvasData.width, canvasData.height);
      this.ctx = this.canvas.getContext('2d');

      // Create Chart.js instance
      const chart = new Chart(this.ctx, {
        ...config,
        options: {
          ...config.options,
          responsive: false, // We handle resizing manually
          animation: false, // Disable animations in worker
          plugins: {
            ...config.options?.plugins,
            legend: {
              ...config.options?.plugins?.legend,
              display: false, // Hide legend in worker
            },
          },
        },
      });

      // Store chart reference
      this.charts.set(chartId, chart);

      // Convert canvas to image data
      const imageData = this.canvas.transferToImageBitmap();

      // Send result back to main thread
      self.postMessage(
        {
          type: 'CHART_CREATED',
          chartId,
          imageData,
        },
        [imageData]
      );
    } catch (error) {
      console.error('Failed to create chart:', error);
      self.postMessage({
        type: 'CHART_ERROR',
        chartId,
        error: error.message,
      });
    }
  }

  /**
   * Update existing chart
   */
  updateChart({ chartId, data }) {
    const chart = this.charts.get(chartId);
    if (!chart) {
      console.warn('Chart not found:', chartId);
      return;
    }

    try {
      // Update chart data
      chart.data = data;
      chart.update('none'); // No animation

      // Convert to image data
      const imageData = this.canvas.transferToImageBitmap();

      self.postMessage(
        {
          type: 'CHART_UPDATED',
          chartId,
          imageData,
        },
        [imageData]
      );
    } catch (error) {
      console.error('Failed to update chart:', error);
      self.postMessage({
        type: 'CHART_ERROR',
        chartId,
        error: error.message,
      });
    }
  }

  /**
   * Destroy chart
   */
  destroyChart({ chartId }) {
    const chart = this.charts.get(chartId);
    if (chart) {
      chart.destroy();
      this.charts.delete(chartId);

      self.postMessage({
        type: 'CHART_DESTROYED',
        chartId,
      });
    }
  }

  /**
   * Resize chart
   */
  resizeChart({ chartId, width, height }) {
    const chart = this.charts.get(chartId);
    if (!chart) {
      console.warn('Chart not found for resize:', chartId);
      return;
    }

    try {
      // Resize canvas
      this.canvas.width = width;
      this.canvas.height = height;

      // Update chart
      chart.resize(width, height);

      // Convert to image data
      const imageData = this.canvas.transferToImageBitmap();

      self.postMessage(
        {
          type: 'CHART_RESIZED',
          chartId,
          imageData,
        },
        [imageData]
      );
    } catch (error) {
      console.error('Failed to resize chart:', error);
      self.postMessage({
        type: 'CHART_ERROR',
        chartId,
        error: error.message,
      });
    }
  }
}

// Initialize worker only if Chart.js is available
if (chartJSAvailable && typeof Chart !== 'undefined') {
  try {
    new ChartWorker();
  } catch (error) {
    console.error('ChartWorker initialization failed:', error);
    self.postMessage({
      type: 'INIT_ERROR',
      error: 'ChartWorker initialization failed',
      message: error.message || 'Unknown error',
    });
  }
} else {
  // Chart.js not available - worker is unusable but stays alive
  // INIT_ERROR already sent in the catch block above
  // Use console.debug to reduce noise (this is expected in local dev)
  console.debug(
    'ChartWorker: Cannot initialize - Chart.js not available. Worker will not function.'
  );
}
