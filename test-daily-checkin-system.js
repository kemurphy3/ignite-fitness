/**
 * Test Daily Check-in System - Comprehensive readiness and workout adjustment testing
 * Verifies daily check-in flow, readiness scoring, and workout adjustments
 */

// Test configuration
const DAILY_CHECKIN_TEST_CONFIG = {
    testUser: {
        username: 'checkintest',
        password: 'testpass123',
        athleteName: 'Check-in Test User'
    },
    testScenarios: {
        excellentReadiness: {
            sleepHours: 8.5,
            sleepQuality: 9,
            stressLevel: 2,
            energyLevel: 9,
            sorenessLevel: 2
        },
        poorReadiness: {
            sleepHours: 5,
            sleepQuality: 3,
            stressLevel: 8,
            energyLevel: 3,
            sorenessLevel: 8
        },
        moderateReadiness: {
            sleepHours: 7,
            sleepQuality: 6,
            stressLevel: 5,
            energyLevel: 6,
            sorenessLevel: 5
        }
    }
};

// Test results
let dailyCheckInTestResults = {
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * Run all daily check-in tests
 */
async function runDailyCheckInTests() {
    console.log('🧪 Starting Daily Check-in System Tests...');
    
    try {
        // Daily check-in module tests
        await testDailyCheckInModule();
        
        // Readiness scoring tests
        await testReadinessScoring();
        
        // Workout adjustment tests
        await testWorkoutAdjustments();
        
        // UI integration tests
        await testCheckInUI();
        
        // Data persistence tests
        await testDataPersistence();
        
        // Display results
        displayDailyCheckInTestResults();
        
    } catch (error) {
        console.error('Daily check-in test suite failed:', error);
        dailyCheckInTestResults.errors.push(`Test suite error: ${error.message}`);
    }
}

/**
 * Test daily check-in module functionality
 */
async function testDailyCheckInModule() {
    console.log('Testing daily check-in module...');
    
    try {
        if (typeof window.DailyCheckIn !== 'undefined') {
            // Test start daily check-in
            const startResult = window.DailyCheckIn.startDailyCheckIn();
            if (startResult.success) {
                dailyCheckInTestResults.passed++;
                console.log('✅ DailyCheckIn startDailyCheckIn working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('DailyCheckIn startDailyCheckIn failed');
            }
            
            // Test update check-in data
            const updateResult = window.DailyCheckIn.updateCheckInData('sleepHours', 8);
            if (updateResult.success) {
                dailyCheckInTestResults.passed++;
                console.log('✅ DailyCheckIn updateCheckInData working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('DailyCheckIn updateCheckInData failed');
            }
            
            // Test get slider description
            const description = window.DailyCheckIn.getSliderDescription('energy', 7);
            if (typeof description === 'string' && description.length > 0) {
                dailyCheckInTestResults.passed++;
                console.log('✅ DailyCheckIn getSliderDescription working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('DailyCheckIn getSliderDescription failed');
            }
            
            // Test get slider config
            const config = window.DailyCheckIn.getSliderConfig('stress');
            if (config && config.min && config.max) {
                dailyCheckInTestResults.passed++;
                console.log('✅ DailyCheckIn getSliderConfig working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('DailyCheckIn getSliderConfig failed');
            }
            
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('DailyCheckIn not available');
        }
    } catch (error) {
        dailyCheckInTestResults.failed++;
        dailyCheckInTestResults.errors.push(`DailyCheckIn module test failed: ${error.message}`);
    }
}

/**
 * Test readiness scoring functionality
 */
async function testReadinessScoring() {
    console.log('Testing readiness scoring...');
    
    try {
        if (typeof window.DailyCheckIn !== 'undefined') {
            // Test excellent readiness scenario
            const excellentData = DAILY_CHECKIN_TEST_CONFIG.testScenarios.excellentReadiness;
            const excellentScore = window.DailyCheckIn.calculateReadinessScore(excellentData);
            
            if (excellentScore >= 8) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Excellent readiness scoring working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push(`Excellent readiness score too low: ${excellentScore}`);
            }
            
            // Test poor readiness scenario
            const poorData = DAILY_CHECKIN_TEST_CONFIG.testScenarios.poorReadiness;
            const poorScore = window.DailyCheckIn.calculateReadinessScore(poorData);
            
            if (poorScore <= 4) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Poor readiness scoring working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push(`Poor readiness score too high: ${poorScore}`);
            }
            
            // Test moderate readiness scenario
            const moderateData = DAILY_CHECKIN_TEST_CONFIG.testScenarios.moderateReadiness;
            const moderateScore = window.DailyCheckIn.calculateReadinessScore(moderateData);
            
            if (moderateScore >= 5 && moderateScore <= 7) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Moderate readiness scoring working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push(`Moderate readiness score out of range: ${moderateScore}`);
            }
            
            // Test score bounds
            if (excellentScore >= 1 && excellentScore <= 10) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Readiness score bounds working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Readiness score bounds failed');
            }
            
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('DailyCheckIn not available for scoring tests');
        }
    } catch (error) {
        dailyCheckInTestResults.failed++;
        dailyCheckInTestResults.errors.push(`Readiness scoring test failed: ${error.message}`);
    }
}

/**
 * Test workout adjustment functionality
 */
async function testWorkoutAdjustments() {
    console.log('Testing workout adjustments...');
    
    try {
        if (typeof window.DailyCheckIn !== 'undefined') {
            // Test intensity reduction for poor sleep
            const poorSleepData = {
                sleepHours: 4,
                sleepQuality: 3,
                stressLevel: 5,
                energyLevel: 5,
                sorenessLevel: 5
            };
            
            const poorSleepAdjustments = window.DailyCheckIn.getWorkoutAdjustments(poorSleepData);
            
            if (poorSleepAdjustments.intensityMultiplier < 1.0) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Intensity reduction for poor sleep working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Intensity reduction for poor sleep failed');
            }
            
            // Test intensity reduction for high stress
            const highStressData = {
                sleepHours: 8,
                sleepQuality: 7,
                stressLevel: 9,
                energyLevel: 5,
                sorenessLevel: 5
            };
            
            const highStressAdjustments = window.DailyCheckIn.getWorkoutAdjustments(highStressData);
            
            if (highStressAdjustments.intensityMultiplier < 1.0) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Intensity reduction for high stress working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Intensity reduction for high stress failed');
            }
            
            // Test recovery workout suggestion for high soreness
            const highSorenessData = {
                sleepHours: 8,
                sleepQuality: 7,
                stressLevel: 5,
                energyLevel: 5,
                sorenessLevel: 9
            };
            
            const highSorenessAdjustments = window.DailyCheckIn.getWorkoutAdjustments(highSorenessData);
            
            if (highSorenessAdjustments.recoverySuggested && highSorenessAdjustments.workoutType === 'recovery') {
                dailyCheckInTestResults.passed++;
                console.log('✅ Recovery workout suggestion working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Recovery workout suggestion failed');
            }
            
            // Test coach messages
            if (poorSleepAdjustments.coachMessage && poorSleepAdjustments.coachMessage.length > 0) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Coach messages working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Coach messages failed');
            }
            
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('DailyCheckIn not available for adjustment tests');
        }
    } catch (error) {
        dailyCheckInTestResults.failed++;
        dailyCheckInTestResults.errors.push(`Workout adjustment test failed: ${error.message}`);
    }
}

