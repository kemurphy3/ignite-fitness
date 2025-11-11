/**
 * RUMCollector - Real User Monitoring for Core Web Vitals and performance metrics
 * Collects performance data from real users and sends to analytics
 */
class RUMCollector {
  constructor(options = {}) {
    this.options = {
      endpoint: options.endpoint || '/.netlify/functions/perf-metrics',
      batchSize: options.batchSize || 10,
      flushInterval: options.flushInterval || 30000, // 30 seconds
      enableCoreWebVitals: options.enableCoreWebVitals !== false,
      enableCustomMetrics: options.enableCustomMetrics !== false,
      enableErrorTracking: options.enableErrorTracking !== false,
      enableUserTiming: options.enableUserTiming !== false,
      enableResourceTiming: options.enableResourceTiming !== false,
      enableNavigationTiming: options.enableNavigationTiming !== false,
      enableMemoryInfo: options.enableMemoryInfo !== false,
      enableDeviceInfo: options.enableDeviceInfo !== false,
      enableNetworkInfo: options.enableNetworkInfo !== false,
      ...options,
    };

    this.logger = window.SafeLogger || console;
    this.metrics = [];
    this.isInitialized = false;
    this.flushTimer = null;
    this.observer = null;

    this.stats = {
      metricsCollected: 0,
      metricsSent: 0,
      errorsTracked: 0,
      sessionsTracked: 0,
    };

    this.init();
  }

  /**
   * Initialize RUM collector
   */
  init() {
    try {
      // Set up Core Web Vitals monitoring
      if (this.options.enableCoreWebVitals) {
        this.setupCoreWebVitals();
      }

      // Set up custom metrics monitoring
      if (this.options.enableCustomMetrics) {
        this.setupCustomMetrics();
      }

      // Set up error tracking
      if (this.options.enableErrorTracking) {
        this.setupErrorTracking();
      }

      // Set up user timing
      if (this.options.enableUserTiming) {
        this.setupUserTiming();
      }

      // Set up resource timing
      if (this.options.enableResourceTiming) {
        this.setupResourceTiming();
      }

      // Set up navigation timing
      if (this.options.enableNavigationTiming) {
        this.setupNavigationTiming();
      }

      // Set up memory info
      if (this.options.enableMemoryInfo) {
        this.setupMemoryInfo();
      }

      // Set up device info
      if (this.options.enableDeviceInfo) {
        this.setupDeviceInfo();
      }

      // Set up network info
      if (this.options.enableNetworkInfo) {
        this.setupNetworkInfo();
      }

      // Start flush timer
      this.startFlushTimer();

      this.isInitialized = true;
      this.logger.info('RUMCollector initialized');
    } catch (error) {
      this.logger.error('Failed to initialize RUMCollector:', error);
    }
  }

