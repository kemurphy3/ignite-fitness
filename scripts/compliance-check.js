#!/usr/bin/env node

/**
 * Automated Compliance Checking Script
 * Continuously validates GDPR, security controls, and data handling
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Compliance configuration
const COMPLIANCE_CONFIG = {
    // GDPR Requirements
    gdpr: {
        dataMinimization: true,
        consentManagement: true,
        dataRetention: true,
        dataPortability: true,
        rightToErasure: true,
        privacyByDesign: true,
        breachNotification: true
    },

    // Security Controls
    security: {
        encryptionAtRest: true,
        encryptionInTransit: true,
        accessControls: true,
        auditLogging: true,
        inputValidation: true,
        sessionManagement: true,
        securityHeaders: true,
        vulnerabilityScanning: true
    },

    // Data Handling
    dataHandling: {
        dataClassification: true,
        dataRetention: true,
        dataDisposal: true,
        dataBackup: true,
        dataRecovery: true,
        dataIntegrity: true,
        dataAvailability: true
    },

    // Compliance thresholds
    thresholds: {
        minComplianceScore: 80,
        maxViolations: 5,
        maxHighRiskViolations: 2,
        maxCriticalViolations: 0
    }
};

class ComplianceChecker {
    constructor(options = {}) {
        this.config = { ...COMPLIANCE_CONFIG, ...options };
        this.results = {
            gdpr: {},
            security: {},
            dataHandling: {},
            violations: [],
            score: 0,
            timestamp: new Date().toISOString()
        };

        this.logger = console;
    }

    /**
     * Run comprehensive compliance check
     */
    async runComplianceCheck() {
        this.logger.log('🔍 Starting automated compliance check...');

        try {
            // Run all compliance checks
            await Promise.all([
                this.checkGDPRCompliance(),
                this.checkSecurityControls(),
                this.checkDataHandling(),
                this.checkCodeCompliance(),
                this.checkConfigurationCompliance()
            ]);

            // Calculate overall compliance score
            this.calculateComplianceScore();

            // Generate compliance report
            this.generateComplianceReport();

            // Check if compliance thresholds are met
            const isCompliant = this.checkComplianceThresholds();

            this.logger.log(`✅ Compliance check completed. Score: ${this.results.score}%`);
            this.logger.log(`📊 Compliance status: ${isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}`);

            return {
                compliant: isCompliant,
                score: this.results.score,
                results: this.results
            };

        } catch (error) {
            this.logger.error('❌ Compliance check failed:', error.message);
            throw error;
        }
    }

    /**
     * Check GDPR compliance
     */
    async checkGDPRCompliance() {
        this.logger.log('🔒 Checking GDPR compliance...');

        const gdprChecks = {
            dataMinimization: await this.checkDataMinimization(),
            consentManagement: await this.checkConsentManagement(),
            dataRetention: await this.checkDataRetention(),
            dataPortability: await this.checkDataPortability(),
            rightToErasure: await this.checkRightToErasure(),
            privacyByDesign: await this.checkPrivacyByDesign(),
            breachNotification: await this.checkBreachNotification()
        };

        this.results.gdpr = gdprChecks;

        const passedChecks = Object.values(gdprChecks).filter(check => check.passed).length;
        const totalChecks = Object.keys(gdprChecks).length;

        this.logger.log(`📋 GDPR: ${passedChecks}/${totalChecks} checks passed`);
    }

    /**
     * Check security controls
     */
    async checkSecurityControls() {
        this.logger.log('🛡️ Checking security controls...');

        const securityChecks = {
            encryptionAtRest: await this.checkEncryptionAtRest(),
            encryptionInTransit: await this.checkEncryptionInTransit(),
            accessControls: await this.checkAccessControls(),
            auditLogging: await this.checkAuditLogging(),
            inputValidation: await this.checkInputValidation(),
            sessionManagement: await this.checkSessionManagement(),
            securityHeaders: await this.checkSecurityHeaders(),
            vulnerabilityScanning: await this.checkVulnerabilityScanning()
        };

        this.results.security = securityChecks;

        const passedChecks = Object.values(securityChecks).filter(check => check.passed).length;
        const totalChecks = Object.keys(securityChecks).length;

        this.logger.log(`🔐 Security: ${passedChecks}/${totalChecks} checks passed`);
    }

    /**
     * Check data handling
     */
    async checkDataHandling() {
        this.logger.log('📊 Checking data handling...');

        const dataHandlingChecks = {
            dataClassification: await this.checkDataClassification(),
            dataRetention: await this.checkDataRetention(),
            dataDisposal: await this.checkDataDisposal(),
            dataBackup: await this.checkDataBackup(),
            dataRecovery: await this.checkDataRecovery(),
            dataIntegrity: await this.checkDataIntegrity(),
            dataAvailability: await this.checkDataAvailability()
        };

        this.results.dataHandling = dataHandlingChecks;

        const passedChecks = Object.values(dataHandlingChecks).filter(check => check.passed).length;
        const totalChecks = Object.keys(dataHandlingChecks).length;

        this.logger.log(`💾 Data Handling: ${passedChecks}/${totalChecks} checks passed`);
    }

    /**
     * Check code compliance
     */
    async checkCodeCompliance() {
        this.logger.log('💻 Checking code compliance...');

        try {
            // Check for security vulnerabilities in code
            const codeChecks = {
                sqlInjection: await this.checkSQLInjection(),
                xssVulnerabilities: await this.checkXSSVulnerabilities(),
                csrfProtection: await this.checkCSRFProtection(),
                authenticationBypass: await this.checkAuthenticationBypass(),
                authorizationIssues: await this.checkAuthorizationIssues(),
                dataExposure: await this.checkDataExposure(),
                insecureCrypto: await this.checkInsecureCrypto(),
                hardcodedSecrets: await this.checkHardcodedSecrets()
            };

            // Add code checks to results
            Object.assign(this.results, codeChecks);

            const passedChecks = Object.values(codeChecks).filter(check => check.passed).length;
            const totalChecks = Object.keys(codeChecks).length;

            this.logger.log(`🔍 Code Security: ${passedChecks}/${totalChecks} checks passed`);

        } catch (error) {
            this.logger.error('Code compliance check failed:', error.message);
        }
    }

    /**
     * Check configuration compliance
     */
    async checkConfigurationCompliance() {
        this.logger.log('⚙️ Checking configuration compliance...');

        try {
            const configChecks = {
                environmentVariables: await this.checkEnvironmentVariables(),
                databaseConfiguration: await this.checkDatabaseConfiguration(),
                apiConfiguration: await this.checkAPIConfiguration(),
                loggingConfiguration: await this.checkLoggingConfiguration(),
                monitoringConfiguration: await this.checkMonitoringConfiguration()
            };

            // Add config checks to results
            Object.assign(this.results, configChecks);

            const passedChecks = Object.values(configChecks).filter(check => check.passed).length;
            const totalChecks = Object.keys(configChecks).length;

            this.logger.log(`🔧 Configuration: ${passedChecks}/${totalChecks} checks passed`);

        } catch (error) {
            this.logger.error('Configuration compliance check failed:', error.message);
        }
    }

    // GDPR Compliance Checks

    async checkDataMinimization() {
        try {
            // Check if data collection is minimized
            const hasDataMinimization = this.checkFileExists('js/modules/data/DataMinimizer.js');
            const hasPrivacyPolicy = this.checkFileExists('docs/PRIVACY_POLICY.md');

            return {
                passed: hasDataMinimization && hasPrivacyPolicy,
                details: {
                    dataMinimizer: hasDataMinimization,
                    privacyPolicy: hasPrivacyPolicy
                },
                recommendations: hasDataMinimization ? [] : ['Implement data minimization practices']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkConsentManagement() {
        try {
            const hasConsentManager = this.checkFileExists('js/modules/settings/ConsentManager.js');
            const hasConsentAPI = this.checkFileExists('netlify/functions/record-consent.js');

            return {
                passed: hasConsentManager && hasConsentAPI,
                details: {
                    consentManager: hasConsentManager,
                    consentAPI: hasConsentAPI
                },
                recommendations: hasConsentManager ? [] : ['Implement consent management system']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkDataRetention() {
        try {
            const hasRetentionPolicy = this.checkFileExists('netlify/functions/jobs/data-cleanup.js');
            const hasRetentionConfig = this.checkFileExists('env.example');

            return {
                passed: hasRetentionPolicy && hasRetentionConfig,
                details: {
                    retentionPolicy: hasRetentionPolicy,
                    retentionConfig: hasRetentionConfig
                },
                recommendations: hasRetentionPolicy ? [] : ['Implement data retention policies']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkDataPortability() {
        try {
            const hasDataExport = this.checkFileExists('netlify/functions/data-export.js');
            const hasExportUI = this.checkFileExists('js/modules/settings/PrivacyPanel.js');

            return {
                passed: hasDataExport && hasExportUI,
                details: {
                    dataExport: hasDataExport,
                    exportUI: hasExportUI
                },
                recommendations: hasDataExport ? [] : ['Implement data export functionality']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkRightToErasure() {
        try {
            const hasDataDeletion = this.checkFileExists('netlify/functions/data-deletion.js');
            const hasDeletionUI = this.checkFileExists('js/modules/settings/PrivacyPanel.js');

            return {
                passed: hasDataDeletion && hasDeletionUI,
                details: {
                    dataDeletion: hasDataDeletion,
                    deletionUI: hasDeletionUI
                },
                recommendations: hasDataDeletion ? [] : ['Implement right to erasure functionality']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkPrivacyByDesign() {
        try {
            const hasPrivacyPanel = this.checkFileExists('js/modules/settings/PrivacyPanel.js');
            const hasDataProtection = this.checkFileExists('docs/DATA_PROTECTION_IMPLEMENTATION.md');

            return {
                passed: hasPrivacyPanel && hasDataProtection,
                details: {
                    privacyPanel: hasPrivacyPanel,
                    dataProtection: hasDataProtection
                },
                recommendations: hasPrivacyPanel ? [] : ['Implement privacy by design principles']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkBreachNotification() {
        try {
            const hasIncidentResponse = this.checkFileExists('docs/SECURITY.md');
            const hasNotificationSystem = this.checkFileExists('js/modules/security/SecurityMonitor.js');

            return {
                passed: hasIncidentResponse && hasNotificationSystem,
                details: {
                    incidentResponse: hasIncidentResponse,
                    notificationSystem: hasNotificationSystem
                },
                recommendations: hasIncidentResponse ? [] : ['Implement breach notification procedures']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    // Security Control Checks

    async checkEncryptionAtRest() {
        try {
            const hasEncryption = this.checkFileExists('netlify/functions/utils/encryption.js');
            const hasSecureStorage = this.checkFileExists('js/modules/data/SecureStorage.js');

            return {
                passed: hasEncryption && hasSecureStorage,
                details: {
                    encryption: hasEncryption,
                    secureStorage: hasSecureStorage
                },
                recommendations: hasEncryption ? [] : ['Implement encryption at rest']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkEncryptionInTransit() {
        try {
            const hasHTTPS = this.checkFileExists('netlify.toml');
            const hasSecurityHeaders = this.checkFileExists('netlify/functions/utils/security-headers.js');

            return {
                passed: hasHTTPS && hasSecurityHeaders,
                details: {
                    https: hasHTTPS,
                    securityHeaders: hasSecurityHeaders
                },
                recommendations: hasHTTPS ? [] : ['Ensure HTTPS enforcement']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkAccessControls() {
        try {
            const hasAuth = this.checkFileExists('netlify/functions/utils/auth.js');
            const hasSessionManager = this.checkFileExists('js/modules/auth/SessionManager.js');

            return {
                passed: hasAuth && hasSessionManager,
                details: {
                    authentication: hasAuth,
                    sessionManagement: hasSessionManager
                },
                recommendations: hasAuth ? [] : ['Implement proper access controls']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkAuditLogging() {
        try {
            const hasAuditLogger = this.checkFileExists('netlify/functions/utils/audit-logger.js');
            const hasSecurityMonitor = this.checkFileExists('js/modules/security/SecurityMonitor.js');

            return {
                passed: hasAuditLogger && hasSecurityMonitor,
                details: {
                    auditLogger: hasAuditLogger,
                    securityMonitor: hasSecurityMonitor
                },
                recommendations: hasAuditLogger ? [] : ['Implement comprehensive audit logging']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkInputValidation() {
        try {
            const hasSanitizer = this.checkFileExists('netlify/functions/utils/sanitizer.js');
            const hasValidation = this.checkFileExists('js/modules/validation/InputValidator.js');

            return {
                passed: hasSanitizer && hasValidation,
                details: {
                    sanitizer: hasSanitizer,
                    validator: hasValidation
                },
                recommendations: hasSanitizer ? [] : ['Implement input validation and sanitization']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkSessionManagement() {
        try {
            const hasSessionManager = this.checkFileExists('js/modules/auth/SessionManager.js');
            const hasCSRF = this.checkFileExists('netlify/functions/utils/csrf.js');

            return {
                passed: hasSessionManager && hasCSRF,
                details: {
                    sessionManager: hasSessionManager,
                    csrfProtection: hasCSRF
                },
                recommendations: hasSessionManager ? [] : ['Implement secure session management']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkSecurityHeaders() {
        try {
            const hasSecurityHeaders = this.checkFileExists('netlify/functions/utils/security-headers.js');
            const hasCSP = this.checkFileExists('netlify/functions/csp-report.js');

            return {
                passed: hasSecurityHeaders && hasCSP,
                details: {
                    securityHeaders: hasSecurityHeaders,
                    cspReporting: hasCSP
                },
                recommendations: hasSecurityHeaders ? [] : ['Implement security headers']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkVulnerabilityScanning() {
        try {
            const hasSecurityScan = this.checkFileExists('.github/workflows/security-scan.yml');
            const hasDependencyScan = this.checkFileExists('package.json');

            return {
                passed: hasSecurityScan && hasDependencyScan,
                details: {
                    securityScan: hasSecurityScan,
                    dependencyScan: hasDependencyScan
                },
                recommendations: hasSecurityScan ? [] : ['Implement vulnerability scanning']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    // Data Handling Checks

    async checkDataClassification() {
        try {
            const hasClassification = this.checkFileExists('js/modules/data/DataClassifier.js');
            const hasDataProtection = this.checkFileExists('docs/DATA_PROTECTION_IMPLEMENTATION.md');

            return {
                passed: hasClassification && hasDataProtection,
                details: {
                    classification: hasClassification,
                    dataProtection: hasDataProtection
                },
                recommendations: hasClassification ? [] : ['Implement data classification']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkDataDisposal() {
        try {
            const hasDataCleanup = this.checkFileExists('netlify/functions/jobs/data-cleanup.js');
            const hasRetentionPolicy = this.checkFileExists('docs/DATA_PROTECTION_IMPLEMENTATION.md');

            return {
                passed: hasDataCleanup && hasRetentionPolicy,
                details: {
                    dataCleanup: hasDataCleanup,
                    retentionPolicy: hasRetentionPolicy
                },
                recommendations: hasDataCleanup ? [] : ['Implement secure data disposal']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkDataBackup() {
        try {
            const hasBackupStrategy = this.checkFileExists('docs/BACKUP_STRATEGY.md');
            const hasRecoveryPlan = this.checkFileExists('docs/DISASTER_RECOVERY.md');

            return {
                passed: hasBackupStrategy && hasRecoveryPlan,
                details: {
                    backupStrategy: hasBackupStrategy,
                    recoveryPlan: hasRecoveryPlan
                },
                recommendations: hasBackupStrategy ? [] : ['Implement data backup strategy']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkDataRecovery() {
        try {
            const hasRecoveryPlan = this.checkFileExists('docs/DISASTER_RECOVERY.md');
            const hasBackupStrategy = this.checkFileExists('docs/BACKUP_STRATEGY.md');

            return {
                passed: hasRecoveryPlan && hasBackupStrategy,
                details: {
                    recoveryPlan: hasRecoveryPlan,
                    backupStrategy: hasBackupStrategy
                },
                recommendations: hasRecoveryPlan ? [] : ['Implement data recovery procedures']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkDataIntegrity() {
        try {
            const hasIntegrityChecks = this.checkFileExists('js/modules/data/DataIntegrity.js');
            const hasValidation = this.checkFileExists('js/modules/validation/DataValidator.js');

            return {
                passed: hasIntegrityChecks && hasValidation,
                details: {
                    integrityChecks: hasIntegrityChecks,
                    validation: hasValidation
                },
                recommendations: hasIntegrityChecks ? [] : ['Implement data integrity checks']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkDataAvailability() {
        try {
            const hasMonitoring = this.checkFileExists('js/modules/monitoring/SystemMonitor.js');
            const hasUptimeTracking = this.checkFileExists('netlify/functions/health-check.js');

            return {
                passed: hasMonitoring && hasUptimeTracking,
                details: {
                    monitoring: hasMonitoring,
                    uptimeTracking: hasUptimeTracking
                },
                recommendations: hasMonitoring ? [] : ['Implement data availability monitoring']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    // Code Security Checks

    async checkSQLInjection() {
        try {
            const hasSanitizer = this.checkFileExists('netlify/functions/utils/sanitizer.js');
            const hasParameterizedQueries = this.checkFileExists('netlify/functions/utils/database.js');

            return {
                passed: hasSanitizer && hasParameterizedQueries,
                details: {
                    sanitizer: hasSanitizer,
                    parameterizedQueries: hasParameterizedQueries
                },
                recommendations: hasSanitizer ? [] : ['Implement SQL injection protection']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkXSSVulnerabilities() {
        try {
            const hasSanitizer = this.checkFileExists('netlify/functions/utils/sanitizer.js');
            const hasDOMPurify = this.checkFileExists('package.json');

            return {
                passed: hasSanitizer && hasDOMPurify,
                details: {
                    sanitizer: hasSanitizer,
                    domPurify: hasDOMPurify
                },
                recommendations: hasSanitizer ? [] : ['Implement XSS protection']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkCSRFProtection() {
        try {
            const hasCSRF = this.checkFileExists('netlify/functions/utils/csrf.js');
            const hasCSRFMiddleware = this.checkFileExists('netlify/functions/utils/csrf.js');

            return {
                passed: hasCSRF && hasCSRFMiddleware,
                details: {
                    csrfProtection: hasCSRF,
                    csrfMiddleware: hasCSRFMiddleware
                },
                recommendations: hasCSRF ? [] : ['Implement CSRF protection']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkAuthenticationBypass() {
        try {
            const hasAuth = this.checkFileExists('netlify/functions/utils/auth.js');
            const hasSessionManager = this.checkFileExists('js/modules/auth/SessionManager.js');

            return {
                passed: hasAuth && hasSessionManager,
                details: {
                    authentication: hasAuth,
                    sessionManager: hasSessionManager
                },
                recommendations: hasAuth ? [] : ['Implement proper authentication']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkAuthorizationIssues() {
        try {
            const hasAuth = this.checkFileExists('netlify/functions/utils/auth.js');
            const hasRBAC = this.checkFileExists('js/modules/auth/RoleManager.js');

            return {
                passed: hasAuth && hasRBAC,
                details: {
                    authentication: hasAuth,
                    rbac: hasRBAC
                },
                recommendations: hasAuth ? [] : ['Implement proper authorization']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkDataExposure() {
        try {
            const hasAuditLogger = this.checkFileExists('netlify/functions/utils/audit-logger.js');
            const hasDataProtection = this.checkFileExists('docs/DATA_PROTECTION_IMPLEMENTATION.md');

            return {
                passed: hasAuditLogger && hasDataProtection,
                details: {
                    auditLogger: hasAuditLogger,
                    dataProtection: hasDataProtection
                },
                recommendations: hasAuditLogger ? [] : ['Implement data exposure protection']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkInsecureCrypto() {
        try {
            const hasSecureCrypto = this.checkFileExists('netlify/functions/utils/crypto.js');
            const hasJWTValidation = this.checkFileExists('netlify/functions/utils/auth.js');

            return {
                passed: hasSecureCrypto && hasJWTValidation,
                details: {
                    secureCrypto: hasSecureCrypto,
                    jwtValidation: hasJWTValidation
                },
                recommendations: hasSecureCrypto ? [] : ['Implement secure cryptography']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkHardcodedSecrets() {
        try {
            const hasEnvTemplate = this.checkFileExists('env.example');
            const hasSecretsManagement = this.checkFileExists('docs/SECURITY.md');

            return {
                passed: hasEnvTemplate && hasSecretsManagement,
                details: {
                    envTemplate: hasEnvTemplate,
                    secretsManagement: hasSecretsManagement
                },
                recommendations: hasEnvTemplate ? [] : ['Implement proper secrets management']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    // Configuration Checks

    async checkEnvironmentVariables() {
        try {
            const hasEnvTemplate = this.checkFileExists('env.example');
            const hasEnvValidation = this.checkFileExists('netlify/functions/utils/env-validator.js');

            return {
                passed: hasEnvTemplate && hasEnvValidation,
                details: {
                    envTemplate: hasEnvTemplate,
                    envValidation: hasEnvValidation
                },
                recommendations: hasEnvTemplate ? [] : ['Implement environment variable validation']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkDatabaseConfiguration() {
        try {
            const hasDatabaseConfig = this.checkFileExists('netlify/functions/utils/database.js');
            const hasConnectionPooling = this.checkFileExists('netlify/functions/utils/connection-pool.js');

            return {
                passed: hasDatabaseConfig && hasConnectionPooling,
                details: {
                    databaseConfig: hasDatabaseConfig,
                    connectionPooling: hasConnectionPooling
                },
                recommendations: hasDatabaseConfig ? [] : ['Implement secure database configuration']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkAPIConfiguration() {
        try {
            const hasRateLimiting = this.checkFileExists('netlify/functions/utils/rate-limiter.js');
            const hasAPISecurity = this.checkFileExists('netlify/functions/utils/api-security.js');

            return {
                passed: hasRateLimiting && hasAPISecurity,
                details: {
                    rateLimiting: hasRateLimiting,
                    apiSecurity: hasAPISecurity
                },
                recommendations: hasRateLimiting ? [] : ['Implement API security configuration']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkLoggingConfiguration() {
        try {
            const hasSafeLogging = this.checkFileExists('netlify/functions/utils/safe-logging.js');
            const hasAuditLogger = this.checkFileExists('netlify/functions/utils/audit-logger.js');

            return {
                passed: hasSafeLogging && hasAuditLogger,
                details: {
                    safeLogging: hasSafeLogging,
                    auditLogger: hasAuditLogger
                },
                recommendations: hasSafeLogging ? [] : ['Implement secure logging configuration']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async checkMonitoringConfiguration() {
        try {
            const hasSecurityMonitor = this.checkFileExists('js/modules/security/SecurityMonitor.js');
            const hasSystemMonitor = this.checkFileExists('js/modules/monitoring/SystemMonitor.js');

            return {
                passed: hasSecurityMonitor && hasSystemMonitor,
                details: {
                    securityMonitor: hasSecurityMonitor,
                    systemMonitor: hasSystemMonitor
                },
                recommendations: hasSecurityMonitor ? [] : ['Implement monitoring configuration']
            };
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    /**
     * Calculate overall compliance score
     */
    calculateComplianceScore() {
        let totalChecks = 0;
        let passedChecks = 0;

        // Count all checks
        const allChecks = [
            this.results.gdpr,
            this.results.security,
            this.results.dataHandling
        ];

        allChecks.forEach(category => {
            Object.values(category).forEach(check => {
                totalChecks++;
                if (check.passed) {
                    passedChecks++;
                }
            });
        });

        // Calculate score
        this.results.score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

        this.logger.log(`📊 Compliance Score: ${this.results.score}% (${passedChecks}/${totalChecks} checks passed)`);
    }

    /**
     * Check compliance thresholds
     */
    checkComplianceThresholds() {
        const {thresholds} = this.config;

        // Check minimum compliance score
        if (this.results.score < thresholds.minComplianceScore) {
            this.addViolation('compliance_score', 'Compliance score below threshold', 'high');
        }

        // Check violation counts
        const {violations} = this.results;
        const criticalViolations = violations.filter(v => v.severity === 'critical').length;
        const highViolations = violations.filter(v => v.severity === 'high').length;

        if (criticalViolations > thresholds.maxCriticalViolations) {
            this.addViolation('critical_violations', 'Too many critical violations', 'critical');
        }

        if (highViolations > thresholds.maxHighRiskViolations) {
            this.addViolation('high_violations', 'Too many high-risk violations', 'high');
        }

        if (violations.length > thresholds.maxViolations) {
            this.addViolation('total_violations', 'Too many total violations', 'medium');
        }

        return this.results.score >= thresholds.minComplianceScore &&
               criticalViolations <= thresholds.maxCriticalViolations &&
               highViolations <= thresholds.maxHighRiskViolations &&
               violations.length <= thresholds.maxViolations;
    }

    /**
     * Add compliance violation
     */
    addViolation(type, description, severity) {
        this.results.violations.push({
            type,
            description,
            severity,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Generate compliance report
     */
    generateComplianceReport() {
        const report = {
            summary: {
                score: this.results.score,
                compliant: this.checkComplianceThresholds(),
                timestamp: this.results.timestamp
            },
            gdpr: this.results.gdpr,
            security: this.results.security,
            dataHandling: this.results.dataHandling,
            violations: this.results.violations,
            recommendations: this.generateRecommendations()
        };

        // Save report to file
        const reportPath = path.join(process.cwd(), 'compliance-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        this.logger.log(`📄 Compliance report saved to: ${reportPath}`);

        return report;
    }

    /**
     * Generate recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        // Collect recommendations from all checks
        const allChecks = [
            this.results.gdpr,
            this.results.security,
            this.results.dataHandling
        ];

        allChecks.forEach(category => {
            Object.values(category).forEach(check => {
                if (check.recommendations) {
                    recommendations.push(...check.recommendations);
                }
            });
        });

        return [...new Set(recommendations)]; // Remove duplicates
    }

    /**
     * Check if file exists
     */
    checkFileExists(filePath) {
        try {
            return fs.existsSync(path.join(process.cwd(), filePath));
        } catch (error) {
            return false;
        }
    }
}

// CLI interface
if (require.main === module) {
    const checker = new ComplianceChecker();

    checker.runComplianceCheck()
        .then(result => {
            if (result.compliant) {
                console.log('✅ Compliance check passed');
                process.exit(0);
            } else {
                console.log('❌ Compliance check failed');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Compliance check error:', error.message);
            process.exit(1);
        });
}

module.exports = ComplianceChecker;
