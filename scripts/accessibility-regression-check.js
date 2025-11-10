#!/usr/bin/env node

/**
 * Accessibility Regression Check Script
 * Prevents accessibility regressions by comparing current results with baseline
 */

const fs = require('fs');
const path = require('path');

class AccessibilityRegressionChecker {
    constructor() {
        this.logger = console;
        this.baselineFile = 'accessibility-baseline.json';
        this.currentResults = {};
        this.baselineResults = {};
        this.regressions = [];
        this.improvements = [];
    }

    /**
     * Run accessibility regression check
     */
    async runCheck() {
        this.logger.log('🔍 Running Accessibility Regression Check...\n');

        try {
            // Load current results
            await this.loadCurrentResults();

            // Load baseline results
            await this.loadBaselineResults();

            // Compare results
            this.compareResults();

            // Generate report
            this.generateReport();

            // Save critical issues if any
            if (this.regressions.length > 0) {
                this.saveCriticalIssues();
            }

            this.logger.log('\n✅ Accessibility regression check completed');

        } catch (error) {
            this.logger.error('❌ Error during accessibility regression check:', error.message);
            process.exit(1);
        }
    }

    /**
     * Load current accessibility test results
     */
    async loadCurrentResults() {
        const resultFiles = [
            'axe-results.json',
            'pa11y-results.json',
            'lighthouse-results.json'
        ];

        for (const file of resultFiles) {
            try {
                const filePath = path.join(process.cwd(), file);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    this.currentResults[file.replace('.json', '')] = JSON.parse(content);
                }
            } catch (error) {
                this.logger.warn(`Could not load ${file}:`, error.message);
            }
        }
    }

    /**
     * Load baseline accessibility results
     */
    async loadBaselineResults() {
        try {
            const baselinePath = path.join(process.cwd(), this.baselineFile);
            if (fs.existsSync(baselinePath)) {
                const content = fs.readFileSync(baselinePath, 'utf8');
                this.baselineResults = JSON.parse(content);
            } else {
                this.logger.log('No baseline found, creating new baseline...');
                this.createBaseline();
            }
        } catch (error) {
            this.logger.warn('Could not load baseline:', error.message);
            this.createBaseline();
        }
    }

    /**
     * Create new baseline from current results
     */
    createBaseline() {
        this.baselineResults = { ...this.currentResults };
        this.saveBaseline();
        this.logger.log('✅ New baseline created');
    }

    /**
     * Save baseline results
     */
    saveBaseline() {
        try {
            const baselinePath = path.join(process.cwd(), this.baselineFile);
            fs.writeFileSync(baselinePath, JSON.stringify(this.baselineResults, null, 2));
        } catch (error) {
            this.logger.error('Could not save baseline:', error.message);
        }
    }

    /**
     * Compare current results with baseline
     */
    compareResults() {
        // Compare axe-core results
        this.compareAxeResults();

        // Compare Pa11y results
        this.comparePa11yResults();

        // Compare Lighthouse results
        this.compareLighthouseResults();
    }

    /**
     * Compare axe-core results
     */
    compareAxeResults() {
        const current = this.currentResults.axe_results;
        const baseline = this.baselineResults.axe_results;

        if (!current || !baseline) {return;}

        const currentViolations = current.violations || [];
        const baselineViolations = baseline.violations || [];

        // Check for new violations
        const newViolations = currentViolations.filter(currentViolation =>
            !baselineViolations.some(baselineViolation =>
                this.violationsEqual(currentViolation, baselineViolation)
            )
        );

        // Check for resolved violations
        const resolvedViolations = baselineViolations.filter(baselineViolation =>
            !currentViolations.some(currentViolation =>
                this.violationsEqual(currentViolation, baselineViolation)
            )
        );

        // Record regressions
        newViolations.forEach(violation => {
            this.regressions.push({
                tool: 'axe-core',
                type: 'new_violation',
                severity: this.getViolationSeverity(violation),
                description: violation.description,
                help: violation.help,
                impact: violation.impact,
                nodes: violation.nodes?.length || 0
            });
        });

        // Record improvements
        resolvedViolations.forEach(violation => {
            this.improvements.push({
                tool: 'axe-core',
                type: 'resolved_violation',
                description: violation.description,
                help: violation.help
            });
        });
    }

    /**
     * Compare Pa11y results
     */
    comparePa11yResults() {
        const current = this.currentResults.pa11y_results;
        const baseline = this.baselineResults.pa11y_results;

        if (!current || !baseline) {return;}

        const currentIssues = Array.isArray(current) ? current : [];
        const baselineIssues = Array.isArray(baseline) ? baseline : [];

        // Check for new issues
        const newIssues = currentIssues.filter(currentIssue =>
            !baselineIssues.some(baselineIssue =>
                this.issuesEqual(currentIssue, baselineIssue)
            )
        );

        // Check for resolved issues
        const resolvedIssues = baselineIssues.filter(baselineIssue =>
            !currentIssues.some(currentIssue =>
                this.issuesEqual(currentIssue, baselineIssue)
            )
        );

        // Record regressions
        newIssues.forEach(issue => {
            this.regressions.push({
                tool: 'pa11y',
                type: 'new_issue',
                severity: this.getIssueSeverity(issue),
                code: issue.code,
                message: issue.message,
                context: issue.context
            });
        });

        // Record improvements
        resolvedIssues.forEach(issue => {
            this.improvements.push({
                tool: 'pa11y',
                type: 'resolved_issue',
                code: issue.code,
                message: issue.message
            });
        });
    }

    /**
     * Compare Lighthouse results
     */
    compareLighthouseResults() {
        const current = this.currentResults.lighthouse_results;
        const baseline = this.baselineResults.lighthouse_results;

        if (!current || !baseline) {return;}

        const currentScore = current.categories?.accessibility?.score || 0;
        const baselineScore = baseline.categories?.accessibility?.score || 0;

        const scoreDifference = currentScore - baselineScore;

        if (scoreDifference < -0.1) { // 10% decrease
            this.regressions.push({
                tool: 'lighthouse',
                type: 'score_decrease',
                severity: 'high',
                currentScore: Math.round(currentScore * 100),
                baselineScore: Math.round(baselineScore * 100),
                difference: Math.round(scoreDifference * 100)
            });
        } else if (scoreDifference > 0.1) { // 10% increase
            this.improvements.push({
                tool: 'lighthouse',
                type: 'score_increase',
                currentScore: Math.round(currentScore * 100),
                baselineScore: Math.round(baselineScore * 100),
                difference: Math.round(scoreDifference * 100)
            });
        }
    }

    /**
     * Check if two violations are equal
     */
    violationsEqual(violation1, violation2) {
        return violation1.id === violation2.id &&
               violation1.description === violation2.description &&
               violation1.impact === violation2.impact;
    }

    /**
     * Check if two issues are equal
     */
    issuesEqual(issue1, issue2) {
        return issue1.code === issue2.code &&
               issue1.message === issue2.message &&
               issue1.context === issue2.context;
    }

    /**
     * Get violation severity
     */
    getViolationSeverity(violation) {
        const {impact} = violation;
        switch (impact) {
            case 'critical':
            case 'serious':
                return 'high';
            case 'moderate':
                return 'medium';
            case 'minor':
                return 'low';
            default:
                return 'medium';
        }
    }

    /**
     * Get issue severity
     */
    getIssueSeverity(issue) {
        const {code} = issue;
        if (code.includes('WCAG2AA')) {
            return 'high';
        } else if (code.includes('WCAG2A')) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Generate regression report
     */
    generateReport() {
        this.logger.log('\n📊 Accessibility Regression Report');
        this.logger.log('================================');

        // Summary
        this.logger.log('\n📈 Summary:');
        this.logger.log(`- Regressions: ${this.regressions.length}`);
        this.logger.log(`- Improvements: ${this.improvements.length}`);

        // Regressions
        if (this.regressions.length > 0) {
            this.logger.log('\n🚨 Regressions Found:');
            this.regressions.forEach((regression, index) => {
                this.logger.log(`${index + 1}. [${regression.tool}] ${regression.type}`);
                this.logger.log(`   Severity: ${regression.severity}`);
                if (regression.description) {
                    this.logger.log(`   Description: ${regression.description}`);
                }
                if (regression.message) {
                    this.logger.log(`   Message: ${regression.message}`);
                }
                if (regression.difference) {
                    this.logger.log(`   Score Change: ${regression.difference}%`);
                }
                this.logger.log('');
            });
        }

        // Improvements
        if (this.improvements.length > 0) {
            this.logger.log('\n✅ Improvements Found:');
            this.improvements.forEach((improvement, index) => {
                this.logger.log(`${index + 1}. [${improvement.tool}] ${improvement.type}`);
                if (improvement.description) {
                    this.logger.log(`   Description: ${improvement.description}`);
                }
                if (improvement.difference) {
                    this.logger.log(`   Score Change: +${improvement.difference}%`);
                }
                this.logger.log('');
            });
        }

        // Recommendations
        this.logger.log('\n📋 Recommendations:');
        if (this.regressions.length > 0) {
            this.logger.log('- Fix critical accessibility regressions');
            this.logger.log('- Review new violations and issues');
            this.logger.log('- Test with screen readers');
            this.logger.log('- Validate keyboard navigation');
        } else {
            this.logger.log('- No regressions found');
            this.logger.log('- Continue monitoring accessibility');
        }

        if (this.improvements.length > 0) {
            this.logger.log('- Great job on accessibility improvements!');
        }
    }

    /**
     * Save critical accessibility issues
     */
    saveCriticalIssues() {
        const criticalIssues = this.regressions.filter(regression =>
            regression.severity === 'high'
        );

        if (criticalIssues.length > 0) {
            const criticalIssuesFile = 'critical-accessibility-issues.json';
            try {
                fs.writeFileSync(criticalIssuesFile, JSON.stringify(criticalIssues, null, 2));
                this.logger.log(`\n🚨 Critical issues saved to ${criticalIssuesFile}`);
            } catch (error) {
                this.logger.error('Could not save critical issues:', error.message);
            }
        }
    }
}

// CLI interface
if (require.main === module) {
    const checker = new AccessibilityRegressionChecker();

    checker.runCheck()
        .then(() => {
            // Exit with error code if critical regressions found
            const criticalRegressions = checker.regressions.filter(r => r.severity === 'high');
            if (criticalRegressions.length > 0) {
                process.exit(1);
            } else {
                process.exit(0);
            }
        })
        .catch(error => {
            console.error('❌ Accessibility regression check failed:', error.message);
            process.exit(1);
        });
}

module.exports = AccessibilityRegressionChecker;