  /**
   * Setup Core Web Vitals monitoring
   */
  setupCoreWebVitals() {
    // LCP (Largest Contentful Paint)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];

          this.collectMetric('lcp', {
            value: lastEntry.startTime,
            element: lastEntry.element?.tagName || 'unknown',
            url: lastEntry.url || 'unknown',
          });
        });

        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        this.logger.warn('LCP observer not supported:', error);
      }

      // FID (First Input Delay)
      try {
        const fidObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            this.collectMetric('fid', {
              value: entry.processingStart - entry.startTime,
              eventType: entry.name,
              target: entry.target?.tagName || 'unknown',
            });
          });
        });

        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (error) {
        this.logger.warn('FID observer not supported:', error);
      }

      // CLS (Cumulative Layout Shift)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });

          this.collectMetric('cls', {
            value: clsValue,
            entries: entries.length,
          });
        });

        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        this.logger.warn('CLS observer not supported:', error);
      }

      // TTFB (Time to First Byte)
      try {
        const ttfbObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            this.collectMetric('ttfb', {
              value: entry.responseStart - entry.requestStart,
              url: entry.name,
            });
          });
        });

        ttfbObserver.observe({ entryTypes: ['navigation'] });
      } catch (error) {
        this.logger.warn('TTFB observer not supported:', error);
      }
    }
  }

  /**
   * Setup custom metrics monitoring
   */
  setupCustomMetrics() {
    // Monitor custom performance marks
    if ('PerformanceObserver' in window) {
      try {
        const markObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.name.startsWith('custom-')) {
              this.collectMetric('custom', {
                name: entry.name,
                value: entry.startTime,
                duration: entry.duration,
              });
            }
          });
        });

        markObserver.observe({ entryTypes: ['mark'] });
      } catch (error) {
        this.logger.warn('Mark observer not supported:', error);
      }
    }
  }

  /**
   * Setup error tracking
   */
  setupErrorTracking() {
    // JavaScript errors
    window.addEventListener('error', event => {
      this.collectMetric('error', {
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    // Promise rejections
    window.addEventListener('unhandledrejection', event => {
      this.collectMetric('error', {
        type: 'promise',
        reason: event.reason?.toString(),
        stack: event.reason?.stack,
      });
    });

    // Resource errors
    window.addEventListener(
      'error',
      event => {
        if (event.target !== window) {
          this.collectMetric('error', {
            type: 'resource',
            tagName: event.target.tagName,
            src: event.target.src || event.target.href,
            error: event.error?.message,
          });
        }
      },
      true
    );
  }

  /**
   * Setup user timing
   */
  setupUserTiming() {
    // Monitor user timing marks and measures
    if ('PerformanceObserver' in window) {
      try {
        const measureObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            this.collectMetric('timing', {
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
              entryType: entry.entryType,
            });
          });
        });

        measureObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        this.logger.warn('Measure observer not supported:', error);
      }
    }
  }

  /**
   * Setup resource timing
   */
  setupResourceTiming() {
    // Monitor resource loading times
    if ('PerformanceObserver' in window) {
      try {
        const resourceObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            this.collectMetric('resource', {
              name: entry.name,
              initiatorType: entry.initiatorType,
              duration: entry.duration,
              transferSize: entry.transferSize,
              encodedBodySize: entry.encodedBodySize,
              decodedBodySize: entry.decodedBodySize,
            });
          });
        });

        resourceObserver.observe({ entryTypes: ['resource'] });
      } catch (error) {
        this.logger.warn('Resource observer not supported:', error);
      }
    }
  }

  /**
   * Setup navigation timing
   */
  setupNavigationTiming() {
    // Monitor page load performance
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        this.collectMetric('navigation', {
          domContentLoaded:
            navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          domInteractive: navigation.domInteractive - navigation.navigationStart,
          domComplete: navigation.domComplete - navigation.navigationStart,
          totalLoadTime: navigation.loadEventEnd - navigation.navigationStart,
        });
      }
    });
  }

  /**
   * Setup memory info
   */
  setupMemoryInfo() {
    if ('memory' in performance) {
      setInterval(() => {
        const { memory } = performance;
        this.collectMetric('memory', {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        });
      }, 30000); // Every 30 seconds
    }
  }

  /**
   * Setup device info
   */
  setupDeviceInfo() {
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      connectionType: navigator.connection?.effectiveType || 'unknown',
      connectionDownlink: navigator.connection?.downlink || 0,
    };

    this.collectMetric('device', deviceInfo);
  }

  /**
   * Setup network info
   */
  setupNetworkInfo() {
    if ('connection' in navigator) {
      const { connection } = navigator;

      this.collectMetric('network', {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      });

      // Monitor connection changes
      connection.addEventListener('change', () => {
        this.collectMetric('network_change', {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        });
      });
    }
  }

  /**
   * Collect a metric
   * @param {string} type - Metric type
   * @param {Object} data - Metric data
   */
  collectMetric(type, data) {
    const metric = {
      type,
      data,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      userId: this.getUserId(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.metrics.push(metric);
    this.stats.metricsCollected++;

    // Flush if batch size reached
    if (this.metrics.length >= this.options.batchSize) {
      this.flush();
    }

    this.logger.debug('Metric collected:', metric);
  }

  /**
   * Start flush timer
   */
  startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.options.flushInterval);
  }

  /**
   * Flush metrics to server
   */
  async flush() {
    if (this.metrics.length === 0) {
      return;
    }

    const metricsToSend = [...this.metrics];
    this.metrics.length = 0;

    try {
      const response = await fetch(this.options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: metricsToSend,
          timestamp: Date.now(),
          sessionId: this.getSessionId(),
          userId: this.getUserId(),
        }),
      });

      if (response.ok) {
        this.stats.metricsSent += metricsToSend.length;
        this.logger.debug(`Sent ${metricsToSend.length} metrics to server`);
      } else {
        this.logger.error('Failed to send metrics:', response.status);
        // Re-add metrics to queue for retry
        this.metrics.unshift(...metricsToSend);
      }
    } catch (error) {
      this.logger.error('Error sending metrics:', error);
      // Re-add metrics to queue for retry
      this.metrics.unshift(...metricsToSend);
    }
  }

  /**
   * Get session ID
   * @returns {string} Session ID
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('rum_session_id');
    if (!sessionId) {
      sessionId = this.generateId();
      sessionStorage.setItem('rum_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Get user ID
   * @returns {string} User ID
   */
  getUserId() {
    return localStorage.getItem('ignite_fitness_user_id') || 'anonymous';
  }

  /**
   * Generate unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Mark custom performance point
   * @param {string} name - Mark name
   */
  mark(name) {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name);
    }
  }

  /**
   * Measure custom performance
   * @param {string} name - Measure name
   * @param {string} startMark - Start mark name
   * @param {string} endMark - End mark name
   */
  measure(name, startMark, endMark) {
    if ('performance' in window && 'measure' in performance) {
      try {
        performance.measure(name, startMark, endMark);
      } catch (error) {
        this.logger.warn('Failed to create measure:', error);
      }
    }
  }

  /**
   * Get RUM statistics
   * @returns {Object} RUM statistics
   */
  getStats() {
    return {
      ...this.stats,
      metricsInQueue: this.metrics.length,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Get collected metrics
   * @returns {Array} Collected metrics
   */
  getMetrics() {
    return [...this.metrics];
  }

  /**
   * Clear collected metrics
   */
  clearMetrics() {
    this.metrics.length = 0;
    this.logger.info('RUM metrics cleared');
  }

  /**
   * Destroy RUM collector
   */
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Flush remaining metrics
    this.flush();

    this.logger.info('RUMCollector destroyed');
  }
}

// Export for use in other modules
window.RUMCollector = RUMCollector;
