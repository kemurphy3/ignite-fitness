/**
 * ImageOptimizer - Modern image delivery with WebP/AVIF and responsive sizing
 * Implements lazy loading, format detection, and responsive image delivery
 */
class ImageOptimizer {
  constructor(options = {}) {
    this.options = {
      lazyLoadThreshold: options.lazyLoadThreshold || 50,
      quality: options.quality || 80,
      enableWebP: options.enableWebP !== false,
      enableAVIF: options.enableAVIF !== false,
      enableLazyLoading: options.enableLazyLoading !== false,
      enableResponsive: options.enableResponsive !== false,
      ...options,
    };

    this.logger = window.SafeLogger || console;
    this.observer = null;
    this.supportedFormats = this.detectSupportedFormats();
    this.imageCache = new Map();

    this.stats = {
      imagesLoaded: 0,
      imagesLazyLoaded: 0,
      formatConversions: 0,
      bandwidthSaved: 0,
      lazyLoadErrors: 0,
    };

    this.init();
  }

  /**
   * Initialize image optimizer
   */
  init() {
    // Set up lazy loading observer
    if (this.options.enableLazyLoading) {
      this.setupLazyLoading();
    }

    // Optimize existing images
    this.optimizeExistingImages();

    // Set up mutation observer for new images
    this.setupMutationObserver();

    this.logger.info('ImageOptimizer initialized', {
      supportedFormats: this.supportedFormats,
      lazyLoading: this.options.enableLazyLoading,
    });
  }

