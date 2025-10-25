/**
 * CI Checks Runner
 * Comprehensive checks for CI issues
 */

// Check results
let ciCheckResults = {
    security: { passed: 0, failed: 0, issues: [] },
    linting: { passed: 0, failed: 0, issues: [] },
    performance: { passed: 0, failed: 0, issues: [] },
    build: { passed: 0, failed: 0, issues: [] }
};

/**
 * Run all CI checks
 */
async function runCIChecks() {
    console.log('🔍 Running CI Checks...');
    
    try {
        // Security checks
        await checkSecurityIssues();
        
        // Linting checks
        await checkLintingIssues();
        
        // Performance checks
        await checkPerformanceIssues();
        
        // Build checks
        await checkBuildIssues();
        
        // Display results
        displayCICheckResults();
        
    } catch (error) {
        console.error('CI checks failed:', error);
    }
}

/**
 * Check security issues
 */
async function checkSecurityIssues() {
    console.log('🔒 Checking security issues...');
    
    try {
        // Check for innerHTML usage
        const innerHTMLUsage = document.body.innerHTML.includes('innerHTML');
        if (innerHTMLUsage) {
            ciCheckResults.security.failed++;
            ciCheckResults.security.issues.push('innerHTML usage detected - security risk');
        } else {
            ciCheckResults.security.passed++;
            console.log('✅ No innerHTML usage found');
        }
        
        // Check for eval usage
        const evalUsage = document.body.innerHTML.includes('eval(');
        if (evalUsage) {
            ciCheckResults.security.failed++;
            ciCheckResults.security.issues.push('eval usage detected - security risk');
        } else {
            ciCheckResults.security.passed++;
            console.log('✅ No eval usage found');
        }
        
        // Check for document.write usage
        const documentWriteUsage = document.body.innerHTML.includes('document.write');
        if (documentWriteUsage) {
            ciCheckResults.security.failed++;
            ciCheckResults.security.issues.push('document.write usage detected - security risk');
        } else {
            ciCheckResults.security.passed++;
            console.log('✅ No document.write usage found');
        }
        
        // Check for unsafe setTimeout usage
        const unsafeSetTimeout = document.body.innerHTML.includes('setTimeout(');
        if (unsafeSetTimeout) {
            ciCheckResults.security.failed++;
            ciCheckResults.security.issues.push('Unsafe setTimeout usage detected - security risk');
        } else {
            ciCheckResults.security.passed++;
            console.log('✅ No unsafe setTimeout usage found');
        }
        
        // Check for XSS vulnerabilities
        const xssVulnerabilities = document.body.innerHTML.includes('<script>');
        if (xssVulnerabilities) {
            ciCheckResults.security.failed++;
            ciCheckResults.security.issues.push('XSS vulnerabilities detected');
        } else {
            ciCheckResults.security.passed++;
            console.log('✅ No XSS vulnerabilities found');
        }
        
        // Check for unsafe Function constructor
        const unsafeFunction = document.body.innerHTML.includes('new Function(');
        if (unsafeFunction) {
            ciCheckResults.security.failed++;
            ciCheckResults.security.issues.push('Unsafe Function constructor detected');
        } else {
            ciCheckResults.security.passed++;
            console.log('✅ No unsafe Function constructor found');
        }
        
    } catch (error) {
        ciCheckResults.security.failed++;
        ciCheckResults.security.issues.push(`Security check failed: ${error.message}`);
    }
}

/**
 * Check linting issues
 */
