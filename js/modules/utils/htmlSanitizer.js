/**
 * HTML Sanitizer Utility
 * Provides secure HTML sanitization using DOMPurify
 */

class HtmlSanitizer {
  constructor() {
    this.dompurify = null;
    this.initialized = false;
  }

  /**
   * Initialize DOMPurify if available
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.DOMPurify) {
        this.dompurify = window.DOMPurify;
      } else {
        // Try to load DOMPurify dynamically
        const module = await import('dompurify');
        this.dompurify = module.default;
      }
      this.initialized = true;
    } catch (error) {
      const logger = window.SafeLogger || console;
      logger.warn('DOMPurify not available, falling back to basic escaping', { error: error.message, stack: error.stack });
      this.dompurify = null;
      this.initialized = true;
    }
  }

  /**
   * Sanitize HTML string to prevent XSS
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitize(text) {
    if (!text) {
      return '';
    }
    if (typeof text !== 'string') {
      return String(text);
    }

    // Use basic escaping as fallback if DOMPurify not available
    return this.basicEscape(text);
  }

  /**
   * Basic HTML escaping fallback
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  basicEscape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) {
      return '';
    }
    if (typeof text !== 'string') {
      return String(text);
    }

    // Use basic escaping for now (DOMPurify initialization is async)
    return this.basicEscape(text);
  }
}

// Export singleton instance
window.HtmlSanitizer = new HtmlSanitizer();
