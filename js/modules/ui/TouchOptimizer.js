/**
 * TouchOptimizer - Touch interaction optimization utilities
 * Optimizes touch interactions for mobile devices
 */
class TouchOptimizer {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.isTouchDevice = this.detectTouchDevice();
        this.interactions = new Map();

        this.initializeOptimizations();
    }

    /**
     * Detect if device is touch-enabled
     * @returns {boolean} Is touch device
     */
    detectTouchDevice() {
        return 'ontouchstart' in window ||
               navigator.maxTouchPoints > 0 ||
               navigator.msMaxTouchPoints > 0;
    }

    /**
     * Initialize touch optimizations
     */
    initializeOptimizations() {
        if (this.isTouchDevice) {
            this.optimizeTouchTargets();
            this.optimizeScrolling();
            this.preventDoubleTapZoom();
            this.optimizeTextInputs();
            this.addTouchFeedback();
        }

        this.setupIntersectionObserver();
    }

    /**
     * Optimize touch targets to meet 44px minimum
     */
    optimizeTouchTargets() {
        const style = document.createElement('style');
        style.textContent = `
            /* Minimum touch target sizes */
            button, .btn, .nav-tab, .clickable, 
            input[type="button"], input[type="submit"],
            a.button, label.clickable {
                min-height: 44px !important;
                min-width: 44px !important;
                padding: 12px 16px !important;
            }

            /* Card touch targets */
            .card.clickable {
                min-height: 88px !important;
                padding: 16px !important;
            }

            /* Ensure icons have enough space */
            .icon-button {
                min-width: 48px !important;
                min-height: 48px !important;
                padding: 12px !important;
            }

            /* Mobile-friendly spacing */
            @media (max-width: 768px) {
                .form-group {
                    margin-bottom: 20px;
                }

                .button-group {
                    flex-direction: column;
                    gap: 12px;
                }

                .button-group button {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Optimize scrolling for mobile
     */
    optimizeScrolling() {
        document.documentElement.style.scrollBehavior = 'smooth';

        const style = document.createElement('style');
        style.textContent = `
            * {
                -webkit-overflow-scrolling: touch;
                overscroll-behavior-y: contain;
            }

            body {
                overscroll-behavior: none;
            }

            .scrollable {
                -webkit-overflow-scrolling: touch;
                overflow-scrolling: touch;
            }
        `;

        document.head.appendChild(style);

        // Prevent overscroll bounce on iOS
        let touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            const touchDiff = touchStartY - touchY;

            // Prevent overscroll
            if (touchDiff < 0 && window.scrollY === 0) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    /**
     * Prevent double-tap zoom on interactive elements
     */
    preventDoubleTapZoom() {
        const style = document.createElement('style');
        style.textContent = `
            button, .btn, a, .clickable, 
            input, select, textarea {
                touch-action: manipulation;
            }

            .no-zoom {
                touch-action: manipulation;
                user-select: none;
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Optimize text inputs for iOS
     */
    optimizeTextInputs() {
        const style = document.createElement('style');
        style.textContent = `
            /* Prevent zoom on iOS */
            input[type="text"],
            input[type="email"],
            input[type="password"],
            input[type="number"],
            input[type="tel"],
            textarea,
            select {
                font-size: 16px !important;
            }

            /* Better mobile input styling */
            input:focus, textarea:focus, select:focus {
                -webkit-appearance: none;
                appearance: none;
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Add touch feedback visual indicators
     */
    addTouchFeedback() {
        const style = document.createElement('style');
        style.textContent = `
            /* Touch feedback animations */
            button, .btn, .clickable, a {
                -webkit-tap-highlight-color: rgba(0, 166, 81, 0.2);
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
            }

            /* Active state feedback */
            .touch-active {
                opacity: 0.7;
                transform: scale(0.98);
                transition: all 0.15s ease-out;
            }

            /* Pressed state */
            button:active, .btn:active, .clickable:active {
                transform: scale(0.95);
                opacity: 0.8;
            }
        `;

        document.head.appendChild(style);

        // Add touch feedback classes
        document.addEventListener('touchstart', (e) => {
            if (this.isInteractiveElement(e.target)) {
                e.target.classList.add('touch-active');
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            setTimeout(() => {
                if (e.target.classList) {
                    e.target.classList.remove('touch-active');
                }
            }, 150);
        }, { passive: true });
    }

    /**
     * Setup intersection observer for lazy loading
     */
    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            this.logger.warn('IntersectionObserver not supported');
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');

                    // Trigger lazy loading
                    if (entry.target.dataset.lazyLoad) {
                        this.loadLazyContent(entry.target);
                    }
                }
            });
        }, {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        });

        // Observe elements with lazy-load attribute
        document.querySelectorAll('[data-lazy-load]').forEach(el => {
            observer.observe(el);
        });
    }

    /**
     * Load lazy content
     * @param {HTMLElement} element - Element to load
     */
    loadLazyContent(element) {
        const {src} = element.dataset;
        if (!src) {return;}

        element.setAttribute('src', src);
        element.removeAttribute('data-lazy-load');
        this.logger.debug('Lazy loaded:', src);
    }

    /**
     * Check if element is interactive
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} Is interactive
     */
    isInteractiveElement(element) {
        const interactiveElements = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'];
        const interactiveClasses = ['btn', 'clickable', 'card', 'clickable-item'];

        return interactiveElements.includes(element.tagName) ||
               interactiveClasses.some(cls => element.classList.contains(cls));
    }

    /**
     * Add haptic feedback (if supported)
     * @param {string} type - Feedback type
     */
    addHapticFeedback(type = 'light') {
        if ('vibrate' in navigator) {
            const patterns = {
                light: 10,
                medium: 20,
                heavy: 40,
                success: [100, 50, 100],
                error: [50, 100, 50, 100, 50]
            };

            const pattern = patterns[type] || 10;
            navigator.vibrate(pattern);
        }
    }

    /**
     * Optimize for specific viewport
     * @param {number} width - Target width
     */
    optimizeForViewport(width) {
        const metaViewport = document.querySelector('meta[name="viewport"]');
        if (metaViewport) {
            metaViewport.content = `width=${width}, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes`;
        }
    }

    /**
     * Enable pull-to-refresh
     * @param {Function} refreshCallback - Callback function
     */
    enablePullToRefresh(refreshCallback) {
        let touchStartY = 0;
        let isRefreshing = false;

        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (isRefreshing) {return;}

            const touchY = e.touches[0].clientY;
            const pullDistance = touchY - touchStartY;

            if (pullDistance > 80 && window.scrollY === 0) {
                isRefreshing = true;
                this.addHapticFeedback('medium');

                if (refreshCallback) {
                    refreshCallback();
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            isRefreshing = false;
        }, { passive: true });
    }

    /**
     * Optimize for orientation change
     */
    handleOrientationChange() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                // Recalculate layout
                document.body.style.height = `${window.innerHeight}px`;
                window.scrollTo(0, window.scrollY);
            }, 100);
        });

        // Set initial height
        document.body.style.height = `${window.innerHeight}px`;
    }

    /**
     * Prevent keyboard from moving fixed elements
     */
    preventKeyboardShifting() {
        const viewportHeight = window.innerHeight;
        const metaViewport = document.querySelector('meta[name="viewport"]');

        if (metaViewport) {
            metaViewport.content = `
                width=device-width, 
                initial-scale=1.0, 
                maximum-scale=1.0, 
                user-scalable=no,
                viewport-fit=cover
            `;
        }

        // Fix for iOS keyboard
        const inputElements = document.querySelectorAll('input, textarea');
        inputElements.forEach(input => {
            input.addEventListener('focus', () => {
                window.scrollTo(0, 0);
            });
        });
    }

    /**
     * Optimize for safe area (notches)
     */
    optimizeSafeArea() {
        const style = document.createElement('style');
        style.textContent = `
            /* Safe area insets */
            .safe-top {
                padding-top: env(safe-area-inset-top);
            }

            .safe-bottom {
                padding-bottom: env(safe-area-inset-bottom);
            }

            .safe-left {
                padding-left: env(safe-area-inset-left);
            }

            .safe-right {
                padding-right: env(safe-area-inset-right);
            }

            /* Full screen with safe area */
            body {
                padding-top: env(safe-area-inset-top);
                padding-bottom: env(safe-area-inset-bottom);
            }

            .bottom-nav {
                padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Get touch device information
     * @returns {Object} Touch device info
     */
    getTouchInfo() {
        return {
            isTouchDevice: this.isTouchDevice,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            pointerType: this.getPointerType(),
            screenSize: {
                width: window.screen.width,
                height: window.screen.height
            },
            viewportSize: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
    }

    /**
     * Get pointer type
     * @returns {string} Pointer type
     */
    getPointerType() {
        if ('pointerEvents' in document.documentElement.style) {
            return 'pointer';
        }
        return this.isTouchDevice ? 'touch' : 'mouse';
    }
}

// Create global instance
window.TouchOptimizer = new TouchOptimizer();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TouchOptimizer;
}
