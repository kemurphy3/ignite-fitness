/**
 * AsyncYielder - Utility for converting synchronous operations to async/await with yielding
 * Prevents main thread blocking by yielding control periodically
 */
class AsyncYielder {
  constructor(options = {}) {
    this.maxBlockTime = options.maxBlockTime || 50; // Maximum blocking time in ms
    this.yieldInterval = options.yieldInterval || 16; // Yield every 16ms (~60fps)
    this.useRequestIdleCallback = options.useRequestIdleCallback !== false;
    this.useMessageChannel = options.useMessageChannel !== false;

    this.logger = window.SafeLogger || console;
  }

  /**
   * Process array with yielding
   * @param {Array} items - Items to process
   * @param {Function} processor - Processing function
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Processed results
   */
  async processArray(items, processor, options = {}) {
    const { batchSize = 10, onProgress = null, onError = null } = options;

    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      try {
        // Process batch
        const batchResults = await this.processBatch(batch, processor);
        results.push(...batchResults);

        // Update progress
        if (onProgress) {
          onProgress({
            processed: i + batch.length,
            total: items.length,
            percentage: Math.round(((i + batch.length) / items.length) * 100),
          });
        }

        // Yield to main thread
        await this.yield();
      } catch (error) {
        this.logger.error('Batch processing error:', error);
        errors.push({ batch, error });

        if (onError) {
          onError(error, batch);
        }
      }
    }