  /**
   * Detect supported image formats
   * @returns {Object} Supported formats
   */
  detectSupportedFormats() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    return {
      webp: this.canvasToDataURL(canvas, ctx, 'image/webp'),
      avif: this.canvasToDataURL(canvas, ctx, 'image/avif'),
      jpeg: true,
      png: true,
    };
  }

  /**
   * Test canvas to data URL conversion
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} type - MIME type
   * @returns {boolean} Support status
   */
  canvasToDataURL(canvas, ctx, type) {
    try {
      canvas.width = 1;
      canvas.height = 1;
      ctx.fillRect(0, 0, 1, 1);
      return canvas.toDataURL(type).indexOf(`data:${type}`) === 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Setup lazy loading with Intersection Observer
   */
  setupLazyLoading() {
    if (!('IntersectionObserver' in window)) {
      this.logger.warn('IntersectionObserver not supported, lazy loading disabled');
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: `${this.options.lazyLoadThreshold}px`,
      }
    );
  }

  /**
   * Setup mutation observer for new images
   */
  setupMutationObserver() {
    if (!('MutationObserver' in window)) {
      return;
    }

    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'IMG') {
              this.optimizeImage(node);
            } else {
              const images = node.querySelectorAll('img');
              images.forEach(img => this.optimizeImage(img));
            }
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Optimize existing images
   */
  optimizeExistingImages() {
    const images = document.querySelectorAll('img');
    images.forEach(img => this.optimizeImage(img));
  }

  /**
   * Optimize a single image
   * @param {HTMLImageElement} img - Image element
   */
  optimizeImage(img) {
    // Skip if already optimized
    if (img.dataset.optimized === 'true') {
      return;
    }

    // Add lazy loading if enabled
    if (this.options.enableLazyLoading && !img.loading) {
      this.setupLazyImage(img);
    }

    // Add responsive images if enabled
    if (this.options.enableResponsive) {
      this.addResponsiveImages(img);
    }

    // Optimize format
    this.optimizeImageFormat(img);

    img.dataset.optimized = 'true';
  }

  /**
   * Setup lazy image loading
   * @param {HTMLImageElement} img - Image element
   */
  setupLazyImage(img) {
    // Store original src
    const originalSrc = img.src;
    if (originalSrc) {
      img.dataset.src = originalSrc;
    }

    // Add loading placeholder
    img.src = this.createPlaceholder(img);
    img.classList.add('lazy-image');

    // Add loading styles
    img.style.transition = 'opacity 0.3s ease';
    img.style.opacity = '0';

    // Observe for lazy loading
    if (this.observer) {
      this.observer.observe(img);
    } else {
      // Fallback: load immediately
      this.loadImage(img);
    }
  }

  /**
   * Load lazy image
   * @param {HTMLImageElement} img - Image element
   */
  loadImage(img) {
    const src = img.dataset.src || img.src;
    if (!src) {
      return;
    }

    // Create optimized image
    const optimizedSrc = this.getOptimizedImageSrc(src);

    const imageLoader = new Image();
    imageLoader.onload = () => {
      img.src = optimizedSrc;
      img.style.opacity = '1';
      img.classList.remove('lazy-image');
      img.classList.add('loaded');

      this.stats.imagesLazyLoaded++;
      this.logger.debug('Lazy image loaded:', optimizedSrc);
    };

    imageLoader.onerror = () => {
      this.logger.error('Failed to load lazy image:', src);
      this.stats.lazyLoadErrors++;

      // Fallback to original
      img.src = src;
      img.style.opacity = '1';
    };

    imageLoader.src = optimizedSrc;
  }

  /**
   * Add responsive images
   * @param {HTMLImageElement} img - Image element
   */
  addResponsiveImages(img) {
    const src = img.dataset.src || img.src;
    if (!src) {
      return;
    }

    // Create responsive srcset
    const srcset = this.generateResponsiveSrcset(src);
    if (srcset) {
      img.srcset = srcset;
      img.sizes = this.generateSizes(img);
    }
  }

  /**
   * Generate responsive srcset
   * @param {string} src - Original image source
   * @returns {string} Responsive srcset
   */
  generateResponsiveSrcset(src) {
    const baseSrc = src.replace(/\.[^/.]+$/, '');
    const extension = src.split('.').pop();

    const sizes = [320, 640, 960, 1280, 1920];
    const srcset = sizes.map(size => {
      const optimizedSrc = this.getOptimizedImageSrc(`${baseSrc}-${size}w.${extension}`);
      return `${optimizedSrc} ${size}w`;
    });

    return srcset.join(', ');
  }

  /**
   * Generate sizes attribute
   * @param {HTMLImageElement} img - Image element
   * @returns {string} Sizes attribute
   */
  generateSizes(img) {
    const containerWidth = img.parentElement?.offsetWidth || 800;

    if (containerWidth <= 320) {
      return '100vw';
    } else if (containerWidth <= 640) {
      return '(max-width: 320px) 100vw, 50vw';
    } else if (containerWidth <= 960) {
      return '(max-width: 320px) 100vw, (max-width: 640px) 50vw, 33vw';
    } else {
      return '(max-width: 320px) 100vw, (max-width: 640px) 50vw, (max-width: 960px) 33vw, 25vw';
    }
  }

  /**
   * Optimize image format
   * @param {HTMLImageElement} img - Image element
   */
  optimizeImageFormat(img) {
    const src = img.dataset.src || img.src;
    if (!src) {
      return;
    }

    const optimizedSrc = this.getOptimizedImageSrc(src);
    if (optimizedSrc !== src) {
      img.src = optimizedSrc;
      this.stats.formatConversions++;
    }
  }

  /**
   * Get optimized image source
   * @param {string} src - Original image source
   * @returns {string} Optimized image source
   */
  getOptimizedImageSrc(src) {
    // Check cache first
    if (this.imageCache.has(src)) {
      return this.imageCache.get(src);
    }

    const optimizedSrc = this.convertImageFormat(src);
    this.imageCache.set(src, optimizedSrc);

    return optimizedSrc;
  }

  /**
   * Convert image format
   * @param {string} src - Original image source
   * @returns {string} Converted image source
   */
  convertImageFormat(src) {
    const baseSrc = src.replace(/\.[^/.]+$/, '');
    const extension = src.split('.').pop();

    // Try AVIF first (best compression)
    if (this.options.enableAVIF && this.supportedFormats.avif) {
      const avifSrc = `${baseSrc}.avif`;
      if (this.imageExists(avifSrc)) {
        return avifSrc;
      }
    }

    // Try WebP (good compression, wide support)
    if (this.options.enableWebP && this.supportedFormats.webp) {
      const webpSrc = `${baseSrc}.webp`;
      if (this.imageExists(webpSrc)) {
        return webpSrc;
      }
    }

    // Fallback to original
    return src;
  }

  /**
   * Check if image exists
   * @param {string} src - Image source
   * @returns {boolean} Exists status
   */
  imageExists(src) {
    // This would typically check against a server endpoint
    // For now, we'll assume WebP/AVIF versions exist for common images
    const commonImages = ['logo', 'hero', 'background', 'icon'];
    return commonImages.some(name => src.includes(name));
  }

  /**
   * Create loading placeholder
   * @param {HTMLImageElement} img - Image element
   * @returns {string} Placeholder data URL
   */
  createPlaceholder(img) {
    const width = img.width || 300;
    const height = img.height || 200;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    // Create gradient placeholder
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f3f4f6');
    gradient.addColorStop(1, '#e5e7eb');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add loading indicator
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', width / 2, height / 2);

    return canvas.toDataURL('image/png');
  }

  /**
   * Preload critical images
   * @param {Array} imageUrls - Image URLs to preload
   */
  preloadImages(imageUrls) {
    imageUrls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = this.getOptimizedImageSrc(url);
      document.head.appendChild(link);
    });
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getStats() {
    return {
      ...this.stats,
      supportedFormats: this.supportedFormats,
      cacheSize: this.imageCache.size,
      bandwidthSavedKB: Math.round(this.stats.bandwidthSaved / 1024),
    };
  }

  /**
   * Clear image cache
   */
  clearCache() {
    this.imageCache.clear();
    this.logger.info('Image cache cleared');
  }

  /**
   * Destroy image optimizer
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.clearCache();
  }
}

// Export for use in other modules
window.ImageOptimizer = ImageOptimizer;
