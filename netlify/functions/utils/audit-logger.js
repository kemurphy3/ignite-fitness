/**
 * Audit Logger - Compliance-ready logging for sensitive operations
 * Implements immutable audit trails with comprehensive tracking
 */

const { createClient } = require('@supabase/supabase-js');
const SafeLogger = require('./safe-logging');

// Create safe logger for audit logging
const logger = SafeLogger.create({
    enableMasking: true,
    visibleChars: 4,
    maskChar: '*'
});

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Audit configuration
const AUDIT_CONFIG = {
    // Sensitive operations that require audit logging
    sensitiveOperations: [
        'user_login',
        'user_logout',
        'password_change',
        'data_access',
        'data_modification',
        'data_deletion',
        'data_export',
        'admin_action',
        'privilege_change',
        'consent_change',
        'token_revocation',
        'account_deletion',
        'security_event',
        'configuration_change',
        'system_access'
    ],
    
    // Data types that require special handling
    sensitiveDataTypes: [
        'personal_data',
        'health_data',
        'financial_data',
        'authentication_data',
        'consent_data',
        'admin_data',
        'system_data'
    ],
    
    // Retention periods (in days)
    retentionPeriods: {
        default: 2555, // 7 years
        security: 2555, // 7 years
        admin: 2555, // 7 years
        user: 1095, // 3 years
        system: 365 // 1 year
    },
    
    // Batch processing
    batchSize: 100,
    batchTimeout: 5000, // 5 seconds
    maxRetries: 3
};

/**
 * Audit Logger Class
 */
class AuditLogger {
    constructor(options = {}) {
        this.config = { ...AUDIT_CONFIG, ...options };
        this.eventBuffer = [];
        this.isProcessing = false;
        this.retryQueue = [];
        
        this.logger = logger;
        
        this.init();
    }
    
    /**
     * Initialize audit logger
     */
    init() {
        this.startBatchProcessing();
        this.startRetryProcessing();
        
        this.logger.info('AuditLogger initialized', {
            sensitive_operations: this.config.sensitiveOperations.length,
            retention_periods: this.config.retentionPeriods
        });
    }
    
