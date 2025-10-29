/**
 * Router - Client-side routing system for IgniteFitness SPA
 * Handles hash-based navigation and dynamic content loading
 */
class Router {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.routes = new Map();
        this.currentRoute = null;
        this.routeHistory = [];
        this.maxHistorySize = 10;
        
        this.initializeRoutes();
        this.setupEventListeners();
        this.handleInitialRoute();
    }

    /**
     * Initialize application routes
     */
    initializeRoutes() {
        this.routes.set('#/', {
            name: 'dashboard',
            title: 'Dashboard',
            component: 'DashboardView',
            icon: '🏠',
            requiresAuth: true
        });

        this.routes.set('#/training', {
            name: 'training',
            title: 'Training',
            component: 'TrainingView',
            icon: '💪',
            requiresAuth: true
        });

        this.routes.set('#/workouts', {
            name: 'workouts',
            title: 'Workouts',
            component: 'WorkoutsView',
            icon: '💪',
            requiresAuth: true
        });

        this.routes.set('#/progress', {
            name: 'progress',
            title: 'Progress',
            component: 'ProgressView',
            icon: '📊',
            requiresAuth: true
        });

        this.routes.set('#/sport', {
            name: 'sport',
            title: 'Sport Training',
            component: 'SportView',
            icon: '⚽',
            requiresAuth: true
        });

        this.routes.set('#/profile', {
            name: 'profile',
            title: 'Profile',
            component: 'ProfileView',
            icon: '👤',
            requiresAuth: true
        });

        this.routes.set('#/onboarding', {
            name: 'onboarding',
            title: 'Get Started',
            component: 'OnboardingView',
            icon: '🚀',
            requiresAuth: false
        });

        this.routes.set('#/login', {
            name: 'login',
            title: 'Sign In',
            component: 'LoginView',
            icon: '🔐',
            requiresAuth: false
        });

        this.routes.set('#/register', {
            name: 'register',
            title: 'Sign Up',
            component: 'RegisterView',
            icon: '📝',
            requiresAuth: false
        });

        this.logger.debug('Router initialized with', this.routes.size, 'routes');
    }

    /**
     * Setup event listeners for navigation
     */
    setupEventListeners() {
        // Handle hash changes
        window.addEventListener('hashchange', (e) => {
            this.handleRouteChange();
        });

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            this.handleRouteChange();
        });

        // Handle programmatic navigation
        window.addEventListener('router:navigate', (e) => {
            this.navigate(e.detail.route, e.detail.options);
        });
    }

    /**
     * Handle initial route on page load
     */
    handleInitialRoute() {
        const hash = window.location.hash;
        
        // If no hash and user is not authenticated, go to login
        if (!hash && !this.isAuthenticated()) {
            this.navigate('#/login', { replace: true });
            return;
        }
        
        // If hash is #/ and user is not authenticated, redirect to login
        if ((!hash || hash === '#/') && !this.isAuthenticated()) {
            this.navigate('#/login', { replace: true });
            return;
        }
        
        // Otherwise navigate to the hash (or default to #/)
        this.navigate(hash || '#/', { replace: true });
    }

    /**
     * Handle route changes
     */
    handleRouteChange() {
        const hash = window.location.hash || '#/';
        this.navigate(hash, { silent: true });
    }

    /**
     * Navigate to a route
     * @param {string} route - Route hash
     * @param {Object} options - Navigation options
     */
    navigate(route, options = {}) {
        const { replace = false, silent = false } = options;
        
        if (!this.routes.has(route)) {
            this.logger.warn('Route not found:', route);
            this.navigate('#/', { replace: true });
            return;
        }

        const routeConfig = this.routes.get(route);
        
        // Check authentication requirements
        if (routeConfig.requiresAuth && !this.isAuthenticated()) {
            this.logger.debug('Route requires authentication, redirecting to login');
            this.navigate('#/login', { replace: true });
            return;
        }

        // Skip if already on this route
        if (this.currentRoute === route) {
            return;
        }

        // Add to history if not replacing
        if (!replace && !silent) {
            this.addToHistory(this.currentRoute);
        }

        // Update current route
        this.currentRoute = route;

        // Update URL hash
        if (!silent) {
            window.location.hash = route;
        }

        // Load route component
        this.loadRouteComponent(routeConfig);

        // Update navigation state
        this.updateNavigationState(routeConfig);

        // Emit route change event
        this.emitRouteChange(routeConfig);

        this.logger.debug('Navigated to:', route, routeConfig.title);
    }

    /**
     * Load route component
     * @param {Object} routeConfig - Route configuration
     */
    async loadRouteComponent(routeConfig) {
        try {
            // Try both possible IDs for compatibility
            const container = document.getElementById('main-content') || document.getElementById('app-content');
            if (!container) {
                this.logger.error('App content container not found');
                return;
            }

            // Show loading state
            this.showLoadingState(container);

            // Load component
            const component = await this.getComponent(routeConfig.component);
            
            // Update page title
            document.title = `${routeConfig.title} - IgniteFitness`;

            // Render component
            container.innerHTML = component;
            
            // Initialize component if it has an init method
            const componentElement = container.querySelector('[data-component]');
            if (componentElement && window[routeConfig.component]) {
                const componentInstance = new window[routeConfig.component]();
                if (typeof componentInstance.init === 'function') {
                    componentInstance.init();
                }
            }

            // Hide loading state
            this.hideLoadingState(container);

        } catch (error) {
            this.logger.error('Failed to load route component:', error);
            this.showErrorState(container, error);
        }
    }

    /**
     * Get component HTML/content
     * @param {string} componentName - Component name
     * @returns {Promise<string>} Component HTML
     */
    async getComponent(componentName) {
        // Check if component is already loaded
        if (window[componentName] && typeof window[componentName].render === 'function') {
            return window[componentName].render();
        }

        // Load component dynamically
        const componentPath = `js/modules/views/${componentName}.js`;
        
        try {
            // Dynamic import for ES6 modules
            const module = await import(componentPath);
            return module.default.render();
        } catch (error) {
            // Fallback to static component loading
            return this.getStaticComponent(componentName);
        }
    }

    /**
     * Get static component content
     * @param {string} componentName - Component name
     * @returns {string} Component HTML
     */
    getStaticComponent(componentName) {
        const components = {
            'DashboardView': () => this.getDashboardHTML(),
            'TrainingView': () => this.getTrainingHTML(),
            'WorkoutsView': () => this.getWorkoutsHTML(),
            'ProgressView': () => this.getProgressHTML(),
            'SportView': () => this.getSportHTML(),
            'ProfileView': () => this.getProfileHTML(),
            'OnboardingView': () => this.getOnboardingHTML(),
            'LoginView': () => this.getLoginHTML(),
            'RegisterView': () => this.getRegisterHTML()
        };

        const componentRenderer = components[componentName];
        return componentRenderer ? componentRenderer() : this.getNotFoundHTML();
    }

    /**
     * Add route to history
     * @param {string} route - Route to add
     */
    addToHistory(route) {
        if (route && route !== this.currentRoute) {
            this.routeHistory.unshift(route);
            if (this.routeHistory.length > this.maxHistorySize) {
                this.routeHistory.pop();
            }
        }
    }

    /**
     * Update navigation state
     * @param {Object} routeConfig - Route configuration
     */
    updateNavigationState(routeConfig) {
        // Update bottom navigation active state
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.route === routeConfig.name) {
                tab.classList.add('active');
            }
        });

        // Update mobile navigation
        if (window.MobileNavigation) {
            window.MobileNavigation.setActiveTab(routeConfig.name);
        }
    }

    /**
     * Emit route change event
     * @param {Object} routeConfig - Route configuration
     */
    emitRouteChange(routeConfig) {
        const event = new CustomEvent('route:changed', {
            detail: {
                route: this.currentRoute,
                config: routeConfig,
                history: [...this.routeHistory]
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuthenticated() {
        return window.AuthManager && window.AuthManager.isLoggedIn();
    }

    /**
     * Show loading state
     * @param {HTMLElement} container - Container element
     */
    showLoadingState(container) {
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        `;
    }

    /**
     * Hide loading state
     * @param {HTMLElement} container - Container element
     */
    hideLoadingState(container) {
        const loadingState = container.querySelector('.loading-state');
        if (loadingState) {
            loadingState.remove();
        }
    }

    /**
     * Show error state
     * @param {HTMLElement} container - Container element
     * @param {Error} error - Error object
     */
    showErrorState(container, error) {
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3>Something went wrong</h3>
                <p>${error.message}</p>
                <button onclick="window.location.reload()" class="retry-button">
                    Try Again
                </button>
            </div>
        `;
    }

    // Component HTML generators
    getDashboardHTML() {
        // Use DashboardHero component if available
        if (window.DashboardHero) {
            const hero = window.DashboardHero.render();
            return `
                <div data-component="DashboardView" class="dashboard-view">
                    ${hero.outerHTML}
                    <div class="dashboard-content">
                        <!-- Additional dashboard content -->
                    </div>
                </div>
            `;
        }
        
        // Fallback
        return `
            <div data-component="DashboardView" class="dashboard-view">
                <div class="dashboard-header">
                    <h1>Welcome back!</h1>
                    <p>Ready for your next workout?</p>
                </div>
                <div class="dashboard-content">
                    <div class="quick-actions">
                        <button class="action-card" onclick="window.Router.navigate('#/training')">
                            <div class="action-icon">💪</div>
                            <div class="action-text">Start Workout</div>
                        </button>
                        <button class="action-card" onclick="window.Router.navigate('#/progress')">
                            <div class="action-icon">📊</div>
                            <div class="action-text">View Progress</div>
                        </button>
                        <button class="action-card" onclick="window.Router.navigate('#/sport')">
                            <div class="action-icon">⚽</div>
                            <div class="action-text">Sport Training</div>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    getTrainingHTML() {
        return `
            <div data-component="TrainingView" class="training-view">
                <div class="view-header">
                    <h1>Training</h1>
                </div>
                <div class="training-content">
                    <p>Your training plan will be displayed here</p>
                </div>
            </div>
        `;
    }

    getWorkoutsHTML() {
        return `
            <div data-component="WorkoutsView" class="workouts-view">
                <div class="view-header">
                    <h1>Workouts</h1>
                </div>
                <div class="workouts-content">
                    <p>Workout content will be loaded here</p>
                </div>
            </div>
        `;
    }

    getProgressHTML() {
        return `
            <div data-component="ProgressView" class="progress-view">
                <div class="view-header">
                    <h1>Progress</h1>
                </div>
                <div class="progress-content">
                    <p>Progress tracking will be loaded here</p>
                </div>
            </div>
        `;
    }

    getSportHTML() {
        return `
            <div data-component="SportView" class="sport-view">
                <div class="view-header">
                    <h1>Sport Training</h1>
                </div>
                <div class="sport-content">
                    <p>Sport-specific training will be loaded here</p>
                </div>
            </div>
        `;
    }

    getProfileHTML() {
        return `
            <div data-component="ProfileView" class="profile-view">
                <div class="view-header">
                    <h1>Profile</h1>
                </div>
                <div class="profile-content">
                    <p>Profile settings will be loaded here</p>
                </div>
            </div>
        `;
    }

    getOnboardingHTML() {
        return `
            <div data-component="OnboardingView" class="onboarding-view">
                <div class="onboarding-content">
                    <p>Onboarding flow will be loaded here</p>
                </div>
            </div>
        `;
    }

    getLoginHTML() {
        // Show the legacy login form from index.html
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.style.display = 'block';
            loginForm.classList.remove('hidden');
        }
        
        // Also show login form content in main content area
        return `
            <div data-component="LoginView" class="login-view auth-view">
                <div class="auth-container" style="max-width: 400px; margin: 2rem auto; padding: 2rem;">
                    <section class="form-section" aria-labelledby="login-heading">
                        <h2 id="login-heading" style="text-align: center; margin-bottom: 1.5rem; color: #2d3748;">Welcome Back</h2>
                        <form role="form" aria-label="User login form" onsubmit="if(window.login){window.login(); return false;} return false;">
                            <div class="form-group">
                                <label for="loginUsername">Username</label>
                                <input type="text" 
                                       id="loginUsername" 
                                       name="username"
                                       class="form-input" 
                                       placeholder="Enter username"
                                       aria-required="true"
                                       autocomplete="username"
                                       required>
                            </div>
                            <div class="form-group">
                                <label for="loginPassword">Password</label>
                                <input type="password" 
                                       id="loginPassword" 
                                       name="password"
                                       class="form-input" 
                                       placeholder="Enter password"
                                       aria-required="true"
                                       autocomplete="current-password"
                                       required>
                            </div>
                            <div class="form-actions" style="margin-top: 1.5rem;">
                                <button type="submit" class="btn" style="width: 100%;">
                                    Sign In
                                </button>
                            </div>
                            <div class="form-footer" style="margin-top: 1rem; text-align: center;">
                                <p style="color: #718096; font-size: 0.875rem;">
                                    Don't have an account? 
                                    <a href="#/register" onclick="window.Router?.navigate('#/register'); return false;" style="color: #4299e1; text-decoration: underline;">Sign up</a>
                                </p>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        `;
    }

    getRegisterHTML() {
        return `
            <div data-component="RegisterView" class="register-view">
                <div class="auth-container">
                    <h1>Sign Up</h1>
                    <p>Registration form will be loaded here</p>
                </div>
            </div>
        `;
    }

    getNotFoundHTML() {
        return `
            <div class="not-found-view">
                <div class="not-found-content">
                    <h1>404</h1>
                    <p>Page not found</p>
                    <button onclick="router.navigate('#/')" class="home-button">
                        Go Home
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get current route
     * @returns {string} Current route
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Get route history
     * @returns {Array} Route history
     */
    getHistory() {
        return [...this.routeHistory];
    }

    /**
     * Go back in history
     */
    goBack() {
        if (this.routeHistory.length > 0) {
            const previousRoute = this.routeHistory.shift();
            this.navigate(previousRoute, { replace: true });
        }
    }
}

// Create global router instance
window.Router = new Router();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Router;
}
