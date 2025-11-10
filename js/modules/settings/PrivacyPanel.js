/**
 * PrivacyPanel - GDPR-compliant privacy controls and data management
 * Provides comprehensive data export, opt-out, and consent management
 */

class PrivacyPanel extends BaseComponent {
    constructor(options = {}) {
        super(options);

        this.container = options.container;
        this.userId = options.userId;
        this.consentManager = null;

        this.logger = window.SafeLogger || console;

        this.init();
    }

    /**
     * Initialize privacy panel
     */
    async init() {
        await this.loadConsentManager();
        await this.loadUserPreferences();
        this.render();
        this.bindEvents();

        this.logger.info('PrivacyPanel initialized');
    }

    /**
     * Load consent manager
     */
    async loadConsentManager() {
        try {
            const { ConsentManager } = await import('./ConsentManager.js');
            this.consentManager = new ConsentManager({
                userId: this.userId
            });
        } catch (error) {
            this.logger.error('Failed to load ConsentManager:', error);
        }
    }

    /**
     * Load user privacy preferences
     */
    async loadUserPreferences() {
        try {
            const response = await fetch('/.netlify/functions/get-privacy-preferences', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.userPreferences = data.preferences;
            } else {
                this.userPreferences = this.getDefaultPreferences();
            }

        } catch (error) {
            this.logger.error('Failed to load privacy preferences:', error);
            this.userPreferences = this.getDefaultPreferences();
        }
    }

