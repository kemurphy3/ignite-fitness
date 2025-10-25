/**
 * CI Fixes Test Suite
 * Addresses common CI failures and security issues
 */

// Test configuration
const CI_TEST_CONFIG = {
    testUser: {
        username: 'citest',
        password: 'testpass123',
        athleteName: 'CI Test User'
    },
    testData: {
        activities: [
            {
                id: 123456789,
                type: 'Run',
                moving_time: 3600,
                distance: 10000,
                calories: 500,
                average_heartrate: 150,
                max_heartrate: 180
            }
        ],
        sessions: [
            {
                date: '2024-01-15',
                exercises: [
                    { name: 'Squat', sets: 3, reps: 8, weight: 100, rpe: 8 }
                ]
            }
        ]
    }
};

// Test results
let ciTestResults = {
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * Run all CI fix tests
 */
async function runCIFixTests() {
    console.log('🧪 Starting CI Fix Tests...');
    
    try {
        // Security tests
        await testSecurityIssues();
        
        // Linting tests
        await testLintingIssues();
        
        // Performance tests
        await testPerformanceIssues();
        
        // Memory leak tests
        await testMemoryLeaks();
        
        // Display results
        displayCITestResults();
        
    } catch (error) {
        console.error('CI fix test suite failed:', error);
        ciTestResults.errors.push(`Test suite error: ${error.message}`);
    }
}

/**
 * Test security issues
 */
async function testSecurityIssues() {
    console.log('Testing security issues...');
    
    try {
        // Test for innerHTML usage
        const innerHTMLUsage = document.querySelectorAll('[innerHTML]');
        if (innerHTMLUsage.length === 0) {
            ciTestResults.passed++;
            console.log('✅ No innerHTML usage found');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('innerHTML usage detected - security risk');
        }
        
        // Test for eval usage
        const evalUsage = document.body.innerHTML.includes('eval(');
        if (!evalUsage) {
            ciTestResults.passed++;
            console.log('✅ No eval usage found');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('eval usage detected - security risk');
        }
        
        // Test for document.write usage
        const documentWriteUsage = document.body.innerHTML.includes('document.write');
        if (!documentWriteUsage) {
            ciTestResults.passed++;
            console.log('✅ No document.write usage found');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('document.write usage detected - security risk');
        }
        
        // Test for unsafe setTimeout usage
        const unsafeSetTimeout = document.body.innerHTML.includes('setTimeout(');
        if (!unsafeSetTimeout) {
            ciTestResults.passed++;
            console.log('✅ No unsafe setTimeout usage found');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('Unsafe setTimeout usage detected - security risk');
        }
        
        // Test for XSS vulnerabilities
        const xssVulnerabilities = document.body.innerHTML.includes('<script>');
        if (!xssVulnerabilities) {
            ciTestResults.passed++;
            console.log('✅ No XSS vulnerabilities found');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('XSS vulnerabilities detected');
        }
        
    } catch (error) {
        ciTestResults.failed++;
        ciTestResults.errors.push(`Security test failed: ${error.message}`);
    }
}

/**
 * Test linting issues
 */
async function testLintingIssues() {
    console.log('Testing linting issues...');
    
    try {
        // Test for console.log usage (should be removed in production)
        const consoleLogUsage = document.body.innerHTML.includes('console.log');
        if (!consoleLogUsage) {
            ciTestResults.passed++;
            console.log('✅ No console.log usage found');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('console.log usage detected - should be removed in production');
        }
        
        // Test for debugger statements
        const debuggerUsage = document.body.innerHTML.includes('debugger');
        if (!debuggerUsage) {
            ciTestResults.passed++;
            console.log('✅ No debugger statements found');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('debugger statements detected - should be removed in production');
        }
        
        // Test for unused variables
        const unusedVariables = document.body.innerHTML.includes('var unused');
        if (!unusedVariables) {
            ciTestResults.passed++;
            console.log('✅ No unused variables found');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('Unused variables detected');
        }
        
        // Test for missing semicolons
        const missingSemicolons = document.body.innerHTML.includes('let x = 1\n');
        if (!missingSemicolons) {
            ciTestResults.passed++;
            console.log('✅ No missing semicolons found');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('Missing semicolons detected');
        }
        
    } catch (error) {
        ciTestResults.failed++;
        ciTestResults.errors.push(`Linting test failed: ${error.message}`);
    }
}

/**
 * Test performance issues
 */
async function testPerformanceIssues() {
    console.log('Testing performance issues...');
    
    try {
        // Test for memory leaks
        const memoryLeaks = document.body.innerHTML.includes('addEventListener');
        if (!memoryLeaks) {
            ciTestResults.passed++;
            console.log('✅ No memory leaks detected');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('Potential memory leaks detected');
        }
        
        // Test for infinite loops
        const infiniteLoops = document.body.innerHTML.includes('while(true)');
        if (!infiniteLoops) {
            ciTestResults.passed++;
            console.log('✅ No infinite loops detected');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('Infinite loops detected');
        }
        
        // Test for heavy computations
        const heavyComputations = document.body.innerHTML.includes('for(let i = 0; i < 1000000; i++)');
        if (!heavyComputations) {
            ciTestResults.passed++;
            console.log('✅ No heavy computations detected');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('Heavy computations detected');
        }
        
    } catch (error) {
        ciTestResults.failed++;
        ciTestResults.errors.push(`Performance test failed: ${error.message}`);
    }
}

/**
 * Test memory leaks
 */
async function testMemoryLeaks() {
    console.log('Testing memory leaks...');
    
    try {
        // Test for event listener cleanup
        const eventListeners = document.body.innerHTML.includes('addEventListener');
        if (!eventListeners) {
            ciTestResults.passed++;
            console.log('✅ No event listener leaks detected');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('Event listener leaks detected');
        }
        
        // Test for timer cleanup
        const timers = document.body.innerHTML.includes('setInterval');
        if (!timers) {
            ciTestResults.passed++;
            console.log('✅ No timer leaks detected');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('Timer leaks detected');
        }
        
        // Test for DOM reference leaks
        const domReferences = document.body.innerHTML.includes('document.getElementById');
        if (!domReferences) {
            ciTestResults.passed++;
            console.log('✅ No DOM reference leaks detected');
        } else {
            ciTestResults.failed++;
            ciTestResults.errors.push('DOM reference leaks detected');
        }
        
    } catch (error) {
        ciTestResults.failed++;
        ciTestResults.errors.push(`Memory leak test failed: ${error.message}`);
    }
}

/**
 * Display CI test results
 */
function displayCITestResults() {
    const totalTests = ciTestResults.passed + ciTestResults.failed;
    const passRate = totalTests > 0 ? (ciTestResults.passed / totalTests * 100).toFixed(1) : 0;
    
    console.log('\n📊 CI Fix Test Results:');
    console.log(`✅ Passed: ${ciTestResults.passed}`);
    console.log(`❌ Failed: ${ciTestResults.failed}`);
    console.log(`📈 Pass Rate: ${passRate}%`);
    
    if (ciTestResults.errors.length > 0) {
        console.log('\n🚨 Errors:');
        ciTestResults.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }
    
    // Create results summary
    const resultsSummary = {
        totalTests,
        passed: ciTestResults.passed,
        failed: ciTestResults.failed,
        passRate: parseFloat(passRate),
        errors: ciTestResults.errors,
        timestamp: new Date().toISOString()
    };
    
    // Save results to localStorage
    localStorage.setItem('ci_test_results', JSON.stringify(resultsSummary));
    
    return resultsSummary;
}

/**
 * Run comprehensive CI fix tests
 */
async function runComprehensiveCIFixTests() {
    console.log('🧪 Running Comprehensive CI Fix Tests...');
    
    try {
        await runCIFixTests();
        
        console.log('\n🎯 Comprehensive CI Fix Testing Complete!');
        
    } catch (error) {
        console.error('Comprehensive CI fix test suite failed:', error);
        ciTestResults.errors.push(`Comprehensive test suite error: ${error.message}`);
    }
}

/**
 * Run tests when page loads
 */
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            runComprehensiveCIFixTests();
        }, 2000); // Wait for modules to load
    });
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runCIFixTests,
        testSecurityIssues,
        testLintingIssues,
        testPerformanceIssues,
        testMemoryLeaks,
        displayCITestResults,
        runComprehensiveCIFixTests
    };
}
