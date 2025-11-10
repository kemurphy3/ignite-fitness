/**
 * IntegrationPanel - Settings panel for managing external integrations
 * Provides secure disconnect functionality for Strava and other services
 */

class IntegrationPanel extends BaseComponent {
    constructor(options = {}) {
        super(options);
        
        this.container = options.container;
        this.userId = options.userId;
        this.integrations = new Map();
        
        this.logger = window.SafeLogger || console;
        
        this.init();
    }
    
    /**
     * Initialize integration panel
     */
    init() {
        this.loadIntegrations();
        this.render();
        this.bindEvents();
        
        this.logger.info('IntegrationPanel initialized');
    }
    
    /**
     * Load user integrations
     */
    async loadIntegrations() {
        try {
            const response = await fetch('/.netlify/functions/get-integrations', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.integrations = new Map(data.integrations.map(integration => [
                    integration.provider,
                    integration
                ]));
            }
            
        } catch (error) {
            this.logger.error('Failed to load integrations:', error);
        }
    }
    
    /**
     * Render integration panel
     */
    render() {
        this.container.innerHTML = `
            <div class="integration-panel">
                <div class="panel-header">
                    <h3>Connected Services</h3>
                    <p>Manage your external fitness data integrations</p>
                </div>
                
                <div class="integrations-list">
                    ${this.renderIntegrationList()}
                </div>
                
                <div class="integration-help">
                    <h4>About Integrations</h4>
                    <p>Connect your fitness apps to automatically import workout data and get personalized recommendations.</p>
                    <ul>
                        <li>Data is encrypted and stored securely</li>
                        <li>You can disconnect at any time</li>
                        <li>Disconnecting will remove all imported data</li>
                    </ul>
                </div>
            </div>
        `;
    }
    
