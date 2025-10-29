/**
 * Admin Bundle Entry Point
 * Loads admin-specific modules only for admin users
 * Reduces main bundle size by excluding admin code
 */

// Admin-specific imports
import { DataInspector } from '../modules/admin/DataInspector.js';
import { UserManager } from '../modules/admin/UserManager.js';
import { SystemMonitor } from '../modules/admin/SystemMonitor.js';
import { CacheManager } from '../modules/admin/CacheManager.js';
import { DatabaseInspector } from '../modules/admin/DatabaseInspector.js';

// Admin UI components
import { AdminDashboard } from '../modules/admin/ui/AdminDashboard.js';
import { AdminSidebar } from '../modules/admin/ui/AdminSidebar.js';
import { AdminHeader } from '../modules/admin/ui/AdminHeader.js';

// Admin utilities
import { AdminAuth } from '../modules/admin/utils/AdminAuth.js';
import { AdminLogger } from '../modules/admin/utils/AdminLogger.js';
import { AdminMetrics } from '../modules/admin/utils/AdminMetrics.js';

/**
 * AdminBundle - Main admin functionality
 */
class AdminBundle {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.isInitialized = false;
        this.modules = {
            dataInspector: null,
            userManager: null,
            systemMonitor: null,
            cacheManager: null,
            databaseInspector: null,
            adminDashboard: null,
            adminSidebar: null,
            adminHeader: null,
            adminAuth: null,
            adminLogger: null,
            adminMetrics: null
        };
        
