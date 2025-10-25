/**
 * Test Onboarding System - Comprehensive onboarding and dashboard testing
 * Verifies onboarding flow, preferences, and dashboard personalization
 */

// Test configuration
const ONBOARDING_TEST_CONFIG = {
    testUser: {
        username: 'onboardingtest',
        password: 'testpass123',
        athleteName: 'Onboarding Test User'
    },
    testPreferences: {
        data_preference: 'some_metrics',
        primary_goal: 'strength',
        training_background: 'intermediate',
        primary_sport: 'soccer',
        time_commitment: '4-5_days',
        role: 'athlete'
    }
};

// Test results
let onboardingTestResults = {
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * Run all onboarding tests
 */
async function runOnboardingTests() {
    console.log('🧪 Starting Onboarding System Tests...');
    
    try {
        // Onboarding module tests
        await testOnboardingModule();
        
        // Dashboard renderer tests
        await testDashboardRenderer();
        
        // Integration tests
        await testOnboardingFlow();
        
        // Preference management tests
        await testPreferenceManagement();
        
        // Role switching tests
        await testRoleSwitching();
        
        // Display results
        displayOnboardingTestResults();
        
    } catch (error) {
        console.error('Onboarding test suite failed:', error);
        onboardingTestResults.errors.push(`Test suite error: ${error.message}`);
    }
}

/**
 * Test onboarding module functionality
 */
async function testOnboardingModule() {
    console.log('Testing onboarding module...');
    
    try {
        if (typeof window.OnboardingManager !== 'undefined') {
            // Test needs onboarding check
            const needsOnboarding = window.OnboardingManager.needsOnboarding();
            if (typeof needsOnboarding === 'boolean') {
                onboardingTestResults.passed++;
                console.log('✅ OnboardingManager needsOnboarding working');
            } else {
                onboardingTestResults.failed++;
                onboardingTestResults.errors.push('OnboardingManager needsOnboarding not working');
            }
            
            // Test start onboarding
            const startResult = window.OnboardingManager.startOnboarding();
            if (startResult.success) {
                onboardingTestResults.passed++;
                console.log('✅ OnboardingManager startOnboarding working');
            } else {
                onboardingTestResults.failed++;
                onboardingTestResults.errors.push('OnboardingManager startOnboarding failed');
            }
            
            // Test get current question
            const question = window.OnboardingManager.getCurrentQuestion();
            if (question && question.question) {
                onboardingTestResults.passed++;
                console.log('✅ OnboardingManager getCurrentQuestion working');
            } else {
                onboardingTestResults.failed++;
                onboardingTestResults.errors.push('OnboardingManager getCurrentQuestion failed');
            }
            
            // Test answer question
            const answerResult = window.OnboardingManager.answerQuestion('strength');
            if (answerResult.success) {
                onboardingTestResults.passed++;
                console.log('✅ OnboardingManager answerQuestion working');
            } else {
                onboardingTestResults.failed++;
                onboardingTestResults.errors.push('OnboardingManager answerQuestion failed');
            }
            
            // Test get user preferences
            const preferences = window.OnboardingManager.getUserPreferences();
            if (typeof preferences === 'object') {
                onboardingTestResults.passed++;
                console.log('✅ OnboardingManager getUserPreferences working');
            } else {
                onboardingTestResults.failed++;
                onboardingTestResults.errors.push('OnboardingManager getUserPreferences failed');
            }
            
            // Test update preferences
            const updateResult = window.OnboardingManager.updateUserPreferences(ONBOARDING_TEST_CONFIG.testPreferences);
            if (updateResult.success) {
                onboardingTestResults.passed++;
                console.log('✅ OnboardingManager updateUserPreferences working');
            } else {
                onboardingTestResults.failed++;
                onboardingTestResults.errors.push('OnboardingManager updateUserPreferences failed');
            }
            
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('OnboardingManager not available');
        }
    } catch (error) {
        onboardingTestResults.failed++;
        onboardingTestResults.errors.push(`OnboardingManager test failed: ${error.message}`);
    }
}

/**
 * Test dashboard renderer functionality
 */
async function testDashboardRenderer() {
    console.log('Testing dashboard renderer...');
    
    try {
        if (typeof window.DashboardRenderer !== 'undefined') {
            // Test render dashboard
            const renderResult = window.DashboardRenderer.renderDashboard();
            if (renderResult.success) {
                onboardingTestResults.passed++;
                console.log('✅ DashboardRenderer renderDashboard working');
            } else {
                onboardingTestResults.failed++;
                onboardingTestResults.errors.push('DashboardRenderer renderDashboard failed');
            }
            
            // Test get dashboard configuration
            const config = window.DashboardRenderer.getDashboardConfiguration();
            if (config && config.name) {
                onboardingTestResults.passed++;
                console.log('✅ DashboardRenderer getDashboardConfiguration working');
            } else {
                onboardingTestResults.failed++;
                onboardingTestResults.errors.push('DashboardRenderer getDashboardConfiguration failed');
            }
            
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('DashboardRenderer not available');
        }
    } catch (error) {
        onboardingTestResults.failed++;
        onboardingTestResults.errors.push(`DashboardRenderer test failed: ${error.message}`);
    }
}

/**
 * Test complete onboarding flow
 */
async function testOnboardingFlow() {
    console.log('Testing onboarding flow...');
    
    try {
        // Test onboarding questions
        const questions = window.OnboardingManager?.onboardingQuestions || [];
        if (questions.length === 6) {
            onboardingTestResults.passed++;
            console.log('✅ Onboarding questions configured correctly');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push(`Expected 6 questions, got ${questions.length}`);
        }
        
        // Test question structure
        const firstQuestion = questions[0];
        if (firstQuestion && firstQuestion.id && firstQuestion.question && firstQuestion.options) {
            onboardingTestResults.passed++;
            console.log('✅ Onboarding question structure correct');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Onboarding question structure incorrect');
        }
        
        // Test onboarding progress
        const progress = window.OnboardingManager?.getOnboardingProgress();
        if (progress && typeof progress.currentStep === 'number') {
            onboardingTestResults.passed++;
            console.log('✅ Onboarding progress tracking working');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Onboarding progress tracking failed');
        }
        
    } catch (error) {
        onboardingTestResults.failed++;
        onboardingTestResults.errors.push(`Onboarding flow test failed: ${error.message}`);
    }
}

/**
 * Test preference management
 */
async function testPreferenceManagement() {
    console.log('Testing preference management...');
    
    try {
        // Test get user preferences
        const preferences = window.OnboardingManager?.getUserPreferences();
        if (typeof preferences === 'object') {
            onboardingTestResults.passed++;
            console.log('✅ User preferences retrieval working');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('User preferences retrieval failed');
        }
        
        // Test update preferences
        const newPreferences = {
            data_preference: 'all_data',
            role: 'coach'
        };
        
        const updateResult = window.OnboardingManager?.updateUserPreferences(newPreferences);
        if (updateResult.success) {
            onboardingTestResults.passed++;
            console.log('✅ User preferences update working');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('User preferences update failed');
        }
        
        // Test get dashboard mode
        const dashboardMode = window.OnboardingManager?.getDashboardMode();
        if (typeof dashboardMode === 'string') {
            onboardingTestResults.passed++;
            console.log('✅ Dashboard mode retrieval working');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Dashboard mode retrieval failed');
        }
        
        // Test get user role
        const userRole = window.OnboardingManager?.getUserRole();
        if (typeof userRole === 'string') {
            onboardingTestResults.passed++;
            console.log('✅ User role retrieval working');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('User role retrieval failed');
        }
        
    } catch (error) {
        onboardingTestResults.failed++;
        onboardingTestResults.errors.push(`Preference management test failed: ${error.message}`);
    }
}

/**
 * Test role switching functionality
 */
async function testRoleSwitching() {
    console.log('Testing role switching...');
    
    try {
        // Test isCoach function
        const isCoach = window.OnboardingManager?.isCoach();
        if (typeof isCoach === 'boolean') {
            onboardingTestResults.passed++;
            console.log('✅ Coach role check working');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Coach role check failed');
        }
        
        // Test role switching
        const currentRole = window.OnboardingManager?.getUserRole();
        const newRole = currentRole === 'athlete' ? 'coach' : 'athlete';
        
        const switchResult = window.OnboardingManager?.updateUserPreferences({ role: newRole });
        if (switchResult.success) {
            onboardingTestResults.passed++;
            console.log('✅ Role switching working');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Role switching failed');
        }
        
        // Test dashboard re-render on role change
        const renderResult = window.DashboardRenderer?.renderDashboard();
        if (renderResult.success) {
            onboardingTestResults.passed++;
            console.log('✅ Dashboard re-render on role change working');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Dashboard re-render on role change failed');
        }
        
    } catch (error) {
        onboardingTestResults.failed++;
        onboardingTestResults.errors.push(`Role switching test failed: ${error.message}`);
    }
}

/**
 * Test dashboard modes
 */
async function testDashboardModes() {
    console.log('Testing dashboard modes...');
    
    try {
        const modes = ['basics', 'some_metrics', 'all_data'];
        
        for (const mode of modes) {
            // Set preference
            const setResult = window.OnboardingManager?.updateUserPreferences({ data_preference: mode });
            if (setResult.success) {
                // Render dashboard
                const renderResult = window.DashboardRenderer?.renderDashboard();
                if (renderResult.success && renderResult.mode === mode) {
                    onboardingTestResults.passed++;
                    console.log(`✅ Dashboard mode '${mode}' working`);
                } else {
                    onboardingTestResults.failed++;
                    onboardingTestResults.errors.push(`Dashboard mode '${mode}' failed`);
                }
            } else {
                onboardingTestResults.failed++;
                onboardingTestResults.errors.push(`Failed to set dashboard mode '${mode}'`);
            }
        }
        
    } catch (error) {
        onboardingTestResults.failed++;
        onboardingTestResults.errors.push(`Dashboard modes test failed: ${error.message}`);
    }
}

/**
 * Test onboarding completion
 */
async function testOnboardingCompletion() {
    console.log('Testing onboarding completion...');
    
    try {
        // Test complete onboarding
        const completeResult = window.OnboardingManager?.completeOnboarding();
        if (completeResult.success) {
            onboardingTestResults.passed++;
            console.log('✅ Onboarding completion working');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Onboarding completion failed');
        }
        
        // Test skip onboarding
        const skipResult = window.OnboardingManager?.skipOnboarding();
        if (skipResult.success) {
            onboardingTestResults.passed++;
            console.log('✅ Onboarding skip working');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Onboarding skip failed');
        }
        
    } catch (error) {
        onboardingTestResults.failed++;
        onboardingTestResults.errors.push(`Onboarding completion test failed: ${error.message}`);
    }
}

/**
 * Display onboarding test results
 */
function displayOnboardingTestResults() {
    const totalTests = onboardingTestResults.passed + onboardingTestResults.failed;
    const passRate = totalTests > 0 ? (onboardingTestResults.passed / totalTests * 100).toFixed(1) : 0;
    
    console.log('\n📊 Onboarding Test Results:');
    console.log(`✅ Passed: ${onboardingTestResults.passed}`);
    console.log(`❌ Failed: ${onboardingTestResults.failed}`);
    console.log(`📈 Pass Rate: ${passRate}%`);
    
    if (onboardingTestResults.errors.length > 0) {
        console.log('\n🚨 Errors:');
        onboardingTestResults.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }
    
    // Create results summary
    const resultsSummary = {
        totalTests,
        passed: onboardingTestResults.passed,
        failed: onboardingTestResults.failed,
        passRate: parseFloat(passRate),
        errors: onboardingTestResults.errors,
        timestamp: new Date().toISOString()
    };
    
    // Save results to localStorage
    localStorage.setItem('onboarding_system_test_results', JSON.stringify(resultsSummary));
    
    return resultsSummary;
}

/**
 * Test onboarding UI elements
 */
function testOnboardingUI() {
    console.log('Testing onboarding UI elements...');
    
    try {
        // Check if onboarding modal exists
        const onboardingModal = document.getElementById('onboardingModal');
        if (onboardingModal) {
            onboardingTestResults.passed++;
            console.log('✅ Onboarding modal exists');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Onboarding modal not found');
        }
        
        // Check if preferences modal exists
        const preferencesModal = document.getElementById('preferencesModal');
        if (preferencesModal) {
            onboardingTestResults.passed++;
            console.log('✅ Preferences modal exists');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Preferences modal not found');
        }
        
        // Check if onboarding container exists
        const onboardingContainer = document.getElementById('onboardingContainer');
        if (onboardingContainer) {
            onboardingTestResults.passed++;
            console.log('✅ Onboarding container exists');
        } else {
            onboardingTestResults.failed++;
            onboardingTestResults.errors.push('Onboarding container not found');
        }
        
    } catch (error) {
        onboardingTestResults.failed++;
        onboardingTestResults.errors.push(`Onboarding UI test failed: ${error.message}`);
    }
}

/**
 * Run tests when page loads
 */
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            runOnboardingTests();
            testOnboardingUI();
        }, 2000); // Wait for modules to load
    });
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runOnboardingTests,
        testOnboardingModule,
        testDashboardRenderer,
        testOnboardingFlow,
        testPreferenceManagement,
        testRoleSwitching,
        testDashboardModes,
        testOnboardingCompletion,
        testOnboardingUI,
        displayOnboardingTestResults
    };
}