    return { results, errors };
  }

  /**
   * Process batch of items
   * @param {Array} batch - Batch to process
   * @param {Function} processor - Processing function
   * @returns {Promise<Array>} Batch results
   */
  async processBatch(batch, processor) {
    const results = [];

    for (const item of batch) {
      const startTime = performance.now();

      try {
        const result = await processor(item);
        results.push(result);

        // Check if we need to yield
        const processingTime = performance.now() - startTime;
        if (processingTime > this.maxBlockTime) {
          await this.yield();
        }
      } catch (error) {
        this.logger.error('Item processing error:', error);
        results.push({ error: error.message, item });
      }
    }

    return results;
  }

  /**
   * Yield control to main thread
   * @returns {Promise} Promise that resolves after yielding
   */
  async yield() {
    if (this.useRequestIdleCallback && 'requestIdleCallback' in window) {
      return new Promise(resolve => {
        requestIdleCallback(resolve, { timeout: this.yieldInterval });
      });
    } else if (this.useMessageChannel) {
      return new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(null);
      });
    } else {
      return new Promise(resolve => {
        setTimeout(resolve, this.yieldInterval);
      });
    }
  }

  /**
   * Process with time slicing
   * @param {Function} task - Task to execute
   * @param {Object} options - Options
   * @returns {Promise} Task result
   */
  async processWithTimeSlicing(task, options = {}) {
    const { maxTime = this.maxBlockTime, onProgress = null } = options;

    const startTime = performance.now();
    let result = null;
    let isComplete = false;

    try {
      // Execute task with time monitoring
      result = await this.executeWithTimeLimit(task, maxTime);
      isComplete = true;
    } catch (error) {
      if (error.name === 'TimeLimitExceeded') {
        // Task exceeded time limit, yield and retry
        await this.yield();

        if (onProgress) {
          onProgress({
            message: 'Task exceeded time limit, yielding...',
            elapsed: performance.now() - startTime,
          });
        }

        // Retry with reduced time limit
        result = await this.processWithTimeSlicing(task, {
          ...options,
          maxTime: Math.max(maxTime * 0.5, 10),
        });
        isComplete = true;
      } else {
        throw error;
      }
    }

    return result;
  }

  /**
   * Execute task with time limit
   * @param {Function} task - Task to execute
   * @param {number} maxTime - Maximum execution time
   * @returns {Promise} Task result
   */
  async executeWithTimeLimit(task, maxTime) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();

      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(new Error('TimeLimitExceeded'));
      }, maxTime);

      // Execute task
      Promise.resolve(task())
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Process with graceful degradation
   * @param {Function} primaryTask - Primary task
   * @param {Function} fallbackTask - Fallback task
   * @param {Object} options - Options
   * @returns {Promise} Task result
   */
  async processWithGracefulDegradation(primaryTask, fallbackTask, options = {}) {
    const { timeout = 5000, onFallback = null } = options;

    try {
      // Try primary task with timeout
      const result = await Promise.race([
        primaryTask(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Primary task timeout')), timeout)
        ),
      ]);

      return result;
    } catch (error) {
      this.logger.warn('Primary task failed, using fallback:', error);

      if (onFallback) {
        onFallback(error);
      }

      // Use fallback task
      return await fallbackTask();
    }
  }

  /**
   * Process with progress indicators
   * @param {Array} tasks - Tasks to process
   * @param {Object} options - Options
   * @returns {Promise<Array>} Task results
   */
  async processWithProgress(tasks, options = {}) {
    const { onProgress = null, onComplete = null, onError = null } = options;

    const results = [];
    const errors = [];

    for (let i = 0; i < tasks.length; i++) {
      try {
        const startTime = performance.now();

        // Execute task with yielding
        const result = await this.processWithTimeSlicing(tasks[i]);
        results.push(result);

        const executionTime = performance.now() - startTime;

        // Update progress
        if (onProgress) {
          onProgress({
            completed: i + 1,
            total: tasks.length,
            percentage: Math.round(((i + 1) / tasks.length) * 100),
            executionTime,
            result,
          });
        }

        // Yield between tasks
        await this.yield();
      } catch (error) {
        this.logger.error('Task execution error:', error);
        errors.push({ taskIndex: i, error });

        if (onError) {
          onError(error, i);
        }
      }
    }

    if (onComplete) {
      onComplete({ results, errors });
    }

    return { results, errors };
  }

  /**
   * Create progress indicator
   * @param {HTMLElement} container - Container element
   * @returns {Object} Progress indicator
   */
  createProgressIndicator(container) {
    const progressBar = document.createElement('div');
    progressBar.className = 'async-progress-bar';
    progressBar.style.cssText = `
            width: 100%;
            height: 4px;
            background: var(--color-border);
            border-radius: 2px;
            overflow: hidden;
            margin: 8px 0;
        `;

    const progressFill = document.createElement('div');
    progressFill.className = 'async-progress-fill';
    progressFill.style.cssText = `
            height: 100%;
            background: var(--color-primary);
            border-radius: 2px;
            transition: width 0.3s ease;
            width: 0%;
        `;

    const progressText = document.createElement('div');
    progressText.className = 'async-progress-text';
    progressText.style.cssText = `
            font-size: 14px;
            color: var(--color-text-secondary);
            text-align: center;
            margin-top: 4px;
        `;

    progressBar.appendChild(progressFill);
    container.appendChild(progressBar);
    container.appendChild(progressText);

    return {
      update: (percentage, text) => {
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = text || `${Math.round(percentage)}%`;
      },
      hide: () => {
        progressBar.style.display = 'none';
        progressText.style.display = 'none';
      },
      show: () => {
        progressBar.style.display = 'block';
        progressText.style.display = 'block';
      },
    };
  }

  /**
   * Monitor main thread blocking
   * @returns {Object} Monitoring controls
   */
  startBlockingMonitor() {
    let isMonitoring = false;
    let blockCount = 0;
    let maxBlockTime = 0;

    const monitor = () => {
      if (!isMonitoring) {
        return;
      }

      const startTime = performance.now();

      requestAnimationFrame(() => {
        const blockTime = performance.now() - startTime;

        if (blockTime > this.maxBlockTime) {
          blockCount++;
          maxBlockTime = Math.max(maxBlockTime, blockTime);

          this.logger.warn(`Main thread blocked for ${blockTime.toFixed(2)}ms`);
        }

        monitor();
      });
    };

    return {
      start: () => {
        isMonitoring = true;
        monitor();
      },
      stop: () => {
        isMonitoring = false;
      },
      getStats: () => ({
        blockCount,
        maxBlockTime,
        averageBlockTime: blockCount > 0 ? maxBlockTime / blockCount : 0,
      }),
    };
  }
}

// Export for use in other modules
window.AsyncYielder = AsyncYielder;
