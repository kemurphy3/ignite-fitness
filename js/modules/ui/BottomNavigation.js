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
                requiresAuth: true
            },
            {
                id: 'workouts',
                label: 'Workouts',
                icon: '💪',
                route: '#/workouts',
                requiresAuth: true
            },
            {
                id: 'progress',
                label: 'Progress',
                icon: '📊',
                route: '#/progress',
                requiresAuth: true
            },
            {
                id: 'sport',
                label: 'Sport',
                icon: '⚽',
                route: '#/sport',
                requiresAuth: true
            },
            {
                id: 'profile',
                label: 'Profile',
                icon: '👤',
                route: '#/profile',
                requiresAuth: true
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
            <div class="nav-container">
                ${this.tabs.map(tab => `
                    <button 
                        class="nav-tab" 
                        data-route="${tab.route}"
                        data-tab="${tab.id}"
                        onclick="bottomNavigation.navigateToTab('${tab.id}')"
                        ${this.isTabDisabled(tab) ? 'disabled' : ''}
                    >
                        <div class="nav-icon">${tab.icon}</div>
                        <div class="nav-label">${tab.label}</div>
                        ${this.isTabDisabled(tab) ? '<div class="nav-lock">🔒</div>' : ''}
                    </button>
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
}

// Create global instance
window.BottomNavigation = new BottomNavigation();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BottomNavigation;
}
