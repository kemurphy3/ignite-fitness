/**
 * IntegrationPanel - Data export and OAuth integrations
 * Provides CSV/JSON/PDF export and OAuth sync with external services
 */
class IntegrationPanel {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.authManager = window.AuthManager;
        this.eventBus = window.EventBus;
        
        this.integrations = {
            strava: { enabled: false, connected: false },
            googleFit: { enabled: false, connected: false }
        };
        
        this.loadIntegrations();
    }

    /**
     * Render integration panel
     * @returns {HTMLElement} Panel element
     */
    render() {
        const panel = document.createElement('div');
        panel.className = 'integration-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h2>📤 Data & Integrations</h2>
                <button class="btn-secondary" onclick="window.IntegrationPanel.showPrivacyScreen()">
                    🔒 Privacy Settings
                </button>
            </div>
            
            <!-- Export Options -->
            <div class="export-section">
                <h3>Export Your Data</h3>
                <div class="export-options">
                    <button class="btn-primary" onclick="window.IntegrationPanel.exportCSV()">
                        📄 Export CSV
                    </button>
                    <button class="btn-primary" onclick="window.IntegrationPanel.exportJSON()">
                        📦 Export JSON
                    </button>
                    <button class="btn-primary" onclick="window.IntegrationPanel.exportPDF()">
                        📊 Weekly Summary PDF
                    </button>
                </div>
            </div>
            
            <!-- OAuth Integrations -->
            <div class="integrations-section">
                <h3>Connect External Services</h3>
                ${this.renderStravaIntegration()}
                ${this.renderGoogleFitIntegration()}
            </div>
        `;
        
        return panel;
    }

    /**
     * Render Strava integration
     * @returns {string} Strava HTML
     */
    renderStravaIntegration() {
        const strava = this.integrations.strava;
        
        return `
            <div class="integration-item">
                <div class="integration-header">
                    <div class="integration-info">
                        <span class="integration-icon">🚴</span>
                        <div>
                            <h4>Strava</h4>
                            <p>Sync workouts and activities</p>
                        </div>
                    </div>
                    <div class="integration-status">
                        ${strava.connected ? 
                            '<span class="status-badge connected">Connected</span>' : 
                            '<span class="status-badge disconnected">Not Connected</span>'
                        }
                    </div>
                </div>
                <div class="integration-controls">
                    <label class="consent-toggle">
                        <input type="checkbox" ${strava.enabled ? 'checked' : ''} 
                               onchange="window.IntegrationPanel.toggleIntegration('strava', this.checked)">
                        <span>Enable Strava sync</span>
                    </label>
                    ${!strava.connected && strava.enabled ? `
                        <button class="btn-primary small" onclick="window.IntegrationPanel.connectStrava()">
                            Connect Strava
                        </button>
                    ` : strava.connected ? `
                        <button class="btn-secondary small" onclick="window.IntegrationPanel.disconnectStrava()">
                            Disconnect
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render Google Fit integration
     * @returns {string} Google Fit HTML
     */
    renderGoogleFitIntegration() {
        const googleFit = this.integrations.googleFit;
        
        return `
            <div class="integration-item">
                <div class="integration-header">
                    <div class="integration-info">
                        <span class="integration-icon">🏃</span>
                        <div>
                            <h4>Google Fit</h4>
                            <p>Sync health and activity data</p>
                        </div>
                    </div>
                    <div class="integration-status">
                        ${googleFit.connected ? 
                            '<span class="status-badge connected">Connected</span>' : 
                            '<span class="status-badge disconnected">Not Connected</span>'
                        }
                    </div>
                </div>
                <div class="integration-controls">
                    <label class="consent-toggle">
                        <input type="checkbox" ${googleFit.enabled ? 'checked' : ''} 
                               onchange="window.IntegrationPanel.toggleIntegration('googleFit', this.checked)">
                        <span>Enable Google Fit sync</span>
                    </label>
                    ${!googleFit.connected && googleFit.enabled ? `
                        <button class="btn-primary small" onclick="window.IntegrationPanel.connectGoogleFit()">
                            Connect Google Fit
                        </button>
                    ` : googleFit.connected ? `
                        <button class="btn-secondary small" onclick="window.IntegrationPanel.disconnectGoogleFit()">
                            Disconnect
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Export data to CSV
     */
    async exportCSV() {
        try {
            const userId = this.authManager?.getCurrentUsername();
            if (!userId) {
                alert('Please log in to export data');
                return;
            }
            
            this.logger.debug('Exporting CSV for user:', userId);
            
            // Call export API
            const response = await this.callExportAPI(userId, 'csv');
            
            // Download file
            this.downloadFile(response, 'ignitefitness-export.csv', 'text/csv');
            
            this.logger.audit('DATA_EXPORTED', { format: 'csv', userId });
        } catch (error) {
            this.logger.error('Failed to export CSV', error);
            alert('Failed to export data. Please try again.');
        }
    }

    /**
     * Export data to JSON
     */
    async exportJSON() {
        try {
            const userId = this.authManager?.getCurrentUsername();
            if (!userId) {
                alert('Please log in to export data');
                return;
            }
            
            this.logger.debug('Exporting JSON for user:', userId);
            
            const response = await this.callExportAPI(userId, 'json');
            
            this.downloadFile(response, 'ignitefitness-export.json', 'application/json');
            
            this.logger.audit('DATA_EXPORTED', { format: 'json', userId });
        } catch (error) {
            this.logger.error('Failed to export JSON', error);
            alert('Failed to export data. Please try again.');
        }
    }

    /**
     * Export PDF weekly summary
     */
    async exportPDF() {
        try {
            const userId = this.authManager?.getCurrentUsername();
            if (!userId) {
                alert('Please log in to export data');
                return;
            }
            
            this.logger.debug('Exporting PDF for user:', userId);
            
            // Generate PDF summary
            const pdfData = this.generatePDFSummary(userId);
            
            this.downloadFile(pdfData, 'ignitefitness-weekly-summary.pdf', 'application/pdf');
            
            this.logger.audit('DATA_EXPORTED', { format: 'pdf', userId });
        } catch (error) {
            this.logger.error('Failed to export PDF', error);
            alert('Failed to export PDF. Please try again.');
        }
    }

    /**
     * Call export API
     * @param {string} userId - User ID
     * @param {string} format - Format
     * @returns {Promise<string>} Export data
     */
    async callExportAPI(userId, format) {
        // For now, use localStorage data
        const allData = this.getAllUserData(userId);
        
        if (format === 'csv') {
            return this.convertToCSV(allData);
        } else if (format === 'json') {
            return JSON.stringify(allData, null, 2);
        }
        
        return allData;
    }

    /**
     * Get all user data
     * @param {string} userId - User ID
     * @returns {Object} All user data
     */
    getAllUserData(userId) {
        return {
            userId,
            exportedAt: new Date().toISOString(),
            profile: this.storageManager.getUserProfile(userId),
            readinessLogs: this.storageManager.getReadinessLogs(),
            sessionLogs: this.storageManager.getSessionLogs(),
            progressionEvents: this.storageManager.getProgressionEvents(),
            injuryFlags: this.storageManager.getInjuryFlags(),
            preferences: this.storageManager.getPreferences(userId)
        };
    }

    /**
     * Convert data to CSV
     * @param {Object} data - Data object
     * @returns {string} CSV string
     */
    convertToCSV(data) {
        const lines = ['Type,Date,Data'];
        
        if (data.readinessLogs) {
            Object.values(data.readinessLogs).forEach(log => {
                lines.push(`Readiness,${log.date},Score: ${log.readinessScore}`);
            });
        }
        
        if (data.sessionLogs) {
            Object.values(data.sessionLogs).forEach(log => {
                lines.push(`Session,${log.date},Workout: ${log.workout_id}`);
            });
        }
        
        return lines.join('\n');
    }

    /**
     * Generate PDF summary
     * @param {string} userId - User ID
     * @returns {string} PDF data
     */
    generatePDFSummary(userId) {
        // For now, return HTML that can be printed to PDF
        const data = this.getAllUserData(userId);
        
        return `
            <html>
                <head>
                    <title>IgniteFitness Weekly Summary</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #00a651; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
                        th { background: #f8f9fa; }
                    </style>
                </head>
                <body>
                    <h1>Weekly Summary</h1>
                    <p>Exported: ${new Date().toLocaleDateString()}</p>
                    <h2>Recent Workouts</h2>
                    <!-- Summary data here -->
                </body>
            </html>
        `;
    }

    /**
     * Download file
     * @param {string} content - File content
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Connect Strava
     */
    async connectStrava() {
        try {
            // OAuth flow for Strava
            const clientId = process.env.STRAVA_CLIENT_ID || 'your_client_id';
            const redirectUri = window.location.origin + '/callback.html';
            
            const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all`;
            
            window.location.href = authUrl;
        } catch (error) {
            this.logger.error('Failed to connect Strava', error);
        }
    }

    /**
     * Connect Google Fit
     */
    async connectGoogleFit() {
        try {
            // OAuth flow for Google Fit
            // Implementation similar to Strava
            this.logger.debug('Connecting Google Fit');
        } catch (error) {
            this.logger.error('Failed to connect Google Fit', error);
        }
    }

    /**
     * Disconnect Strava
     */
    disconnectStrava() {
        this.integrations.strava.connected = false;
        this.saveIntegrations();
        this.logger.debug('Strava disconnected');
    }

    /**
     * Disconnect Google Fit
     */
    disconnectGoogleFit() {
        this.integrations.googleFit.connected = false;
        this.saveIntegrations();
        this.logger.debug('Google Fit disconnected');
    }

    /**
     * Toggle integration
     * @param {string} integration - Integration name
     * @param {boolean} enabled - Enabled state
     */
    toggleIntegration(integration, enabled) {
        this.integrations[integration].enabled = enabled;
        this.saveIntegrations();
    }

    /**
     * Load integrations
     */
    loadIntegrations() {
        try {
            const stored = localStorage.getItem('ignitefitness_integrations');
            if (stored) {
                this.integrations = { ...this.integrations, ...JSON.parse(stored) };
            }
        } catch (error) {
            this.logger.error('Failed to load integrations', error);
        }
    }

    /**
     * Save integrations
     */
    saveIntegrations() {
        try {
            localStorage.setItem('ignitefitness_integrations', JSON.stringify(this.integrations));
        } catch (error) {
            this.logger.error('Failed to save integrations', error);
        }
    }

    /**
     * Show privacy screen
     */
    showPrivacyScreen() {
        alert('Privacy settings: You can export or delete all your data. Coming soon!');
    }

    /**
     * Delete all data
     */
    async deleteAllData() {
        if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
            await this.storageManager.clearAllData();
            this.logger.audit('DATA_DELETED', { userId: this.authManager?.getCurrentUsername() });
            alert('All data deleted. You will be logged out.');
            window.location.reload();
        }
    }
}

// Create global instance
window.IntegrationPanel = new IntegrationPanel();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntegrationPanel;
}
