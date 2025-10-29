/**
 * ConsentManager - GDPR-compliant consent tracking with versioning
 * Manages user consent with audit trails and withdrawal capabilities
 */

class ConsentManager extends BaseComponent {
    constructor(options = {}) {
        super(options);
        
        this.userId = options.userId;
        this.consentVersion = options.consentVersion || '1.0';
        this.consentTypes = [
            'data_collection',
            'analytics',
            'marketing',
            'data_export',
            'data_retention',
            'third_party_sharing'
        ];
        
        this.logger = window.SafeLogger || console;
        
        this.init();
    }
    
    /**
     * Initialize consent manager
     */
    async init() {
        await this.loadConsentHistory();
        await this.loadCurrentConsent();
        
        this.logger.info('ConsentManager initialized', {
            user_id: this.userId,
            consent_version: this.consentVersion
        });
    }
    
    /**
     * Load consent history
     */
    async loadConsentHistory() {
        try {
            const response = await fetch('/.netlify/functions/get-consent-history', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.consentHistory = data.consent_history || [];
            } else {
                this.consentHistory = [];
            }
            
        } catch (error) {
            this.logger.error('Failed to load consent history:', error);
            this.consentHistory = [];
        }
    }
    
    /**
     * Load current consent status
     */
    async loadCurrentConsent() {
        try {
            const response = await fetch('/.netlify/functions/get-current-consent', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentConsent = data.consent || this.getDefaultConsent();
            } else {
                this.currentConsent = this.getDefaultConsent();
            }
            
        } catch (error) {
            this.logger.error('Failed to load current consent:', error);
            this.currentConsent = this.getDefaultConsent();
        }
    }
    
    /**
     * Get default consent configuration
     * @returns {Object} Default consent
     */
    getDefaultConsent() {
        return {
            data_collection: false,
            analytics: false,
            marketing: false,
            data_export: false,
            data_retention: 365,
            third_party_sharing: false,
            consent_version: this.consentVersion,
            granted_at: null,
            last_updated: null
        };
    }
    
