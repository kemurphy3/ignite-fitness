/**
 * MobileOptimizer - Mobile-first responsive optimization system
 * Handles touch interactions, viewport management, and mobile-specific features
 */
class MobileOptimizer {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.isMobile = false;
        this.isTablet = false;
        this.isDesktop = false;
        this.touchSupport = false;
        this.orientation = 'portrait';
        
        this.initializeOptimizer();
        this.setupEventListeners();
        this.applyMobileOptimizations();
    }

    /**
     * Initialize mobile optimizer
     */
    initializeOptimizer() {
        this.detectDeviceType();
        this.detectTouchSupport();
        this.detectOrientation();
        
        this.logger.debug('Mobile optimizer initialized:', {
            isMobile: this.isMobile,
            isTablet: this.isTablet,
            isDesktop: this.isDesktop,
            touchSupport: this.touchSupport,
            orientation: this.orientation
        });
    }

    /**
     * Detect device type based on screen size
     */
    detectDeviceType() {
        const width = window.innerWidth;
        
        this.isMobile = width <= 768;
        this.isTablet = width > 768 && width <= 1024;
        this.isDesktop = width > 1024;
        
        // Update body class for CSS targeting
        document.body.classList.remove('mobile', 'tablet', 'desktop');
        if (this.isMobile) {
            document.body.classList.add('mobile');
        } else if (this.isTablet) {
            document.body.classList.add('tablet');
        } else {
            document.body.classList.add('desktop');
        }
    }

    /**
     * Detect touch support
     */
    detectTouchSupport() {
        this.touchSupport = 'ontouchstart' in window || 
                           navigator.maxTouchPoints > 0 || 
                           navigator.msMaxTouchPoints > 0;
        
        if (this.touchSupport) {
            document.body.classList.add('touch');
        } else {
            document.body.classList.add('no-touch');
        }
    }

    /**
     * Detect device orientation
     */
    detectOrientation() {
        this.orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        
        document.body.classList.remove('portrait', 'landscape');
        document.body.classList.add(this.orientation);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 100);
        });

        // Handle touch events for mobile interactions
        if (this.touchSupport) {
            this.setupTouchEvents();
        }

        // Handle viewport changes
        window.addEventListener('resize', () => {
            this.updateViewportMeta();
        });
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const wasMobile = this.isMobile;
        const wasTablet = this.isTablet;
        const wasDesktop = this.isDesktop;
        
        this.detectDeviceType();
        this.detectOrientation();
        
        // Emit device type change event if changed
        if (wasMobile !== this.isMobile || wasTablet !== this.isTablet || wasDesktop !== this.isDesktop) {
            this.emitDeviceTypeChange();
        }
        
        // Update mobile-specific optimizations
        this.applyMobileOptimizations();
    }

    /**
     * Handle orientation change
     */
    handleOrientationChange() {
        const wasPortrait = this.orientation === 'portrait';
        this.detectOrientation();
        
        if (wasPortrait !== (this.orientation === 'portrait')) {
            this.emitOrientationChange();
        }
        
        // Apply orientation-specific optimizations
        this.applyOrientationOptimizations();
    }

    /**
     * Setup touch events for mobile interactions
     */
    setupTouchEvents() {
        // Prevent double-tap zoom on buttons
        document.addEventListener('touchend', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.classList.contains('clickable')) {
                e.preventDefault();
                e.target.click();
            }
        });

        // Handle touch scrolling optimization
        let touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            const touchDiff = touchStartY - touchY;
            
            // Prevent overscroll bounce on iOS
            if (touchDiff < 0 && window.scrollY === 0) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    /**
     * Apply mobile optimizations
     */
    applyMobileOptimizations() {
        if (this.isMobile) {
            this.applyMobileStyles();
            this.optimizeTouchTargets();
            this.setupMobileGestures();
            this.optimizeScrolling();
        } else {
            this.removeMobileStyles();
        }
    }

    /**
     * Apply mobile-specific styles
     */
    applyMobileStyles() {
        // Ensure viewport meta tag is correct
        this.updateViewportMeta();
        
        // Add mobile-specific CSS classes
        document.body.classList.add('mobile-optimized');
        
        // Optimize font sizes for mobile
        this.optimizeFontSizes();
        
        // Adjust spacing for touch interfaces
        this.optimizeSpacing();
    }

    /**
     * Remove mobile-specific styles
     */
    removeMobileStyles() {
        document.body.classList.remove('mobile-optimized');
    }

    /**
     * Update viewport meta tag
     */
    updateViewportMeta() {
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        
        if (!viewportMeta) {
            viewportMeta = document.createElement('meta');
            viewportMeta.name = 'viewport';
            document.head.appendChild(viewportMeta);
        }
        
        if (this.isMobile) {
            viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        } else {
            viewportMeta.content = 'width=device-width, initial-scale=1.0';
        }
    }

    /**
     * Optimize touch targets
     */
    optimizeTouchTargets() {
        // Ensure minimum touch target size (44px recommended by Apple/Google)
        const style = document.createElement('style');
        style.textContent = `
            .mobile-optimized button,
            .mobile-optimized .clickable,
            .mobile-optimized input[type="button"],
            .mobile-optimized input[type="submit"] {
                min-height: 44px;
                min-width: 44px;
                padding: 12px 16px;
            }
            
            .mobile-optimized .nav-tab {
                min-height: 60px;
                min-width: 60px;
            }
            
            .mobile-optimized input[type="text"],
            .mobile-optimized input[type="email"],
            .mobile-optimized input[type="password"],
            .mobile-optimized textarea,
            .mobile-optimized select {
                min-height: 44px;
                font-size: 16px; /* Prevents zoom on iOS */
            }
        `;
        
        // Remove existing mobile styles
        const existingStyle = document.getElementById('mobile-optimizer-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        style.id = 'mobile-optimizer-styles';
        document.head.appendChild(style);
    }

    /**
     * Setup mobile gestures
     */
    setupMobileGestures() {
        // Swipe gestures for navigation
        let startX = 0;
        let startY = 0;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const diffX = startX - endX;
            const diffY = startY - endY;
            
            // Horizontal swipe detection
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // Swipe left - next tab
                    this.handleSwipeLeft();
                } else {
                    // Swipe right - previous tab
                    this.handleSwipeRight();
                }
            }
        }, { passive: true });
    }

    /**
     * Handle swipe left gesture
     */
    handleSwipeLeft() {
        if (window.BottomNavigation) {
            const tabs = window.BottomNavigation.getAllTabs();
            const currentTab = window.BottomNavigation.activeTab;
            const currentIndex = tabs.findIndex(tab => tab.id === currentTab);
            
            if (currentIndex < tabs.length - 1) {
                const nextTab = tabs[currentIndex + 1];
                window.BottomNavigation.navigateToTab(nextTab.id);
            }
        }
    }

    /**
     * Handle swipe right gesture
     */
    handleSwipeRight() {
        if (window.BottomNavigation) {
            const tabs = window.BottomNavigation.getAllTabs();
            const currentTab = window.BottomNavigation.activeTab;
            const currentIndex = tabs.findIndex(tab => tab.id === currentTab);
            
            if (currentIndex > 0) {
                const prevTab = tabs[currentIndex - 1];
                window.BottomNavigation.navigateToTab(prevTab.id);
            }
        }
    }

    /**
     * Optimize scrolling for mobile
     */
    optimizeScrolling() {
        // Add smooth scrolling behavior
        document.documentElement.style.scrollBehavior = 'smooth';
        
        // Optimize scroll performance
        const style = document.createElement('style');
        style.textContent = `
            .mobile-optimized {
                -webkit-overflow-scrolling: touch;
                overflow-scrolling: touch;
            }
            
            .mobile-optimized * {
                -webkit-transform: translateZ(0);
                transform: translateZ(0);
            }
        `;
        
        const existingStyle = document.getElementById('mobile-scroll-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        style.id = 'mobile-scroll-styles';
        document.head.appendChild(style);
    }

    /**
     * Optimize font sizes for mobile
     */
    optimizeFontSizes() {
        const style = document.createElement('style');
        style.textContent = `
            .mobile-optimized {
                font-size: 16px; /* Base font size */
            }
            
            .mobile-optimized h1 {
                font-size: 24px;
                line-height: 1.2;
            }
            
            .mobile-optimized h2 {
                font-size: 20px;
                line-height: 1.3;
            }
            
            .mobile-optimized h3 {
                font-size: 18px;
                line-height: 1.4;
            }
            
            .mobile-optimized p {
                font-size: 16px;
                line-height: 1.5;
            }
            
            .mobile-optimized .small-text {
                font-size: 14px;
            }
        `;
        
        const existingStyle = document.getElementById('mobile-font-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        style.id = 'mobile-font-styles';
        document.head.appendChild(style);
    }

    /**
     * Optimize spacing for touch interfaces
     */
    optimizeSpacing() {
        const style = document.createElement('style');
        style.textContent = `
            .mobile-optimized .card,
            .mobile-optimized .action-card {
                margin-bottom: 16px;
                padding: 16px;
            }
            
            .mobile-optimized .form-group {
                margin-bottom: 20px;
            }
            
            .mobile-optimized .button-group {
                gap: 12px;
            }
        `;
        
        const existingStyle = document.getElementById('mobile-spacing-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        style.id = 'mobile-spacing-styles';
        document.head.appendChild(style);
    }

    /**
     * Apply orientation-specific optimizations
     */
    applyOrientationOptimizations() {
        if (this.orientation === 'landscape' && this.isMobile) {
            // Landscape mobile optimizations
            document.body.classList.add('landscape-mobile');
        } else {
            document.body.classList.remove('landscape-mobile');
        }
    }

    /**
     * Emit device type change event
     */
    emitDeviceTypeChange() {
        const event = new CustomEvent('device:typeChanged', {
            detail: {
                isMobile: this.isMobile,
                isTablet: this.isTablet,
                isDesktop: this.isDesktop,
                touchSupport: this.touchSupport
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Emit orientation change event
     */
    emitOrientationChange() {
        const event = new CustomEvent('device:orientationChanged', {
            detail: {
                orientation: this.orientation,
                isPortrait: this.orientation === 'portrait',
                isLandscape: this.orientation === 'landscape'
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Get device information
     * @returns {Object} Device information
     */
    getDeviceInfo() {
        return {
            isMobile: this.isMobile,
            isTablet: this.isTablet,
            isDesktop: this.isDesktop,
            touchSupport: this.touchSupport,
            orientation: this.orientation,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            userAgent: navigator.userAgent
        };
    }

    /**
     * Check if device is mobile
     * @returns {boolean} Mobile status
     */
    isMobileDevice() {
        return this.isMobile;
    }

    /**
     * Check if device supports touch
     * @returns {boolean} Touch support status
     */
    hasTouchSupport() {
        return this.touchSupport;
    }
}

// Create global instance
window.MobileOptimizer = new MobileOptimizer();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileOptimizer;
}