        this.init();
    }
    
    /**
     * Initialize admin bundle
     */
    async init() {
        try {
            // Check admin permissions
            if (!await this.checkAdminPermissions()) {
                this.logger.warn('Admin permissions not found');
                return;
            }
            
            // Initialize admin modules
            await this.initializeModules();
            
            // Set up admin UI
            this.setupAdminUI();
            
            // Initialize admin features
            this.initializeAdminFeatures();
            
            this.isInitialized = true;
            this.logger.info('Admin bundle initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize admin bundle:', error);
        }
    }
    
    /**
     * Check admin permissions
     * @returns {Promise<boolean>} Admin permission status
     */
    async checkAdminPermissions() {
        try {
            // Check if user has admin role
            const user = await this.getCurrentUser();
            return user && user.role === 'admin';
        } catch (error) {
            this.logger.error('Failed to check admin permissions:', error);
            return false;
        }
    }
    
    /**
     * Get current user
     * @returns {Promise<Object>} Current user
     */
    async getCurrentUser() {
        // This would typically fetch from an API
        const userData = localStorage.getItem('ignite_fitness_user');
        return userData ? JSON.parse(userData) : null;
    }
    
    /**
     * Initialize admin modules
     */
    async initializeModules() {
        // Initialize core admin modules
        this.modules.adminAuth = new AdminAuth();
        this.modules.adminLogger = new AdminLogger();
        this.modules.adminMetrics = new AdminMetrics();
        
        // Initialize data management modules
        this.modules.dataInspector = new DataInspector();
        this.modules.userManager = new UserManager();
        this.modules.systemMonitor = new SystemMonitor();
        this.modules.cacheManager = new CacheManager();
        this.modules.databaseInspector = new DatabaseInspector();
        
        // Initialize UI modules
        this.modules.adminDashboard = new AdminDashboard();
        this.modules.adminSidebar = new AdminSidebar();
        this.modules.adminHeader = new AdminHeader();
    }
    
    /**
     * Setup admin UI
     */
    setupAdminUI() {
        // Create admin container
        const adminContainer = document.createElement('div');
        adminContainer.id = 'admin-container';
        adminContainer.className = 'admin-container';
        adminContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--color-surface);
            z-index: 10000;
            display: none;
        `;
        
        // Add admin header
        const header = this.modules.adminHeader.render();
        adminContainer.appendChild(header);
        
        // Add admin sidebar
        const sidebar = this.modules.adminSidebar.render();
        adminContainer.appendChild(sidebar);
        
        // Add admin dashboard
        const dashboard = this.modules.adminDashboard.render();
        adminContainer.appendChild(dashboard);
        
        document.body.appendChild(adminContainer);
        
        // Set up admin toggle
        this.setupAdminToggle();
    }
    
    /**
     * Setup admin toggle
     */
    setupAdminToggle() {
        // Create admin toggle button (hidden by default)
        const toggleButton = document.createElement('button');
        toggleButton.id = 'admin-toggle';
        toggleButton.className = 'admin-toggle';
        toggleButton.innerHTML = '⚙️';
        toggleButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--color-primary);
            color: white;
            border: none;
            font-size: 20px;
            cursor: pointer;
            z-index: 9999;
            display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        toggleButton.addEventListener('click', () => {
            this.toggleAdminPanel();
        });
        
        document.body.appendChild(toggleButton);
        
        // Show toggle button for admin users
        if (this.isInitialized) {
            toggleButton.style.display = 'block';
        }
    }
    
    /**
     * Toggle admin panel
     */
    toggleAdminPanel() {
        const adminContainer = document.getElementById('admin-container');
        if (adminContainer) {
            const isVisible = adminContainer.style.display !== 'none';
            adminContainer.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                this.modules.adminDashboard.refresh();
            }
        }
    }
    
    /**
     * Initialize admin features
     */
    initializeAdminFeatures() {
        // Set up real-time monitoring
        this.setupRealTimeMonitoring();
        
        // Set up admin shortcuts
        this.setupAdminShortcuts();
        
        // Set up admin notifications
        this.setupAdminNotifications();
    }
    
    /**
     * Setup real-time monitoring
     */
    setupRealTimeMonitoring() {
        // Monitor system performance
        setInterval(() => {
            this.modules.systemMonitor.collectMetrics();
        }, 5000);
        
        // Monitor user activity
        setInterval(() => {
            this.modules.userManager.updateActivityStats();
        }, 10000);
        
        // Monitor cache performance
        setInterval(() => {
            this.modules.cacheManager.updateCacheStats();
        }, 30000);
    }
    
    /**
     * Setup admin shortcuts
     */
    setupAdminShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl+Shift+A to toggle admin panel
            if (event.ctrlKey && event.shiftKey && event.key === 'A') {
                event.preventDefault();
                this.toggleAdminPanel();
            }
            
            // Ctrl+Shift+D to open data inspector
            if (event.ctrlKey && event.shiftKey && event.key === 'D') {
                event.preventDefault();
                this.modules.dataInspector.open();
            }
            
            // Ctrl+Shift+S to open system monitor
            if (event.ctrlKey && event.shiftKey && event.key === 'S') {
                event.preventDefault();
                this.modules.systemMonitor.open();
            }
        });
    }
    
    /**
     * Setup admin notifications
     */
    setupAdminNotifications() {
        // Listen for system events
        window.addEventListener('admin:system:error', (event) => {
            this.modules.adminLogger.logError(event.detail);
        });
        
        window.addEventListener('admin:user:activity', (event) => {
            this.modules.userManager.logActivity(event.detail);
        });
        
        window.addEventListener('admin:cache:update', (event) => {
            this.modules.cacheManager.handleCacheUpdate(event.detail);
        });
    }
    
    /**
     * Get admin module
     * @param {string} moduleName - Module name
     * @returns {Object} Admin module
     */
    getModule(moduleName) {
        return this.modules[moduleName];
    }
    
    /**
     * Get admin statistics
     * @returns {Object} Admin statistics
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            moduleCount: Object.keys(this.modules).length,
            activeModules: Object.values(this.modules).filter(m => m !== null).length,
            systemMetrics: this.modules.systemMonitor?.getMetrics() || {},
            userStats: this.modules.userManager?.getStats() || {},
            cacheStats: this.modules.cacheManager?.getStats() || {}
        };
    }
    
    /**
     * Destroy admin bundle
     */
    destroy() {
        // Clean up modules
        Object.values(this.modules).forEach(module => {
            if (module && typeof module.destroy === 'function') {
                module.destroy();
            }
        });
        
        // Remove admin UI
        const adminContainer = document.getElementById('admin-container');
        if (adminContainer) {
            adminContainer.remove();
        }
        
        const toggleButton = document.getElementById('admin-toggle');
        if (toggleButton) {
            toggleButton.remove();
        }
        
        this.isInitialized = false;
        this.logger.info('Admin bundle destroyed');
    }
}

// Initialize admin bundle
const adminBundle = new AdminBundle();

// Export for global access
window.AdminBundle = adminBundle;
