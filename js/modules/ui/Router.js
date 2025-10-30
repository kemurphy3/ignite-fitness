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
        this.lastKnownRoute = null;
        this.lastRedirectReason = null;
        this.isInitialized = false;
        this.authManager = null;
        
        this.initializeRoutes();
        this.setupEventListeners();
        // DO NOT call handleInitialRoute here - wait for init() call after auth is loaded
    }
    
    /**
     * Initialize router after auth state is ready
     * @param {Object} authState - Auth state from AuthManager.getAuthState()
     */
    init(authState) {
        this.authManager = window.AuthManager;
        this.isInitialized = true;
        this.resolveInitialRoute(authState);
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
     * Resolve initial route after auth state is loaded
     * @param {Object} authState - Auth state from AuthManager
     */
    resolveInitialRoute(authState) {
        const { isAuthenticated, token } = authState || {};
        const hash = window.location.hash;
        
        // Check token expiration even on initial route
        if (isAuthenticated && this.isTokenExpired(token)) {
            this.logger.warn('Token expired on initial route resolution');
            this.authManager?.logout();
            this.lastRedirectReason = 'guard: token expired → /login';
            this.logger.info(this.lastRedirectReason);
            this.navigate('#/login', { replace: true });
            return;
        }
        
        // Prevent infinite loops - if already on login, stay there
        if (hash === '#/login') {
            this.logger.info('guard: already on login route, staying');
            this.navigate('#/login', { replace: true, silent: false });
            return;
        }
        
        // If authenticated, check if onboarding needed
        if (isAuthenticated) {
            const needsOnboarding = window.OnboardingManager?.needsOnboarding() ?? false;
            if (needsOnboarding) {
                this.lastRedirectReason = 'guard: authed but needs onboarding';
                this.logger.info(this.lastRedirectReason);
                this.navigate('#/onboarding', { replace: true });
                return;
            }
            
            const targetRoute = this.lastKnownRoute || '#/dashboard' || '#/';
            this.lastRedirectReason = 'guard: authed → dashboard';
            this.logger.info(this.lastRedirectReason);
            this.navigate(targetRoute, { replace: true });
            return;
        }
        
        // Not authenticated - check if this is first visit (no users in storage)
        const hasUsers = localStorage.getItem('ignitefitness_users');
        if (!hasUsers && !hash) {
            // First-time visitor - show landing page
            this.lastRedirectReason = 'guard: first visit → landing';
            this.logger.info(this.lastRedirectReason);
            if (window.LandingView) {
                const container = document.getElementById('main-content') || document.getElementById('app-content');
                if (container) {
                    container.innerHTML = new window.LandingView().render();
                }
            } else {
                this.navigate('#/register', { replace: true });
            }
            return;
        }
        
        // Not authenticated - route to login
        this.lastRedirectReason = 'guard: not authed → /login';
        this.logger.info(this.lastRedirectReason);
        this.navigate('#/login', { replace: true });
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
        let navigationTimeout = null;
        
        try {
            // Prevent loops: if trying to navigate to login while already on login, do nothing
            if (route === '#/login' && this.currentRoute === '#/login') {
                this.logger.debug('Already on login route, skipping navigation');
                return;
            }
            
            if (!this.routes.has(route)) {
                this.logger.warn('Route not found:', route);
                // Route to safe default based on auth state
                const authState = this.authManager?.getAuthState() || { isAuthenticated: false };
                const safeRoute = authState.isAuthenticated ? '#/dashboard' : '#/login';
                this.logger.info(`guard: unknown route → ${safeRoute}`);
                this.navigate(safeRoute, { replace: true });
                return;
            }

            const routeConfig = this.routes.get(route);
            
            // Check authentication requirements with guards
            if (routeConfig.requiresAuth) {
                const authState = this.authManager?.getAuthState() || { isAuthenticated: false };
                
                // Validate token expiration
                if (authState.isAuthenticated && this.isTokenExpired(authState.token)) {
                    this.logger.warn('Token expired during navigation');
                    this.authManager?.logout();
                    this.handleNavigationError(route, 'token_expired');
                    return;
                }
                
                if (!authState.isAuthenticated) {
                    // Store intended route for redirect after login
                    if (route !== '#/login') {
                        this.lastKnownRoute = route;
                    }
                    this.lastRedirectReason = 'guard: protected route requires auth → /login';
                    this.logger.info(this.lastRedirectReason);
                    this.navigate('#/login', { replace: true });
                    return;
                }
            }

            // Add timeout protection (5 seconds)
            navigationTimeout = setTimeout(() => {
                this.logger.warn('Navigation timeout:', route);
                this.handleNavigationError(route, 'timeout');
            }, 5000);

            // Skip if already on this route
            if (this.currentRoute === route) {
                if (navigationTimeout) {
                    clearTimeout(navigationTimeout);
                }
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

            // Clear timeout on successful navigation
            if (navigationTimeout) {
                clearTimeout(navigationTimeout);
            }

            // Emit route change event
            this.emitRouteChange(routeConfig);

            this.logger.debug('Navigated to:', route, routeConfig.title);
            
        } catch (error) {
            // Clear timeout on error
            if (navigationTimeout) {
                clearTimeout(navigationTimeout);
            }
            this.handleNavigationError(route, error);
        }
    }

    /**
     * Handle navigation errors with fallback
     * @param {string} path - Route path that failed
     * @param {Error|string} error - Error information
     */
    handleNavigationError(path, error) {
        this.logger.error('Navigation error:', { path, error });
        
        // Fallback navigation based on auth state
        const authState = this.authManager?.getAuthState() || { isAuthenticated: false };
        const fallbackPath = authState.isAuthenticated ? '#/dashboard' : '#/login';
        
        // Prevent infinite loops
        if (path !== fallbackPath && this.currentRoute !== fallbackPath) {
            this.logger.info('Falling back to:', fallbackPath);
            this.navigate(fallbackPath, { replace: true });
        }
    }

    /**
     * Check if token is expired
     * @param {string|Object} token - Token value or token object
     * @returns {boolean} True if expired
     */
    isTokenExpired(token) {
        if (!token) return true;
        
        // CRITICAL FIX: Use AuthManager's loginTimestamp for consistent comparison
        // This prevents inconsistent Date comparisons causing random logouts
        if (window.AuthManager && window.AuthManager.loginTimestamp) {
            const tokenAge = Date.now() - window.AuthManager.loginTimestamp;
            return tokenAge >= 86400000; // 24 hours (86400000 milliseconds)
        }
        
        // Fallback: Check token metadata if AuthManager timestamp not available
        if (typeof token === 'string') {
            try {
                const tokenStr = localStorage.getItem('ignite.auth.token');
                if (tokenStr) {
                    const tokenData = JSON.parse(tokenStr);
                    if (tokenData.created_at) {
                        const createdTimestamp = new Date(tokenData.created_at).getTime();
                        if (!isNaN(createdTimestamp)) {
                            const tokenAge = Date.now() - createdTimestamp;
                            return tokenAge >= 86400000; // 24 hours
                        }
                    }
                }
            } catch (e) {
                return true;
            }
            return true;
        }
        
        // Handle token object with created_at
        if (token && typeof token === 'object' && token.created_at) {
            const createdTimestamp = new Date(token.created_at).getTime();
            if (!isNaN(createdTimestamp)) {
                const tokenAge = Date.now() - createdTimestamp;
                return tokenAge >= 86400000; // 24 hours (86400000 milliseconds)
            }
        }
        
        // Unknown format - assume expired for safety
        return true;
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
            this.logger.error('ROUTE_LOAD_FAILED', { route: routeConfig?.component, message: error?.message, stack: error?.stack });
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
            'RegisterView': () => this.getRegisterHTML(),
            'LandingView': () => window.LandingView ? new window.LandingView().render() : this.getRegisterHTML()
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
        if (!this.authManager) {
            this.authManager = window.AuthManager;
        }
        const authState = this.authManager?.getAuthState() || { isAuthenticated: false };
        return authState.isAuthenticated;
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
            <div class="error-state" style="padding: 2rem; text-align: center;">
                <div class="error-icon" style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3 style="color: #2d3748; margin-bottom: 0.5rem;">Something went wrong</h3>
                <p style="color: #718096; margin-bottom: 1.5rem;">${error.message || 'An error occurred'}</p>
                <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                    <button onclick="window.location.reload()" class="btn" style="background: #4299e1; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Retry
                    </button>
                    <button onclick="window.Router?.navigate('#/login')" class="btn" style="background: #e2e8f0; color: #2d3748; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Back to Sign In
                    </button>
                </div>
            </div>
        `;
    }

    // Component HTML generators
    getDashboardHTML() {
        // Check Simple Mode
        const simpleMode = window.SimpleModeManager?.isEnabled() ?? true;
        
        // Use AdaptiveDashboard if available for better Simple Mode integration
        if (window.AdaptiveDashboard) {
            const container = document.createElement('div');
            const adaptiveDashboard = new window.AdaptiveDashboard(container);
            adaptiveDashboard.render();
            return `<div data-component="DashboardView" class="dashboard-view">${container.innerHTML}</div>`;
        }
        
        // Fallback: Use DashboardHero component if available
        if (window.DashboardHero) {
            const hero = window.DashboardHero.render();
            
            // In Simple Mode: hide charts, seasonal panels, detailed analytics, macro cards
            const additionalContent = simpleMode 
                ? '' // Simple Mode: no additional content
                : `
                    <div class="dashboard-content">
                        <!-- Charts and analytics (hidden in Simple Mode) -->
                        ${this.renderChartsSection()}
                        ${this.renderSeasonalPanel()}
                        ${this.renderMacroCard()}
                    </div>
                `;
            
            return `
                <div data-component="DashboardView" class="dashboard-view">
                    ${hero.outerHTML}
                    ${additionalContent}
                </div>
            `;
        }
        
        // Fallback
        const fallbackActions = simpleMode
            ? `
                <button class="action-card" onclick="window.Router.navigate('#/workouts')">
                    <div class="action-icon">💪</div>
                    <div class="action-text">Start Workout</div>
                </button>
                <button class="action-card" onclick="window.Router.navigate('#/sport')">
                    <div class="action-icon">⚽</div>
                    <div class="action-text">Log Sport Session</div>
                </button>
                <button class="action-card" onclick="if(window.CoachChat){window.CoachChat.openChat();}">
                    <div class="action-icon">💬</div>
                    <div class="action-text">Ask Coach</div>
                </button>
            `
            : `
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
            `;
        
        return `
            <div data-component="DashboardView" class="dashboard-view">
                <div class="dashboard-header">
                    <h1>Welcome back!</h1>
                    <p>Ready for your next workout?</p>
                </div>
                <div class="dashboard-content">
                    <div class="quick-actions">
                        ${fallbackActions}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render charts section (hidden in Simple Mode)
     */
    renderChartsSection() {
        if (!window.Trends) return '';
        return '<div id="charts-section" class="dashboard-charts"></div>';
    }
    
    /**
     * Render seasonal panel (hidden in Simple Mode)
     */
    renderSeasonalPanel() {
        if (!window.PeriodizationView) return '';
        return '<div id="seasonal-panel"></div>';
    }
    
    /**
     * Render macro card (hidden in Simple Mode)
     */
    renderMacroCard() {
        if (!window.NutritionCard) return '';
        return '<div id="macro-card"></div>';
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
        // Check Simple Mode
        const simpleMode = window.SimpleModeManager?.isEnabled() ?? true;
        
        return `
            <div data-component="ProfileView" class="profile-view">
                <div class="view-header">
                    <h1>Profile</h1>
                </div>
                <div class="profile-content" style="padding: 1.5rem;">
                    <!-- Simple Mode Toggle (Enhanced) -->
                    <div class="profile-setting-card" style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                        <h3 style="margin-top: 0; margin-bottom: 1rem; color: #2d3748;">Interface Mode</h3>
                        <p style="margin: 0 0 1rem 0; color: #718096; font-size: 0.875rem;">Choose the experience that works best for you</p>
                        <div id="simple-mode-toggle-container"></div>
                        <script>
                            (function() {
                                if (window.SimpleModeToggle && document.getElementById('simple-mode-toggle-container')) {
                                    setTimeout(function() {
                                        window.createSimpleModeToggle('simple-mode-toggle-container');
                                    }, 100);
                                }
                            })();
                        </script>
                    </div>
                    
                    <!-- Other profile settings -->
                    <div class="profile-setting-card" style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem;">
                        <p style="color: #718096;">Additional profile settings will be loaded here</p>
                    </div>
                </div>
            </div>
            <script>
                window.handleSimpleModeToggle = function(event) {
                    const enabled = event.target.checked;
                    if (window.SimpleModeManager) {
                        window.SimpleModeManager.setEnabled(enabled);
                        // Reload current view to apply changes
                        if (window.Router) {
                            const currentRoute = window.Router.currentRoute || window.location.hash || '#/';
                            window.Router.navigate(currentRoute, { replace: true });
                        }
                    }
                };
            </script>
        `;
    }

    getOnboardingHTML() {
        // Use OnboardingManager to render onboarding
        if (window.OnboardingManager) {
            return window.OnboardingManager.render();
        }
        
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
                        <form role="form" aria-label="User login form" onsubmit="window.handleLoginSubmit(event); return false;">
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
                            <div id="loginError" style="display: none; color: #ef4444; margin-top: 1rem; text-align: center;"></div>
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
                                <button type="button" onclick="window.Router?.navigate('#/register');" style="background: none; border: none; color: #4299e1; cursor: pointer; margin-top: 0.5rem; text-decoration: underline; font-size: 0.875rem;">
                                    Back to Sign In
                                </button>
                            </div>
                        </form>
                        <script>
                            // LoginView resilience - prevent unmount unless login succeeds or explicit navigation
                            window.handleLoginSubmit = async function(event) {
                                event.preventDefault();
                                const username = document.getElementById('loginUsername').value;
                                const password = document.getElementById('loginPassword').value;
                                const errorDiv = document.getElementById('loginError');
                                
                                if (!window.AuthManager) {
                                    errorDiv.textContent = 'Auth system not ready. Please reload.';
                                    errorDiv.style.display = 'block';
                                    return;
                                }
                                
                                const result = window.AuthManager.login(username, password);
                                
                                if (result.success) {
                                    errorDiv.style.display = 'none';
                                    // Update auth state and navigate to intended route
                                    const authState = window.AuthManager.getAuthState();
                                    const router = window.Router;
                                    if (router && router.lastKnownRoute) {
                                        router.navigate(router.lastKnownRoute);
                                        router.lastKnownRoute = null;
                                    } else {
                                        router.navigate('#/dashboard');
                                    }
                                } else {
                                    errorDiv.textContent = result.error || 'Login failed';
                                    errorDiv.style.display = 'block';
                                    // Stay on login screen - DO NOT unmount
                                }
                            };
                        </script>
                    </section>
                </div>
            </div>
        `;
    }

    getRegisterHTML() {
        return `
            <div data-component="RegisterView" class="register-view auth-view">
                <div class="quick-auth-container" style="max-width: 400px; margin: 2rem auto; padding: 2rem;">
                    <div class="auth-header" style="text-align: center; margin-bottom: 2rem;">
                        <h2 style="color: #2d3748; margin-bottom: 0.5rem;">Join IgniteFitness</h2>
                        <p style="color: #718096;">Get your personalized workout plan in 60 seconds</p>
                    </div>
                    
                    <form id="quick-signup-form" class="quick-form" onsubmit="window.handleQuickSignup(event); return false;">
                        <div class="form-group">
                            <label for="signup-username">Username</label>
                            <input type="text" 
                                   id="signup-username" 
                                   name="username"
                                   placeholder="Choose a username"
                                   autocomplete="username"
                                   aria-required="true"
                                   required
                                   class="form-input">
                            <div class="field-hint" style="font-size: 0.875rem; color: #718096; margin-top: 0.25rem;">
                                This is how you'll log in
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="signup-password">Password</label>
                            <input type="password" 
                                   id="signup-password" 
                                   name="password"
                                   placeholder="Create a password"
                                   autocomplete="new-password"
                                   aria-required="true"
                                   required
                                   minlength="6"
                                   class="form-input">
                            <div class="field-hint" style="font-size: 0.875rem; color: #718096; margin-top: 0.25rem;">
                                At least 6 characters
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="signup-athlete-name">Your Name</label>
                            <input type="text" 
                                   id="signup-athlete-name" 
                                   name="athleteName"
                                   placeholder="Enter your name"
                                   autocomplete="name"
                                   aria-required="true"
                                   required
                                   class="form-input">
                        </div>
                        
                        <div id="signupError" style="display: none; color: #ef4444; margin-top: 1rem; text-align: center; font-size: 0.875rem;"></div>
                        
                        <button type="submit" class="btn" style="width: 100%; margin-top: 1.5rem;">
                            Create Account & Continue
                        </button>
                    </form>
                    
                    <div class="auth-footer" style="margin-top: 1.5rem; text-align: center;">
                        <p style="color: #718096; font-size: 0.875rem;">
                            Already have an account? 
                            <a href="#/login" onclick="window.Router?.navigate('#/login'); return false;" style="color: #4299e1; text-decoration: underline;">
                                Sign in
                            </a>
                        </p>
                    </div>
                    
                    <script>
                        window.handleQuickSignup = async function(event) {
                            event.preventDefault();
                            const username = document.getElementById('signup-username').value;
                            const password = document.getElementById('signup-password').value;
                            const athleteName = document.getElementById('signup-athlete-name').value;
                            const errorDiv = document.getElementById('signupError');
                            
                            if (!window.AuthManager) {
                                errorDiv.textContent = 'Auth system not ready. Please reload.';
                                errorDiv.style.display = 'block';
                                return;
                            }
                            
                            // Show loading state
                            const submitBtn = event.target.querySelector('button[type="submit"]');
                            const originalText = submitBtn.textContent;
                            submitBtn.textContent = 'Creating account...';
                            submitBtn.disabled = true;
                            
                            try {
                                const result = window.AuthManager.register({
                                    username,
                                    password,
                                    confirmPassword: password,
                                    athleteName
                                });
                                
                                if (result.success) {
                                    errorDiv.style.display = 'none';
                                    // Auto-login after registration, proceed to onboarding
                                    const authState = window.AuthManager.getAuthState();
                                    if (authState.isAuthenticated) {
                                        // Check if user needs onboarding
                                        const needsOnboarding = window.OnboardingManager?.needsOnboarding() ?? true;
                                        if (needsOnboarding && window.OnboardingManager) {
                                            window.OnboardingManager.startOnboarding(authState.user?.username);
                                        } else {
                                            window.Router?.navigate('#/dashboard');
                                        }
                                    } else {
                                        window.Router?.navigate('#/onboarding');
                                    }
                                } else {
                                    errorDiv.textContent = result.error || 'Account creation failed';
                                    errorDiv.style.display = 'block';
                                    submitBtn.textContent = originalText;
                                    submitBtn.disabled = false;
                                }
                            } catch (error) {
                                errorDiv.textContent = 'Account creation failed. Please try again.';
                                errorDiv.style.display = 'block';
                                submitBtn.textContent = originalText;
                                submitBtn.disabled = false;
                            }
                        };
                    </script>
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