    /**
     * Get default privacy preferences
     * @returns {Object} Default preferences
     */
    getDefaultPreferences() {
        return {
            dataCollection: true,
            analytics: true,
            marketing: false,
            dataExport: true,
            dataRetention: 365, // days
            consentVersion: '1.0',
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Render privacy panel
     */
    render() {
        this.container.innerHTML = `
            <div class="privacy-panel">
                <div class="panel-header">
                    <h3>Privacy & Data Control</h3>
                    <p>Manage your data collection, export, and privacy preferences</p>
                </div>
                
                <div class="privacy-sections">
                    ${this.renderDataCollectionSection()}
                    ${this.renderDataExportSection()}
                    ${this.renderConsentSection()}
                    ${this.renderDataRetentionSection()}
                    ${this.renderAuditSection()}
                </div>
                
                <div class="privacy-actions">
                    <button class="btn btn-primary save-preferences-btn">
                        Save Preferences
                    </button>
                    <button class="btn btn-secondary export-data-btn">
                        Export My Data
                    </button>
                    <button class="btn btn-danger delete-data-btn">
                        Delete All Data
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render data collection section
     * @returns {string} HTML for data collection controls
     */
    renderDataCollectionSection() {
        const isOptedOut = !this.userPreferences.dataCollection;

        return `
            <div class="privacy-section">
                <h4>Data Collection</h4>
                <p>Control what data we collect and how we use it</p>
                
                <div class="privacy-controls">
                    <div class="control-group">
                        <label class="control-label">
                            <input type="checkbox" 
                                   class="privacy-toggle" 
                                   data-preference="dataCollection"
                                   ${this.userPreferences.dataCollection ? 'checked' : ''}>
                            <span class="control-text">Allow data collection for personalized training</span>
                        </label>
                        <p class="control-description">
                            This includes workout data, performance metrics, and training preferences.
                            ${isOptedOut ? '<strong>Currently opted out - data collection stopped.</strong>' : ''}
                        </p>
                    </div>
                    
                    <div class="control-group">
                        <label class="control-label">
                            <input type="checkbox" 
                                   class="privacy-toggle" 
                                   data-preference="analytics"
                                   ${this.userPreferences.analytics ? 'checked' : ''}>
                            <span class="control-text">Allow analytics and usage tracking</span>
                        </label>
                        <p class="control-description">
                            Anonymous usage data to improve the app experience.
                        </p>
                    </div>
                    
                    <div class="control-group">
                        <label class="control-label">
                            <input type="checkbox" 
                                   class="privacy-toggle" 
                                   data-preference="marketing"
                                   ${this.userPreferences.marketing ? 'checked' : ''}>
                            <span class="control-text">Allow marketing communications</span>
                        </label>
                        <p class="control-description">
                            Receive updates about new features and fitness tips.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render data export section
     * @returns {string} HTML for data export controls
     */
    renderDataExportSection() {
        return `
            <div class="privacy-section">
                <h4>Data Export & Portability</h4>
                <p>Download your data or transfer it to another service</p>
                
                <div class="export-format-selector">
                    <label class="control-label">
                        <span class="control-text">Export Format:</span>
                        <select class="export-format-select" id="export-format-select">
                            <option value="csv">CSV (Excel-compatible)</option>
                            <option value="json">JSON (Machine-readable)</option>
                        </select>
                    </label>
                </div>
                
                <div class="export-controls">
                    <div class="export-option">
                        <h5>Complete Data Export</h5>
                        <p>Download all your data: workouts, readiness scores, progression events</p>
                        <button class="btn btn-outline export-complete-btn" data-export-type="all">
                            Export All Data
                        </button>
                    </div>
                    
                    <div class="export-option">
                        <h5>Workout Data Only</h5>
                        <p>Export just your workout history and performance data</p>
                        <button class="btn btn-outline export-workouts-btn" data-export-type="sessions">
                            Export Workouts
                        </button>
                    </div>
                    
                    <div class="export-option">
                        <h5>Readiness Scores</h5>
                        <p>Export your daily readiness check-ins and recovery data</p>
                        <button class="btn btn-outline export-readiness-btn" data-export-type="readiness">
                            Export Readiness
                        </button>
                    </div>
                    
                    <div class="export-option">
                        <h5>Progression Events</h5>
                        <p>Export your progress tracking and PR data</p>
                        <button class="btn btn-outline export-progression-btn" data-export-type="progression">
                            Export Progression
                        </button>
                    </div>
                </div>
                
                <div class="export-status" id="export-status" style="display: none;">
                    <div class="status-message"></div>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render consent section
     * @returns {string} HTML for consent management
     */
    renderConsentSection() {
        return `
            <div class="privacy-section">
                <h4>Consent Management</h4>
                <p>View and manage your consent history</p>
                
                <div class="consent-controls">
                    <div class="consent-summary">
                        <div class="consent-item">
                            <span class="consent-label">Current Consent Version:</span>
                            <span class="consent-value">${this.userPreferences.consentVersion}</span>
                        </div>
                        <div class="consent-item">
                            <span class="consent-label">Last Updated:</span>
                            <span class="consent-value">${new Date(this.userPreferences.lastUpdated).toLocaleDateString()}</span>
                        </div>
                    </div>
                    
                    <button class="btn btn-outline view-consent-history-btn">
                        View Consent History
                    </button>
                    
                    <button class="btn btn-outline withdraw-consent-btn">
                        Withdraw All Consent
                    </button>
                </div>
                
                <div class="consent-history" id="consent-history" style="display: none;">
                    <h5>Consent History</h5>
                    <div class="consent-timeline"></div>
                </div>
            </div>
        `;
    }

    /**
     * Render data retention section
     * @returns {string} HTML for data retention controls
     */
    renderDataRetentionSection() {
        return `
            <div class="privacy-section">
                <h4>Data Retention</h4>
                <p>Control how long we keep your data</p>
                
                <div class="retention-controls">
                    <div class="control-group">
                        <label class="control-label">
                            <span class="control-text">Data Retention Period:</span>
                            <select class="retention-select" data-preference="dataRetention">
                                <option value="30" ${this.userPreferences.dataRetention === 30 ? 'selected' : ''}>30 days</option>
                                <option value="90" ${this.userPreferences.dataRetention === 90 ? 'selected' : ''}>90 days</option>
                                <option value="365" ${this.userPreferences.dataRetention === 365 ? 'selected' : ''}>1 year</option>
                                <option value="730" ${this.userPreferences.dataRetention === 730 ? 'selected' : ''}>2 years</option>
                                <option value="0" ${this.userPreferences.dataRetention === 0 ? 'selected' : ''}>Indefinite</option>
                            </select>
                        </label>
                        <p class="control-description">
                            Data older than this period will be automatically deleted.
                        </p>
                    </div>
                    
                    <div class="retention-info">
                        <h5>Current Data Status</h5>
                        <div class="data-stats">
                            <div class="stat-item">
                                <span class="stat-label">Workouts:</span>
                                <span class="stat-value" id="workout-count">Loading...</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Activities:</span>
                                <span class="stat-value" id="activity-count">Loading...</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Oldest Data:</span>
                                <span class="stat-value" id="oldest-data">Loading...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render audit section
     * @returns {string} HTML for audit trail
     */
    renderAuditSection() {
        return `
            <div class="privacy-section">
                <h4>Privacy Audit Trail</h4>
                <p>View your privacy-related activities</p>
                
                <div class="audit-controls">
                    <button class="btn btn-outline view-audit-log-btn">
                        View Audit Log
                    </button>
                    
                    <button class="btn btn-outline download-audit-btn">
                        Download Audit Report
                    </button>
                </div>
                
                <div class="audit-log" id="audit-log" style="display: none;">
                    <h5>Recent Privacy Activities</h5>
                    <div class="audit-timeline"></div>
                </div>
            </div>
        `;
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Privacy toggles
        this.container.querySelectorAll('.privacy-toggle').forEach(toggle => {
            this.addEventListener(toggle, 'change', (event) => {
                this.handlePreferenceChange(event.target);
            });
        });

        // Retention select
        const retentionSelect = this.container.querySelector('.retention-select');
        if (retentionSelect) {
            this.addEventListener(retentionSelect, 'change', (event) => {
                this.handlePreferenceChange(event.target);
            });
        }

        // Action buttons
        this.container.querySelectorAll('.save-preferences-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.savePreferences());
        });

        this.container.querySelectorAll('.export-data-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.exportAllData());
        });

        this.container.querySelectorAll('.delete-data-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.deleteAllData());
        });

        // Export buttons
        this.container.querySelectorAll('.export-complete-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.exportData('all'));
        });

        this.container.querySelectorAll('.export-workouts-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.exportData('sessions'));
        });

