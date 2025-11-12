/**
 * BaseComponent - Base class for UI components with automatic cleanup
 * Provides event listener management and memory leak prevention
 */
class BaseComponent {
  constructor(options = {}) {
    this.element = options.element || null;
    this.eventListeners = new Map();
    this.timers = new Set();
    this.observers = new Set();
    this.isDestroyed = false;

    this.logger = window.SafeLogger || console;

    // Auto-cleanup on page unload
    this.setupAutoCleanup();
  }

  /**
   * Add event listener with automatic cleanup tracking
   * @param {HTMLElement|Window|Document} target - Event target
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object} options - Event options
   */
  addEventListener(target, event, handler, options = {}) {
    if (this.isDestroyed) {
      this.logger.warn('Cannot add event listener to destroyed component');
      return;
    }

    const listenerId = this.generateListenerId(target, event, handler);

    // Store listener info for cleanup
    this.eventListeners.set(listenerId, {
      target,
      event,
      handler,
      options,
    });

    // Add the actual listener
    target.addEventListener(event, handler, options);

    this.logger.debug(`Event listener added: ${event} on ${target.constructor.name}`);
  }

  /**
   * Remove specific event listener
   * @param {HTMLElement|Window|Document} target - Event target
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   */
  removeEventListener(target, event, handler) {
    const listenerId = this.generateListenerId(target, event, handler);

    if (this.eventListeners.has(listenerId)) {
      target.removeEventListener(event, handler);
      this.eventListeners.delete(listenerId);
      this.logger.debug(`Event listener removed: ${event} on ${target.constructor.name}`);
    }
  }

  /**
   * Add timer with automatic cleanup tracking
   * @param {Function} callback - Timer callback
   * @param {number} delay - Delay in milliseconds
   * @param {boolean} isInterval - Whether it's an interval
   * @returns {number} Timer ID
   */
  addTimer(callback, delay, isInterval = false) {
    if (this.isDestroyed) {
      this.logger.warn('Cannot add timer to destroyed component');
      return null;
    }

    const timerId = isInterval ? setInterval(callback, delay) : setTimeout(callback, delay);

    this.timers.add(timerId);

    this.logger.debug(`Timer added: ${isInterval ? 'interval' : 'timeout'} (${delay}ms)`);

    return timerId;
  }

  /**
   * Remove timer
   * @param {number} timerId - Timer ID
   */
  removeTimer(timerId) {
    if (this.timers.has(timerId)) {
      clearTimeout(timerId);
      clearInterval(timerId);
      this.timers.delete(timerId);
      this.logger.debug('Timer removed');
    }
  }

  /**
   * Add observer with automatic cleanup tracking
   * @param {IntersectionObserver|MutationObserver|ResizeObserver} observer - Observer instance
   */
  addObserver(observer) {
    if (this.isDestroyed) {
      this.logger.warn('Cannot add observer to destroyed component');
      return;
    }

    this.observers.add(observer);
    this.logger.debug('Observer added');
  }

  /**
   * Remove observer
   * @param {IntersectionObserver|MutationObserver|ResizeObserver} observer - Observer instance
   */
  removeObserver(observer) {
    if (this.observers.has(observer)) {
      observer.disconnect();
      this.observers.delete(observer);
      this.logger.debug('Observer removed');
    }
  }

  /**
   * Generate unique listener ID
   * @param {HTMLElement|Window|Document} target - Event target
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @returns {string} Listener ID
   */
  generateListenerId(target, event, handler) {
    const targetId =
      target === window
        ? 'window'
        : target === document
          ? 'document'
          : target.id || target.className || 'element';

    return `${targetId}_${event}_${handler.name || 'anonymous'}`;
  }

  /**
   * Setup automatic cleanup on page unload
   */
  setupAutoCleanup() {
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.destroy();
    });

    // Cleanup on visibility change (for SPA navigation)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  /**
   * Pause component (stop timers, pause observers)
   */
  pause() {
    this.timers.forEach(timerId => {
      clearTimeout(timerId);
      clearInterval(timerId);
    });

    this.observers.forEach(observer => {
      if (observer.disconnect) {
        observer.disconnect();
      }
    });

    this.logger.debug('Component paused');
  }

  /**
   * Resume component (restart timers, observers)
   */
  resume() {
    // Note: Timers and observers need to be recreated
    // This is a simplified implementation
    this.logger.debug('Component resumed');
  }

  /**
   * Destroy component and clean up all resources
   */
  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.logger.debug('Destroying component...');

    // Remove all event listeners
    this.eventListeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this.eventListeners.clear();

    // Clear all timers
    this.timers.forEach(timerId => {
      clearTimeout(timerId);
      clearInterval(timerId);
    });
    this.timers.clear();

    // Disconnect all observers
    this.observers.forEach(observer => {
      if (observer.disconnect) {
        observer.disconnect();
      }
    });
    this.observers.clear();

    // Remove element from DOM if it exists
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.isDestroyed = true;
    this.logger.debug('Component destroyed');
  }

  /**
   * Get component statistics
   * @returns {Object} Component stats
   */
  getStats() {
    return {
      eventListeners: this.eventListeners.size,
      timers: this.timers.size,
      observers: this.observers.size,
      isDestroyed: this.isDestroyed,
    };
  }
}

// Export for use in other modules
window.BaseComponent = BaseComponent;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BaseComponent };
}
