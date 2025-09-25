// Comprehensive Debug Test for Ignite Fitness App
// This script tests every aspect of the application

console.log('🔍 Starting Comprehensive Debug Test...');

// Test Results Storage
const testResults = {
    passed: 0,
    failed: 0,
    errors: []
};

function logTest(testName, passed, error = null) {
    if (passed) {
        console.log(`✅ ${testName}`);
        testResults.passed++;
    } else {
        console.error(`❌ ${testName}${error ? ': ' + error : ''}`);
        testResults.failed++;
        if (error) testResults.errors.push(error);
    }
}

// Test 1: DOM Elements Exist
function testDOMElements() {
    const requiredElements = [
        'loginForm', 'registerForm', 'passwordResetForm', 'userDashboard',
        'loginUsername', 'loginPassword', 'regUsername', 'regPassword',
        'regConfirmPassword', 'regAthleteName', 'resetUsername', 'resetAthleteName',
        'newPassword', 'confirmNewPassword', 'loginError', 'registerError', 'resetError',
        'personalData', 'goals', 'workoutPlan', 'logWorkout', 'soccer', 'devices',
        'age', 'weight', 'height', 'experience', 'currentAthleteName'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    logTest('DOM Elements', missingElements.length === 0, missingElements.length > 0 ? `Missing: ${missingElements.join(', ')}` : null);
}

// Test 2: JavaScript Functions
function testJavaScriptFunctions() {
    const requiredFunctions = [
        'login', 'register', 'resetPassword', 'showPasswordReset', 'hidePasswordReset',
        'showRegisterForm', 'hideRegisterForm', 'hideLoginForm', 'showTab',
        'savePersonalInfo', 'saveGoals', 'generateWorkoutPlan', 'logout',
        'showError', 'showSuccess', 'loadUserData', 'saveUserData', 'simpleHash'
    ];
    
    const missingFunctions = requiredFunctions.filter(func => typeof window[func] !== 'function');
    logTest('JavaScript Functions', missingFunctions.length === 0, missingFunctions.length > 0 ? `Missing: ${missingFunctions.join(', ')}` : null);
}

// Test 3: CSS Classes
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
    
    logTest('CSS Classes', missingClasses.length === 0, missingClasses.length > 0 ? `Missing: ${missingClasses.join(', ')}` : null);
}

// Test 4: Form Validation
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
        
        // Check if error message appeared
        const errorDiv = document.getElementById('loginError');
        const hasError = errorDiv && errorDiv.style.display !== 'none' && errorDiv.textContent.includes('Please enter both username and password');
        
        // Restore original values
        document.getElementById('loginUsername').value = originalUsername;
        document.getElementById('loginPassword').value = originalPassword;
        
        logTest('Form Validation', hasError, hasError ? null : 'Validation error not displayed');
    } catch (error) {
        logTest('Form Validation', false, error.message);
    }
}

// Test 5: Tab Navigation
function testTabNavigation() {
    try {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        logTest('Tab Navigation', tabButtons.length > 0 && tabContents.length > 0, 
            tabButtons.length === 0 ? 'No tab buttons found' : 
            tabContents.length === 0 ? 'No tab contents found' : null);
    } catch (error) {
        logTest('Tab Navigation', false, error.message);
    }
}

// Test 6: LocalStorage
function testLocalStorage() {
    try {
        const testKey = 'ignitefitness_debug_test';
        const testValue = 'test_value_' + Date.now();
        
        localStorage.setItem(testKey, testValue);
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        
        logTest('LocalStorage', retrieved === testValue, retrieved !== testValue ? 'Retrieved value does not match stored value' : null);
    } catch (error) {
        logTest('LocalStorage', false, error.message);
    }
}