    /**
     * Render integration list
     * @returns {string} HTML for integration list
     */
    renderIntegrationList() {
        const integrations = [
            {
                provider: 'strava',
                name: 'Strava',
                description: 'Import your running and cycling activities',
                icon: '🏃',
                connected: this.integrations.has('strava'),
                data: this.integrations.get('strava')
            }
        ];
        
        return integrations.map(integration => `
            <div class="integration-item ${integration.connected ? 'connected' : 'disconnected'}">
                <div class="integration-info">
                    <div class="integration-icon">${integration.icon}</div>
                    <div class="integration-details">
                        <h4>${integration.name}</h4>
                        <p>${integration.description}</p>
                        ${integration.connected ? this.renderConnectionDetails(integration.data) : ''}
                    </div>
                </div>
                
                <div class="integration-actions">
                    ${integration.connected ? 
                        this.renderDisconnectButton(integration) : 
                        this.renderConnectButton(integration)
                    }
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Render connection details
     * @param {Object} data - Integration data
     * @returns {string} HTML for connection details
     */
    renderConnectionDetails(data) {
        const connectedDate = new Date(data.created_at).toLocaleDateString();
        const lastSync = data.last_sync ? new Date(data.last_sync).toLocaleDateString() : 'Never';
        
        return `
            <div class="connection-details">
                <div class="detail-item">
                    <span class="detail-label">Connected:</span>
                    <span class="detail-value">${connectedDate}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Last Sync:</span>
                    <span class="detail-value">${lastSync}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Activities:</span>
                    <span class="detail-value">${data.activity_count || 0}</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Render connect button
     * @param {Object} integration - Integration data
     * @returns {string} HTML for connect button
     */
    renderConnectButton(integration) {
        return `
            <button class="btn btn-primary connect-btn" data-provider="${integration.provider}">
                Connect ${integration.name}
            </button>
        `;
    }
    
    /**
     * Render disconnect button
     * @param {Object} integration - Integration data
     * @returns {string} HTML for disconnect button
     */
    renderDisconnectButton(integration) {
        return `
            <button class="btn btn-danger disconnect-btn" data-provider="${integration.provider}">
                Disconnect
            </button>
        `;
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Connect buttons
        this.container.querySelectorAll('.connect-btn').forEach(btn => {
            this.addEventListener(btn, 'click', (event) => {
                const provider = event.target.dataset.provider;
                this.handleConnect(provider);
            });
        });
        
        // Disconnect buttons
        this.container.querySelectorAll('.disconnect-btn').forEach(btn => {
            this.addEventListener(btn, 'click', (event) => {
                const provider = event.target.dataset.provider;
                this.handleDisconnect(provider);
            });
        });
    }
    
    /**
     * Handle connect action
     * @param {string} provider - Integration provider
     */
    async handleConnect(provider) {
        try {
            if (provider === 'strava') {
                await this.connectStrava();
            }
        } catch (error) {
            this.logger.error('Connect failed:', error);
            this.showError('Failed to connect to ' + provider);
        }
    }
    
    /**
     * Handle disconnect action
     * @param {string} provider - Integration provider
     */
    async handleDisconnect(provider) {
        try {
            // Show confirmation dialog
            const confirmed = await this.showDisconnectConfirmation(provider);
            if (!confirmed) return;
            
            if (provider === 'strava') {
                await this.disconnectStrava();
            }
            
            // Reload integrations
            await this.loadIntegrations();
            this.render();
            this.bindEvents();
            
        } catch (error) {
            this.logger.error('Disconnect failed:', error);
            this.showError('Failed to disconnect from ' + provider);
        }
    }
    
    /**
     * Connect to Strava
     */
    async connectStrava() {
        const stravaAuthUrl = this.buildStravaAuthUrl();
        if (!stravaAuthUrl) {
            this.logger.warn('Strava client configuration missing, aborting OAuth flow');
            this.showError('Strava configuration required. Please set STRAVA_CLIENT_ID in your environment.');
            return;
        }
        window.open(stravaAuthUrl, '_blank', 'width=600,height=700');
        
        // Listen for auth completion
        this.addEventListener(window, 'message', (event) => {
            if (event.data.type === 'strava_auth_complete') {
                this.handleStravaAuthComplete(event.data);
            }
        });
    }
    
    getStravaIntegrationConfig() {
        try {
            const integrations = typeof window !== 'undefined' && window.configLoader?.get?.('integrations')
                ? window.configLoader.get('integrations')
                : {};
            const strava = integrations?.strava || {};
            const fallbackRedirect = typeof window !== 'undefined'
                ? `${window.location.origin}/auth/strava/callback`
                : '';
            return {
                clientId: strava.clientId || '',
                redirectUri: strava.redirectUri || fallbackRedirect,
                scope: strava.scope || 'read,activity:read'
            };
        } catch (error) {
            this.logger.warn('Failed to resolve Strava integration config', error);
            const fallbackRedirect = typeof window !== 'undefined'
                ? `${window.location.origin}/auth/strava/callback`
                : '';
            return {
                clientId: '',
                redirectUri: fallbackRedirect,
                scope: 'read,activity:read'
            };
        }
    }
    
    /**
     * Build Strava authorization URL
     * @returns {string|null} Authorization URL or null when config missing
     */
    buildStravaAuthUrl() {
        const { clientId, redirectUri, scope } = this.getStravaIntegrationConfig();
        if (!clientId) {
            return null;
        }
        const encodedRedirect = encodeURIComponent(redirectUri);
        const encodedScope = encodeURIComponent(scope);
        const state = this.generateState();
        
        return `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodedRedirect}&response_type=code&scope=${encodedScope}&state=${state}`;
    }
    
    /**
     * Handle Strava auth completion
     * @param {Object} data - Auth data
     */
    async handleStravaAuthComplete(data) {
        try {
            const response = await fetch('/.netlify/functions/strava-oauth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: data.code,
                    state: data.state
                })
            });
            
            if (response.ok) {
                this.showSuccess('Successfully connected to Strava!');
                await this.loadIntegrations();
                this.render();
                this.bindEvents();
            } else {
                throw new Error('Auth failed');
            }
            
        } catch (error) {
            this.logger.error('Strava auth completion failed:', error);
            this.showError('Failed to complete Strava connection');
        }
    }
    
    /**
     * Disconnect from Strava
     */
    async disconnectStrava() {
        const integration = this.integrations.get('strava');
        if (!integration) {
            throw new Error('Strava integration not found');
        }
        
        const response = await fetch('/.netlify/functions/strava-revoke-token', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.getAuthToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                access_token: integration.access_token,
                refresh_token: integration.refresh_token,
                user_id: this.userId
            })
        });
        
        if (!response.ok) {
            throw new Error('Token revocation failed');
        }
        
        this.showSuccess('Successfully disconnected from Strava');
    }
    
    /**
     * Show disconnect confirmation
     * @param {string} provider - Provider name
     * @returns {Promise<boolean>} Confirmation result
     */
    async showDisconnectConfirmation(provider) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'disconnect-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            modal.innerHTML = `
                <div style="
                    background: var(--color-surface);
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin: 0 0 16px 0; color: var(--color-text);">Disconnect ${provider}?</h3>
                    <p style="margin: 0 0 20px 0; color: var(--color-text-secondary);">
                        This will remove all imported data from ${provider} and revoke access to your account.
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-danger confirm-btn">Disconnect</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle button clicks
            modal.querySelector('.cancel-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });
            
            modal.querySelector('.confirm-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });
            
            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(false);
                }
            });
        });
    }
    
    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    /**
     * Show notification
     * @param {string} message - Message
     * @param {string} type - Notification type
     */
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            z-index: 10001;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    /**
     * Generate state parameter
     * @returns {string} State parameter
     */
    generateState() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    
    /**
     * Get auth token
     * @returns {string} Auth token
     */
    getAuthToken() {
        return localStorage.getItem('auth_token') || '';
    }
}

// Export for use in other modules
window.IntegrationPanel = IntegrationPanel;