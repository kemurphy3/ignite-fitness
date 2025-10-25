/**
 * Test Progression System - Comprehensive progression and exercise adaptation testing
 * Verifies auto-progression, exercise feedback, and time optimization
 */

// Test configuration
const PROGRESSION_TEST_CONFIG = {
    testUser: {
        username: 'progressiontest',
        password: 'testpass123',
        athleteName: 'Progression Test User'
    },
    testExercises: {
        squat: {
            name: 'Squat',
            weight: 135,
            reps: 8,
            sets: 3,
            rpe: 8
        },
        benchPress: {
            name: 'Bench Press',
            weight: 115,
            reps: 8,
            sets: 3,
            rpe: 7
        },
        deadlift: {
            name: 'Deadlift',
            weight: 185,
            reps: 5,
            sets: 3,
            rpe: 9
        }
    },
    testScenarios: {
        weightIncrease: { rpe: 8, setsCompleted: 1.0, repsCompleted: 8 },
        weightDecrease: { rpe: 9, setsCompleted: 1.0, repsCompleted: 5 },
        repProgression: { rpe: 8, setsCompleted: 1.0, repsCompleted: 8 },
        maintenance: { rpe: 7, setsCompleted: 1.0, repsCompleted: 8 }
    }
};

// Test results
let progressionTestResults = {
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * Run all progression system tests
 */
async function runProgressionSystemTests() {
    console.log('🧪 Starting Progression System Tests...');
    
    try {
        // Progression engine tests
        await testProgressionEngine();
        
        // Exercise adapter tests
        await testExerciseAdapter();
        
        // Feedback system tests
        await testFeedbackSystem();
        
        // Time optimization tests
        await testTimeOptimization();
        
        // Integration tests
        await testProgressionIntegration();
        
        // Display results
        displayProgressionTestResults();
        
    } catch (error) {
        console.error('Progression system test suite failed:', error);
        progressionTestResults.errors.push(`Test suite error: ${error.message}`);
    }
}

/**
 * Test progression engine functionality
 */
async function testProgressionEngine() {
    console.log('Testing progression engine...');
    
    try {
        if (typeof window.ProgressionEngine !== 'undefined') {
            // Test weight increase scenario
            const increaseResult = window.ProgressionEngine.calculateNextSession(
                PROGRESSION_TEST_CONFIG.testExercises.squat,
                PROGRESSION_TEST_CONFIG.testScenarios.weightIncrease.rpe,
                PROGRESSION_TEST_CONFIG.testScenarios.weightIncrease.setsCompleted,
                PROGRESSION_TEST_CONFIG.testScenarios.weightIncrease.repsCompleted
            );
            
            if (increaseResult.progression === 'weight_increase' && increaseResult.weight > PROGRESSION_TEST_CONFIG.testExercises.squat.weight) {
                progressionTestResults.passed++;
                console.log('✅ Weight increase progression working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Weight increase progression failed');
            }
            
            // Test weight decrease scenario
            const decreaseResult = window.ProgressionEngine.calculateNextSession(
                PROGRESSION_TEST_CONFIG.testExercises.deadlift,
                PROGRESSION_TEST_CONFIG.testScenarios.weightDecrease.rpe,
                PROGRESSION_TEST_CONFIG.testScenarios.weightDecrease.setsCompleted,
                PROGRESSION_TEST_CONFIG.testScenarios.weightDecrease.repsCompleted
            );
            
            if (decreaseResult.progression === 'weight_decrease' && decreaseResult.weight < PROGRESSION_TEST_CONFIG.testExercises.deadlift.weight) {
                progressionTestResults.passed++;
                console.log('✅ Weight decrease progression working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Weight decrease progression failed');
            }
            
            // Test exercise bounds
            const bounds = window.ProgressionEngine.exerciseBounds;
            if (bounds && bounds.squat && bounds.squat.min && bounds.squat.max) {
                progressionTestResults.passed++;
                console.log('✅ Exercise bounds configured');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Exercise bounds not configured');
            }
            
            // Test rep schemes
            const repSchemes = window.ProgressionEngine.repSchemes;
            if (repSchemes && repSchemes.squat && repSchemes.squat.progression) {
                progressionTestResults.passed++;
                console.log('✅ Rep schemes configured');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Rep schemes not configured');
            }
            
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('ProgressionEngine not available');
        }
    } catch (error) {
        progressionTestResults.failed++;
        progressionTestResults.errors.push(`ProgressionEngine test failed: ${error.message}`);
    }
}

/**
 * Test exercise adapter functionality
 */
async function testExerciseAdapter() {
    console.log('Testing exercise adapter...');
    
    try {
        if (typeof window.ExerciseAdapter !== 'undefined') {
            // Test exercise feedback processing
            const painFeedback = window.ExerciseAdapter.processExerciseFeedback(
                'squat',
                'this hurts',
                PROGRESSION_TEST_CONFIG.testExercises.squat
            );
            
            if (painFeedback.success && painFeedback.alternatives.length > 0) {
                progressionTestResults.passed++;
                console.log('✅ Exercise feedback processing working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Exercise feedback processing failed');
            }
            
            // Test alternative suggestions
            const alternatives = window.ExerciseAdapter.getExerciseAlternatives('squat');
            if (Array.isArray(alternatives) && alternatives.length > 0) {
                progressionTestResults.passed++;
                console.log('✅ Exercise alternatives working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Exercise alternatives failed');
            }
            
            // Test exercise suggestion
            const suggestion = window.ExerciseAdapter.suggestExercise('chest', 'intermediate', ['barbell']);
            if (suggestion.success && suggestion.exercise) {
                progressionTestResults.passed++;
                console.log('✅ Exercise suggestion working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Exercise suggestion failed');
            }
            
            // Test preference saving
            const saveResult = window.ExerciseAdapter.saveExercisePreference('squat', 'prefer', 'Great exercise');
            if (saveResult.success) {
                progressionTestResults.passed++;
                console.log('✅ Exercise preference saving working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Exercise preference saving failed');
            }
            
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('ExerciseAdapter not available');
        }
    } catch (error) {
        progressionTestResults.failed++;
        progressionTestResults.errors.push(`ExerciseAdapter test failed: ${error.message}`);
    }
}

/**
 * Test feedback system functionality
 */
async function testFeedbackSystem() {
    console.log('Testing feedback system...');
    
    try {
        // Test feedback option selection
        if (typeof window.selectFeedbackOption === 'function') {
            progressionTestResults.passed++;
            console.log('✅ Feedback option selection function exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Feedback option selection function not found');
        }
        
        // Test exercise rating
        if (typeof window.setExerciseRating === 'function') {
            progressionTestResults.passed++;
            console.log('✅ Exercise rating function exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Exercise rating function not found');
        }
        
        // Test feedback submission
        if (typeof window.submitExerciseFeedback === 'function') {
            progressionTestResults.passed++;
            console.log('✅ Feedback submission function exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Feedback submission function not found');
        }
        
        // Test alternative selection
        if (typeof window.selectExerciseAlternative === 'function') {
            progressionTestResults.passed++;
            console.log('✅ Alternative selection function exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Alternative selection function not found');
        }
        
    } catch (error) {
        progressionTestResults.failed++;
        progressionTestResults.errors.push(`Feedback system test failed: ${error.message}`);
    }
}

/**
 * Test time optimization functionality
 */
async function testTimeOptimization() {
    console.log('Testing time optimization...');
    
    try {
        if (typeof window.ProgressionEngine !== 'undefined') {
            // Test workout adaptation for short time
            const shortTimeWorkout = {
                exercises: [
                    { name: 'Squat', sets: 3, reps: 8, restTime: 90 },
                    { name: 'Bench Press', sets: 3, reps: 8, restTime: 90 },
                    { name: 'Deadlift', sets: 3, reps: 5, restTime: 120 }
                ],
                estimatedTime: 60
            };
            
            const adaptedWorkout = window.ProgressionEngine.adaptWorkoutToTime(30, shortTimeWorkout);
            
            if (adaptedWorkout && adaptedWorkout.estimatedTime <= 30) {
                progressionTestResults.passed++;
                console.log('✅ Time optimization working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Time optimization failed');
            }
            
            // Test superset creation
            const supersetWorkout = window.ProgressionEngine.createSupersetVersion(shortTimeWorkout);
            if (supersetWorkout && supersetWorkout.type === 'superset') {
                progressionTestResults.passed++;
                console.log('✅ Superset creation working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Superset creation failed');
            }
            
            // Test rest time reduction
            const reducedRestWorkout = window.ProgressionEngine.reduceRestTimes(shortTimeWorkout);
            if (reducedRestWorkout && reducedRestWorkout.estimatedTime < shortTimeWorkout.estimatedTime) {
                progressionTestResults.passed++;
                console.log('✅ Rest time reduction working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Rest time reduction failed');
            }
            
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('ProgressionEngine not available for time optimization');
        }
    } catch (error) {
        progressionTestResults.failed++;
        progressionTestResults.errors.push(`Time optimization test failed: ${error.message}`);
    }
}

/**
 * Test progression integration
 */
async function testProgressionIntegration() {
    console.log('Testing progression integration...');
    
    try {
        // Test progression calculation function
        if (typeof window.calculateExerciseProgression === 'function') {
            progressionTestResults.passed++;
            console.log('✅ Progression calculation function exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Progression calculation function not found');
        }
        
        // Test workout adaptation function
        if (typeof window.adaptWorkoutToTime === 'function') {
            progressionTestResults.passed++;
            console.log('✅ Workout adaptation function exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Workout adaptation function not found');
        }
        
        // Test exercise feedback UI
        if (typeof window.showExerciseFeedback === 'function') {
            progressionTestResults.passed++;
            console.log('✅ Exercise feedback UI function exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Exercise feedback UI function not found');
        }
        
        // Test exercise alternatives UI
        if (typeof window.showExerciseAlternatives === 'function') {
            progressionTestResults.passed++;
            console.log('✅ Exercise alternatives UI function exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Exercise alternatives UI function not found');
        }
        
    } catch (error) {
        progressionTestResults.failed++;
        progressionTestResults.errors.push(`Progression integration test failed: ${error.message}`);
    }
}

/**
 * Test progression history and analytics
 */
async function testProgressionAnalytics() {
    console.log('Testing progression analytics...');
    
    try {
        if (typeof window.ProgressionEngine !== 'undefined') {
            // Test progression history
            const history = window.ProgressionEngine.getProgressionHistory('squat', 30);
            if (Array.isArray(history) && history.length > 0) {
                progressionTestResults.passed++;
                console.log('✅ Progression history working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Progression history failed');
            }
            
            // Test exercise preference saving
            const preferenceResult = window.ProgressionEngine.saveExercisePreference('squat', 'prefer', 'Great exercise');
            if (preferenceResult.success) {
                progressionTestResults.passed++;
                console.log('✅ Exercise preference saving working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Exercise preference saving failed');
            }
            
            // Test exercise avoidance check
            const shouldAvoid = window.ProgressionEngine.shouldAvoidExercise('squat');
            if (typeof shouldAvoid === 'boolean') {
                progressionTestResults.passed++;
                console.log('✅ Exercise avoidance check working');
            } else {
                progressionTestResults.failed++;
                progressionTestResults.errors.push('Exercise avoidance check failed');
            }
            
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('ProgressionEngine not available for analytics');
        }
    } catch (error) {
        progressionTestResults.failed++;
        progressionTestResults.errors.push(`Progression analytics test failed: ${error.message}`);
    }
}

/**
 * Test UI components
 */
async function testProgressionUI() {
    console.log('Testing progression UI components...');
    
    try {
        // Check if feedback modal exists
        const feedbackModal = document.getElementById('exerciseFeedbackModal');
        if (feedbackModal) {
            progressionTestResults.passed++;
            console.log('✅ Exercise feedback modal exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Exercise feedback modal not found');
        }
        
        // Check if alternatives modal exists
        const alternativesModal = document.getElementById('exerciseAlternativesModal');
        if (alternativesModal) {
            progressionTestResults.passed++;
            console.log('✅ Exercise alternatives modal exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Exercise alternatives modal not found');
        }
        
        // Check if feedback container exists
        const feedbackContainer = document.getElementById('exerciseFeedbackContainer');
        if (feedbackContainer) {
            progressionTestResults.passed++;
            console.log('✅ Exercise feedback container exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Exercise feedback container not found');
        }
        
        // Check if alternatives container exists
        const alternativesContainer = document.getElementById('exerciseAlternativesContainer');
        if (alternativesContainer) {
            progressionTestResults.passed++;
            console.log('✅ Exercise alternatives container exists');
        } else {
            progressionTestResults.failed++;
            progressionTestResults.errors.push('Exercise alternatives container not found');
        }
        
    } catch (error) {
        progressionTestResults.failed++;
        progressionTestResults.errors.push(`Progression UI test failed: ${error.message}`);
    }
}

/**
 * Display progression test results
 */
function displayProgressionTestResults() {
    const totalTests = progressionTestResults.passed + progressionTestResults.failed;
    const passRate = totalTests > 0 ? (progressionTestResults.passed / totalTests * 100).toFixed(1) : 0;
    
    console.log('\n📊 Progression System Test Results:');
    console.log(`✅ Passed: ${progressionTestResults.passed}`);
    console.log(`❌ Failed: ${progressionTestResults.failed}`);
    console.log(`📈 Pass Rate: ${passRate}%`);
    
    if (progressionTestResults.errors.length > 0) {
        console.log('\n🚨 Errors:');
        progressionTestResults.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }
    
    // Create results summary
    const resultsSummary = {
        totalTests,
        passed: progressionTestResults.passed,
        failed: progressionTestResults.failed,
        passRate: parseFloat(passRate),
        errors: progressionTestResults.errors,
        timestamp: new Date().toISOString()
    };
    
    // Save results to localStorage
    localStorage.setItem('progression_system_test_results', JSON.stringify(resultsSummary));
    
    return resultsSummary;
}

/**
 * Run comprehensive progression system tests
 */
async function runComprehensiveProgressionTests() {
    console.log('🧪 Running Comprehensive Progression System Tests...');
    
    try {
        await runProgressionSystemTests();
        await testProgressionAnalytics();
        await testProgressionUI();
        
        console.log('\n🎯 Comprehensive Progression System Testing Complete!');
        
    } catch (error) {
        console.error('Comprehensive progression system test suite failed:', error);
        progressionTestResults.errors.push(`Comprehensive test suite error: ${error.message}`);
    }
}

/**
 * Run tests when page loads
 */
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            runComprehensiveProgressionTests();
        }, 2000); // Wait for modules to load
    });
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runProgressionSystemTests,
        testProgressionEngine,
        testExerciseAdapter,
        testFeedbackSystem,
        testTimeOptimization,
        testProgressionIntegration,
        testProgressionAnalytics,
        testProgressionUI,
        displayProgressionTestResults,
        runComprehensiveProgressionTests
    };
}
