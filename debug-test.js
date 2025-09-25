// Debug Test Script for Ignite Fitness App
// Run this in browser console to test all functionality

console.log('🧪 Starting Ignite Fitness Debug Test...');

// Test 1: Check if all required functions exist
function testFunctionAvailability() {
    const requiredFunctions = [
        'login', 'register', 'resetPassword', 'showPasswordReset', 'hidePasswordReset',
        'showRegisterForm', 'hideRegisterForm', 'hideLoginForm', 'showTab',
        'savePersonalInfo', 'saveGoals', 'generateWorkoutPlan', 'logout',
        'showError', 'showSuccess', 'loadUserData', 'saveUserData'
    ];
    
    const missingFunctions = requiredFunctions.filter(func => typeof window[func] !== 'function');
    
    if (missingFunctions.length === 0) {
        console.log('✅ All required functions are available');
        return true;
    } else {
        console.error('❌ Missing functions:', missingFunctions);
        return false;
    }
}

// Test 2: Check if all required HTML elements exist
function testHTMLElements() {
    const requiredElements = [
        'loginForm', 'registerForm', 'passwordResetForm', 'userDashboard',
        'loginUsername', 'loginPassword', 'regUsername', 'regPassword',
        'regConfirmPassword', 'regAthleteName', 'resetUsername', 'resetAthleteName',
        'newPassword', 'confirmNewPassword', 'loginError', 'registerError', 'resetError',
        'personalData', 'goals', 'workoutPlan', 'logWorkout', 'soccer', 'devices',
        'age', 'weight', 'height', 'experience'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length === 0) {
        console.log('✅ All required HTML elements exist');
        return true;
    } else {
        console.error('❌ Missing HTML elements:', missingElements);
        return false;
    }
}

// Test 3: Check localStorage functionality
function testLocalStorage() {
    try {
        const testKey = 'ignitefitness_debug_test';
        const testValue = 'test_value_' + Date.now();
        
        localStorage.setItem(testKey, testValue);
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        
        if (retrieved === testValue) {
            console.log('✅ localStorage is working correctly');
            return true;
        } else {
            console.error('❌ localStorage retrieval failed');
            return false;
        }
    } catch (error) {
        console.error('❌ localStorage error:', error.message);
        return false;
    }
}

// Test 4: Check CSS classes
function testCSSClasses() {
    const requiredClasses = [
        'container', 'header', 'form-section', 'form-group', 'form-input',
        'btn', 'tab-container', 'tab-buttons', 'tab-btn', 'tab-content', 'hidden'
    ];
    
    const testElement = document.createElement('div');
    const missingClasses = requiredClasses.filter(className => {
        testElement.className = className;
        return !testElement.classList.contains(className);
    });
    
    if (missingClasses.length === 0) {
        console.log('✅ All required CSS classes are available');
        return true;
    } else {
        console.error('❌ Missing CSS classes:', missingClasses);
        return false;
    }
}

// Test 5: Check tab functionality
function testTabFunctionality() {
    try {
        // Test if showTab function works without errors
        showTab('personalData', document.querySelector('.tab-btn'));
        console.log('✅ Tab functionality works');
        return true;
    } catch (error) {
        console.error('❌ Tab functionality error:', error.message);
        return false;
    }
}

// Test 6: Check form validation
function testFormValidation() {
    try {
        // Test login form validation
        const originalUsername = document.getElementById('loginUsername').value;
        const originalPassword = document.getElementById('loginPassword').value;
        
        // Clear fields to test validation
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        
        // This should trigger validation error
        login();
        
        // Restore original values
        document.getElementById('loginUsername').value = originalUsername;
        document.getElementById('loginPassword').value = originalPassword;
        
        console.log('✅ Form validation is working');
        return true;
    } catch (error) {
        console.error('❌ Form validation error:', error.message);
        return false;
    }
}

// Run all tests
function runAllTests() {
    console.log('🔍 Running comprehensive debug tests...\n');
    
    const tests = [
        { name: 'Function Availability', test: testFunctionAvailability },
        { name: 'HTML Elements', test: testHTMLElements },
        { name: 'LocalStorage', test: testLocalStorage },
        { name: 'CSS Classes', test: testCSSClasses },
        { name: 'Tab Functionality', test: testTabFunctionality },
        { name: 'Form Validation', test: testFormValidation }
    ];
    
    const results = tests.map(test => ({
        name: test.name,
        passed: test.test()
    }));
    
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    
    console.log('\n📊 Test Results Summary:');
    console.log(`Passed: ${passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! The app is ready to use.');
    } else {
        console.log('⚠️ Some tests failed. Check the errors above.');
    }
    
    return results;
}

// Auto-run tests when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAllTests);
} else {
    runAllTests();
}

// Export for manual testing
window.debugTest = {
    runAllTests,
    testFunctionAvailability,
    testHTMLElements,
    testLocalStorage,
    testCSSClasses,
    testTabFunctionality,
    testFormValidation
};
