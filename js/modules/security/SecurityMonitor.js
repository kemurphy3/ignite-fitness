/**
 * SecurityMonitor - Comprehensive security event logging and monitoring
 * Detects suspicious activity, failed logins, and security events
 */

class SecurityMonitor extends BaseComponent {
    constructor(options = {}) {
        super(options);
        
        this.config = {
            alertThresholds: {
                failedLogins: 5, // Failed logins per hour
                suspiciousActivity: 3, // Suspicious events per hour
                unusualPatterns: 2, // Unusual patterns per hour
                bruteForce: 10, // Attempts per IP per hour
                dataAccess: 100, // Data access per hour
                adminActions: 20 // Admin actions per hour
            },
            monitoringEnabled: options.monitoringEnabled !== false,
            realTimeAlerts: options.realTimeAlerts !== false,
            anomalyDetection: options.anomalyDetection !== false,
            ...options
        };
        
        this.eventBuffer = [];
        this.alertHistory = [];
        this.suspiciousIPs = new Set();
        this.userPatterns = new Map();
        this.incidentCounter = 0;
        
        this.logger = window.SafeLogger || console;
        
        this.init();
    }
    
    /**
     * Initialize security monitor
     */
    init() {
        this.startEventCollection();
        this.startAnomalyDetection();
        this.startAlertProcessing();
        
        this.logger.info('SecurityMonitor initialized', {
            monitoring_enabled: this.config.monitoringEnabled,
            real_time_alerts: this.config.realTimeAlerts,
            anomaly_detection: this.config.anomalyDetection
        });
    }
    
    /**
     * Log security event
     * @param {string} eventType - Type of security event
     * @param {Object} eventData - Event data
     * @param {string} severity - Event severity (low, medium, high, critical)
     */
    async logSecurityEvent(eventType, eventData, severity = 'medium') {
        if (!this.config.monitoringEnabled) return;
        
        const event = {
            id: this.generateEventId(),
            type: eventType,
            severity: severity,
            timestamp: new Date().toISOString(),
            data: eventData,
            ip: await this.getClientIP(),
            userAgent: navigator.userAgent,
            sessionId: this.getSessionId(),
            userId: this.getUserId()
        };
        
        // Add to buffer
        this.eventBuffer.push(event);
        
        // Check for immediate threats
        if (severity === 'critical' || severity === 'high') {
            await this.processImmediateThreat(event);
        }
        
        // Send to server
        await this.sendEventToServer(event);
        
        this.logger.info('Security event logged', {
            event_type: eventType,
            severity: severity,
            event_id: event.id
        });
    }
    
    /**
     * Log failed login attempt
     * @param {Object} loginData - Login attempt data
     */
    async logFailedLogin(loginData) {
        await this.logSecurityEvent('failed_login', {
            username: loginData.username,
            reason: loginData.reason,
            attemptCount: loginData.attemptCount,
            userAgent: loginData.userAgent,
            ip: loginData.ip
        }, 'high');
        
        // Check for brute force
        await this.checkBruteForcePattern(loginData);
    }
    
    /**
     * Log suspicious activity
     * @param {string} activityType - Type of suspicious activity
     * @param {Object} activityData - Activity data
     */
    async logSuspiciousActivity(activityType, activityData) {
        await this.logSecurityEvent('suspicious_activity', {
            activity_type: activityType,
            details: activityData,
            risk_score: this.calculateRiskScore(activityData)
        }, 'medium');
        
        // Update user patterns
        this.updateUserPatterns(activityType, activityData);
    }
    
    /**
     * Log data access event
     * @param {string} operation - Data operation
     * @param {Object} accessData - Access data
     */
    async logDataAccess(operation, accessData) {
        await this.logSecurityEvent('data_access', {
            operation: operation,
            resource: accessData.resource,
            data_type: accessData.dataType,
            record_count: accessData.recordCount,
            user_id: accessData.userId
        }, 'low');
        
        // Check for unusual data access patterns
        await this.checkDataAccessPatterns(operation, accessData);
    }
    