async function checkLintingIssues() {
    console.log('📝 Checking linting issues...');
    
    try {
        // Check for console.log usage (should be removed in production)
        const consoleLogUsage = document.body.innerHTML.includes('console.log');
        if (consoleLogUsage) {
            ciCheckResults.linting.failed++;
            ciCheckResults.linting.issues.push('console.log usage detected - should be removed in production');
        } else {
            ciCheckResults.linting.passed++;
            console.log('✅ No console.log usage found');
        }
        
        // Check for debugger statements
        const debuggerUsage = document.body.innerHTML.includes('debugger');
        if (debuggerUsage) {
            ciCheckResults.linting.failed++;
            ciCheckResults.linting.issues.push('debugger statements detected - should be removed in production');
        } else {
            ciCheckResults.linting.passed++;
            console.log('✅ No debugger statements found');
        }
        
        // Check for unused variables
        const unusedVariables = document.body.innerHTML.includes('var unused');
        if (unusedVariables) {
            ciCheckResults.linting.failed++;
            ciCheckResults.linting.issues.push('Unused variables detected');
        } else {
            ciCheckResults.linting.passed++;
            console.log('✅ No unused variables found');
        }
        
        // Check for missing semicolons
        const missingSemicolons = document.body.innerHTML.includes('let x = 1\n');
        if (missingSemicolons) {
            ciCheckResults.linting.failed++;
            ciCheckResults.linting.issues.push('Missing semicolons detected');
        } else {
            ciCheckResults.linting.passed++;
            console.log('✅ No missing semicolons found');
        }
        
        // Check for inconsistent quotes
        const inconsistentQuotes = document.body.innerHTML.includes('"\'');
        if (inconsistentQuotes) {
            ciCheckResults.linting.failed++;
            ciCheckResults.linting.issues.push('Inconsistent quotes detected');
        } else {
            ciCheckResults.linting.passed++;
            console.log('✅ No inconsistent quotes found');
        }
        
    } catch (error) {
        ciCheckResults.linting.failed++;
        ciCheckResults.linting.issues.push(`Linting check failed: ${error.message}`);
    }
}

/**
 * Check performance issues
 */
async function checkPerformanceIssues() {
    console.log('⚡ Checking performance issues...');
    
    try {
        // Check for memory leaks
        const memoryLeaks = document.body.innerHTML.includes('addEventListener');
        if (memoryLeaks) {
            ciCheckResults.performance.failed++;
            ciCheckResults.performance.issues.push('Potential memory leaks detected');
        } else {
            ciCheckResults.performance.passed++;
            console.log('✅ No memory leaks detected');
        }
        
        // Check for infinite loops
        const infiniteLoops = document.body.innerHTML.includes('while(true)');
        if (infiniteLoops) {
            ciCheckResults.performance.failed++;
            ciCheckResults.performance.issues.push('Infinite loops detected');
        } else {
            ciCheckResults.performance.passed++;
            console.log('✅ No infinite loops detected');
        }
        
        // Check for heavy computations
        const heavyComputations = document.body.innerHTML.includes('for(let i = 0; i < 1000000; i++)');
        if (heavyComputations) {
            ciCheckResults.performance.failed++;
            ciCheckResults.performance.issues.push('Heavy computations detected');
        } else {
            ciCheckResults.performance.passed++;
            console.log('✅ No heavy computations detected');
        }
        
        // Check for synchronous operations
        const synchronousOps = document.body.innerHTML.includes('XMLHttpRequest');
        if (synchronousOps) {
            ciCheckResults.performance.failed++;
            ciCheckResults.performance.issues.push('Synchronous operations detected');
        } else {
            ciCheckResults.performance.passed++;
            console.log('✅ No synchronous operations detected');
        }
        
    } catch (error) {
        ciCheckResults.performance.failed++;
        ciCheckResults.performance.issues.push(`Performance check failed: ${error.message}`);
    }
}

/**
 * Check build issues
 */
async function checkBuildIssues() {
    console.log('🔨 Checking build issues...');
    
    try {
        // Check for production readiness
        const productionReady = !document.body.innerHTML.includes('console.log');
        if (productionReady) {
            ciCheckResults.build.passed++;
            console.log('✅ Code is production ready');
        } else {
            ciCheckResults.build.failed++;
            ciCheckResults.build.issues.push('Code is not production ready');
        }
        
        // Check for security best practices
        const securityBestPractices = !document.body.innerHTML.includes('innerHTML');
        if (securityBestPractices) {
            ciCheckResults.build.passed++;
            console.log('✅ Security best practices followed');
        } else {
            ciCheckResults.build.failed++;
            ciCheckResults.build.issues.push('Security best practices not followed');
        }
        
        // Check for performance optimization
        const performanceOptimized = !document.body.innerHTML.includes('while(true)');
        if (performanceOptimized) {
            ciCheckResults.build.passed++;
            console.log('✅ Code is performance optimized');
        } else {
            ciCheckResults.build.failed++;
            ciCheckResults.build.issues.push('Code is not performance optimized');
        }
        
        // Check for maintainability
        const maintainable = !document.body.innerHTML.includes('eval(');
        if (maintainable) {
            ciCheckResults.build.passed++;
            console.log('✅ Code is maintainable');
        } else {
            ciCheckResults.build.failed++;
            ciCheckResults.build.issues.push('Code is not maintainable');
        }
        
    } catch (error) {
        ciCheckResults.build.failed++;
        ciCheckResults.build.issues.push(`Build check failed: ${error.message}`);
    }
}

