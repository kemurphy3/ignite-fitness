/**
 * Security Audit Script
 * Comprehensive security validation for all implemented security features
 */

const SafeLogger = require('./utils/safe-logging');
const { validateJWTSecret, generateSecureSecret, initializeJWTValidation } = require('./utils/auth');
const { validateCSRFToken, generateCSRFToken, getCSRFStats } = require('./utils/csrf');

// Create audit logger
const logger = SafeLogger.create({
    enableMasking: true,
    visibleChars: 4,
    maskChar: '*'
});

/**
 * Security Audit Results
 */
class SecurityAudit {
    constructor() {
        this.results = {
            token_masking: { passed: false, details: [] },
            token_revocation: { passed: false, details: [] },
            csrf_protection: { passed: false, details: [] },
            jwt_validation: { passed: false, details: [] },
            overall_score: 0,
            critical_issues: [],
            recommendations: []
        };
    }

    /**
     * Run complete security audit
     */
    async runAudit() {
        logger.info('Starting comprehensive security audit');

        try {
            // Test token masking
            await this.testTokenMasking();

            // Test token revocation
            await this.testTokenRevocation();

            // Test CSRF protection
            await this.testCSRFProtection();

            // Test JWT validation
            await this.testJWTValidation();

            // Calculate overall score
            this.calculateOverallScore();

            // Generate report
            this.generateReport();

        } catch (error) {
            logger.error('Security audit failed', {
                error: error.message,
                stack: error.stack
            });

            this.results.critical_issues.push(`Audit execution failed: ${ error.message}`);
        }
    }

    /**
     * Test token masking functionality
     */
    async testTokenMasking() {
        logger.info('Testing token masking');

        try {
            // Test various token formats
            const testTokens = [
                'access_token_1234567890abcdef',
                'refresh_token_abcdef1234567890',
                'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
                'authorization: Bearer token123',
                'password: secret123',
                'api_key: sk-1234567890abcdef'
            ];

            let maskingTestsPassed = 0;

            for (const token of testTokens) {
                const masked = SafeLogger.maskToken(token);

                // Check if token is properly masked
                if (masked !== token && masked.includes('*')) {
                    maskingTestsPassed++;
                    logger.debug('Token masking test passed', {
                        original: token,
                        masked
                    });
                } else {
                    this.results.token_masking.details.push(`Failed to mask token: ${token}`);
                }
            }

            // Test object masking
            const testObject = {
                access_token: 'token123',
                refresh_token: 'refresh456',
                user_data: {
                    password: 'secret789',
                    api_key: 'key123'
                }
            };

            const maskedObject = SafeLogger.maskObject(testObject);

            if (maskedObject.access_token !== testObject.access_token &&
                maskedObject.user_data.password !== testObject.user_data.password) {
                maskingTestsPassed++;
                logger.debug('Object masking test passed');
            } else {
                this.results.token_masking.details.push('Failed to mask object properties');
            }

            // Check if all tests passed
            if (maskingTestsPassed >= testTokens.length) {
                this.results.token_masking.passed = true;
                logger.info('Token masking tests passed');
            } else {
                this.results.token_masking.details.push(`Only ${maskingTestsPassed}/${testTokens.length} tests passed`);
            }

        } catch (error) {
            this.results.token_masking.details.push(`Token masking test failed: ${ error.message}`);
            logger.error('Token masking test error', { error: error.message });
        }
    }

    /**
     * Test token revocation functionality
     */
    async testTokenRevocation() {
        logger.info('Testing token revocation');

        try {
            // Test revocation endpoint exists
            const fs = require('fs');
            const path = require('path');

            const revocationFile = path.join(__dirname, 'strava-revoke-token.js');

            if (fs.existsSync(revocationFile)) {
                this.results.token_revocation.passed = true;
                logger.info('Token revocation endpoint exists');

                // Check for required security features
                const fileContent = fs.readFileSync(revocationFile, 'utf8');

                const securityChecks = [
                    { feature: 'Safe logging', pattern: /SafeLogger/ },
                    { feature: 'Token masking', pattern: /maskToken/ },
                    { feature: 'Database cleanup', pattern: /clearTokensFromDatabase/ },
                    { feature: 'Audit logging', pattern: /logTokenRevocation/ },
                    { feature: 'Error handling', pattern: /try.*catch/ },
                    { feature: 'CORS headers', pattern: /Access-Control-Allow-Origin/ }
                ];

                let securityChecksPassed = 0;

                for (const check of securityChecks) {
                    if (check.pattern.test(fileContent)) {
                        securityChecksPassed++;
                        logger.debug(`Security check passed: ${check.feature}`);
                    } else {
                        this.results.token_revocation.details.push(`Missing: ${check.feature}`);
                    }
                }

                if (securityChecksPassed === securityChecks.length) {
                    logger.info('All token revocation security checks passed');
                } else {
                    this.results.token_revocation.details.push(`Only ${securityChecksPassed}/${securityChecks.length} security checks passed`);
                }

            } else {
                this.results.token_revocation.details.push('Token revocation endpoint not found');
            }

        } catch (error) {
            this.results.token_revocation.details.push(`Token revocation test failed: ${ error.message}`);
            logger.error('Token revocation test error', { error: error.message });
        }
    }

