/**
 * Test Modular Architecture - Comprehensive functionality test
 * Verifies all modules work correctly and maintain existing functionality
 */

// Test configuration
const TEST_CONFIG = {
    testUser: {
        username: 'testuser',
        password: 'testpass123',
        athleteName: 'Test Athlete'
    },
    testWorkout: {
        name: 'Test Workout',
        type: 'Strength',
        exercises: [
            {
                name: 'Push-ups',
                sets: [
                    { reps: 10, weight: 0, rest: 60 }
                ]
            }
        ]
    }
};

// Test results
let testResults = {
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('🧪 Starting Modular Architecture Tests...');
    
    try {
        // Core module tests
        await testCoreModules();
        
        // Authentication tests
        await testAuthentication();
        
        // Data module tests
        await testDataModules();
        
        // Workout module tests
        await testWorkoutModules();
        
        // AI module tests
        await testAIModules();
        
        // Integration tests
        await testIntegration();
        
        // Display results
        displayTestResults();
        
    } catch (error) {
        console.error('Test suite failed:', error);
        testResults.errors.push(`Test suite error: ${error.message}`);
    }
}

/**
 * Test core modules
 */
async function testCoreModules() {
    console.log('Testing core modules...');
    
    // Test EventBus
    try {
        if (typeof window.EventBus !== 'undefined') {
            const testEvent = 'test-event';
            let eventReceived = false;
            
            window.EventBus.on(testEvent, () => {
                eventReceived = true;
            });
            
            window.EventBus.emit(testEvent);
            
            if (eventReceived) {
                testResults.passed++;
                console.log('✅ EventBus working');
            } else {
                testResults.failed++;
                testResults.errors.push('EventBus not working');
            }
        } else {
            testResults.failed++;
            testResults.errors.push('EventBus not available');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`EventBus test failed: ${error.message}`);
    }
    
    // Test SafeLogger
    try {
        if (typeof window.SafeLogger !== 'undefined') {
            window.SafeLogger.info('Test log message');
            testResults.passed++;
            console.log('✅ SafeLogger working');
        } else {
            testResults.failed++;
            testResults.errors.push('SafeLogger not available');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`SafeLogger test failed: ${error.message}`);
    }
}

/**
 * Test authentication modules
 */
async function testAuthentication() {
    console.log('Testing authentication modules...');
    
    // Test AuthManager
    try {
        if (typeof window.AuthManager !== 'undefined') {
            // Test registration
            const regResult = window.AuthManager.register(TEST_CONFIG.testUser);
            if (regResult.success) {
                testResults.passed++;
                console.log('✅ AuthManager registration working');
            } else {
                testResults.failed++;
                testResults.errors.push('AuthManager registration failed');
            }
            
            // Test login
            const loginResult = window.AuthManager.login(TEST_CONFIG.testUser.username, TEST_CONFIG.testUser.password);
            if (loginResult.success) {
                testResults.passed++;
                console.log('✅ AuthManager login working');
            } else {
                testResults.failed++;
                testResults.errors.push('AuthManager login failed');
            }
            
            // Test logout
            const logoutResult = window.AuthManager.logout();
            if (logoutResult.success) {
                testResults.passed++;
                console.log('✅ AuthManager logout working');
            } else {
                testResults.failed++;
                testResults.errors.push('AuthManager logout failed');
            }
        } else {
            testResults.failed++;
            testResults.errors.push('AuthManager not available');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`AuthManager test failed: ${error.message}`);
    }
    
    // Test SessionManager
    try {
        if (typeof window.SessionManager !== 'undefined') {
            const sessionData = window.SessionManager.getSessionData();
            testResults.passed++;
            console.log('✅ SessionManager working');
        } else {
            testResults.failed++;
            testResults.errors.push('SessionManager not available');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`SessionManager test failed: ${error.message}`);
    }
}

/**
 * Test data modules
 */
async function testDataModules() {
    console.log('Testing data modules...');
    
    // Test StorageManager
    try {
        if (typeof window.StorageManager !== 'undefined') {
            const testData = { test: 'data' };
            const saveResult = window.StorageManager.saveToLocalStorage('test', testData);
            if (saveResult.success) {
                const retrievedData = window.StorageManager.getFromLocalStorage('test');
                if (retrievedData && retrievedData.test === 'data') {
                    testResults.passed++;
                    console.log('✅ StorageManager working');
                } else {
                    testResults.failed++;
                    testResults.errors.push('StorageManager data retrieval failed');
                }
            } else {
                testResults.failed++;
                testResults.errors.push('StorageManager save failed');
            }
        } else {
            testResults.failed++;
            testResults.errors.push('StorageManager not available');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`StorageManager test failed: ${error.message}`);
    }
    
    // Test ApiClient
    try {
        if (typeof window.ApiClient !== 'undefined') {
            testResults.passed++;
            console.log('✅ ApiClient available');
        } else {
            testResults.failed++;
            testResults.errors.push('ApiClient not available');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`ApiClient test failed: ${error.message}`);
    }
    
    // Test ExerciseDatabase
    try {
        if (typeof window.ExerciseDatabase !== 'undefined') {
            const exercises = window.ExerciseDatabase.getAllExercises();
            testResults.passed++;
            console.log('✅ ExerciseDatabase working');
        } else {
            testResults.failed++;
            testResults.errors.push('ExerciseDatabase not available');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`ExerciseDatabase test failed: ${error.message}`);
    }
}