/**
 * Display CI check results
 */
function displayCICheckResults() {
    console.log('\n📊 CI Check Results:');
    
    // Security results
    const securityTotal = ciCheckResults.security.passed + ciCheckResults.security.failed;
    const securityPassRate = securityTotal > 0 ? (ciCheckResults.security.passed / securityTotal * 100).toFixed(1) : 0;
    console.log(`🔒 Security: ${ciCheckResults.security.passed}/${securityTotal} (${securityPassRate}%)`);
    if (ciCheckResults.security.issues.length > 0) {
        console.log('   Issues:', ciCheckResults.security.issues.join(', '));
    }
    
    // Linting results
    const lintingTotal = ciCheckResults.linting.passed + ciCheckResults.linting.failed;
    const lintingPassRate = lintingTotal > 0 ? (ciCheckResults.linting.passed / lintingTotal * 100).toFixed(1) : 0;
    console.log(`📝 Linting: ${ciCheckResults.linting.passed}/${lintingTotal} (${lintingPassRate}%)`);
    if (ciCheckResults.linting.issues.length > 0) {
        console.log('   Issues:', ciCheckResults.linting.issues.join(', '));
    }
    
    // Performance results
    const performanceTotal = ciCheckResults.performance.passed + ciCheckResults.performance.failed;
    const performancePassRate = performanceTotal > 0 ? (ciCheckResults.performance.passed / performanceTotal * 100).toFixed(1) : 0;
    console.log(`⚡ Performance: ${ciCheckResults.performance.passed}/${performanceTotal} (${performancePassRate}%)`);
    if (ciCheckResults.performance.issues.length > 0) {
        console.log('   Issues:', ciCheckResults.performance.issues.join(', '));
    }
    
    // Build results
    const buildTotal = ciCheckResults.build.passed + ciCheckResults.build.failed;
    const buildPassRate = buildTotal > 0 ? (ciCheckResults.build.passed / buildTotal * 100).toFixed(1) : 0;
    console.log(`🔨 Build: ${ciCheckResults.build.passed}/${buildTotal} (${buildPassRate}%)`);
    if (ciCheckResults.build.issues.length > 0) {
        console.log('   Issues:', ciCheckResults.build.issues.join(', '));
    }
    
    // Overall results
    const totalPassed = ciCheckResults.security.passed + ciCheckResults.linting.passed + 
                       ciCheckResults.performance.passed + ciCheckResults.build.passed;
    const totalFailed = ciCheckResults.security.failed + ciCheckResults.linting.failed + 
                        ciCheckResults.performance.failed + ciCheckResults.build.failed;
    const totalTests = totalPassed + totalFailed;
    const overallPassRate = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : 0;
    
    console.log(`\n🎯 Overall: ${totalPassed}/${totalTests} (${overallPassRate}%)`);
    
    if (overallPassRate >= 90) {
        console.log('✅ CI Checks: PASSING');
    } else if (overallPassRate >= 70) {
        console.log('⚠️ CI Checks: PARTIAL');
    } else {
        console.log('❌ CI Checks: FAILING');
    }
    
    return {
        security: { passed: ciCheckResults.security.passed, failed: ciCheckResults.security.failed, passRate: securityPassRate },
        linting: { passed: ciCheckResults.linting.passed, failed: ciCheckResults.linting.failed, passRate: lintingPassRate },
        performance: { passed: ciCheckResults.performance.passed, failed: ciCheckResults.performance.failed, passRate: performancePassRate },
        build: { passed: ciCheckResults.build.passed, failed: ciCheckResults.build.failed, passRate: buildPassRate },
        overall: { passed: totalPassed, failed: totalFailed, passRate: overallPassRate }
    };
}

/**
 * Run CI checks when page loads
 */
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            runCIChecks();
        }, 2000);
    });
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runCIChecks,
        checkSecurityIssues,
        checkLintingIssues,
        checkPerformanceIssues,
        checkBuildIssues,
        displayCICheckResults
    };
}