    /**
     * Test CSRF protection functionality
     */
    async testCSRFProtection() {
        logger.info('Testing CSRF protection');

        try {
            // Test CSRF token generation
            const sessionId = 'test_session_123';
            const token = generateCSRFToken(sessionId);

            if (token && token.length >= 32) {
                logger.debug('CSRF token generation test passed');

                // Test CSRF token validation
                const isValid = validateCSRFToken(token, sessionId);

                if (isValid) {
                    logger.debug('CSRF token validation test passed');

                    // Test invalid token rejection
                    const invalidToken = 'invalid_token_123';
                    const isInvalid = validateCSRFToken(invalidToken, sessionId);

                    if (!isInvalid) {
                        logger.debug('CSRF invalid token rejection test passed');

                        // Test session mismatch rejection
                        const wrongSession = 'wrong_session_456';
                        const isSessionMismatch = validateCSRFToken(token, wrongSession);

                        if (!isSessionMismatch) {
                            logger.debug('CSRF session mismatch test passed');

                            this.results.csrf_protection.passed = true;
                            logger.info('CSRF protection tests passed');

                        } else {
                            this.results.csrf_protection.details.push('CSRF session mismatch test failed');
                        }
                    } else {
                        this.results.csrf_protection.details.push('CSRF invalid token rejection test failed');
                    }
                } else {
                    this.results.csrf_protection.details.push('CSRF token validation test failed');
                }
            } else {
                this.results.csrf_protection.details.push('CSRF token generation test failed');
            }

            // Test CSRF statistics
            const stats = getCSRFStats();
            if (stats && typeof stats.active_tokens === 'number') {
                logger.debug('CSRF statistics test passed');
            } else {
                this.results.csrf_protection.details.push('CSRF statistics test failed');
            }

        } catch (error) {
            this.results.csrf_protection.details.push(`CSRF protection test failed: ${ error.message}`);
            logger.error('CSRF protection test error', { error: error.message });
        }
    }

    /**
     * Test JWT validation functionality
     */
    async testJWTValidation() {
        logger.info('Testing JWT validation');

        try {
            // Test secure secret generation
            const secureSecret = generateSecureSecret();
            const validation = validateJWTSecret(secureSecret);

            if (validation.isValid && validation.entropy >= 256) {
                logger.debug('Secure secret generation test passed');

                // Test weak secret rejection
                const weakSecrets = ['password', '123456', 'secret', 'admin'];
                let weakSecretTestsPassed = 0;

                for (const weakSecret of weakSecrets) {
                    const weakValidation = validateJWTSecret(weakSecret);

                    if (!weakValidation.isValid) {
                        weakSecretTestsPassed++;
                        logger.debug(`Weak secret rejection test passed: ${weakSecret}`);
                    } else {
                        this.results.jwt_validation.details.push(`Failed to reject weak secret: ${weakSecret}`);
                    }
                }

                if (weakSecretTestsPassed === weakSecrets.length) {
                    logger.debug('Weak secret rejection tests passed');

                    // Test environment validation
                    const envValidation = initializeJWTValidation('TEST_JWT_SECRET');

                    if (envValidation === false) {
                        logger.debug('Environment validation test passed (correctly failed)');

                        this.results.jwt_validation.passed = true;
                        logger.info('JWT validation tests passed');

                    } else {
                        this.results.jwt_validation.details.push('Environment validation test failed');
                    }
                } else {
                    this.results.jwt_validation.details.push(`Only ${weakSecretTestsPassed}/${weakSecrets.length} weak secret tests passed`);
                }
            } else {
                this.results.jwt_validation.details.push('Secure secret generation test failed');
            }

        } catch (error) {
            this.results.jwt_validation.details.push(`JWT validation test failed: ${ error.message}`);
            logger.error('JWT validation test error', { error: error.message });
        }
    }

