/**
 * BottomNavigation - Mobile-first bottom tab navigation system
 * Provides touch-optimized navigation for mobile devices
 */
class BottomNavigation {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.isVisible = true;
        this.activeTab = null;
        this.tabs = [];
        this.currentIndex = 0;
        this.isKeyboardNavigating = false;
        
        this.initializeNavigation();
        this.setupEventListeners();
    }

    /**
     * Initialize bottom navigation
     */
    initializeNavigation() {
        this.tabs = [
            {
                id: 'dashboard',
                label: 'Home',
                icon: '🏠',
                route: '#/',
                requiresAuth: true,
                shortLabel: 'Home'
            },
            {
                id: 'training',
                label: 'Training',
                icon: '💪',
                route: '#/training',
                requiresAuth: true,
                shortLabel: 'Train'
            },
            {
                id: 'progress',
                label: 'Progress',
                icon: '📊',
                route: '#/progress',
                requiresAuth: true,
                shortLabel: 'Stats'
            },
            {
                id: 'sport',
                label: 'Sport',
                icon: '⚽',
                route: '#/sport',
                requiresAuth: true,
                shortLabel: 'Sport'
            },
            {
                id: 'profile',
                label: 'Profile',
                icon: '👤',
                route: '#/profile',
                requiresAuth: true,
                shortLabel: 'Me'
            }
        ];

        this.createNavigationElement();
        this.updateVisibility();
    }

    /**
     * Create navigation element
     */
    createNavigationElement() {
        // Remove existing navigation if present
        const existingNav = document.getElementById('bottom-navigation');
        if (existingNav) {
            existingNav.remove();
        }

        const nav = document.createElement('div');
        nav.id = 'bottom-navigation';
        nav.className = 'bottom-nav';
        
        nav.innerHTML = this.generateNavigationHTML();
        
        document.body.appendChild(nav);
        
        this.logger.debug('Bottom navigation created');
    }

    /**
     * Generate navigation HTML
     * @returns {string} Navigation HTML
     */
    generateNavigationHTML() {
        return `
            <div class="nav-container" role="navigation" aria-label="Main navigation">
                ${this.tabs.map(tab => `
                    <button 
                        class="nav-tab" 
                        data-route="${tab.route}"
                        data-tab="${tab.id}"
                        aria-label="Navigate to ${tab.label}"
                        aria-describedby="${tab.id}-description"
                        onclick="bottomNavigation.navigateToTab('${tab.id}')"
                        ${this.isTabDisabled(tab) ? 'disabled aria-disabled="true"' : ''}
                    >
                        <div class="nav-icon" aria-hidden="true">${tab.icon}</div>
                        <div class="nav-label">${tab.label}</div>
                        ${this.isTabDisabled(tab) ? '<div class="nav-lock" aria-hidden="true">🔒</div>' : ''}
                    </button>
                    <div id="${tab.id}-description" class="sr-only">
                        ${tab.description || `Access the ${tab.label} section`}
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Check if tab should be disabled
     * @param {Object} tab - Tab configuration
     * @returns {boolean} Whether tab is disabled
     */
    isTabDisabled(tab) {
        if (!tab.requiresAuth) return false;
        return !this.isAuthenticated();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for authentication changes
        window.addEventListener('auth:login', () => {
            this.updateNavigation();
        });

        window.addEventListener('auth:logout', () => {
            this.updateNavigation();
        });

        // Listen for route changes
        window.addEventListener('route:changed', (e) => {
            this.setActiveTab(e.detail.config.name);
        });

        // Handle window resize for responsive behavior
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Add keyboard navigation support
        this.setupKeyboardNavigation();

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleResize(), 100);
        });
    }

    /**
     * Navigate to tab
     * @param {string} tabId - Tab ID
     */
    navigateToTab(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) {
            this.logger.warn('Tab not found:', tabId);
            return;
        }

        if (this.isTabDisabled(tab)) {
            this.logger.debug('Tab disabled, redirecting to login');
            window.Router.navigate('#/login');
            return;
        }

        window.Router.navigate(tab.route);
    }

    /**
     * Set active tab
     * @param {string} tabId - Tab ID
     */
    setActiveTab(tabId) {
        this.activeTab = tabId;
        
        // Update visual state
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
            }
        });

        this.logger.debug('Active tab set to:', tabId);
    }

    /**
     * Update navigation visibility
     */
    updateVisibility() {
        const nav = document.getElementById('bottom-navigation');
        if (!nav) return;

        // Hide navigation on auth pages
        const currentRoute = window.Router.getCurrentRoute();
        const authRoutes = ['#/login', '#/register', '#/onboarding'];
        
        if (authRoutes.includes(currentRoute)) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Update navigation state
     */
    updateNavigation() {
        this.createNavigationElement();
        this.updateVisibility();
        
        if (this.activeTab) {
            this.setActiveTab(this.activeTab);
        }
    }

    /**
     * Show navigation
     */
    show() {
        const nav = document.getElementById('bottom-navigation');
        if (nav) {
            nav.style.display = 'flex';
            this.isVisible = true;
        }
    }

    /**
     * Hide navigation
     */
    hide() {
        const nav = document.getElementById('bottom-navigation');
        if (nav) {
            nav.style.display = 'none';
            this.isVisible = false;
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            this.show();
        } else {
            // On desktop, we might want to show a different navigation
            this.show(); // Keep showing for now, can be customized
        }
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuthenticated() {
        return window.AuthManager && window.AuthManager.isLoggedIn();
    }

    /**
     * Add notification badge to tab
     * @param {string} tabId - Tab ID
     * @param {number} count - Notification count
     */
    addNotificationBadge(tabId, count) {
        const tab = document.querySelector(`[data-tab="${tabId}"]`);
        if (!tab) return;

        // Remove existing badge
        const existingBadge = tab.querySelector('.nav-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        if (count > 0) {
            const badge = document.createElement('div');
            badge.className = 'nav-badge';
            badge.textContent = count > 99 ? '99+' : count.toString();
            tab.appendChild(badge);
        }
    }

    /**
     * Remove notification badge from tab
     * @param {string} tabId - Tab ID
     */
    removeNotificationBadge(tabId) {
        const tab = document.querySelector(`[data-tab="${tabId}"]`);
        if (!tab) return;

        const badge = tab.querySelector('.nav-badge');
        if (badge) {
            badge.remove();
        }
    }

    /**
     * Get tab configuration
     * @param {string} tabId - Tab ID
     * @returns {Object|null} Tab configuration
     */
    getTab(tabId) {
        return this.tabs.find(tab => tab.id === tabId) || null;
    }

    /**
     * Get all tabs
     * @returns {Array} All tabs
     */
    getAllTabs() {
        return [...this.tabs];
    }

    /**
     * Update tab configuration
     * @param {string} tabId - Tab ID
     * @param {Object} updates - Updates to apply
     */
    updateTab(tabId, updates) {
        const tabIndex = this.tabs.findIndex(tab => tab.id === tabId);
        if (tabIndex === -1) {
            this.logger.warn('Tab not found for update:', tabId);
            return;
        }

        this.tabs[tabIndex] = { ...this.tabs[tabIndex], ...updates };
        this.updateNavigation();
    }

    /**
     * Add custom tab
     * @param {Object} tabConfig - Tab configuration
     */
    addTab(tabConfig) {
        this.tabs.push(tabConfig);
        this.updateNavigation();
    }

    /**
     * Remove tab
     * @param {string} tabId - Tab ID
     */
    removeTab(tabId) {
        this.tabs = this.tabs.filter(tab => tab.id !== tabId);
        this.updateNavigation();
    }

    /**
     * Setup keyboard navigation for bottom navigation
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Only handle navigation when bottom nav is visible and focused
            const navContainer = document.querySelector('.nav-container');
            if (!navContainer || navContainer.classList.contains('hidden')) {
                return;
            }

            // Check if we're in the navigation area
            const activeElement = document.activeElement;
            const isInNav = navContainer.contains(activeElement) || 
                           activeElement.classList.contains('nav-tab');

            if (!isInNav && !this.isKeyboardNavigating) {
                return;
            }

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.navigateToPreviousTab();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigateToNextTab();
                    break;
                case 'Home':
                    e.preventDefault();
                    this.navigateToFirstTab();
                    break;
                case 'End':
                    e.preventDefault();
                    this.navigateToLastTab();
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    this.activateCurrentTab();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.exitKeyboardNavigation();
                    break;
            }
        });

        // Handle focus management
        document.addEventListener('focusin', (e) => {
            const navContainer = document.querySelector('.nav-container');
            if (navContainer && navContainer.contains(e.target)) {
                this.isKeyboardNavigating = true;
                this.updateKeyboardFocus();
            }
        });

        document.addEventListener('focusout', (e) => {
            const navContainer = document.querySelector('.nav-container');
            if (navContainer && !navContainer.contains(e.target)) {
                this.isKeyboardNavigating = false;
            }
        });
    }

    /**
     * Navigate to previous tab
     */
    navigateToPreviousTab() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateKeyboardFocus();
            this.announceTabChange();
        }
    }

    /**
     * Navigate to next tab
     */
    navigateToNextTab() {
        if (this.currentIndex < this.tabs.length - 1) {
            this.currentIndex++;
            this.updateKeyboardFocus();
            this.announceTabChange();
        }
    }

    /**
     * Navigate to first tab
     */
    navigateToFirstTab() {
        this.currentIndex = 0;
        this.updateKeyboardFocus();
        this.announceTabChange();
    }

    /**
     * Navigate to last tab
     */
    navigateToLastTab() {
        this.currentIndex = this.tabs.length - 1;
        this.updateKeyboardFocus();
        this.announceTabChange();
    }

    /**
     * Activate current tab
     */
    activateCurrentTab() {
        const currentTab = this.tabs[this.currentIndex];
        if (currentTab && !this.isTabDisabled(currentTab)) {
            this.navigateToTab(currentTab.id);
        }
    }

    /**
     * Exit keyboard navigation mode
     */
    exitKeyboardNavigation() {
        this.isKeyboardNavigating = false;
        const navContainer = document.querySelector('.nav-container');
        if (navContainer) {
            navContainer.blur();
        }
        this.announceToScreenReader('Exited navigation mode');
    }

    /**
     * Update keyboard focus indicator
     */
    updateKeyboardFocus() {
        const navButtons = document.querySelectorAll('.nav-tab');
        navButtons.forEach((button, index) => {
            if (index === this.currentIndex) {
                button.classList.add('keyboard-focus');
                button.setAttribute('aria-selected', 'true');
                button.focus();
            } else {
                button.classList.remove('keyboard-focus');
                button.setAttribute('aria-selected', 'false');
            }
        });
    }

    /**
     * Announce tab change to screen readers
     */
    announceTabChange() {
        const currentTab = this.tabs[this.currentIndex];
        if (currentTab) {
            const announcement = `${currentTab.label} tab, ${this.currentIndex + 1} of ${this.tabs.length}`;
            this.announceToScreenReader(announcement);
        }
    }

    /**
     * Announce text to screen readers
     * @param {string} text - Text to announce
     */
    announceToScreenReader(text) {
        let liveRegion = document.getElementById('nav-announcements');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'nav-announcements';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            document.body.appendChild(liveRegion);
        }
        
        liveRegion.textContent = text;
        
        // Clear announcement after a short delay
        setTimeout(() => {
            if (liveRegion) {
                liveRegion.textContent = '';
            }
        }, 1000);
    }
}

// Create global instance
window.BottomNavigation = new BottomNavigation();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BottomNavigation;
}