    /**
     * Log admin action
     * @param {string} action - Admin action
     * @param {Object} actionData - Action data
     */
    async logAdminAction(action, actionData) {
        await this.logSecurityEvent('admin_action', {
            action: action,
            target: actionData.target,
            changes: actionData.changes,
            admin_user: actionData.adminUser,
            justification: actionData.justification
        }, 'high');
        
        // Check for privilege escalation
        await this.checkPrivilegeEscalation(action, actionData);
    }
    
    /**
     * Check for brute force patterns
     * @param {Object} loginData - Login data
     */
    async checkBruteForcePattern(loginData) {
        const ip = loginData.ip;
        const timeWindow = 60 * 60 * 1000; // 1 hour
        const now = Date.now();
        
        // Count failed logins for this IP in the last hour
        const recentFailures = this.eventBuffer.filter(event => 
            event.type === 'failed_login' &&
            event.data.ip === ip &&
            (now - new Date(event.timestamp).getTime()) < timeWindow
        );
        
        if (recentFailures.length >= this.config.alertThresholds.bruteForce) {
            await this.triggerAlert('brute_force_detected', {
                ip: ip,
                failure_count: recentFailures.length,
                time_window: timeWindow,
                affected_accounts: [...new Set(recentFailures.map(f => f.data.username))]
            }, 'critical');
            
            this.suspiciousIPs.add(ip);
        }
    }
    
    /**
     * Check data access patterns
     * @param {string} operation - Data operation
     * @param {Object} accessData - Access data
     */
    async checkDataAccessPatterns(operation, accessData) {
        const userId = accessData.userId;
        const timeWindow = 60 * 60 * 1000; // 1 hour
        const now = Date.now();
        
        // Count data access events for this user in the last hour
        const recentAccess = this.eventBuffer.filter(event => 
            event.type === 'data_access' &&
            event.data.user_id === userId &&
            (now - new Date(event.timestamp).getTime()) < timeWindow
        );
        
        if (recentAccess.length >= this.config.alertThresholds.dataAccess) {
            await this.triggerAlert('excessive_data_access', {
                user_id: userId,
                access_count: recentAccess.length,
                time_window: timeWindow,
                operations: recentAccess.map(a => a.data.operation)
            }, 'medium');
        }
    }
    
    /**
     * Check for privilege escalation
     * @param {string} action - Admin action
     * @param {Object} actionData - Action data
     */
    async checkPrivilegeEscalation(action, actionData) {
        const adminUser = actionData.adminUser;
        const timeWindow = 60 * 60 * 1000; // 1 hour
        const now = Date.now();
        
        // Count admin actions for this user in the last hour
        const recentActions = this.eventBuffer.filter(event => 
            event.type === 'admin_action' &&
            event.data.admin_user === adminUser &&
            (now - new Date(event.timestamp).getTime()) < timeWindow
        );
        
        if (recentActions.length >= this.config.alertThresholds.adminActions) {
            await this.triggerAlert('excessive_admin_actions', {
                admin_user: adminUser,
                action_count: recentActions.length,
                time_window: timeWindow,
                actions: recentActions.map(a => a.data.action)
            }, 'high');
        }
    }
    
    /**
     * Update user patterns for anomaly detection
     * @param {string} activityType - Activity type
     * @param {Object} activityData - Activity data
     */
    updateUserPatterns(activityType, activityData) {
        const userId = activityData.userId || 'anonymous';
        
        if (!this.userPatterns.has(userId)) {
            this.userPatterns.set(userId, {
                activities: [],
                lastSeen: Date.now(),
                riskScore: 0
            });
        }
        
        const pattern = this.userPatterns.get(userId);
        pattern.activities.push({
            type: activityType,
            timestamp: Date.now(),
            data: activityData
        });
        
        // Keep only last 100 activities
        if (pattern.activities.length > 100) {
            pattern.activities = pattern.activities.slice(-100);
        }
        
        pattern.lastSeen = Date.now();
        pattern.riskScore = this.calculateUserRiskScore(pattern);
    }
    
    /**
     * Calculate risk score for activity
     * @param {Object} activityData - Activity data
     * @returns {number} Risk score (0-100)
     */
    calculateRiskScore(activityData) {
        let score = 0;
        
        // Base risk factors
        if (activityData.unusualLocation) score += 20;
        if (activityData.unusualTime) score += 15;
        if (activityData.unusualDevice) score += 25;
        if (activityData.unusualBehavior) score += 30;
        if (activityData.suspiciousPattern) score += 35;
        
        return Math.min(score, 100);
    }
    