    /**
     * Grant consent for specific type
     * @param {string} consentType - Type of consent
     * @param {boolean} granted - Whether consent is granted
     * @param {Object} details - Additional details
     */
    async grantConsent(consentType, granted, details = {}) {
        try {
            if (!this.consentTypes.includes(consentType)) {
                throw new Error(`Invalid consent type: ${consentType}`);
            }
            
            const consentData = {
                user_id: this.userId,
                consent_type: consentType,
                granted: granted,
                consent_version: this.consentVersion,
                details: {
                    ...details,
                    granted_at: new Date().toISOString(),
                    ip_address: await this.getClientIP(),
                    user_agent: navigator.userAgent
                }
            };
            
            const response = await fetch('/.netlify/functions/grant-consent', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(consentData)
            });
            
            if (response.ok) {
                // Update local consent
                this.currentConsent[consentType] = granted;
                this.currentConsent.last_updated = new Date().toISOString();
                
                // Add to history
                this.consentHistory.unshift({
                    ...consentData,
                    timestamp: new Date().toISOString()
                });
                
                this.logger.info('Consent granted', {
                    user_id: this.userId,
                    consent_type: consentType,
                    granted: granted
                });
                
                return true;
            } else {
                throw new Error('Failed to grant consent');
            }
            
        } catch (error) {
            this.logger.error('Failed to grant consent:', error);
            throw error;
        }
    }
    
    /**
     * Withdraw consent for specific type
     * @param {string} consentType - Type of consent to withdraw
     * @param {Object} details - Additional details
     */
    async withdrawConsent(consentType, details = {}) {
        try {
            if (!this.consentTypes.includes(consentType)) {
                throw new Error(`Invalid consent type: ${consentType}`);
            }
            
            const consentData = {
                user_id: this.userId,
                consent_type: consentType,
                granted: false,
                consent_version: this.consentVersion,
                details: {
                    ...details,
                    withdrawn_at: new Date().toISOString(),
                    ip_address: await this.getClientIP(),
                    user_agent: navigator.userAgent
                }
            };
            
            const response = await fetch('/.netlify/functions/withdraw-consent', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(consentData)
            });
            
            if (response.ok) {
                // Update local consent
                this.currentConsent[consentType] = false;
                this.currentConsent.last_updated = new Date().toISOString();
                
                // Add to history
                this.consentHistory.unshift({
                    ...consentData,
                    timestamp: new Date().toISOString()
                });
                
                this.logger.info('Consent withdrawn', {
                    user_id: this.userId,
                    consent_type: consentType
                });
                
                return true;
            } else {
                throw new Error('Failed to withdraw consent');
            }
            
        } catch (error) {
            this.logger.error('Failed to withdraw consent:', error);
            throw error;
        }
    }
    
    /**
     * Withdraw all consent
     * @param {Object} details - Additional details
     */
    async withdrawAllConsent(details = {}) {
        try {
            const consentData = {
                user_id: this.userId,
                consent_types: this.consentTypes,
                consent_version: this.consentVersion,
                details: {
                    ...details,
                    withdrawn_at: new Date().toISOString(),
                    ip_address: await this.getClientIP(),
                    user_agent: navigator.userAgent
                }
            };
            
            const response = await fetch('/.netlify/functions/withdraw-all-consent', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(consentData)
            });
            
            if (response.ok) {
                // Update local consent
                this.consentTypes.forEach(type => {
                    this.currentConsent[type] = false;
                });
                this.currentConsent.last_updated = new Date().toISOString();
                
                // Add to history
                this.consentHistory.unshift({
                    ...consentData,
                    timestamp: new Date().toISOString()
                });
                
                this.logger.info('All consent withdrawn', {
                    user_id: this.userId
                });
                
                return true;
            } else {
                throw new Error('Failed to withdraw all consent');
            }
            
        } catch (error) {
            this.logger.error('Failed to withdraw all consent:', error);
            throw error;
        }
    }
    
    /**
     * Update consent for specific type
     * @param {string} consentType - Type of consent
     * @param {boolean} granted - Whether consent is granted
     * @param {Object} details - Additional details
     */
    async updateConsent(consentType, granted, details = {}) {
        try {
            if (this.currentConsent[consentType] === granted) {
                // No change needed
                return true;
            }
            
            if (granted) {
                return await this.grantConsent(consentType, true, details);
            } else {
                return await this.withdrawConsent(consentType, details);
            }
            
        } catch (error) {
            this.logger.error('Failed to update consent:', error);
            throw error;
        }
    }
    
    /**
     * Check if consent is granted for specific type
     * @param {string} consentType - Type of consent
     * @returns {boolean} Whether consent is granted
     */
    hasConsent(consentType) {
        return this.currentConsent[consentType] === true;
    }
    
    /**
     * Get consent status for all types
     * @returns {Object} Consent status for all types
     */
    getConsentStatus() {
        const status = {};
        this.consentTypes.forEach(type => {
            status[type] = this.hasConsent(type);
        });
        return status;
    }
    
    /**
     * Get consent history
     * @returns {Array} Consent history
     */
    getConsentHistory() {
        return this.consentHistory;
    }
    
    /**
     * Get current consent
     * @returns {Object} Current consent
     */
    getCurrentConsent() {
        return this.currentConsent;
    }
    
    /**
     * Check if consent is required
     * @param {string} consentType - Type of consent
     * @returns {boolean} Whether consent is required
     */
    isConsentRequired(consentType) {
        // Check if consent is required based on current version
        const requiredConsentTypes = [
            'data_collection',
            'analytics',
            'marketing',
            'third_party_sharing'
        ];
        
        return requiredConsentTypes.includes(consentType);
    }
    
    /**
     * Get consent summary
     * @returns {Object} Consent summary
     */
    getConsentSummary() {
        const summary = {
            user_id: this.userId,
            consent_version: this.consentVersion,
            granted_consent: [],
            withdrawn_consent: [],
            pending_consent: [],
            last_updated: this.currentConsent.last_updated,
            total_consent_events: this.consentHistory.length
        };
        
        this.consentTypes.forEach(type => {
            if (this.hasConsent(type)) {
                summary.granted_consent.push(type);
            } else if (this.isConsentRequired(type)) {
                summary.pending_consent.push(type);
            } else {
                summary.withdrawn_consent.push(type);
            }
        });
        
        return summary;
    }
    
    /**
     * Export consent data
     * @returns {Object} Consent data for export
     */
    exportConsentData() {
        return {
            user_id: this.userId,
            consent_version: this.consentVersion,
            current_consent: this.currentConsent,
            consent_history: this.consentHistory,
            consent_summary: this.getConsentSummary(),
            exported_at: new Date().toISOString(),
            gdpr_compliant: true
        };
    }
    
    /**
     * Validate consent for action
     * @param {string} action - Action to validate
     * @returns {boolean} Whether action is allowed
     */
    validateConsentForAction(action) {
        const actionConsentMap = {
            'collect_data': 'data_collection',
            'track_analytics': 'analytics',
            'send_marketing': 'marketing',
            'export_data': 'data_export',
            'share_third_party': 'third_party_sharing'
        };
        
        const requiredConsent = actionConsentMap[action];
        if (!requiredConsent) {
            return true; // No consent required
        }
        
        return this.hasConsent(requiredConsent);
    }
    
    /**
     * Get consent statistics
     * @returns {Object} Consent statistics
     */
    getConsentStats() {
        const stats = {
            total_consent_types: this.consentTypes.length,
            granted_consent_count: 0,
            withdrawn_consent_count: 0,
            pending_consent_count: 0,
            consent_history_count: this.consentHistory.length,
            last_consent_update: this.currentConsent.last_updated
        };
        
        this.consentTypes.forEach(type => {
            if (this.hasConsent(type)) {
                stats.granted_consent_count++;
            } else if (this.isConsentRequired(type)) {
                stats.pending_consent_count++;
            } else {
                stats.withdrawn_consent_count++;
            }
        });
        
        return stats;
    }
    
    /**
     * Check consent compliance
     * @returns {Object} Compliance status
     */
    checkCompliance() {
        const compliance = {
            gdpr_compliant: true,
            issues: [],
            warnings: [],
            recommendations: []
        };
        
        // Check required consent
        const requiredConsent = this.consentTypes.filter(type => 
            this.isConsentRequired(type)
        );
        
        requiredConsent.forEach(type => {
            if (!this.hasConsent(type)) {
                compliance.issues.push(`Missing required consent: ${type}`);
                compliance.gdpr_compliant = false;
            }
        });
        
        // Check consent version
        if (this.currentConsent.consent_version !== this.consentVersion) {
            compliance.warnings.push('Consent version mismatch');
            compliance.recommendations.push('Update consent to latest version');
        }
        
        // Check consent age
        if (this.currentConsent.last_updated) {
            const lastUpdate = new Date(this.currentConsent.last_updated);
            const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysSinceUpdate > 365) {
                compliance.warnings.push('Consent is older than 1 year');
                compliance.recommendations.push('Refresh consent annually');
            }
        }
        
        return compliance;
    }
    
    /**
     * Get client IP address
     * @returns {Promise<string>} Client IP
     */
    async getClientIP() {
        try {
            const response = await fetch('/.netlify/functions/get-client-ip');
            if (response.ok) {
                const data = await response.json();
                return data.ip;
            }
        } catch (error) {
            this.logger.warn('Failed to get client IP:', error);
        }
        return 'unknown';
    }
    
    /**
     * Get auth token
     * @returns {string} Auth token
     */
    getAuthToken() {
        return localStorage.getItem('auth_token') || '';
    }
    
    /**
     * Create consent banner
     * @returns {HTMLElement} Consent banner
     */
    createConsentBanner() {
        const banner = document.createElement('div');
        banner.className = 'consent-banner';
        banner.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--color-surface);
            border-top: 1px solid var(--color-border);
            padding: 20px;
            z-index: 10000;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.1);
        `;
        
        banner.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <h3 style="margin: 0 0 12px 0; color: var(--color-text);">Privacy & Consent</h3>
                <p style="margin: 0 0 16px 0; color: var(--color-text-secondary);">
                    We use cookies and collect data to provide personalized fitness training. 
                    You can manage your preferences below.
                </p>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="btn btn-primary accept-all-btn">Accept All</button>
                    <button class="btn btn-secondary manage-preferences-btn">Manage Preferences</button>
                    <button class="btn btn-outline reject-all-btn">Reject All</button>
                </div>
            </div>
        `;
        
        // Bind events
        banner.querySelector('.accept-all-btn').addEventListener('click', () => {
            this.acceptAllConsent();
            banner.remove();
        });
        
        banner.querySelector('.manage-preferences-btn').addEventListener('click', () => {
            this.showConsentModal();
        });
        
        banner.querySelector('.reject-all-btn').addEventListener('click', () => {
            this.rejectAllConsent();
            banner.remove();
        });
        
        return banner;
    }
    
    /**
     * Accept all consent
     */
    async acceptAllConsent() {
        try {
            const consentTypes = this.consentTypes.filter(type => 
                this.isConsentRequired(type)
            );
            
            for (const type of consentTypes) {
                await this.grantConsent(type, true, {
                    source: 'consent_banner',
                    action: 'accept_all'
                });
            }
            
            this.logger.info('All consent accepted', {
                user_id: this.userId
            });
            
        } catch (error) {
            this.logger.error('Failed to accept all consent:', error);
        }
    }
    
    /**
     * Reject all consent
     */
    async rejectAllConsent() {
        try {
            await this.withdrawAllConsent({
                source: 'consent_banner',
                action: 'reject_all'
            });
            
            this.logger.info('All consent rejected', {
                user_id: this.userId
            });
            
        } catch (error) {
            this.logger.error('Failed to reject all consent:', error);
        }
    }
    
    /**
     * Show consent modal
     */
    showConsentModal() {
        // This would open a detailed consent management modal
        // Implementation depends on your UI framework
        this.logger.info('Consent modal requested', {
            user_id: this.userId
        });
    }
    
    /**
     * Show consent banner if needed
     */
    showConsentBannerIfNeeded() {
        const requiredConsent = this.consentTypes.filter(type => 
            this.isConsentRequired(type) && !this.hasConsent(type)
        );
        
        if (requiredConsent.length > 0) {
            const banner = this.createConsentBanner();
            document.body.appendChild(banner);
        }
    }
}

// Export for use in other modules
window.ConsentManager = ConsentManager;
