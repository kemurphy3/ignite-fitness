/**
 * PrivacyPanel - User data control and privacy management
 * Provides export, deletion, and consent management
 */
class PrivacyPanel {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.authManager = window.AuthManager;
        
        this.tables = [
            'user_profiles',
            'preferences',
            'session_logs',
            'progression_events',
            'injury_flags',
            'external_activities',
            'nutrition_profiles'
        ];
    }

    /**
     * Render privacy panel
     * @returns {HTMLElement} Privacy panel
     */
    render() {
        const panel = document.createElement('div');
        panel.className = 'privacy-panel';
        
        panel.innerHTML = `
            <div class="privacy-header">
                <h2>Privacy & Data Control</h2>
                <p>Manage your data and privacy settings</p>
            </div>
            
            <div class="privacy-section">
                <h3>Data Export</h3>
                <p>Download your data in JSON or CSV format</p>
                <div class="export-actions">
                    <button class="btn-primary" onclick="window.PrivacyPanel.exportJSON()">
                        📥 Export JSON
                    </button>
                    <button class="btn-primary" onclick="window.PrivacyPanel.exportCSV()">
                        📊 Export CSV
                    </button>
                </div>
            </div>
            
            <div class="privacy-section">
                <h3>Data Deletion</h3>
                <p>Permanently delete all your data and reset the app</p>
                <div class="delete-actions">
                    <button class="btn-danger" onclick="window.PrivacyPanel.confirmDelete()">
                        🗑️ Delete My Data
                    </button>
                </div>
            </div>
            
            <div class="privacy-section">
                <h3>Integration Consent</h3>
                <p>Control which integrations can access your data</p>
                <div class="consent-toggles">
                    <label class="consent-item">
                        <input type="checkbox" id="consent-strava" checked>
                        <span>Strava Integration</span>
                    </label>
                    <label class="consent-item">
                        <input type="checkbox" id="consent-google-fit" checked>
                        <span>Google Fit Integration</span>
                    </label>
                    <label class="consent-item">
                        <input type="checkbox" id="consent-analytics" checked>
                        <span>Anonymous Analytics</span>
                    </label>
                </div>
            </div>
            
            <div class="privacy-section">
                <h3>Data Storage</h3>
                <p>Your data is stored locally in your browser</p>
                <div id="storage-info" class="storage-info">
                    <p>Storage used: <span id="storage-used">0 KB</span></p>
                    <p>Tables: <span id="table-count">0</span></p>
                </div>
            </div>
        `;
        
        this.updateStorageInfo();
        this.initializeConsentToggles();
        
        return panel;
    }

    /**
     * Export all data as JSON
     */
    async exportJSON() {
        try {
            const userId = this.authManager?.getCurrentUsername();
            if (!userId) {
                alert('You must be logged in to export data');
                return;
            }
            
            const exportData = await this.collectAllData(userId);
            
            // Create downloadable JSON file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ignite-fitness-export-${Date.now()}.json`;
            a.click();
            
            this.logger.audit('DATA_EXPORTED', { format: 'json', userId });
            
            alert('Data exported successfully!');
        } catch (error) {
            this.logger.error('Failed to export JSON', error);
            alert('Failed to export data');
        }
    }

    /**
     * Export all data as CSV
     */
    async exportCSV() {
        try {
            const userId = this.authManager?.getCurrentUsername();
            if (!userId) {
                alert('You must be logged in to export data');
                return;
            }
            
            const allData = await this.collectAllData(userId);
            
            // Generate CSV for each table
            const csvFiles = [];
            for (const table of this.tables) {
                const tableData = allData[table] || [];
                if (tableData.length > 0) {
                    const csv = this.arrayToCSV(tableData);
                    const blob = new Blob([csv], { type: 'text/csv' });
                    csvFiles.push({ name: table, blob });
                }
            }
            
            // Create ZIP or download multiple files
            if (csvFiles.length > 0) {
                // Download first file (can be enhanced with JSZip for multiple files)
                const url = URL.createObjectURL(csvFiles[0].blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${csvFiles[0].name}-export-${Date.now()}.csv`;
                a.click();
                
                this.logger.audit('DATA_EXPORTED', { format: 'csv', userId });
                
                alert('Data exported successfully!');
            } else {
                alert('No data to export');
            }
        } catch (error) {
            this.logger.error('Failed to export CSV', error);
            alert('Failed to export data');
        }
    }

    /**
     * Collect all data for export
     * @param {string} userId - User ID
     * @returns {Promise<Object>} All user data
     */
    async collectAllData(userId) {
        const exportData = {};
        
        for (const table of this.tables) {
            try {
                const data = await this.storageManager.getData(userId, table);
                exportData[table] = data || [];
            } catch (error) {
                this.logger.error(`Failed to get data for ${table}`, error);
                exportData[table] = [];
            }
        }
        
        // Add metadata
        exportData.metadata = {
            exportedAt: new Date().toISOString(),
            userId,
            tables: this.tables,
            version: '1.0'
        };
        
        return exportData;
    }

    /**
     * Convert array to CSV
     * @param {Array} data - Array of objects
     * @returns {string} CSV string
     */
    arrayToCSV(data) {
        if (!data || data.length === 0) return '';
        
        // Get headers
        const headers = Object.keys(data[0]);
        
        // Create CSV rows
        const rows = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ];
        
        return rows.join('\n');
    }

    /**
     * Confirm and execute data deletion
     */
    async confirmDelete() {
        const confirmed = confirm(
            'Are you sure you want to delete all your data? This action cannot be undone.\n\n' +
            'This will:\n' +
            '• Delete all workout data\n' +
            '• Delete all progress data\n' +
            '• Delete all preferences\n' +
            '• Reset the app to onboarding\n\n' +
            'This action is permanent and cannot be reversed.'
        );
        
        if (!confirmed) return;
        
        // Double confirmation
        const doubleConfirmed = confirm(
            'FINAL WARNING: This will permanently delete ALL your data. Press OK to proceed with deletion.'
        );
        
        if (!doubleConfirmed) return;
        
        await this.deleteAllData();
    }

    /**
     * Delete all user data
     */
    async deleteAllData() {
        try {
            const userId = this.authManager?.getCurrentUsername();
            
            // Delete all data from each table
            for (const table of this.tables) {
                await this.storageManager.deleteAllData(userId, table);
            }
            
            // Clear LocalStorage
            localStorage.clear();
            
            // Reset app state
            this.logger.audit('DATA_DELETED', { userId });
            
            // Redirect to onboarding
            alert('All data deleted. Redirecting to onboarding...');
            window.location.hash = '#/onboarding';
            
        } catch (error) {
            this.logger.error('Failed to delete data', error);
            alert('Failed to delete data');
        }
    }

    /**
     * Update storage info
     */
    async updateStorageInfo() {
        try {
            const userId = this.authManager?.getCurrentUsername();
            if (!userId) return;
            
            // Calculate storage used
            const storageUsed = this.getStorageSize();
            
            // Count tables
            let tableCount = 0;
            for (const table of this.tables) {
                try {
                    const data = await this.storageManager.getData(userId, table);
                    if (data && data.length > 0) tableCount++;
                } catch (error) {
                    // Ignore errors
                }
            }
            
            // Update UI
            const storageUsedEl = document.getElementById('storage-used');
            const tableCountEl = document.getElementById('table-count');
            
            if (storageUsedEl) storageUsedEl.textContent = this.formatBytes(storageUsed);
            if (tableCountEl) tableCountEl.textContent = tableCount;
            
        } catch (error) {
            this.logger.error('Failed to update storage info', error);
        }
    }

    /**
     * Get storage size
     * @returns {number} Size in bytes
     */
    getStorageSize() {
        let total = 0;
        for (const key in localStorage) {
            if (key.startsWith('ignitefitness_')) {
                total += localStorage[key].length;
            }
        }
        return total;
    }

    /**
     * Format bytes to human-readable
     * @param {number} bytes - Bytes
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Initialize consent toggles
     */
    initializeConsentToggles() {
        const toggles = document.querySelectorAll('.consent-item input[type="checkbox"]');
        
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const consentType = e.target.id.replace('consent-', '');
                this.updateConsent(consentType, e.target.checked);
            });
        });
    }

    /**
     * Update consent
     * @param {string} consentType - Consent type
     * @param {boolean} consented - Consent value
     */
    async updateConsent(consentType, consented) {
        try {
            const userId = this.authManager?.getCurrentUsername();
            const consents = await this.storageManager.getData(userId, 'consents') || {};
            
            consents[consentType] = consented;
            
            await this.storageManager.saveData(userId, 'consents', consents);
            
            this.logger.audit('CONSENT_UPDATED', { consentType, consented, userId });
            
        } catch (error) {
            this.logger.error('Failed to update consent', error);
        }
    }
}

window.PrivacyPanel = PrivacyPanel;