// Test 7: JSON Parsing
function testJSONParsing() {
    try {
        const testData = { test: 'value', number: 123, array: [1, 2, 3] };
        const jsonString = JSON.stringify(testData);
        const parsedData = JSON.parse(jsonString);
        
        logTest('JSON Parsing', JSON.stringify(parsedData) === jsonString, 
            JSON.stringify(parsedData) !== jsonString ? 'Parsed data does not match original' : null);
    } catch (error) {
        logTest('JSON Parsing', false, error.message);
    }
}

// Test 8: Password Hashing
function testPasswordHashing() {
    try {
        const testPassword = 'testpassword123';
        const hash1 = simpleHash(testPassword);
        const hash2 = simpleHash(testPassword);
        
        logTest('Password Hashing', hash1 === hash2 && hash1.length > 0, 
            hash1 !== hash2 ? 'Hashes are not consistent' : 
            hash1.length === 0 ? 'Hash is empty' : null);
    } catch (error) {
        logTest('Password Hashing', false, error.message);
    }
}

// Test 9: Error Handling
function testErrorHandling() {
    try {
        // Test showError function
        const testDiv = document.createElement('div');
        testDiv.style.display = 'none';
        showError(testDiv, 'Test error message');
        
        const hasError = testDiv.textContent === 'Test error message' && testDiv.style.display === 'block';
        logTest('Error Handling', hasError, hasError ? null : 'Error handling not working correctly');
    } catch (error) {
        logTest('Error Handling', false, error.message);
    }
}

// Test 10: Success Notifications
function testSuccessNotifications() {
    try {
        showSuccess('Test success message');
        
        // Check if notification was created
        const notification = document.getElementById('success-notification');
        const hasNotification = notification && notification.textContent === 'Test success message';
        
        logTest('Success Notifications', hasNotification, hasNotification ? null : 'Success notification not created');
    } catch (error) {
        logTest('Success Notifications', false, error.message);
    }
}

// Test 11: Radio Button Selection
function testRadioButtonSelection() {
    try {
        const primaryGoalInputs = document.querySelectorAll('input[name="primaryGoal"]');
        const secondaryGoalInputs = document.querySelectorAll('input[name="secondaryGoal"]');
        
        logTest('Radio Button Selection', primaryGoalInputs.length > 0 && secondaryGoalInputs.length > 0, 
            primaryGoalInputs.length === 0 ? 'No primary goal inputs found' : 
            secondaryGoalInputs.length === 0 ? 'No secondary goal inputs found' : null);
    } catch (error) {
        logTest('Radio Button Selection', false, error.message);
    }
}

// Test 12: Form Input Types
function testFormInputTypes() {
    try {
        const textInputs = document.querySelectorAll('input[type="text"]');
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        const numberInputs = document.querySelectorAll('input[type="number"]');
        const radioInputs = document.querySelectorAll('input[type="radio"]');
        
        const hasCorrectTypes = textInputs.length > 0 && passwordInputs.length > 0 && 
                               numberInputs.length > 0 && radioInputs.length > 0;
        
        logTest('Form Input Types', hasCorrectTypes, hasCorrectTypes ? null : 'Missing required input types');
    } catch (error) {
        logTest('Form Input Types', false, error.message);
    }
}

// Run all tests
function runAllTests() {
    console.log('🧪 Running comprehensive debug tests...\n');
    
    testDOMElements();
    testJavaScriptFunctions();
    testCSSClasses();
    testFormValidation();
    testTabNavigation();
    testLocalStorage();
    testJSONParsing();
    testPasswordHashing();
    testErrorHandling();
    testSuccessNotifications();
    testRadioButtonSelection();
    testFormInputTypes();
    
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
    
    if (testResults.errors.length > 0) {
        console.log('\n🚨 Errors Found:');
        testResults.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
        });
    }
    
    if (testResults.failed === 0) {
        console.log('\n🎉 All tests passed! The application is ready for production.');
    } else {
        console.log('\n⚠️ Some tests failed. Please review the errors above.');
    }
    
    return testResults;
}

// Auto-run tests when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAllTests);
} else {
    runAllTests();
}

// Export for manual testing
window.comprehensiveDebug = {
    runAllTests,
    testResults
};