/**
 * Test check-in UI functionality
 */
async function testCheckInUI() {
    console.log('Testing check-in UI...');
    
    try {
        // Check if check-in modal exists
        const checkInModal = document.getElementById('dailyCheckInModal');
        if (checkInModal) {
            dailyCheckInTestResults.passed++;
            console.log('✅ Daily check-in modal exists');
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('Daily check-in modal not found');
        }
        
        // Check if check-in container exists
        const checkInContainer = document.getElementById('checkInContainer');
        if (checkInContainer) {
            dailyCheckInTestResults.passed++;
            console.log('✅ Check-in container exists');
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('Check-in container not found');
        }
        
        // Test slider descriptions
        const descriptions = window.DailyCheckIn?.descriptions;
        if (descriptions && descriptions.sleep && descriptions.stress && descriptions.energy && descriptions.soreness) {
            dailyCheckInTestResults.passed++;
            console.log('✅ Slider descriptions configured');
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('Slider descriptions not configured');
        }
        
        // Test adjustment rules
        const rules = window.DailyCheckIn?.adjustmentRules;
        if (rules && rules.intensityReduction && rules.recoveryWorkout && rules.coachMessages) {
            dailyCheckInTestResults.passed++;
            console.log('✅ Adjustment rules configured');
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('Adjustment rules not configured');
        }
        
    } catch (error) {
        dailyCheckInTestResults.failed++;
        dailyCheckInTestResults.errors.push(`Check-in UI test failed: ${error.message}`);
    }
}

/**
 * Test data persistence
 */
async function testDataPersistence() {
    console.log('Testing data persistence...');
    
    try {
        if (typeof window.DailyCheckIn !== 'undefined') {
            // Test has completed today check-in
            const hasCompleted = window.DailyCheckIn.hasCompletedTodayCheckIn();
            if (typeof hasCompleted === 'boolean') {
                dailyCheckInTestResults.passed++;
                console.log('✅ Has completed today check-in working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Has completed today check-in failed');
            }
            
            // Test complete daily check-in
            const completeResult = window.DailyCheckIn.completeDailyCheckIn();
            if (completeResult.success) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Complete daily check-in working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Complete daily check-in failed');
            }
            
            // Test get today's check-in
            const todayCheckIn = window.DailyCheckIn.getTodayCheckIn();
            if (todayCheckIn && todayCheckIn.date) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Get today check-in working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Get today check-in failed');
            }
            
            // Test skip daily check-in
            const skipResult = window.DailyCheckIn.skipDailyCheckIn();
            if (skipResult.success) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Skip daily check-in working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Skip daily check-in failed');
            }
            
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('DailyCheckIn not available for persistence tests');
        }
    } catch (error) {
        dailyCheckInTestResults.failed++;
        dailyCheckInTestResults.errors.push(`Data persistence test failed: ${error.message}`);
    }
}

