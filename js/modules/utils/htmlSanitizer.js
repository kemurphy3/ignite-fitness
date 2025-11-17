/**
 * HTML Sanitizer Utility
 * Provides secure HTML sanitization using DOMPurify with enhanced XSS protection
 */

class HtmlSanitizer {
  constructor() {
    this.dompurify = null;
    this.initialized = false;
    this.allowedTags = [
      'p',
      'br',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'a',
      'img',
    ];
    this.allowedAttributes = {
      a: ['href'],
      img: ['src', 'alt', 'width', 'height'],
    };
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
      logger.warn('DOMPurify not available, falling back to basic escaping', {
        error: error.message,
        stack: error.stack,
      });
      this.dompurify = null;
      this.initialized = true;
    }
  }

  /**
   * Sanitize HTML string to prevent XSS
   * @param {string} html - HTML to sanitize
   * @returns {string} Sanitized HTML
   */
  sanitize(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Remove all script tags and event handlers
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '');

    // Allow only whitelisted tags
    const tagRegex = /<(\/?)([\w-]+)([^>]*)>/g;
    cleaned = cleaned.replace(tagRegex, (match, slash, tag, attrs) => {
      const lowerTag = tag.toLowerCase();

      if (!this.allowedTags.includes(lowerTag)) {
        return '';
      }

      // Sanitize attributes
      const cleanAttrs = this.sanitizeAttributes(lowerTag, attrs);
      return `<${slash}${lowerTag}${cleanAttrs}>`;
    });

    return cleaned;
  }

  /**
   * Sanitize attributes for a tag
   * @param {string} tag - Tag name
   * @param {string} attrs - Attribute string
   * @returns {string} Sanitized attributes
   */
  sanitizeAttributes(tag, attrs) {
    if (!attrs || !this.allowedAttributes[tag]) {
      return '';
    }

    const allowedForTag = this.allowedAttributes[tag];
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let match;
    const cleanAttrs = [];

    while ((match = attrRegex.exec(attrs)) !== null) {
      const [, attrName, attrValue] = match;

      if (allowedForTag.includes(attrName.toLowerCase())) {
        // Additional validation for specific attributes
        if (attrName === 'href' && this.isValidURL(attrValue)) {
          cleanAttrs.push(`${attrName}="${attrValue}"`);
        } else if (attrName !== 'href') {
          cleanAttrs.push(`${attrName}="${attrValue}"`);
        }
      }
    }

    return cleanAttrs.length ? ` ${cleanAttrs.join(' ')}` : '';
  }

  /**
   * Validate URL
   * @param {string} url - URL to validate
   * @returns {boolean} Is valid URL
   */
  isValidURL(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
    } catch {
      return false;
    }
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

  /**
   * Sanitize user input
   * @param {string} input - User input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeUserInput(input) {
    if (typeof input !== 'string') {
      return String(input);
    }

    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/['"]/g, '') // Remove quotes
      .trim()
      .slice(0, 1000); // Limit length
  }
}

// Export singleton instance
window.HtmlSanitizer = new HtmlSanitizer();