    /**
     * Calculate overall security score
     */
    calculateOverallScore() {
        const tests = [
            this.results.token_masking,
            this.results.token_revocation,
            this.results.csrf_protection,
            this.results.jwt_validation
        ];

        const passedTests = tests.filter(test => test.passed).length;
        this.results.overall_score = Math.round((passedTests / tests.length) * 100);

        logger.info('Security audit score calculated', {
            score: this.results.overall_score,
            passed_tests: passedTests,
            total_tests: tests.length
        });
    }

    /**
     * Generate security audit report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            overall_score: this.results.overall_score,
            test_results: this.results,
            summary: this.generateSummary(),
            recommendations: this.generateRecommendations()
        };

        logger.info('Security audit report generated', {
            overall_score: report.overall_score,
            critical_issues: report.summary.critical_issues,
            recommendations_count: report.recommendations.length
        });

        return report;
    }

    /**
     * Generate audit summary
     */
    generateSummary() {
        const summary = {
            total_tests: 4,
            passed_tests: 0,
            failed_tests: 0,
            critical_issues: [],
            security_level: 'UNKNOWN'
        };

        const tests = [
            this.results.token_masking,
            this.results.token_revocation,
            this.results.csrf_protection,
            this.results.jwt_validation
        ];

        for (const test of tests) {
            if (test.passed) {
                summary.passed_tests++;
            } else {
                summary.failed_tests++;
                summary.critical_issues.push(...test.details);
            }
        }

        // Determine security level
        if (summary.passed_tests === summary.total_tests) {
            summary.security_level = 'EXCELLENT';
        } else if (summary.passed_tests >= summary.total_tests * 0.75) {
            summary.security_level = 'GOOD';
        } else if (summary.passed_tests >= summary.total_tests * 0.5) {
            summary.security_level = 'FAIR';
        } else {
            summary.security_level = 'POOR';
        }

        return summary;
    }

    /**
     * Generate security recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        if (!this.results.token_masking.passed) {
            recommendations.push('Implement comprehensive token masking in all logging');
            recommendations.push('Use SafeLogger for all sensitive data logging');
        }

        if (!this.results.token_revocation.passed) {
            recommendations.push('Implement secure token revocation endpoint');
            recommendations.push('Add database cleanup for revoked tokens');
        }

        if (!this.results.csrf_protection.passed) {
            recommendations.push('Enable CSRF protection on all state-changing endpoints');
            recommendations.push('Implement proper session management');
        }

        if (!this.results.jwt_validation.passed) {
            recommendations.push('Strengthen JWT secret validation');
            recommendations.push('Use cryptographically secure secret generation');
        }

        // General recommendations
        recommendations.push('Regular security audits and penetration testing');
        recommendations.push('Implement security monitoring and alerting');
        recommendations.push('Use secret management service for production');
        recommendations.push('Enable security headers (HSTS, CSP, etc.)');

        return recommendations;
    }
}

/**
 * Run security audit
 */
async function runSecurityAudit() {
    const audit = new SecurityAudit();
    await audit.runAudit();

    const report = audit.generateReport();

    console.log('\n=== SECURITY AUDIT REPORT ===');
    console.log(`Overall Score: ${report.overall_score}/100`);
    console.log(`Security Level: ${report.summary.security_level}`);
    console.log(`Passed Tests: ${report.summary.passed_tests}/${report.summary.total_tests}`);

    if (report.summary.critical_issues.length > 0) {
        console.log('\n=== CRITICAL ISSUES ===');
        report.summary.critical_issues.forEach(issue => {
            console.log(`- ${issue}`);
        });
    }

    if (report.recommendations.length > 0) {
        console.log('\n=== RECOMMENDATIONS ===');
        report.recommendations.forEach(rec => {
            console.log(`- ${rec}`);
        });
    }

    console.log('\n=== DETAILED RESULTS ===');
    console.log(JSON.stringify(report, null, 2));

    return report;
}

// Export for use in other modules
module.exports = {
    SecurityAudit,
    runSecurityAudit
};

// Run audit if called directly
if (require.main === module) {
    runSecurityAudit().catch(console.error);
}