    /**
     * Calculate user risk score
     * @param {Object} pattern - User pattern
     * @returns {number} Risk score (0-100)
     */
    calculateUserRiskScore(pattern) {
        let score = 0;
        const activities = pattern.activities;
        
        if (activities.length === 0) return 0;
        
        // Recent activity analysis
        const recentActivities = activities.filter(a => 
            Date.now() - a.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
        );
        
        // Unusual frequency
        if (recentActivities.length > 50) score += 20;
        
        // Unusual patterns
        const activityTypes = [...new Set(recentActivities.map(a => a.type))];
        if (activityTypes.length > 10) score += 15;
        
        // High-risk activities
        const highRiskActivities = recentActivities.filter(a => 
            a.data.riskScore > 50
        );
        score += highRiskActivities.length * 5;
        
        return Math.min(score, 100);
    }
    
    /**
     * Process immediate threat
     * @param {Object} event - Security event
     */
    async processImmediateThreat(event) {
        this.incidentCounter++;
        
        // Create incident
        const incident = {
            id: `incident-${this.incidentCounter}`,
            event: event,
            severity: event.severity,
            timestamp: event.timestamp,
            status: 'active',
            response: []
        };
        
        // Immediate response actions
        if (event.severity === 'critical') {
            await this.executeIncidentResponse(incident, 'immediate');
        }
        
        this.logger.warn('Immediate threat processed', {
            incident_id: incident.id,
            event_type: event.type,
            severity: event.severity
        });
    }
    
    /**
     * Execute incident response
     * @param {Object} incident - Security incident
     * @param {string} responseType - Response type
     */
    async executeIncidentResponse(incident, responseType) {
        const responses = {
            immediate: [
                'block_suspicious_ip',
                'notify_security_team',
                'escalate_to_admin'
            ],
            standard: [
                'log_incident',
                'notify_user',
                'monitor_activity'
            ]
        };
        
        const actions = responses[responseType] || responses.standard;
        
        for (const action of actions) {
            try {
                await this.executeResponseAction(action, incident);
                incident.response.push({
                    action: action,
                    timestamp: new Date().toISOString(),
                    status: 'completed'
                });
            } catch (error) {
                this.logger.error('Response action failed', {
                    action: action,
                    incident_id: incident.id,
                    error: error.message
                });
                
                incident.response.push({
                    action: action,
                    timestamp: new Date().toISOString(),
                    status: 'failed',
                    error: error.message
                });
            }
        }
    }
    
    /**
     * Execute response action
     * @param {string} action - Action to execute
     * @param {Object} incident - Security incident
     */
    async executeResponseAction(action, incident) {
        switch (action) {
            case 'block_suspicious_ip':
                await this.blockSuspiciousIP(incident.event.data.ip);
                break;
            case 'notify_security_team':
                await this.notifySecurityTeam(incident);
                break;
            case 'escalate_to_admin':
                await this.escalateToAdmin(incident);
                break;
            case 'log_incident':
                await this.logIncident(incident);
                break;
            case 'notify_user':
                await this.notifyUser(incident);
                break;
            case 'monitor_activity':
                await this.monitorActivity(incident);
                break;
        }
    }
    