    /**
     * Log audit event
     * @param {string} operation - Operation type
     * @param {Object} eventData - Event data
     * @param {Object} options - Logging options
     */
    async logAuditEvent(operation, eventData, options = {}) {
        try {
            // Validate operation
            if (!this.config.sensitiveOperations.includes(operation)) {
                this.logger.warn('Non-sensitive operation logged', {
                    operation: operation
                });
            }
            
            // Create audit event
            const auditEvent = {
                id: this.generateEventId(),
                operation: operation,
                timestamp: new Date().toISOString(),
                user_id: eventData.userId || 'system',
                session_id: eventData.sessionId || 'unknown',
                ip_address: eventData.ipAddress || 'unknown',
                user_agent: eventData.userAgent || 'unknown',
                resource_type: eventData.resourceType || 'unknown',
                resource_id: eventData.resourceId || 'unknown',
                action: eventData.action || 'unknown',
                details: this.sanitizeEventData(eventData.details || {}),
                result: eventData.result || 'success',
                risk_level: this.calculateRiskLevel(operation, eventData),
                compliance_category: this.getComplianceCategory(operation),
                retention_period: this.getRetentionPeriod(operation),
                created_at: new Date().toISOString()
            };
            
            // Add to buffer
            this.eventBuffer.push(auditEvent);
            
            // Process immediately for critical events
            if (auditEvent.risk_level === 'critical') {
                await this.processCriticalEvent(auditEvent);
            }
            
            this.logger.debug('Audit event logged', {
                operation: operation,
                event_id: auditEvent.id,
                risk_level: auditEvent.risk_level
            });
            
            return auditEvent.id;
            
        } catch (error) {
            this.logger.error('Failed to log audit event', {
                operation: operation,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Log user authentication event
     * @param {string} action - Authentication action
     * @param {Object} authData - Authentication data
     */
    async logAuthenticationEvent(action, authData) {
        await this.logAuditEvent('user_login', {
            userId: authData.userId,
            sessionId: authData.sessionId,
            ipAddress: authData.ipAddress,
            userAgent: authData.userAgent,
            action: action,
            details: {
                method: authData.method,
                success: authData.success,
                failure_reason: authData.failureReason,
                mfa_used: authData.mfaUsed,
                device_info: authData.deviceInfo
            },
            result: authData.success ? 'success' : 'failure'
        });
    }
    
    /**
     * Log data access event
     * @param {string} operation - Data operation
     * @param {Object} accessData - Access data
     */
    async logDataAccessEvent(operation, accessData) {
        await this.logAuditEvent('data_access', {
            userId: accessData.userId,
            sessionId: accessData.sessionId,
            ipAddress: accessData.ipAddress,
            userAgent: accessData.userAgent,
            resourceType: accessData.resourceType,
            resourceId: accessData.resourceId,
            action: operation,
            details: {
                data_type: accessData.dataType,
                record_count: accessData.recordCount,
                fields_accessed: accessData.fieldsAccessed,
                query_type: accessData.queryType,
                justification: accessData.justification
            },
            result: accessData.success ? 'success' : 'failure'
        });
    }
    
    /**
     * Log data modification event
     * @param {string} operation - Modification operation
     * @param {Object} modificationData - Modification data
     */
    async logDataModificationEvent(operation, modificationData) {
        await this.logAuditEvent('data_modification', {
            userId: modificationData.userId,
            sessionId: modificationData.sessionId,
            ipAddress: modificationData.ipAddress,
            userAgent: modificationData.userAgent,
            resourceType: modificationData.resourceType,
            resourceId: modificationData.resourceId,
            action: operation,
            details: {
                data_type: modificationData.dataType,
                changes: modificationData.changes,
                old_values: modificationData.oldValues,
                new_values: modificationData.newValues,
                justification: modificationData.justification
            },
            result: modificationData.success ? 'success' : 'failure'
        });
    }
    
    /**
     * Log admin action event
     * @param {string} action - Admin action
     * @param {Object} adminData - Admin data
     */
    async logAdminActionEvent(action, adminData) {
        await this.logAuditEvent('admin_action', {
            userId: adminData.adminUserId,
            sessionId: adminData.sessionId,
            ipAddress: adminData.ipAddress,
            userAgent: adminData.userAgent,
            resourceType: adminData.resourceType,
            resourceId: adminData.resourceId,
            action: action,
            details: {
                target_user: adminData.targetUserId,
                changes: adminData.changes,
                justification: adminData.justification,
                approval_required: adminData.approvalRequired,
                approval_given: adminData.approvalGiven
            },
            result: adminData.success ? 'success' : 'failure'
        });
    }
    
    /**
     * Log consent change event
     * @param {string} action - Consent action
     * @param {Object} consentData - Consent data
     */
    async logConsentChangeEvent(action, consentData) {
        await this.logAuditEvent('consent_change', {
            userId: consentData.userId,
            sessionId: consentData.sessionId,
            ipAddress: consentData.ipAddress,
            userAgent: consentData.userAgent,
            resourceType: 'consent',
            resourceId: consentData.consentId,
            action: action,
            details: {
                consent_type: consentData.consentType,
                old_value: consentData.oldValue,
                new_value: consentData.newValue,
                consent_version: consentData.consentVersion,
                withdrawal_reason: consentData.withdrawalReason
            },
            result: consentData.success ? 'success' : 'failure'
        });
    }
    
    /**
     * Log security event
     * @param {string} eventType - Security event type
     * @param {Object} securityData - Security data
     */
    async logSecurityEvent(eventType, securityData) {
        await this.logAuditEvent('security_event', {
            userId: securityData.userId,
            sessionId: securityData.sessionId,
            ipAddress: securityData.ipAddress,
            userAgent: securityData.userAgent,
            resourceType: 'security',
            resourceId: securityData.eventId,
            action: eventType,
            details: {
                threat_type: securityData.threatType,
                risk_score: securityData.riskScore,
                attack_vector: securityData.attackVector,
                mitigation_applied: securityData.mitigationApplied,
                incident_id: securityData.incidentId
            },
            result: securityData.success ? 'success' : 'failure'
        });
    }
    
    /**
     * Sanitize event data
     * @param {Object} data - Event data
     * @returns {Object} Sanitized data
     */
    sanitizeEventData(data) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                // Mask sensitive data
                if (this.isSensitiveField(key)) {
                    sanitized[key] = this.maskSensitiveData(value);
                } else {
                    sanitized[key] = value;
                }
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeEventData(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    /**
     * Check if field contains sensitive data
     * @param {string} fieldName - Field name
     * @returns {boolean} Is sensitive field
     */
    isSensitiveField(fieldName) {
        const sensitiveFields = [
            'password', 'token', 'secret', 'key', 'ssn', 'credit_card',
            'email', 'phone', 'address', 'name', 'id', 'username'
        ];
        
        return sensitiveFields.some(field => 
            fieldName.toLowerCase().includes(field)
        );
    }
    
    /**
     * Mask sensitive data
     * @param {string} data - Data to mask
     * @returns {string} Masked data
     */
    maskSensitiveData(data) {
        if (!data || typeof data !== 'string') {
            return '[MASKED]';
        }
        
        if (data.length <= 4) {
            return '*'.repeat(data.length);
        }
        
        return '*'.repeat(data.length - 4) + data.slice(-4);
    }
    
    /**
     * Calculate risk level
     * @param {string} operation - Operation type
     * @param {Object} eventData - Event data
     * @returns {string} Risk level
     */
    calculateRiskLevel(operation, eventData) {
        let riskScore = 0;
        
        // Base risk by operation
        const operationRisk = {
            'user_login': 1,
            'user_logout': 0,
            'password_change': 3,
            'data_access': 2,
            'data_modification': 4,
            'data_deletion': 5,
            'data_export': 3,
            'admin_action': 5,
            'privilege_change': 5,
            'consent_change': 2,
            'token_revocation': 3,
            'account_deletion': 5,
            'security_event': 4,
            'configuration_change': 4,
            'system_access': 5
        };
        
        riskScore += operationRisk[operation] || 1;
        
        // Additional risk factors
        if (eventData.result === 'failure') riskScore += 2;
        if (eventData.details?.justification) riskScore -= 1;
        if (eventData.details?.mfa_used) riskScore -= 1;
        if (eventData.details?.approval_required) riskScore -= 1;
        
        // Determine risk level
        if (riskScore >= 5) return 'critical';
        if (riskScore >= 3) return 'high';
        if (riskScore >= 2) return 'medium';
        return 'low';
    }
    
    /**
     * Get compliance category
     * @param {string} operation - Operation type
     * @returns {string} Compliance category
     */
    getComplianceCategory(operation) {
        const categories = {
            'user_login': 'authentication',
            'user_logout': 'authentication',
            'password_change': 'authentication',
            'data_access': 'data_protection',
            'data_modification': 'data_protection',
            'data_deletion': 'data_protection',
            'data_export': 'data_protection',
            'admin_action': 'administrative',
            'privilege_change': 'administrative',
            'consent_change': 'consent',
            'token_revocation': 'authentication',
            'account_deletion': 'data_protection',
            'security_event': 'security',
            'configuration_change': 'administrative',
            'system_access': 'system'
        };
        
        return categories[operation] || 'general';
    }
    
    /**
     * Get retention period
     * @param {string} operation - Operation type
     * @returns {number} Retention period in days
     */
    getRetentionPeriod(operation) {
        const category = this.getComplianceCategory(operation);
        return this.config.retentionPeriods[category] || this.config.retentionPeriods.default;
    }
    
    /**
     * Process critical event immediately
     * @param {Object} event - Critical event
     */
    async processCriticalEvent(event) {
        try {
            await this.storeAuditEvent(event);
            
            this.logger.warn('Critical audit event processed', {
                event_id: event.id,
                operation: event.operation,
                risk_level: event.risk_level
            });
            
        } catch (error) {
            this.logger.error('Failed to process critical event', {
                event_id: event.id,
                error: error.message
            });
        }
    }
    
    /**
     * Start batch processing
     */
    startBatchProcessing() {
        setInterval(async () => {
            if (!this.isProcessing && this.eventBuffer.length > 0) {
                await this.processBatch();
            }
        }, this.config.batchTimeout);
    }
    
    /**
     * Process event batch
     */
    async processBatch() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        
        try {
            const batch = this.eventBuffer.splice(0, this.config.batchSize);
            
            if (batch.length === 0) {
                this.isProcessing = false;
                return;
            }
            
            await this.storeAuditEvents(batch);
            
            this.logger.debug('Audit batch processed', {
                batch_size: batch.length,
                remaining: this.eventBuffer.length
            });
            
        } catch (error) {
            this.logger.error('Batch processing failed', {
                error: error.message,
                batch_size: this.eventBuffer.length
            });
            
            // Add failed events to retry queue
            this.retryQueue.push(...this.eventBuffer.splice(0, this.config.batchSize));
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Start retry processing
     */
    startRetryProcessing() {
        setInterval(async () => {
            if (this.retryQueue.length > 0) {
                await this.processRetryQueue();
            }
        }, 30000); // 30 seconds
    }
    
    /**
     * Process retry queue
     */
    async processRetryQueue() {
        const retryBatch = this.retryQueue.splice(0, this.config.batchSize);
        
        for (const event of retryBatch) {
            try {
                await this.storeAuditEvent(event);
            } catch (error) {
                this.logger.error('Retry failed', {
                    event_id: event.id,
                    error: error.message
                });
                
                // Add back to retry queue if retries remaining
                if (event.retryCount < this.config.maxRetries) {
                    event.retryCount = (event.retryCount || 0) + 1;
                    this.retryQueue.push(event);
                }
            }
        }
    }
    
    /**
     * Store audit event
     * @param {Object} event - Audit event
     */
    async storeAuditEvent(event) {
        try {
            const { error } = await supabase
                .from('audit_logs')
                .insert(event);
            
            if (error) {
                throw new Error(`Database error: ${error.message}`);
            }
            
        } catch (error) {
            this.logger.error('Failed to store audit event', {
                event_id: event.id,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Store audit events
     * @param {Array} events - Audit events
     */
    async storeAuditEvents(events) {
        try {
            const { error } = await supabase
                .from('audit_logs')
                .insert(events);
            
            if (error) {
                throw new Error(`Database error: ${error.message}`);
            }
            
        } catch (error) {
            this.logger.error('Failed to store audit events', {
                batch_size: events.length,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Generate event ID
     * @returns {string} Event ID
     */
    generateEventId() {
        return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get audit statistics
     * @returns {Object} Audit statistics
     */
    getAuditStats() {
        return {
            buffer_size: this.eventBuffer.length,
            retry_queue_size: this.retryQueue.length,
            is_processing: this.isProcessing,
            config: this.config
        };
    }
}

/**
 * Audit middleware for Netlify functions
 * @param {Function} handler - Function handler
 * @param {Object} options - Audit options
 * @returns {Function} Wrapped handler with audit logging
 */
function withAuditLogging(handler, options = {}) {
    const auditLogger = new AuditLogger(options);
    
    return async (event, context) => {
        const startTime = Date.now();
        let result = null;
        let error = null;
        
        try {
            result = await handler(event, context);
            
            // Log successful operation
            await auditLogger.logAuditEvent('api_call', {
                userId: context.user?.id,
                sessionId: context.session?.id,
                ipAddress: event.headers['x-forwarded-for'],
                userAgent: event.headers['user-agent'],
                resourceType: 'api',
                resourceId: event.path,
                action: event.httpMethod,
                details: {
                    endpoint: event.path,
                    method: event.httpMethod,
                    status_code: result.statusCode,
                    duration: Date.now() - startTime
                },
                result: 'success'
            });
            
            return result;
            
        } catch (err) {
            error = err;
            
            // Log failed operation
            await auditLogger.logAuditEvent('api_call', {
                userId: context.user?.id,
                sessionId: context.session?.id,
                ipAddress: event.headers['x-forwarded-for'],
                userAgent: event.headers['user-agent'],
                resourceType: 'api',
                resourceId: event.path,
                action: event.httpMethod,
                details: {
                    endpoint: event.path,
                    method: event.httpMethod,
                    error: err.message,
                    duration: Date.now() - startTime
                },
                result: 'failure'
            });
            
            throw err;
        }
    };
}

// Export functions
module.exports = {
    AuditLogger,
    withAuditLogging,
    AUDIT_CONFIG
};
