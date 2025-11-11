/**
 * ResourcePreloader - Intelligent preloading and prefetching
 * Preloads critical resources and prefetches likely-needed modules based on user flow
 */
class ResourcePreloader {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.preloadedResources = new Set();
    this.prefetchedResources = new Set();
    this.userFlow = this.analyzeUserFlow();
    this.criticalResources = this.getCriticalResources();

    this.stats = {
      preloadHits: 0,
      prefetchHits: 0,
      wastedBandwidth: 0,
      totalPreloaded: 0,
      totalPrefetched: 0,
    };

    this.init();
  }

  /**
   * Initialize resource preloader
   */
  init() {
    // Preload critical resources immediately
    this.preloadCriticalResources();

    // Set up intersection observer for prefetching
    this.setupPrefetchObserver();

    // Monitor user interactions for intelligent prefetching
    this.setupInteractionMonitoring();

    this.logger.info('ResourcePreloader initialized');
  }

  /**
   * Preload critical resources
   */
  preloadCriticalResources() {
    const criticalResources = [
      // Critical CSS
      { href: '/styles/main.css', as: 'style', crossorigin: 'anonymous' },
      { href: '/styles/mobile-first.css', as: 'style', crossorigin: 'anonymous' },

      // Critical JavaScript
      { href: '/js/app.js', as: 'script', crossorigin: 'anonymous' },
      { href: '/js/modules/ui/VirtualList.js', as: 'script', crossorigin: 'anonymous' },
      { href: '/js/modules/cache/LRUCache.js', as: 'script', crossorigin: 'anonymous' },

      // Critical fonts
      { href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },

      // Critical images
      { href: '/images/logo.webp', as: 'image' },
      { href: '/images/hero-bg.webp', as: 'image' },
    ];

    criticalResources.forEach(resource => {
      this.preloadResource(resource);
    });

    this.logger.info(`Preloaded ${criticalResources.length} critical resources`);
  }

  /**
   * Preload a single resource
   * @param {Object} resource - Resource to preload
   */
  preloadResource(resource) {
    if (this.preloadedResources.has(resource.href)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource.href;
    link.as = resource.as;

    if (resource.type) {
      link.type = resource.type;
    }

    if (resource.crossorigin) {
      link.crossOrigin = resource.crossorigin;
    }

    // Add error handling
    link.onerror = () => {
      this.logger.warn(`Failed to preload resource: ${resource.href}`);
      this.stats.wastedBandwidth += this.estimateResourceSize(resource);
    };

    link.onload = () => {
      this.stats.preloadHits++;
      this.logger.debug(`Preloaded resource: ${resource.href}`);
    };

    document.head.appendChild(link);
    this.preloadedResources.add(resource.href);
    this.stats.totalPreloaded++;
  }

  /**
   * Prefetch a resource
   * @param {string} href - Resource URL
   * @param {string} as - Resource type
   */
  prefetchResource(href, as = 'script') {
    if (this.prefetchedResources.has(href)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    link.as = as;

    if (as === 'script' || as === 'style') {
      link.crossOrigin = 'anonymous';
    }

    // Add error handling
    link.onerror = () => {
      this.logger.warn(`Failed to prefetch resource: ${href}`);
      this.stats.wastedBandwidth += this.estimateResourceSize({ href, as });
    };

    link.onload = () => {
      this.stats.prefetchHits++;
      this.logger.debug(`Prefetched resource: ${href}`);
    };

    document.head.appendChild(link);
    this.prefetchedResources.add(href);
    this.stats.totalPrefetched++;
  }

  /**
   * Setup intersection observer for prefetching
   */
  setupPrefetchObserver() {
    if (!('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.prefetchBasedOnElement(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Start prefetching 50px before visible
      }
    );

    // Observe elements that might trigger prefetching
    document.querySelectorAll('[data-prefetch-trigger]').forEach(el => {
      observer.observe(el);
    });
  }

  /**
   * Prefetch based on element
   * @param {HTMLElement} element - Element that triggered prefetch
   */
  prefetchBasedOnElement(element) {
    const trigger = element.dataset.prefetchTrigger;

    switch (trigger) {
      case 'workout-start':
        this.prefetchWorkoutResources();
        break;
      case 'chart-view':
        this.prefetchChartResources();
        break;
      case 'admin-panel':
        this.prefetchAdminResources();
        break;
      case 'exercise-list':
        this.prefetchExerciseResources();
        break;
    }
  }

  /**
   * Prefetch workout resources
   */
  prefetchWorkoutResources() {
    const workoutResources = [
      '/js/modules/ui/TimerOverlay.js',
      '/js/modules/ui/RPEInput.js',
      '/js/modules/workout/WorkoutGenerator.js',
      '/js/modules/ai/ExpertCoordinator.js',
      '/styles/workout-timer.css',
    ];

    workoutResources.forEach(resource => {
      this.prefetchResource(resource, 'script');
    });
  }

  /**
   * Prefetch chart resources
   */
  prefetchChartResources() {
    const chartResources = [
      '/js/modules/ui/charts/ChartManager.js',
      '/js/workers/ChartWorker.js',
      '/js/modules/ui/charts/Trends.js',
      '/styles/charts.css',
    ];

    chartResources.forEach(resource => {
      this.prefetchResource(resource, 'script');
    });
  }

  /**
   * Prefetch admin resources
   */
  prefetchAdminResources() {
    const adminResources = [
      '/js/bundles/admin.js',
      '/js/modules/admin/DataInspector.js',
      '/js/modules/admin/UserManager.js',
      '/styles/admin.css',
    ];

    adminResources.forEach(resource => {
      this.prefetchResource(resource, 'script');
    });
  }

  /**
   * Prefetch exercise resources
   */
  prefetchExerciseResources() {
    const exerciseResources = [
      '/js/modules/sports/SoccerExercises.js',
      '/js/modules/ui/VirtualList.js',
      '/js/modules/sports/ExerciseLibrary.js',
      '/styles/exercises.css',
    ];

    exerciseResources.forEach(resource => {
      this.prefetchResource(resource, 'script');
    });
  }

  /**
   * Setup interaction monitoring
   */
  setupInteractionMonitoring() {
    // Monitor clicks for intelligent prefetching
    document.addEventListener('click', event => {
      const target = event.target.closest('[data-prefetch-on-click]');
      if (target) {
        const prefetchTarget = target.dataset.prefetchOnClick;
        this.prefetchResource(prefetchTarget, 'script');
      }
    });

    // Monitor hover for prefetching
    document.addEventListener(
      'mouseenter',
      event => {
        const target = event.target.closest('[data-prefetch-on-hover]');
        if (target) {
          const prefetchTarget = target.dataset.prefetchOnHover;
          this.prefetchResource(prefetchTarget, 'script');
        }
      },
      true
    );

    // Monitor route changes
    window.addEventListener('popstate', () => {
      this.prefetchBasedOnRoute();
    });
  }

  /**
   * Prefetch based on current route
   */
  prefetchBasedOnRoute() {
    const route = window.location.hash || window.location.pathname;

    switch (route) {
      case '#/dashboard':
        this.prefetchWorkoutResources();
        break;
      case '#/workout':
        this.prefetchWorkoutResources();
        break;
      case '#/progress':
        this.prefetchChartResources();
        break;
      case '#/exercises':
        this.prefetchExerciseResources();
        break;
      case '#/admin':
        this.prefetchAdminResources();
        break;
    }
  }

  /**
   * Analyze user flow for intelligent prefetching
   * @returns {Object} User flow analysis
   */
  analyzeUserFlow() {
    // Get user behavior from localStorage
    const userFlow = JSON.parse(localStorage.getItem('ignite_fitness_user_flow') || '{}');

    return {
      mostVisitedPages: userFlow.mostVisitedPages || ['dashboard', 'workout'],
      commonSequences: userFlow.commonSequences || [
        ['dashboard', 'workout'],
        ['workout', 'progress'],
        ['dashboard', 'exercises'],
      ],
      timeSpent: userFlow.timeSpent || {},
      lastVisit: userFlow.lastVisit || null,
    };
  }

  /**
   * Get critical resources
   * @returns {Array} Critical resources
   */
  getCriticalResources() {
    return [
      '/styles/main.css',
      '/js/app.js',
      '/js/modules/ui/VirtualList.js',
      '/js/modules/cache/LRUCache.js',
      '/fonts/inter-var.woff2',
    ];
  }

  /**
   * Estimate resource size
   * @param {Object} resource - Resource object
   * @returns {number} Estimated size in bytes
   */
  estimateResourceSize(resource) {
    const sizeMap = {
      script: 50000, // 50KB average
      style: 10000, // 10KB average
      font: 50000, // 50KB average
      image: 100000, // 100KB average
    };

    return sizeMap[resource.as] || 25000; // 25KB default
  }

  /**
   * Update user flow data
   * @param {string} page - Page visited
   * @param {number} timeSpent - Time spent on page
   */
  updateUserFlow(page, timeSpent) {
    const userFlow = JSON.parse(localStorage.getItem('ignite_fitness_user_flow') || '{}');

    // Update most visited pages
    if (!userFlow.mostVisitedPages) {
      userFlow.mostVisitedPages = [];
    }

    if (!userFlow.mostVisitedPages.includes(page)) {
      userFlow.mostVisitedPages.push(page);
    }

    // Update time spent
    userFlow.timeSpent = userFlow.timeSpent || {};
    userFlow.timeSpent[page] = (userFlow.timeSpent[page] || 0) + timeSpent;

    // Update last visit
    userFlow.lastVisit = Date.now();

    localStorage.setItem('ignite_fitness_user_flow', JSON.stringify(userFlow));
  }

  /**
   * Get prefetch hit rate
   * @returns {number} Hit rate percentage
   */
  getPrefetchHitRate() {
    if (this.stats.totalPrefetched === 0) {
      return 0;
    }
    return (this.stats.prefetchHits / this.stats.totalPrefetched) * 100;
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getStats() {
    return {
      ...this.stats,
      prefetchHitRate: this.getPrefetchHitRate(),
      preloadHitRate:
        this.stats.totalPreloaded > 0
          ? (this.stats.preloadHits / this.stats.totalPreloaded) * 100
          : 0,
      wastedBandwidthKB: Math.round(this.stats.wastedBandwidth / 1024),
    };
  }

  /**
   * Clear prefetch cache
   */
  clearPrefetchCache() {
    // Remove prefetch links
    document.querySelectorAll('link[rel="prefetch"]').forEach(link => {
      link.remove();
    });

    this.prefetchedResources.clear();
    this.logger.info('Prefetch cache cleared');
  }
}

// Export for use in other modules
window.ResourcePreloader = ResourcePreloader;