    /**
     * Block suspicious IP
     * @param {string} ip - IP address to block
     */
    async blockSuspiciousIP(ip) {
        try {
            await fetch('/.netlify/functions/block-ip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ip: ip,
                    reason: 'suspicious_activity',
                    duration: 24 * 60 * 60 * 1000 // 24 hours
                })
            });
            
            this.logger.info('IP blocked', { ip: ip });
        } catch (error) {
            this.logger.error('Failed to block IP', { ip: ip, error: error.message });
        }
    }
    
    /**
     * Notify security team
     * @param {Object} incident - Security incident
     */
    async notifySecurityTeam(incident) {
        try {
            await fetch('/.netlify/functions/notify-security', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    incident: incident,
                    priority: incident.severity,
                    timestamp: new Date().toISOString()
                })
            });
            
            this.logger.info('Security team notified', {
                incident_id: incident.id,
                severity: incident.severity
            });
        } catch (error) {
            this.logger.error('Failed to notify security team', {
                incident_id: incident.id,
                error: error.message
            });
        }
    }
    
    /**
     * Start event collection
     */
    startEventCollection() {
        // Collect events every 5 minutes
        setInterval(() => {
            this.processEventBuffer();
        }, 5 * 60 * 1000);
    }
    
    /**
     * Start anomaly detection
     */
    startAnomalyDetection() {
        if (!this.config.anomalyDetection) return;
        
        // Run anomaly detection every 10 minutes
        setInterval(() => {
            this.detectAnomalies();
        }, 10 * 60 * 1000);
    }
    
    /**
     * Start alert processing
     */
    startAlertProcessing() {
        if (!this.config.realTimeAlerts) return;
        
        // Process alerts every minute
        setInterval(() => {
            this.processAlerts();
        }, 60 * 1000);
    }
    
    /**
     * Process event buffer
     */
    async processEventBuffer() {
        if (this.eventBuffer.length === 0) return;
        
        try {
            // Send events to server in batches
            const batchSize = 50;
            const batches = [];
            
            for (let i = 0; i < this.eventBuffer.length; i += batchSize) {
                batches.push(this.eventBuffer.slice(i, i + batchSize));
            }
            
            for (const batch of batches) {
                await this.sendEventBatchToServer(batch);
            }
            
            // Clear processed events
            this.eventBuffer = [];
            
        } catch (error) {
            this.logger.error('Failed to process event buffer', {
                error: error.message,
                buffer_size: this.eventBuffer.length
            });
        }
    }
    
    /**
     * Detect anomalies
     */
    async detectAnomalies() {
        try {
            // Analyze user patterns for anomalies
            for (const [userId, pattern] of this.userPatterns.entries()) {
                if (pattern.riskScore > 70) {
                    await this.triggerAlert('user_anomaly_detected', {
                        user_id: userId,
                        risk_score: pattern.riskScore,
                        activity_count: pattern.activities.length,
                        last_seen: pattern.lastSeen
                    }, 'high');
                }
            }
            
        } catch (error) {
            this.logger.error('Anomaly detection failed', {
                error: error.message
            });
        }
    }
    
    /**
     * Process alerts
     */
    async processAlerts() {
        // Process pending alerts
        // Implementation depends on alert system
    }
    
    /**
     * Send event to server
     * @param {Object} event - Security event
     */
    async sendEventToServer(event) {
        try {
            await fetch('/.netlify/functions/log-security-event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            });
        } catch (error) {
            this.logger.error('Failed to send event to server', {
                event_id: event.id,
                error: error.message
            });
        }
    }
    
    /**
     * Send event batch to server
     * @param {Array} events - Security events
     */
    async sendEventBatchToServer(events) {
        try {
            await fetch('/.netlify/functions/log-security-events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ events: events })
            });
        } catch (error) {
            this.logger.error('Failed to send event batch to server', {
                batch_size: events.length,
                error: error.message
            });
        }
    }
    
    /**
     * Generate event ID
     * @returns {string} Event ID
     */
    generateEventId() {
        return `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get client IP
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
            this.logger.warn('Failed to get client IP', { error: error.message });
        }
        return 'unknown';
    }
    
    /**
     * Get session ID
     * @returns {string} Session ID
     */
    getSessionId() {
        return sessionStorage.getItem('session_id') || 'unknown';
    }
    
    /**
     * Get user ID
     * @returns {string} User ID
     */
    getUserId() {
        return localStorage.getItem('user_id') || 'anonymous';
    }
    
    /**
     * Get security statistics
     * @returns {Object} Security statistics
     */
    getSecurityStats() {
        return {
            totalEvents: this.eventBuffer.length,
            suspiciousIPs: this.suspiciousIPs.size,
            userPatterns: this.userPatterns.size,
            incidents: this.incidentCounter,
            alerts: this.alertHistory.length,
            config: this.config
        };
    }
}

// Export for use in other modules
window.SecurityMonitor = SecurityMonitor;
