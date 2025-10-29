/**
 * Auth Debug Panel - Development-only debug tools
 * Only available when NODE_ENV !== 'production'
 */

(function() {
    'use strict';
    
    // Only load in development
    const isProduction = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
    if (isProduction) return;
    
    class AuthDebugPanel {
        constructor() {
            this.panel = null;
            this.isVisible = false;
        }
        
        /**
         * Show debug panel
         */
        show() {
            if (this.panel) {
                this.panel.style.display = 'block';
                this.isVisible = true;
                this.update();
                return;
            }
            
            this.panel = document.createElement('div');
            this.panel.id = 'auth-debug-panel';
            this.panel.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                width: 300px;
                background: white;
                border: 2px solid #4299e1;
                border-radius: 8px;
                padding: 1rem;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                font-family: monospace;
                font-size: 12px;
                max-height: 400px;
                overflow-y: auto;
            `;
            
            this.update();
            document.body.appendChild(this.panel);
            this.isVisible = true;
        }
        
        /**
         * Update debug panel content
         */
        update() {
            if (!this.panel) return;
            
            const authState = window.AuthManager?.getAuthState() || { isAuthenticated: false, token: null, user: null };
            const router = window.Router;
            const currentRoute = router?.currentRoute || window.location.hash || 'none';
            const lastRedirect = router?.lastRedirectReason || 'none';
            
            this.panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                    <strong style="color: #2d3748;">Auth Debug Panel</strong>
                    <button onclick="window.__IGNITE__.auth.hide()" style="background: #ef4444; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 10px;">✕</button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <div><strong>isAuthenticated:</strong> ${authState.isAuthenticated ? '✅ true' : '❌ false'}</div>
                    <div><strong>Token present:</strong> ${authState.token ? '✅ yes' : '❌ no'}</div>
                    <div><strong>Current route:</strong> ${currentRoute}</div>
                    <div><strong>Last redirect:</strong> ${lastRedirect}</div>
                    <div><strong>User:</strong> ${authState.user?.username || 'null'}</div>
                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e2e8f0;">
                        <button onclick="window.Router?.navigate('#/login')" style="background: #4299e1; color: white; border: none; padding: 0.5rem; border-radius: 4px; cursor: pointer; width: 100%; font-weight: 600;">Force Route: #/login</button>
                    </div>
                    <div style="margin-top: 0.25rem;">
                        <button onclick="window.AuthManager?.clearStorage(); window.location.reload();" style="background: #ef4444; color: white; border: none; padding: 0.5rem; border-radius: 4px; cursor: pointer; width: 100%; font-weight: 600;">Clear Auth & Reload</button>
                    </div>
                </div>
            `;
        }
        
        /**
         * Hide debug panel
         */
        hide() {
            if (this.panel) {
                this.panel.style.display = 'none';
                this.isVisible = false;
            }
        }
        
        /**
         * Toggle debug panel
         */
        toggle() {
            if (this.isVisible) {
                this.hide();
            } else {
                this.show();
            }
        }
    }
    
    // Initialize debug panel
    const debugPanel = new AuthDebugPanel();
    
    // Expose via window.__IGNITE__.auth
    if (!window.__IGNITE__) {
        window.__IGNITE__ = {};
    }
    window.__IGNITE__.auth = {
        debugPanel: () => debugPanel.show(),
        hide: () => debugPanel.hide(),
        toggle: () => debugPanel.toggle(),
        update: () => debugPanel.update()
    };
    
    // Hotkey "L" to force route to login
    document.addEventListener('keydown', (e) => {
        if (e.key === 'L' && e.shiftKey && e.altKey) {
            e.preventDefault();
            if (window.Router) {
                window.Router.navigate('#/login');
            }
        }
        
        // Ctrl+Shift+D to toggle debug panel
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            debugPanel.toggle();
        }
    });
    
    // Auto-update panel when auth state changes
    if (window.EventBus) {
        window.EventBus.on('user:login', () => debugPanel.update());
        window.EventBus.on('user:logout', () => debugPanel.update());
    }
    
    // Log availability
    console.log('%c[DEV] Auth Debug Panel loaded. Use: window.__IGNITE__.auth.debugPanel()', 'color: #4299e1; font-weight: bold;');
    console.log('%c[DEV] Hotkeys: Alt+Shift+L = Force #/login, Ctrl+Shift+D = Toggle debug panel', 'color: #4299e1;');
    
})();