/**
 * Test workout modules
 */
async function testWorkoutModules() {
    console.log('Testing workout modules...');
    
    // Test WorkoutTracker
    try {
        if (typeof window.WorkoutTracker !== 'undefined') {
            const startResult = window.WorkoutTracker.startWorkout(TEST_CONFIG.testWorkout);
            if (startResult.success) {
                testResults.passed++;
                console.log('✅ WorkoutTracker start working');
                
                // Test adding exercise
                const exerciseResult = window.WorkoutTracker.addExerciseToWorkout({
                    name: 'Test Exercise',
                    sets: []
                });
                
                if (exerciseResult.success) {
                    testResults.passed++;
                    console.log('✅ WorkoutTracker add exercise working');
                } else {
                    testResults.failed++;
                    testResults.errors.push('WorkoutTracker add exercise failed');
                }
                
                // Test completing workout
                const completeResult = window.WorkoutTracker.completeWorkout();
                if (completeResult.success) {
                    testResults.passed++;
                    console.log('✅ WorkoutTracker complete working');
                } else {
                    testResults.failed++;
                    testResults.errors.push('WorkoutTracker complete failed');
                }
            } else {
                testResults.failed++;
                testResults.errors.push('WorkoutTracker start failed');
            }
        } else {
            testResults.failed++;
            testResults.errors.push('WorkoutTracker not available');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`WorkoutTracker test failed: ${error.message}`);
    }
    
    // Test ProgressionEngine
    try {
        if (typeof window.ProgressionEngine !== 'undefined') {
            const progression = window.ProgressionEngine.calculateProgression('Push-ups', {
                sets: [{ reps: 10, weight: 0 }]
            });
            
            if (progression && progression.exercise === 'Push-ups') {
                testResults.passed++;
                console.log('✅ ProgressionEngine working');
            } else {
                testResults.failed++;
                testResults.errors.push('ProgressionEngine calculation failed');
            }
        } else {
            testResults.failed++;
            testResults.errors.push('ProgressionEngine not available');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`ProgressionEngine test failed: ${error.message}`);
    }
}

/**
 * Test AI modules
 */
async function testAIModules() {
    console.log('Testing AI modules...');
    
    // Test CoachingEngine
    try {
        if (typeof window.CoachingEngine !== 'undefined') {
            const status = window.CoachingEngine.getSystemStatus();
            if (status && typeof status === 'object') {
                testResults.passed++;
                console.log('✅ CoachingEngine working');
            } else {
                testResults.failed++;
                testResults.errors.push('CoachingEngine status check failed');
            }
        } else {
            testResults.failed++;
            testResults.errors.push('CoachingEngine not available');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`CoachingEngine test failed: ${error.message}`);
    }
}

/**
 * Test integration between modules
 */
async function testIntegration() {
    console.log('Testing module integration...');
    
    try {
        // Test that modules can communicate
        if (window.EventBus && window.AuthManager) {
            let eventReceived = false;
            
            window.EventBus.on('user:login', () => {
                eventReceived = true;
            });
            
            // Simulate login
            window.AuthManager.login(TEST_CONFIG.testUser.username, TEST_CONFIG.testUser.password);
            
            if (eventReceived) {
                testResults.passed++;
                console.log('✅ Module integration working');
            } else {
                testResults.failed++;
                testResults.errors.push('Module integration failed');
            }
        } else {
            testResults.failed++;
            testResults.errors.push('Required modules not available for integration test');
        }
    } catch (error) {
        testResults.failed++;
        testResults.errors.push(`Integration test failed: ${error.message}`);
    }
}

/**
 * Display test results
 */
function displayTestResults() {
    const totalTests = testResults.passed + testResults.failed;
    const passRate = totalTests > 0 ? (testResults.passed / totalTests * 100).toFixed(1) : 0;
    
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Pass Rate: ${passRate}%`);
    
    if (testResults.errors.length > 0) {
        console.log('\n🚨 Errors:');
        testResults.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }
    
    // Create results summary
    const resultsSummary = {
        totalTests,
        passed: testResults.passed,
        failed: testResults.failed,
        passRate: parseFloat(passRate),
        errors: testResults.errors,
        timestamp: new Date().toISOString()
    };
    
    // Save results to localStorage
    localStorage.setItem('modular_architecture_test_results', JSON.stringify(resultsSummary));
    
    return resultsSummary;
}

/**
 * Run tests when page loads
 */
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(runAllTests, 1000); // Wait for modules to load
    });
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        testCoreModules,
        testAuthentication,
        testDataModules,
        testWorkoutModules,
        testAIModules,
        testIntegration,
        displayTestResults
    };
}
