#!/usr/bin/env node

/**
 * Accessibility Report Generator
 * Generates comprehensive accessibility documentation and reports
 */

const fs = require('fs');
const path = require('path');

class AccessibilityReportGenerator {
    constructor() {
        this.logger = console;
        this.reportData = {
            timestamp: new Date().toISOString(),
            axeResults: {},
            pa11yResults: {},
            lighthouseResults: {},
            customTests: {},
            compliance: {},
            recommendations: []
        };
    }

    /**
     * Generate accessibility report
     */
    async generateReport() {
        this.logger.log('📊 Generating Accessibility Report...\n');

        try {
            // Load test results
            await this.loadTestResults();
            
            // Analyze compliance
            this.analyzeCompliance();
            
            // Generate recommendations
            this.generateRecommendations();
            
            // Generate markdown report
            this.generateMarkdownReport();
            
            // Generate compliance report
            this.generateComplianceReport();
            
            // Generate testing guide
            this.generateTestingGuide();
            
            this.logger.log('✅ Accessibility report generated successfully');
            
        } catch (error) {
            this.logger.error('❌ Error generating accessibility report:', error.message);
            process.exit(1);
        }
    }

    /**
     * Load test results from files
     */
    async loadTestResults() {
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
                    const key = file.replace('.json', '').replace('-', '');
                    this.reportData[key] = JSON.parse(content);
                }
            } catch (error) {
                this.logger.warn(`Could not load ${file}:`, error.message);
            }
        }
    }

    /**
     * Analyze accessibility compliance
     */
    analyzeCompliance() {
        const compliance = {
            wcag21AA: { score: 0, issues: [] },
            wcag21AAA: { score: 0, issues: [] },
            section508: { score: 0, issues: [] },
            overall: { score: 0, status: 'unknown' }
        };

        // Analyze axe-core results
        if (this.reportData.axeresults) {
            this.analyzeAxeCompliance(compliance);
        }

        // Analyze Pa11y results
        if (this.reportData.pa11yresults) {
            this.analyzePa11yCompliance(compliance);
        }

        // Analyze Lighthouse results
        if (this.reportData.lighthouseresults) {
            this.analyzeLighthouseCompliance(compliance);
        }

        // Calculate overall compliance
        const scores = Object.values(compliance).map(c => c.score).filter(s => s > 0);
        if (scores.length > 0) {
            compliance.overall.score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            compliance.overall.status = this.getComplianceStatus(compliance.overall.score);
        }

        this.reportData.compliance = compliance;
    }

    /**
     * Analyze axe-core compliance
     */
    analyzeAxeCompliance(compliance) {
        const axeResults = this.reportData.axeresults;
        const violations = axeResults.violations || [];
        const passes = axeResults.passes || [];

        // Calculate WCAG 2.1 AA compliance
        const wcag21AAViolations = violations.filter(v => 
            v.tags && v.tags.some(tag => tag.includes('wcag2a'))
        );
        const wcag21AAPasses = passes.filter(p => 
            p.tags && p.tags.some(tag => tag.includes('wcag2a'))
        );

        compliance.wcag21AA.score = Math.round(
            (wcag21AAPasses.length / (wcag21AAPasses.length + wcag21AAViolations.length)) * 100
        );
        compliance.wcag21AA.issues = wcag21AAViolations.map(v => ({
            id: v.id,
            description: v.description,
            impact: v.impact,
            help: v.help
        }));

        // Calculate WCAG 2.1 AAA compliance
        const wcag21AAAViolations = violations.filter(v => 
            v.tags && v.tags.some(tag => tag.includes('wcag2aaa'))
        );
        const wcag21AAAPasses = passes.filter(p => 
            p.tags && p.tags.some(tag => tag.includes('wcag2aaa'))
        );

        compliance.wcag21AAA.score = Math.round(
            (wcag21AAAPasses.length / (wcag21AAAPasses.length + wcag21AAAViolations.length)) * 100
        );
        compliance.wcag21AAA.issues = wcag21AAAViolations.map(v => ({
            id: v.id,
            description: v.description,
            impact: v.impact,
            help: v.help
        }));
    }

    /**
     * Analyze Pa11y compliance
     */
    analyzePa11yCompliance(compliance) {
        const pa11yResults = this.reportData.pa11yresults;
        const issues = Array.isArray(pa11yResults) ? pa11yResults : [];

        // Calculate Section 508 compliance
        const section508Issues = issues.filter(issue => 
            issue.code && issue.code.includes('Section508')
        );

        compliance.section508.score = Math.round(
            ((issues.length - section508Issues.length) / issues.length) * 100
        );
        compliance.section508.issues = section508Issues.map(issue => ({
            code: issue.code,
            message: issue.message,
            context: issue.context
        }));
    }

    /**
     * Analyze Lighthouse compliance
     */
    analyzeLighthouseCompliance(compliance) {
        const lighthouseResults = this.reportData.lighthouseresults;
        const accessibilityScore = lighthouseResults.categories?.accessibility?.score || 0;

        // Use Lighthouse score as overall indicator
        if (compliance.overall.score === 0) {
            compliance.overall.score = Math.round(accessibilityScore * 100);
            compliance.overall.status = this.getComplianceStatus(compliance.overall.score);
        }
    }

    /**
     * Get compliance status
     */
    getComplianceStatus(score) {
        if (score >= 95) return 'excellent';
        if (score >= 85) return 'good';
        if (score >= 70) return 'fair';
        if (score >= 50) return 'poor';
        return 'critical';
    }

    /**
     * Generate recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        // Analyze violations and generate recommendations
        if (this.reportData.axeresults?.violations) {
            this.generateAxeRecommendations(recommendations);
        }

        if (this.reportData.pa11yresults) {
            this.generatePa11yRecommendations(recommendations);
        }

        // General recommendations
        recommendations.push({
            category: 'general',
            priority: 'high',
            title: 'Regular Accessibility Testing',
            description: 'Implement regular accessibility testing in CI/CD pipeline',
            action: 'Set up automated accessibility testing with axe-core and Pa11y'
        });

        recommendations.push({
            category: 'general',
            priority: 'medium',
            title: 'Screen Reader Testing',
            description: 'Test with actual screen readers',
            action: 'Test with NVDA, JAWS, and VoiceOver'
        });

        recommendations.push({
            category: 'general',
            priority: 'medium',
            title: 'Keyboard Navigation Testing',
            description: 'Ensure all functionality is keyboard accessible',
            action: 'Test complete workflow using only keyboard'
        });

        this.reportData.recommendations = recommendations;
    }

    /**
     * Generate axe-core recommendations
     */
    generateAxeRecommendations(recommendations) {
        const violations = this.reportData.axeresults.violations || [];
        
        violations.forEach(violation => {
            recommendations.push({
                category: 'axe-core',
                priority: this.getPriorityFromImpact(violation.impact),
                title: violation.description,
                description: violation.help,
                action: `Fix ${violation.id} violation: ${violation.description}`,
                impact: violation.impact,
                nodes: violation.nodes?.length || 0
            });
        });
    }

    /**
     * Generate Pa11y recommendations
     */
    generatePa11yRecommendations(recommendations) {
        const issues = Array.isArray(this.reportData.pa11yresults) ? this.reportData.pa11yresults : [];
        
        issues.forEach(issue => {
            recommendations.push({
                category: 'pa11y',
                priority: this.getPriorityFromCode(issue.code),
                title: issue.message,
                description: issue.context,
                action: `Fix ${issue.code}: ${issue.message}`,
                code: issue.code
            });
        });
    }

    /**
     * Get priority from impact
     */
    getPriorityFromImpact(impact) {
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
     * Get priority from code
     */
    getPriorityFromCode(code) {
        if (code.includes('WCAG2AA')) return 'high';
        if (code.includes('WCAG2A')) return 'medium';
        return 'low';
    }

    /**
     * Generate markdown report
     */
    generateMarkdownReport() {
        const report = this.generateMarkdownContent();
        const reportPath = path.join(process.cwd(), 'docs', 'ACCESSIBILITY_REPORT.md');
        
        // Ensure docs directory exists
        const docsDir = path.dirname(reportPath);
        if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
        }
        
        fs.writeFileSync(reportPath, report);
        this.logger.log(`📄 Accessibility report saved to: ${reportPath}`);
    }

    /**
     * Generate markdown content
     */
    generateMarkdownContent() {
        const compliance = this.reportData.compliance;
        
        return `# 🔍 Accessibility Report

**Generated**: ${new Date(this.reportData.timestamp).toLocaleString()}  
**Status**: ${compliance.overall.status.toUpperCase()}  
**Overall Score**: ${compliance.overall.score}/100

## 📊 Compliance Summary

| Standard | Score | Status |
|----------|-------|--------|
| WCAG 2.1 AA | ${compliance.wcag21AA.score}/100 | ${this.getComplianceStatus(compliance.wcag21AA.score).toUpperCase()} |
| WCAG 2.1 AAA | ${compliance.wcag21AAA.score}/100 | ${this.getComplianceStatus(compliance.wcag21AAA.score).toUpperCase()} |
| Section 508 | ${compliance.section508.score}/100 | ${this.getComplianceStatus(compliance.section508.score).toUpperCase()} |
| Overall | ${compliance.overall.score}/100 | ${compliance.overall.status.toUpperCase()} |

## 🛠️ Test Results

### axe-core Results
${this.generateAxeResultsSection()}

### Pa11y Results
${this.generatePa11yResultsSection()}

### Lighthouse Results
${this.generateLighthouseResultsSection()}

## 🚨 Issues Found

${this.generateIssuesSection()}

## 📋 Recommendations

${this.generateRecommendationsSection()}

## 🎯 Next Steps

1. **Fix Critical Issues**: Address all high-priority accessibility issues
2. **Screen Reader Testing**: Test with NVDA, JAWS, and VoiceOver
3. **Keyboard Navigation**: Ensure complete keyboard accessibility
4. **User Testing**: Test with users with disabilities
5. **Regular Monitoring**: Implement continuous accessibility monitoring

## 📚 Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)
- [Pa11y Documentation](https://pa11y.org/)
- [Lighthouse Accessibility](https://developers.google.com/web/tools/lighthouse)

---
*This report was generated automatically by the accessibility testing pipeline.*
`;
    }

    /**
     * Generate axe-core results section
     */
    generateAxeResultsSection() {
        const axeResults = this.reportData.axeresults;
        if (!axeResults) return 'No axe-core results available.';

        const violations = axeResults.violations || [];
        const passes = axeResults.passes || [];
        const incomplete = axeResults.incomplete || [];

        return `
- **Violations**: ${violations.length}
- **Passes**: ${passes.length}
- **Incomplete**: ${incomplete.length}

${violations.length > 0 ? `
#### Violations
${violations.map(v => `- **${v.id}**: ${v.description} (${v.impact})`).join('\n')}
` : ''}
`;
    }

    /**
     * Generate Pa11y results section
     */
    generatePa11yResultsSection() {
        const pa11yResults = this.reportData.pa11yresults;
        if (!pa11yResults) return 'No Pa11y results available.';

        const issues = Array.isArray(pa11yResults) ? pa11yResults : [];

        return `
- **Issues**: ${issues.length}

${issues.length > 0 ? `
#### Issues
${issues.map(issue => `- **${issue.code}**: ${issue.message}`).join('\n')}
` : ''}
`;
    }

    /**
     * Generate Lighthouse results section
     */
    generateLighthouseResultsSection() {
        const lighthouseResults = this.reportData.lighthouseresults;
        if (!lighthouseResults) return 'No Lighthouse results available.';

        const accessibilityScore = lighthouseResults.categories?.accessibility?.score || 0;
        const score = Math.round(accessibilityScore * 100);

        return `
- **Accessibility Score**: ${score}/100
- **Status**: ${this.getComplianceStatus(score).toUpperCase()}
`;
    }

    /**
     * Generate issues section
     */
    generateIssuesSection() {
        const issues = [];
        
        // Add axe-core violations
        if (this.reportData.axeresults?.violations) {
            this.reportData.axeresults.violations.forEach(violation => {
                issues.push({
                    tool: 'axe-core',
                    severity: violation.impact,
                    description: violation.description,
                    help: violation.help
                });
            });
        }

        // Add Pa11y issues
        if (this.reportData.pa11yresults) {
            const pa11yIssues = Array.isArray(this.reportData.pa11yresults) ? this.reportData.pa11yresults : [];
            pa11yIssues.forEach(issue => {
                issues.push({
                    tool: 'pa11y',
                    severity: this.getPriorityFromCode(issue.code),
                    description: issue.message,
                    help: issue.context
                });
            });
        }

        if (issues.length === 0) {
            return 'No accessibility issues found! 🎉';
        }

        return issues.map((issue, index) => `
${index + 1}. **${issue.tool}** - ${issue.severity.toUpperCase()}
   - ${issue.description}
   - ${issue.help}
`).join('\n');
    }

    /**
     * Generate recommendations section
     */
    generateRecommendationsSection() {
        const recommendations = this.reportData.recommendations || [];
        
        if (recommendations.length === 0) {
            return 'No specific recommendations at this time.';
        }

        const highPriority = recommendations.filter(r => r.priority === 'high');
        const mediumPriority = recommendations.filter(r => r.priority === 'medium');
        const lowPriority = recommendations.filter(r => r.priority === 'low');

        let section = '';

        if (highPriority.length > 0) {
            section += '### High Priority\n';
            section += highPriority.map(r => `- **${r.title}**: ${r.description}`).join('\n') + '\n\n';
        }

        if (mediumPriority.length > 0) {
            section += '### Medium Priority\n';
            section += mediumPriority.map(r => `- **${r.title}**: ${r.description}`).join('\n') + '\n\n';
        }

        if (lowPriority.length > 0) {
            section += '### Low Priority\n';
            section += lowPriority.map(r => `- **${r.title}**: ${r.description}`).join('\n') + '\n\n';
        }

        return section;
    }

    /**
     * Generate compliance report
     */
    generateComplianceReport() {
        const compliance = this.reportData.compliance;
        const reportPath = path.join(process.cwd(), 'docs', 'ACCESSIBILITY_COMPLIANCE.md');
        
        const report = `# 📋 Accessibility Compliance Report

**Generated**: ${new Date(this.reportData.timestamp).toLocaleString()}

## 🎯 Compliance Status

**Overall Status**: ${compliance.overall.status.toUpperCase()}  
**Overall Score**: ${compliance.overall.score}/100

## 📊 Detailed Compliance

### WCAG 2.1 AA Compliance
- **Score**: ${compliance.wcag21AA.score}/100
- **Status**: ${this.getComplianceStatus(compliance.wcag21AA.score).toUpperCase()}
- **Issues**: ${compliance.wcag21AA.issues.length}

### WCAG 2.1 AAA Compliance
- **Score**: ${compliance.wcag21AAA.score}/100
- **Status**: ${this.getComplianceStatus(compliance.wcag21AAA.score).toUpperCase()}
- **Issues**: ${compliance.wcag21AAA.issues.length}

### Section 508 Compliance
- **Score**: ${compliance.section508.score}/100
- **Status**: ${this.getComplianceStatus(compliance.section508.score).toUpperCase()}
- **Issues**: ${compliance.section508.issues.length}

## 🚨 Critical Issues

${compliance.wcag21AA.issues.filter(issue => issue.impact === 'critical' || issue.impact === 'serious').map(issue => `
- **${issue.id}**: ${issue.description}
  - Impact: ${issue.impact}
  - Help: ${issue.help}
`).join('\n')}

## 📈 Compliance Trends

*Compliance trends will be available after multiple test runs.*

---
*This compliance report is generated automatically and should be reviewed regularly.*
`;

        fs.writeFileSync(reportPath, report);
        this.logger.log(`📄 Compliance report saved to: ${reportPath}`);
    }

    /**
     * Generate testing guide
     */
    generateTestingGuide() {
        const guidePath = path.join(process.cwd(), 'docs', 'ACCESSIBILITY_TESTING_GUIDE.md');
        
        const guide = `# 🧪 Accessibility Testing Guide

This guide provides comprehensive instructions for testing accessibility in the Ignite Fitness application.

## 🔧 Automated Testing

### Running Automated Tests

\`\`\`bash
# Run all accessibility tests
npm run test:accessibility

# Run specific tests
npm run test:axe
npm run test:pa11y
npm run test:lighthouse
\`\`\`

### CI/CD Integration

Accessibility tests are automatically run in the CI/CD pipeline:

- **Trigger**: Every push and pull request
- **Schedule**: Weekly accessibility scan
- **Tools**: axe-core, Pa11y, Lighthouse
- **Reporting**: Automated PR comments

## 🎯 Manual Testing

### Screen Reader Testing

#### NVDA (Windows)
1. Download and install NVDA
2. Navigate to the application
3. Test keyboard navigation
4. Verify screen reader announcements
5. Test form interactions

#### JAWS (Windows)
1. Install JAWS screen reader
2. Test complete workout flow
3. Verify audio cues and announcements
4. Test modal interactions
5. Validate form accessibility

#### VoiceOver (macOS/iOS)
1. Enable VoiceOver (Cmd+F5)
2. Test touch navigation
3. Verify gesture controls
4. Test voice control integration
5. Validate mobile accessibility

### Keyboard Navigation Testing

1. **Tab Navigation**
   - Tab through all interactive elements
   - Verify logical tab order
   - Test focus indicators

2. **Keyboard Shortcuts**
   - Test screen reader shortcuts (Ctrl+W, Ctrl+N, etc.)
   - Verify voice control shortcuts
   - Test application shortcuts

3. **Modal Interactions**
   - Test focus trapping in modals
   - Verify escape key functionality
   - Test backdrop click handling

### Voice Control Testing

1. **Voice Commands**
   - Test workout commands ("start workout", "complete set")
   - Test navigation commands ("go home", "go to progress")
   - Test timer commands ("start timer", "pause timer")

2. **Speech Feedback**
   - Verify action confirmations
   - Test error announcements
   - Validate status updates

### Cognitive Accessibility Testing

1. **Plain Language Mode**
   - Enable plain language mode
   - Verify simplified text
   - Test content comprehension

2. **Reading Assistance**
   - Test text highlighting
   - Verify pronunciation help
   - Test definition tooltips

3. **Attention Management**
   - Test focus indicators
   - Verify progress bars
   - Test visual cues

## 📋 Testing Checklist

### Pre-Test Setup
- [ ] Install required screen readers
- [ ] Configure accessibility preferences
- [ ] Set up testing environment
- [ ] Prepare test data

### Screen Reader Testing
- [ ] NVDA compatibility verified
- [ ] JAWS testing complete
- [ ] VoiceOver iOS/macOS tested
- [ ] Screen reader shortcuts working
- [ ] Audio cues functioning

### Keyboard Navigation
- [ ] Tab order logical
- [ ] Focus indicators visible
- [ ] All functions keyboard accessible
- [ ] Modal focus trapping working
- [ ] Escape key handling

### Voice Control
- [ ] Voice commands recognized
- [ ] Speech feedback working
- [ ] Noise cancellation effective
- [ ] Hands-free operation possible
- [ ] Command accuracy acceptable

### Cognitive Accessibility
- [ ] Plain language mode available
- [ ] Reading level indicators working
- [ ] Content summarization functional
- [ ] Attention management features active
- [ ] Cognitive load reduced

### Visual Accessibility
- [ ] High contrast mode working
- [ ] Forced colors supported
- [ ] Focus indicators visible
- [ ] Color not sole indicator
- [ ] Text readable at all sizes

## 🚨 Common Issues

### Screen Reader Issues
- Missing ARIA labels
- Incorrect heading hierarchy
- Unclear button descriptions
- Missing form labels
- Inaccessible modals

### Keyboard Issues
- Tab order problems
- Missing focus indicators
- Keyboard traps
- Inaccessible dropdowns
- Missing skip links

### Voice Control Issues
- Commands not recognized
- Poor speech feedback
- Background noise interference
- Inaccurate command matching
- Missing error handling

## 📊 Testing Metrics

### Success Criteria
- **axe-core**: 0 critical violations
- **Pa11y**: 0 WCAG 2.1 AA violations
- **Lighthouse**: 90+ accessibility score
- **Screen Reader**: Full functionality
- **Keyboard**: Complete navigation
- **Voice Control**: 95%+ accuracy

### Reporting
- Document all issues found
- Include severity levels
- Provide reproduction steps
- Suggest fixes
- Track resolution status

## 🔄 Continuous Testing

### Regular Testing Schedule
- **Daily**: Automated CI/CD tests
- **Weekly**: Manual screen reader testing
- **Monthly**: Comprehensive accessibility audit
- **Quarterly**: User testing with disabilities

### Monitoring
- Track accessibility metrics
- Monitor regression trends
- Update testing procedures
- Review compliance status

## 📚 Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)
- [Pa11y Documentation](https://pa11y.org/)
- [Lighthouse Accessibility](https://developers.google.com/web/tools/lighthouse)
- [Screen Reader Testing Guide](https://webaim.org/articles/screenreader_testing/)

---
*This testing guide should be updated regularly as new features are added.*
`;

        fs.writeFileSync(guidePath, guide);
        this.logger.log(`📄 Testing guide saved to: ${guidePath}`);
    }
}

// CLI interface
if (require.main === module) {
    const generator = new AccessibilityReportGenerator();
    
    generator.generateReport()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Error generating accessibility report:', error.message);
            process.exit(1);
        });
}

module.exports = AccessibilityReportGenerator;