        this.container.querySelectorAll('.export-readiness-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.exportData('readiness'));
        });

        this.container.querySelectorAll('.export-progression-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.exportData('progression'));
        });

        // Consent buttons
        this.container.querySelectorAll('.view-consent-history-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.viewConsentHistory());
        });

        this.container.querySelectorAll('.withdraw-consent-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.withdrawConsent());
        });

        // Audit buttons
        this.container.querySelectorAll('.view-audit-log-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.viewAuditLog());
        });

        this.container.querySelectorAll('.download-audit-btn').forEach(btn => {
            this.addEventListener(btn, 'click', () => this.downloadAuditReport());
        });

        // Load data stats
        this.loadDataStats();
    }

    /**
     * Handle preference change
     * @param {HTMLElement} element - Changed element
     */
    async handlePreferenceChange(element) {
        const {preference} = element.dataset;
        const value = element.type === 'checkbox' ? element.checked : element.value;

        this.userPreferences[preference] = value;

        // Handle opt-out immediately
        if (preference === 'dataCollection' && !value) {
            await this.handleOptOut();
        }

        // Update consent if needed
        if (this.consentManager) {
            await this.consentManager.updateConsent(preference, value);
        }

        this.logger.info('Privacy preference changed', {
            preference,
            value,
            user_id: this.userId
        });
    }

    /**
     * Handle opt-out from data collection
     */
    async handleOptOut() {
        try {
            const response = await fetch('/.netlify/functions/opt-out-data-collection', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    opt_out_reason: 'user_requested',
                    retroactive: true
                })
            });

            if (response.ok) {
                this.showSuccess('Data collection stopped. Existing data marked for deletion.');

                // Update UI to show opt-out status
                this.render();
                this.bindEvents();

            } else {
                throw new Error('Opt-out failed');
            }

        } catch (error) {
            this.logger.error('Opt-out failed:', error);
            this.showError('Failed to opt out of data collection');
        }
    }

    /**
     * Save privacy preferences
     */
    async savePreferences() {
        try {
            const response = await fetch('/.netlify/functions/save-privacy-preferences', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    preferences: this.userPreferences
                })
            });

            if (response.ok) {
                this.showSuccess('Privacy preferences saved successfully');
            } else {
                throw new Error('Save failed');
            }

        } catch (error) {
            this.logger.error('Failed to save preferences:', error);
            this.showError('Failed to save privacy preferences');
        }
    }

    /**
     * Export user data
     * @param {string} type - Export type ('all', 'sessions', 'readiness', 'progression')
     */
    async exportData(type) {
        try {
            // Get export format from UI
            const formatSelect = this.container.querySelector('#export-format-select');
            const format = formatSelect ? formatSelect.value : 'csv';

            this.showExportStatus('Preparing export...', 10);

            // Try client-side export first (using DataExport module)
            if (window.DataExport) {
                try {
                    this.showExportStatus('Collecting data...', 30);

                    // Map export type to DataExport options
                    const exportOptions = this.getExportOptions(type);

                    this.showExportStatus('Generating export file...', 60);

                    // Use DataExport module for client-side export
                    await window.DataExport.exportDataType(type, format, exportOptions);

                    this.showExportStatus('Export completed!', 100);

                    // Log audit trail
                    await this.logAuditEvent('data_export', {
                        export_type: type,
                        format,
                        method: 'client-side'
                    });

                    setTimeout(() => this.hideExportStatus(), 2000);
                    return;
                } catch (clientError) {
                    this.logger.warn('Client-side export failed, trying server-side:', clientError);
                    // Fall through to server-side export
                }
            }

            // Fallback: Server-side export
            this.showExportStatus('Preparing server export...', 40);

            const response = await fetch('/.netlify/functions/data-export', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    export_type: type,
                    format
                })
            });

            if (response.ok) {
                const data = await response.json();

                // Download the exported data
                const filename = format === 'csv'
                    ? `ignite-fitness-${type}-export.csv`
                    : `ignite-fitness-${type}-export.json`;

                // Handle both string (CSV) and object (JSON) responses
                if (format === 'csv' && typeof data.export_data === 'string') {
                    this.downloadFileAsString(data.export_data, filename, 'text/csv');
                } else {
                    this.downloadFile(data.export_data, filename);
                }

                this.showExportStatus('Export completed!', 100);

                // Log audit trail
                await this.logAuditEvent('data_export', {
                    export_type: type,
                    format,
                    method: 'server-side',
                    size: typeof data.export_data === 'string'
                        ? data.export_data.length
                        : JSON.stringify(data.export_data).length
                });

            } else {
                throw new Error('Export failed');
            }

            setTimeout(() => this.hideExportStatus(), 2000);

        } catch (error) {
            this.logger.error('Data export failed:', error);
            this.showError(`Failed to export data: ${ error.message || 'Unknown error'}`);
            this.hideExportStatus();
        }
    }

    /**
     * Get export options based on type
     * @param {string} type - Export type
     * @returns {Object} Export options
     */
    getExportOptions(type) {
        const options = {
            includeSessions: type === 'sessions' || type === 'all',
            includeReadiness: type === 'readiness' || type === 'all',
            includeProgression: type === 'progression' || type === 'all',
            includeInjuryFlags: false, // Optional, not included by default
            dateRange: null // Can be set to { start: Date, end: Date } to filter by date
        };

        return options;
    }

    /**
     * Download file as string (for CSV)
     * @param {string} content - File content
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    downloadFileAsString(content, filename, mimeType = 'text/csv') {
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
     * Export all data
     */
    async exportAllData() {
        await this.exportData('all');
    }

    /**
     * Delete all user data
     */
    async deleteAllData() {
        const confirmed = await this.showDeleteConfirmation();
        if (!confirmed) {return;}

        try {
            this.showExportStatus('Deleting data...', 0);

            const response = await fetch('/.netlify/functions/delete-user-data', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    confirm_deletion: true
                })
            });

            if (response.ok) {
                this.showExportStatus('Data deleted successfully', 100);

                // Log audit trail
                await this.logAuditEvent('data_deletion', {
                    scope: 'complete',
                    user_confirmed: true
                });

                // Redirect to logout
                setTimeout(() => {
                    window.location.href = '/logout';
                }, 2000);

            } else {
                throw new Error('Deletion failed');
            }

        } catch (error) {
            this.logger.error('Data deletion failed:', error);
            this.showError('Failed to delete data');
            this.hideExportStatus();
        }
    }

    /**
     * View consent history
     */
    async viewConsentHistory() {
        try {
            if (this.consentManager) {
                const history = await this.consentManager.getConsentHistory();
                this.renderConsentHistory(history);
            }
        } catch (error) {
            this.logger.error('Failed to load consent history:', error);
            this.showError('Failed to load consent history');
        }
    }

    /**
     * Withdraw all consent
     */
    async withdrawConsent() {
        const confirmed = await this.showWithdrawConfirmation();
        if (!confirmed) {return;}

        try {
            if (this.consentManager) {
                await this.consentManager.withdrawAllConsent();
                this.showSuccess('All consent withdrawn successfully');

                // Update preferences
                this.userPreferences.dataCollection = false;
                this.userPreferences.analytics = false;
                this.userPreferences.marketing = false;

                this.render();
                this.bindEvents();
            }
        } catch (error) {
            this.logger.error('Failed to withdraw consent:', error);
            this.showError('Failed to withdraw consent');
        }
    }

    /**
     * View audit log
     */
    async viewAuditLog() {
        try {
            const response = await fetch('/.netlify/functions/get-audit-log', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderAuditLog(data.audit_log);
            } else {
                throw new Error('Failed to load audit log');
            }

        } catch (error) {
            this.logger.error('Failed to load audit log:', error);
            this.showError('Failed to load audit log');
        }
    }

    /**
     * Download audit report
     */
    async downloadAuditReport() {
        try {
            const response = await fetch('/.netlify/functions/audit-report', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.downloadFile(data.report, 'ignite-fitness-audit-report.json');
            } else {
                throw new Error('Failed to generate audit report');
            }

        } catch (error) {
            this.logger.error('Failed to download audit report:', error);
            this.showError('Failed to download audit report');
        }
    }

    /**
     * Load data statistics
     */
    async loadDataStats() {
        try {
            const response = await fetch('/.netlify/functions/get-data-stats', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();

                // Update UI with stats
                const workoutCount = this.container.querySelector('#workout-count');
                const activityCount = this.container.querySelector('#activity-count');
                const oldestData = this.container.querySelector('#oldest-data');

                if (workoutCount) {workoutCount.textContent = data.workout_count || 0;}
                if (activityCount) {activityCount.textContent = data.activity_count || 0;}
                if (oldestData) {oldestData.textContent = data.oldest_data || 'N/A';}
            }

        } catch (error) {
            this.logger.error('Failed to load data stats:', error);
        }
    }

    /**
     * Show export status
     * @param {string} message - Status message
     * @param {number} progress - Progress percentage
     */
    showExportStatus(message, progress) {
        const statusEl = this.container.querySelector('#export-status');
        const messageEl = statusEl.querySelector('.status-message');
        const progressEl = statusEl.querySelector('.progress-fill');

        if (statusEl) {
            statusEl.style.display = 'block';
            messageEl.textContent = message;
            progressEl.style.width = `${progress}%`;
        }
    }

    /**
     * Hide export status
     */
    hideExportStatus() {
        const statusEl = this.container.querySelector('#export-status');
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }

    /**
     * Download file
     * @param {Object} data - Data to download
     * @param {string} filename - Filename
     */
    downloadFile(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
     * Show delete confirmation
     * @returns {Promise<boolean>} Confirmation result
     */
    async showDeleteConfirmation() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'delete-confirmation-modal';
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
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin: 0 0 16px 0; color: var(--color-danger);">Delete All Data?</h3>
                    <p style="margin: 0 0 20px 0; color: var(--color-text-secondary);">
                        This will permanently delete all your data including workouts, activities, and preferences. 
                        This action cannot be undone.
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-danger confirm-btn">Delete All Data</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector('.cancel-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });

            modal.querySelector('.confirm-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(false);
                }
            });
        });
    }

    /**
     * Show withdraw confirmation
     * @returns {Promise<boolean>} Confirmation result
     */
    async showWithdrawConfirmation() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'withdraw-confirmation-modal';
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
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin: 0 0 16px 0; color: var(--color-warning);">Withdraw All Consent?</h3>
                    <p style="margin: 0 0 20px 0; color: var(--color-text-secondary);">
                        This will withdraw all consent and stop data collection. 
                        Existing data will be marked for deletion according to your retention settings.
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-warning confirm-btn">Withdraw Consent</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector('.cancel-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });

            modal.querySelector('.confirm-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(false);
                }
            });
        });
    }

    /**
     * Render consent history
     * @param {Array} history - Consent history
     */
    renderConsentHistory(history) {
        const timeline = this.container.querySelector('.consent-timeline');
        if (!timeline) {return;}

        timeline.innerHTML = history.map(entry => `
            <div class="consent-entry">
                <div class="consent-date">${new Date(entry.timestamp).toLocaleString()}</div>
                <div class="consent-action">${entry.action}</div>
                <div class="consent-details">${entry.details}</div>
            </div>
        `).join('');

        const historyEl = this.container.querySelector('#consent-history');
        if (historyEl) {
            historyEl.style.display = 'block';
        }
    }

    /**
     * Render audit log
     * @param {Array} auditLog - Audit log entries
     */
    renderAuditLog(auditLog) {
        const timeline = this.container.querySelector('.audit-timeline');
        if (!timeline) {return;}

        timeline.innerHTML = auditLog.map(entry => `
            <div class="audit-entry">
                <div class="audit-date">${new Date(entry.timestamp).toLocaleString()}</div>
                <div class="audit-action">${entry.action}</div>
                <div class="audit-details">${entry.details}</div>
            </div>
        `).join('');

        const logEl = this.container.querySelector('#audit-log');
        if (logEl) {
            logEl.style.display = 'block';
        }
    }

    /**
     * Log audit event
     * @param {string} action - Audit action
     * @param {Object} details - Audit details
     */
    async logAuditEvent(action, details) {
        try {
            await fetch('/.netlify/functions/log-audit-event', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    action,
                    details,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            this.logger.error('Failed to log audit event:', error);
        }
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
     * Get auth token
     * @returns {string} Auth token
     */
    getAuthToken() {
        return localStorage.getItem('auth_token') || '';
    }
}

// Export for use in other modules
window.PrivacyPanel = PrivacyPanel;