/**
 * Test readiness trend analysis
 */
async function testReadinessTrend() {
    console.log('Testing readiness trend analysis...');
    
    try {
        if (typeof window.DailyCheckIn !== 'undefined') {
            // Test get readiness trend
            const trend = window.DailyCheckIn.getReadinessTrend(7);
            if (Array.isArray(trend) && trend.length > 0) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Readiness trend analysis working');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Readiness trend analysis failed');
            }
            
            // Test trend data structure
            if (trend[0] && trend[0].date && trend[0].readinessScore) {
                dailyCheckInTestResults.passed++;
                console.log('✅ Readiness trend data structure correct');
            } else {
                dailyCheckInTestResults.failed++;
                dailyCheckInTestResults.errors.push('Readiness trend data structure incorrect');
            }
            
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('DailyCheckIn not available for trend tests');
        }
    } catch (error) {
        dailyCheckInTestResults.failed++;
        dailyCheckInTestResults.errors.push(`Readiness trend test failed: ${error.message}`);
    }
}

/**
 * Test workout integration
 */
async function testWorkoutIntegration() {
    console.log('Testing workout integration...');
    
    try {
        // Test startWorkout function
        if (typeof window.startWorkout === 'function') {
            dailyCheckInTestResults.passed++;
            console.log('✅ Start workout function exists');
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('Start workout function not found');
        }
        
        // Test showDailyCheckIn function
        if (typeof window.showDailyCheckIn === 'function') {
            dailyCheckInTestResults.passed++;
            console.log('✅ Show daily check-in function exists');
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('Show daily check-in function not found');
        }
        
        // Test completeDailyCheckIn function
        if (typeof window.completeDailyCheckIn === 'function') {
            dailyCheckInTestResults.passed++;
            console.log('✅ Complete daily check-in function exists');
        } else {
            dailyCheckInTestResults.failed++;
            dailyCheckInTestResults.errors.push('Complete daily check-in function not found');
        }
        
    } catch (error) {
        dailyCheckInTestResults.failed++;
        dailyCheckInTestResults.errors.push(`Workout integration test failed: ${error.message}`);
    }
}

/**
 * Display daily check-in test results
 */
function displayDailyCheckInTestResults() {
    const totalTests = dailyCheckInTestResults.passed + dailyCheckInTestResults.failed;
    const passRate = totalTests > 0 ? (dailyCheckInTestResults.passed / totalTests * 100).toFixed(1) : 0;
    
    console.log('\n📊 Daily Check-in Test Results:');
    console.log(`✅ Passed: ${dailyCheckInTestResults.passed}`);
    console.log(`❌ Failed: ${dailyCheckInTestResults.failed}`);
    console.log(`📈 Pass Rate: ${passRate}%`);
    
    if (dailyCheckInTestResults.errors.length > 0) {
        console.log('\n🚨 Errors:');
        dailyCheckInTestResults.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }
    
    // Create results summary
    const resultsSummary = {
        totalTests,
        passed: dailyCheckInTestResults.passed,
        failed: dailyCheckInTestResults.failed,
        passRate: parseFloat(passRate),
        errors: dailyCheckInTestResults.errors,
        timestamp: new Date().toISOString()
    };
    
    // Save results to localStorage
    localStorage.setItem('daily_checkin_test_results', JSON.stringify(resultsSummary));
    
    return resultsSummary;
}

/**
 * Run comprehensive daily check-in tests
 */
async function runComprehensiveDailyCheckInTests() {
    console.log('🧪 Running Comprehensive Daily Check-in Tests...');
    
    try {
        await runDailyCheckInTests();
        await testReadinessTrend();
        await testWorkoutIntegration();
        
        console.log('\n🎯 Comprehensive Daily Check-in Testing Complete!');
        
    } catch (error) {
        console.error('Comprehensive daily check-in test suite failed:', error);
        dailyCheckInTestResults.errors.push(`Comprehensive test suite error: ${error.message}`);
    }
}

/**
 * Run tests when page loads
 */
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            runComprehensiveDailyCheckInTests();
        }, 2000); // Wait for modules to load
    });
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runDailyCheckInTests,
        testDailyCheckInModule,
        testReadinessScoring,
        testWorkoutAdjustments,
        testCheckInUI,
        testDataPersistence,
        testReadinessTrend,
        testWorkoutIntegration,
        displayDailyCheckInTestResults,
        runComprehensiveDailyCheckInTests
    };
}
