/**
 * PersistentHeader - Persistent app header with title and connection status
 * Always visible at top of app with season phase pill
 */
class PersistentHeader {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.isOnline = navigator.onLine;
        this.connectionStatus = 'online';
        
        this.setupNetworkListeners();
        this.createHeader();
    }

    /**
     * Setup network connection listeners
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.connectionStatus = 'online';
            this.updateConnectionStatus();
            this.logger.info('Connection restored');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.connectionStatus = 'offline';
            this.updateConnectionStatus();
            this.logger.warn('Connection lost');
        });
    }

    /**
     * Create persistent header
     */
    createHeader() {
        // Remove existing header if present
        const existing = document.getElementById('persistent-header');
        if (existing) existing.remove();

        const header = document.createElement('header');
        header.id = 'persistent-header';
        header.className = 'persistent-header';
        header.innerHTML = this.generateHeaderHTML();

        // Insert at beginning of body or app container
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.insertBefore(header, appContainer.firstChild);
        } else {
            document.body.insertBefore(header, document.body.firstChild);
        }

        // Update connection status
        this.updateConnectionStatus();
        // Listen to sync queue updates to show a delayed sync indicator
        if (window.StorageManager && window.EventBus) {
            let syncTimer = null;
            window.EventBus.on(window.EventBus.TOPICS?.SYNC_QUEUE_UPDATED || 'sync:queue', ({ queueLength }) => {
                const header = document.getElementById('persistent-header');
                if (!header) return;
                const right = header.querySelector('.header-right');
                if (!right) return;

                const existing = right.querySelector('.sync-indicator');
                const show = queueLength > 0;

                if (show) {
                    if (syncTimer) clearTimeout(syncTimer);
                    // Show after 500ms
                    syncTimer = setTimeout(() => {
                        if (right.querySelector('.sync-indicator')) return;
                        const el = document.createElement('div');
                        el.className = 'sync-indicator';
                        el.style.cssText = 'display:flex;align-items:center;gap:6px;margin-left:8px;color:#9CA3AF;font-size:12px;';
                        el.innerHTML = '<span class="if-spinner" style="width:14px;height:14px;border-width:2px"></span><span>Syncing…</span>';
                        right.appendChild(el);
                        window.LiveRegionManager?.announce('Sync started', 'polite');
                    }, 500);
                } else {
                    if (syncTimer) clearTimeout(syncTimer);
                    if (existing) existing.remove();
                    window.LiveRegionManager?.announce('Sync complete', 'polite');
                }
            });
        }
        
        // Update season phase
        this.updateSeasonPhase();
        
        // Listen for phase changes
        window.addEventListener('phase:changed', () => this.updateSeasonPhase());
        
        // Update sign-in button on auth state changes (initially and on events)
        this.updateSignInButton();
        if (window.EventBus) {
            window.EventBus.on('user:login', () => this.updateSignInButton());
            window.EventBus.on('user:logout', () => this.updateSignInButton());
        }

        // Wire Simple Mode toggle
        const modeBtn = document.getElementById('if-mode-toggle');
        if (modeBtn) {
            modeBtn.onclick = () => {
                const newState = window.SimpleModeManager?.toggle();
                if (typeof newState === 'boolean') {
                    modeBtn.setAttribute('aria-pressed', newState ? 'true' : 'false');
                    modeBtn.textContent = newState ? 'Simple Mode' : 'Advanced Mode';
                    window.LiveRegionManager?.announce(newState ? 'Simple Mode enabled' : 'Advanced Mode enabled', 'polite');
                }
            };
        }
    }

    /**
     * Generate header HTML
     * @returns {string} Header HTML
     */
    generateHeaderHTML() {
        // Check auth state for Sign In button
        const authState = window.AuthManager?.getAuthState() || { isAuthenticated: false };
        const signInButton = !authState.isAuthenticated 
            ? '<button onclick="window.Router?.navigate(\'#/login\')" class="header-sign-in-btn" style="padding: 0.5rem 1rem; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem; font-weight: 600;">Sign In</button>'
            : '';
        
        const simpleEnabled = authState.isAuthenticated ? (window.SimpleModeManager?.isEnabled() ?? true) : (window.SimpleModeManager?.isEnabled() ?? true);
        const simpleLabel = simpleEnabled ? 'Simple Mode' : 'Advanced Mode';
        return `
            <div class="header-content">
                <div class="header-left">
                    <h1 class="app-title">IgniteFitness</h1>
                    <span class="connection-indicator" id="connection-status">
                        <span class="status-dot"></span>
                        <span class="status-text">Online</span>
                    </span>
                </div>
                
                <div class="header-right">
                    ${signInButton}
                    <button class="mode-toggle" id="if-mode-toggle" aria-pressed="${simpleEnabled ? 'true' : 'false'}" title="Click to toggle between Simple and Advanced modes">
                        ${simpleLabel}
                    </button>
                    <div class="season-phase-pill-container" id="season-phase-container">
                        ${this.renderSeasonPhasePill()}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render season phase pill
     * @returns {string} Season phase HTML
     */
    renderSeasonPhasePill() {
        const phase = window.SeasonPhase?.getCurrentPhase();
        
        if (!phase || !phase.config) {
            return '<div class="season-phase-pill"><span class="phase-emoji">🏔️</span><span class="phase-label">Off-Season</span></div>';
        }

        const config = phase.config;
        
        return `
            <div class="season-phase-pill" style="--phase-color: ${config.color}">
                <span class="phase-emoji">${config.emoji}</span>
                <span class="phase-label">${config.label}</span>
            </div>
        `;
    }

    /**
     * Update connection status display
     */
    updateConnectionStatus() {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) return;

        const statusDot = statusEl.querySelector('.status-dot');
        const statusText = statusEl.querySelector('.status-text');

        if (this.connectionStatus === 'online') {
            statusEl.className = 'connection-indicator online';
            statusDot.style.background = '#10b981';
            statusText.textContent = 'Online';
        } else {
            statusEl.className = 'connection-indicator offline';
            statusDot.style.background = '#ef4444';
            statusText.textContent = 'Offline';
            
            // Show sync icon if offline
            statusEl.innerHTML = `
                <span class="status-dot"></span>
                <span class="status-icon">📡</span>
                <span class="status-text">Offline - Sync pending</span>
            `;
        }
    }

    /**
     * Update season phase pill
     */
    updateSeasonPhase() {
        const container = document.getElementById('season-phase-container');
        if (!container) return;

        container.innerHTML = this.renderSeasonPhasePill();
    }

    /**
     * Update Sign In button visibility
     */
    updateSignInButton() {
        const header = document.getElementById('persistent-header');
        if (!header) return;
        
        const authState = window.AuthManager?.getAuthState() || { isAuthenticated: false };
        const headerRight = header.querySelector('.header-right');
        if (!headerRight) return;
        
        const existingBtn = headerRight.querySelector('.header-sign-in-btn');
        if (authState.isAuthenticated && existingBtn) {
            existingBtn.remove();
        } else if (!authState.isAuthenticated && !existingBtn) {
            const signInBtn = document.createElement('button');
            signInBtn.className = 'header-sign-in-btn';
            signInBtn.textContent = 'Sign In';
            signInBtn.style.cssText = 'padding: 0.5rem 1rem; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem; font-weight: 600;';
            signInBtn.onclick = () => window.Router?.navigate('#/login');
            headerRight.insertBefore(signInBtn, headerRight.firstChild);
        }
    }

    /**
     * Show notification in header
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     */
    showNotification(message, type = 'info') {
        const existing = document.querySelector('.header-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `header-notification notification-${type}`;
        notification.textContent = message;

        const header = document.getElementById('persistent-header');
        if (header) {
            header.appendChild(notification);
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

// Create global instance
window.PersistentHeader = new PersistentHeader();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersistentHeader;
}
