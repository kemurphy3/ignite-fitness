/**
 * DataInspector - Admin tool for inspecting and managing application data
 * Provides deep insights into user data, cache performance, and system state
 */
class DataInspector {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.isOpen = false;
        this.currentView = 'overview';
        this.data = {
            users: [],
            activities: [],
            workouts: [],
            cache: {},
            system: {}
        };
        
        this.init();
    }
    
    /**
     * Initialize data inspector
     */
    init() {
        this.logger.debug('DataInspector initialized');
    }
    
    /**
     * Open data inspector
     */
    open() {
        if (this.isOpen) return;
        
        this.createInspectorUI();
        this.loadData();
        this.isOpen = true;
        
        this.logger.info('DataInspector opened');
    }
    
    /**
     * Close data inspector
     */
    close() {
        if (!this.isOpen) return;
        
        const inspector = document.getElementById('data-inspector');
        if (inspector) {
            inspector.remove();
        }
        
        this.isOpen = false;
        this.logger.info('DataInspector closed');
    }
    
    /**
     * Create inspector UI
     */
    createInspectorUI() {
        const inspector = document.createElement('div');
        inspector.id = 'data-inspector';
        inspector.className = 'data-inspector';
        inspector.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const modal = document.createElement('div');
        modal.className = 'data-inspector-modal';
        modal.style.cssText = `
            background: var(--color-surface);
            border-radius: 12px;
            width: 90%;
            height: 90%;
            max-width: 1200px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        `;
        
        // Header
        const header = this.createHeader();
        modal.appendChild(header);
        
        // Content
        const content = this.createContent();
        modal.appendChild(content);
        
        inspector.appendChild(modal);
        document.body.appendChild(inspector);
        
        // Close on backdrop click
        inspector.addEventListener('click', (e) => {
            if (e.target === inspector) {
                this.close();
            }
        });
    }
    
    /**
     * Create header
     * @returns {HTMLElement} Header element
     */
    createHeader() {
        const header = document.createElement('div');
        header.className = 'data-inspector-header';
        header.style.cssText = `
            padding: 20px;
            border-bottom: 1px solid var(--color-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const title = document.createElement('h2');
        title.textContent = 'Data Inspector';
        title.style.cssText = `
            margin: 0;
            color: var(--color-text);
            font-size: 24px;
            font-weight: 600;
        `;
        
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✕';
        closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: var(--color-text-secondary);
            padding: 8px;
            border-radius: 4px;
        `;
        closeButton.addEventListener('click', () => this.close());
        
        header.appendChild(title);
        header.appendChild(closeButton);
        
        return header;
    }
    
    /**
     * Create content
     * @returns {HTMLElement} Content element
     */
    createContent() {
        const content = document.createElement('div');
        content.className = 'data-inspector-content';
        content.style.cssText = `
            flex: 1;
            display: flex;
            overflow: hidden;
        `;
        
        // Sidebar
        const sidebar = this.createSidebar();
        content.appendChild(sidebar);
        
        // Main content
        const main = this.createMainContent();
        content.appendChild(main);
        
        return content;
    }
    
    /**
     * Create sidebar
     * @returns {HTMLElement} Sidebar element
     */
    createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.className = 'data-inspector-sidebar';
        sidebar.style.cssText = `
            width: 250px;
            background: var(--color-surface-secondary);
            border-right: 1px solid var(--color-border);
            padding: 20px;
            overflow-y: auto;
        `;
        
        const navItems = [
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'users', label: 'Users', icon: '👥' },
            { id: 'activities', label: 'Activities', icon: '🏃' },
            { id: 'workouts', label: 'Workouts', icon: '💪' },
            { id: 'cache', label: 'Cache', icon: '🗄️' },
            { id: 'system', label: 'System', icon: '⚙️' }
        ];
        
        navItems.forEach(item => {
            const navItem = document.createElement('div');
            navItem.className = 'nav-item';
            navItem.dataset.view = item.id;
            navItem.style.cssText = `
                padding: 12px 16px;
                margin-bottom: 4px;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 12px;
                transition: background-color 0.2s ease;
            `;
            
            navItem.innerHTML = `
                <span style="font-size: 18px;">${item.icon}</span>
                <span style="font-weight: 500;">${item.label}</span>
            `;
            
            navItem.addEventListener('click', () => {
                this.switchView(item.id);
            });
            
            sidebar.appendChild(navItem);
        });
        
        return sidebar;
    }
    
    /**
     * Create main content
     * @returns {HTMLElement} Main content element
     */
    createMainContent() {
        const main = document.createElement('div');
        main.className = 'data-inspector-main';
        main.style.cssText = `
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        `;
        
        // Overview content
        const overview = this.createOverviewContent();
        main.appendChild(overview);
        
        return main;
    }
    
    /**
     * Create overview content
     * @returns {HTMLElement} Overview content
     */
    createOverviewContent() {
        const overview = document.createElement('div');
        overview.id = 'overview-content';
        overview.className = 'view-content';
        overview.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        `;
        
        // Stats cards
        const statsCards = [
            { title: 'Total Users', value: '0', icon: '👥', color: '#3b82f6' },
            { title: 'Active Sessions', value: '0', icon: '🟢', color: '#10b981' },
            { title: 'Cache Hit Rate', value: '0%', icon: '🎯', color: '#f59e0b' },
            { title: 'System Load', value: '0%', icon: '⚡', color: '#ef4444' }
        ];
        
        statsCards.forEach(card => {
            const cardElement = this.createStatsCard(card);
            overview.appendChild(cardElement);
        });
        
        return overview;
    }
    
    /**
     * Create stats card
     * @param {Object} card - Card data
     * @returns {HTMLElement} Stats card
     */
    createStatsCard(card) {
        const cardElement = document.createElement('div');
        cardElement.className = 'stats-card';
        cardElement.style.cssText = `
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            border-radius: 12px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
        `;
        
        const icon = document.createElement('div');
        icon.style.cssText = `
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: ${card.color}20;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        `;
        icon.textContent = card.icon;
        
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1;
        `;
        
        const title = document.createElement('div');
        title.textContent = card.title;
        title.style.cssText = `
            font-size: 14px;
            color: var(--color-text-secondary);
            margin-bottom: 4px;
        `;
        
        const value = document.createElement('div');
        value.textContent = card.value;
        value.style.cssText = `
            font-size: 24px;
            font-weight: 600;
            color: var(--color-text);
        `;
        
        content.appendChild(title);
        content.appendChild(value);
        
        cardElement.appendChild(icon);
        cardElement.appendChild(content);
        
        return cardElement;
    }
    
    /**
     * Switch view
     * @param {string} viewId - View ID
     */
    switchView(viewId) {
        this.currentView = viewId;
        
        // Update sidebar selection
        document.querySelectorAll('.nav-item').forEach(item => {
            item.style.backgroundColor = item.dataset.view === viewId ? 
                'var(--color-primary-light)' : 'transparent';
        });
        
        // Update main content
        const main = document.querySelector('.data-inspector-main');
        main.innerHTML = '';
        
        let content;
        switch (viewId) {
            case 'overview':
                content = this.createOverviewContent();
                break;
            case 'users':
                content = this.createUsersContent();
                break;
            case 'activities':
                content = this.createActivitiesContent();
                break;
            case 'workouts':
                content = this.createWorkoutsContent();
                break;
            case 'cache':
                content = this.createCacheContent();
                break;
            case 'system':
                content = this.createSystemContent();
                break;
        }
        
        main.appendChild(content);
    }
    
    /**
     * Create users content
     * @returns {HTMLElement} Users content
     */
    createUsersContent() {
        const content = document.createElement('div');
        content.id = 'users-content';
        content.className = 'view-content';
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; color: var(--color-text);">User Management</h3>
                <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                    <button class="btn btn-primary">Add User</button>
                    <button class="btn btn-secondary">Export Users</button>
                    <button class="btn btn-secondary">Import Users</button>
                </div>
            </div>
            <div id="users-table" style="background: var(--color-surface); border-radius: 8px; overflow: hidden;">
                <!-- Users table will be populated here -->
            </div>
        `;
        
        return content;
    }
    
    /**
     * Create activities content
     * @returns {HTMLElement} Activities content
     */
    createActivitiesContent() {
        const content = document.createElement('div');
        content.id = 'activities-content';
        content.className = 'view-content';
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; color: var(--color-text);">Activity Data</h3>
                <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                    <button class="btn btn-primary">Refresh Data</button>
                    <button class="btn btn-secondary">Export Activities</button>
                    <button class="btn btn-secondary">Clear Cache</button>
                </div>
            </div>
            <div id="activities-table" style="background: var(--color-surface); border-radius: 8px; overflow: hidden;">
                <!-- Activities table will be populated here -->
            </div>
        `;
        
        return content;
    }
    
    /**
     * Create workouts content
     * @returns {HTMLElement} Workouts content
     */
    createWorkoutsContent() {
        const content = document.createElement('div');
        content.id = 'workouts-content';
        content.className = 'view-content';
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; color: var(--color-text);">Workout Plans</h3>
                <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                    <button class="btn btn-primary">Generate Plan</button>
                    <button class="btn btn-secondary">Export Plans</button>
                    <button class="btn btn-secondary">Clear Cache</button>
                </div>
            </div>
            <div id="workouts-table" style="background: var(--color-surface); border-radius: 8px; overflow: hidden;">
                <!-- Workouts table will be populated here -->
            </div>
        `;
        
        return content;
    }
    
    /**
     * Create cache content
     * @returns {HTMLElement} Cache content
     */
    createCacheContent() {
        const content = document.createElement('div');
        content.id = 'cache-content';
        content.className = 'view-content';
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; color: var(--color-text);">Cache Management</h3>
                <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                    <button class="btn btn-primary">Clear All Cache</button>
                    <button class="btn btn-secondary">Export Cache</button>
                    <button class="btn btn-secondary">Import Cache</button>
                </div>
            </div>
            <div id="cache-table" style="background: var(--color-surface); border-radius: 8px; overflow: hidden;">
                <!-- Cache table will be populated here -->
            </div>
        `;
        
        return content;
    }
    
    /**
     * Create system content
     * @returns {HTMLElement} System content
     */
    createSystemContent() {
        const content = document.createElement('div');
        content.id = 'system-content';
        content.className = 'view-content';
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; color: var(--color-text);">System Information</h3>
                <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                    <button class="btn btn-primary">Refresh Metrics</button>
                    <button class="btn btn-secondary">Export Logs</button>
                    <button class="btn btn-secondary">System Health</button>
                </div>
            </div>
            <div id="system-table" style="background: var(--color-surface); border-radius: 8px; overflow: hidden;">
                <!-- System table will be populated here -->
            </div>
        `;
        
        return content;
    }
    
    /**
     * Load data
     */
    async loadData() {
        try {
            // Load users
            this.data.users = await this.loadUsers();
            
            // Load activities
            this.data.activities = await this.loadActivities();
            
            // Load workouts
            this.data.workouts = await this.loadWorkouts();
            
            // Load cache data
            this.data.cache = await this.loadCacheData();
            
            // Load system data
            this.data.system = await this.loadSystemData();
            
            this.logger.info('Data loaded successfully');
            
        } catch (error) {
            this.logger.error('Failed to load data:', error);
        }
    }
    
    /**
     * Load users
     * @returns {Promise<Array>} Users data
     */
    async loadUsers() {
        // This would typically fetch from an API
        return [];
    }
    
    /**
     * Load activities
     * @returns {Promise<Array>} Activities data
     */
    async loadActivities() {
        // This would typically fetch from an API
        return [];
    }
    
    /**
     * Load workouts
     * @returns {Promise<Array>} Workouts data
     */
    async loadWorkouts() {
        // This would typically fetch from an API
        return [];
    }
    
    /**
     * Load cache data
     * @returns {Promise<Object>} Cache data
     */
    async loadCacheData() {
        // This would typically fetch from cache
        return {};
    }
    
    /**
     * Load system data
     * @returns {Promise<Object>} System data
     */
    async loadSystemData() {
        // This would typically fetch from system
        return {};
    }
    
    /**
     * Get inspector data
     * @returns {Object} Inspector data
     */
    getData() {
        return this.data;
    }
    
    /**
     * Destroy data inspector
     */
    destroy() {
        this.close();
        this.logger.info('DataInspector destroyed');
    }
}

// Export for use in other modules
window.DataInspector = DataInspector;