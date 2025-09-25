// Comprehensive Test Suite for User Profiles System
const fetch = require('node-fetch');

const BASE_URL = 'https://your-site.netlify.app/.netlify/functions';
const TEST_USER_ID = 'test-user-profiles-123';

// Test configuration
const TEST_CONFIG = {
    baseUrl: BASE_URL,
    userId: TEST_USER_ID,
    timeout: 30000
};

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null, headers = {}) {
    const url = `${TEST_CONFIG.baseUrl}/${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        timeout: TEST_CONFIG.timeout
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        return {
            status: response.status,
            data: data,
            success: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        };
    } catch (error) {
        return {
            status: 0,
            data: { error: error.message },
            success: false,
            error: error
        };
    }
}

// Generate test JWT token
function generateTestToken(userId) {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'test-secret-key-for-development-only';
    
    return jwt.sign(
        { 
            sub: userId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        },
        secret,
        { expiresIn: '24h' }
    );
}

// Test functions
async function testProfileCreation() {
    console.log('\n🧪 Testing Profile Creation...');
    
    const authToken = generateTestToken(TEST_USER_ID);
    
    // Test 1: Create valid profile
    console.log('1. Creating valid profile...');
    const createResult = await apiCall('users-profile-post', 'POST', {
        age: 28,
        sex: 'male',
        height: { value: 6, unit: 'feet', inches: 0 },
        weight: { value: 180, unit: 'lbs' },
        goals: ['gain_muscle', 'increase_strength'],
        bench_press_max: 135,
        squat_max: 185,
        deadlift_max: 225
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Create Result:', createResult.status, createResult.success ? '✅' : '❌');
    if (!createResult.success) {
        console.log('Error:', createResult.data);
    }

    // Test 2: Create profile with metric units
    console.log('2. Creating profile with metric units...');
    const metricResult = await apiCall('users-profile-post', 'POST', {
        age: 25,
        sex: 'female',
        height: 165, // cm
        weight: 60, // kg
        goals: ['lose_weight', 'improve_endurance'],
        preferred_units: 'metric'
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Metric Result:', metricResult.status, metricResult.status === 409 ? '✅' : '❌'); // Should be 409 (already exists)

    // Test 3: Invalid data
    console.log('3. Testing invalid data...');
    const invalidResult = await apiCall('users-profile-post', 'POST', {
        age: 12, // Too young
        sex: 'invalid', // Invalid sex
        height: { value: 2, unit: 'feet' }, // Too short
        weight: { value: 10, unit: 'lbs' } // Too light
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Invalid Result:', invalidResult.status, invalidResult.status === 400 ? '✅' : '❌');

    // Test 4: Missing required fields
    console.log('4. Testing missing required fields...');
    const missingResult = await apiCall('users-profile-post', 'POST', {
        height: 180,
        weight: 80
        // Missing age and sex
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Missing Fields Result:', missingResult.status, missingResult.status === 400 ? '✅' : '❌');

    return authToken;
}

async function testProfileRetrieval(authToken) {
    console.log('\n🧪 Testing Profile Retrieval...');
    
    // Test 1: Get profile
    console.log('1. Getting profile...');
    const getResult = await apiCall('users-profile-get', 'GET', null, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Get Result:', getResult.status, getResult.success ? '✅' : '❌');
    if (getResult.success) {
        console.log('Profile Data Keys:', Object.keys(getResult.data));
        console.log('Completeness Score:', getResult.data.calculated_metrics?.completeness_score);
    }

    // Test 2: Get profile without auth
    console.log('2. Testing without authentication...');
    const noAuthResult = await apiCall('users-profile-get', 'GET');
    console.log('No Auth Result:', noAuthResult.status, noAuthResult.status === 401 ? '✅' : '❌');

    // Test 3: Get profile with invalid token
    console.log('3. Testing with invalid token...');
    const invalidTokenResult = await apiCall('users-profile-get', 'GET', null, {
        'Authorization': 'Bearer invalid-token'
    });
    console.log('Invalid Token Result:', invalidTokenResult.status, invalidTokenResult.status === 401 ? '✅' : '❌');
}

async function testProfileUpdates(authToken) {
    console.log('\n🧪 Testing Profile Updates...');
    
    // Test 1: Partial update
    console.log('1. Testing partial update...');
    const patchResult = await apiCall('users-profile-patch', 'PATCH', {
        weight: { value: 185, unit: 'lbs' },
        bench_press_max: 145
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Patch Result:', patchResult.status, patchResult.success ? '✅' : '❌');
    if (patchResult.success) {
        console.log('Updated Fields:', patchResult.data.updated_fields);
    }

    // Test 2: Update with version conflict
    console.log('2. Testing version conflict...');
    const versionConflictResult = await apiCall('users-profile-patch', 'PATCH', {
        version: 1, // Old version
        age: 29
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Version Conflict Result:', versionConflictResult.status, versionConflictResult.status === 409 ? '✅' : '❌');

    // Test 3: Update non-existent field
    console.log('3. Testing invalid field update...');
    const invalidFieldResult = await apiCall('users-profile-patch', 'PATCH', {
        invalid_field: 'test'
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Invalid Field Result:', invalidFieldResult.status, invalidFieldResult.status === 400 ? '✅' : '❌');

    // Test 4: Empty update
    console.log('4. Testing empty update...');
    const emptyUpdateResult = await apiCall('users-profile-patch', 'PATCH', {}, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Empty Update Result:', emptyUpdateResult.status, emptyUpdateResult.status === 400 ? '✅' : '❌');
}

async function testProfileValidation(authToken) {
    console.log('\n🧪 Testing Profile Validation...');
    
    // Test 1: Valid fields
    console.log('1. Testing valid fields...');
    const validResult = await apiCall('users-profile-validate', 'POST', {
        fields: {
            age: 30,
            height: { value: 5, unit: 'feet', inches: 10 },
            weight: { value: 150, unit: 'lbs' },
            goals: ['gain_muscle']
        }
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Valid Fields Result:', validResult.status, validResult.success ? '✅' : '❌');
    if (validResult.success) {
        console.log('Validation Valid:', validResult.data.valid);
    }

    // Test 2: Invalid fields
    console.log('2. Testing invalid fields...');
    const invalidResult = await apiCall('users-profile-validate', 'POST', {
        fields: {
            age: 200, // Too old
            height: { value: 1, unit: 'feet' }, // Too short
            weight: { value: 5, unit: 'lbs' }, // Too light
            goals: ['invalid_goal'] // Invalid goal
        }
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Invalid Fields Result:', invalidResult.status, invalidResult.success ? '✅' : '❌');
    if (validResult.success) {
        console.log('Validation Valid:', invalidResult.data.valid);
        console.log('Field Errors:', Object.keys(invalidResult.data.fields).filter(f => !invalidResult.data.fields[f].valid));
    }

    // Test 3: Conflicting goals
    console.log('3. Testing conflicting goals...');
    const conflictResult = await apiCall('users-profile-validate', 'POST', {
        fields: {
            goals: ['lose_weight', 'bulk_muscle'] // Conflicting goals
        }
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Conflicting Goals Result:', conflictResult.status, conflictResult.success ? '✅' : '❌');
    if (conflictResult.success) {
        console.log('Warnings:', conflictResult.data.warnings?.length || 0);
    }
}

async function testRateLimiting(authToken) {
    console.log('\n🧪 Testing Rate Limiting...');
    
    // Make multiple requests quickly to test rate limiting
    const promises = [];
    for (let i = 0; i < 12; i++) { // Exceed 10 req/hour limit
        promises.push(apiCall('users-profile-patch', 'PATCH', {
            age: 28 + i
        }, {
            'Authorization': `Bearer ${authToken}`
        }));
    }
    
    const results = await Promise.all(promises);
    const rateLimited = results.filter(r => r.status === 429);
    
    console.log(`Rate Limited Requests: ${rateLimited.length}/${results.length}`);
    console.log('Rate Limiting:', rateLimited.length > 0 ? '✅' : '❌');
}

async function testSecurity() {
    console.log('\n🧪 Testing Security...');
    
    const authToken = generateTestToken(TEST_USER_ID);
    
    // Test 1: XSS attempt
    console.log('1. Testing XSS protection...');
    const xssResult = await apiCall('users-profile-patch', 'PATCH', {
        age: 25,
        sex: '<script>alert("xss")</script>'
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('XSS Result:', xssResult.status, xssResult.status === 400 ? '✅' : '❌');

    // Test 2: SQL injection attempt
    console.log('2. Testing SQL injection protection...');
    const sqlResult = await apiCall('users-profile-patch', 'PATCH', {
        age: 25,
        sex: "'; DROP TABLE users; --"
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('SQL Injection Result:', sqlResult.status, sqlResult.status === 400 ? '✅' : '❌');

    // Test 3: Large payload
    console.log('3. Testing large payload protection...');
    const largeGoals = Array(1000).fill('gain_muscle');
    const largeResult = await apiCall('users-profile-patch', 'PATCH', {
        goals: largeGoals
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Large Payload Result:', largeResult.status, largeResult.status === 400 ? '✅' : '❌');
}

async function testUnitConversion() {
    console.log('\n🧪 Testing Unit Conversion...');
    
    const authToken = generateTestToken('test-units-user');
    
    // Test 1: Imperial to metric conversion
    console.log('1. Testing imperial to metric conversion...');
    const imperialResult = await apiCall('users-profile-post', 'POST', {
        age: 25,
        sex: 'male',
        height: { value: 6, unit: 'feet', inches: 2 },
        weight: { value: 200, unit: 'lbs' },
        preferred_units: 'imperial'
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Imperial Result:', imperialResult.status, imperialResult.success ? '✅' : '❌');

    // Test 2: Get profile in imperial units
    console.log('2. Testing profile retrieval in imperial units...');
    const getImperialResult = await apiCall('users-profile-get', 'GET', null, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Get Imperial Result:', getImperialResult.status, getImperialResult.success ? '✅' : '❌');
    if (getImperialResult.success) {
        console.log('Height Format:', typeof getImperialResult.data.height);
        console.log('Weight Format:', typeof getImperialResult.data.weight);
    }
}

async function testConcurrentUpdates(authToken) {
    console.log('\n🧪 Testing Concurrent Updates...');
    
    // Test concurrent updates to ensure optimistic locking works
    const promises = [];
    for (let i = 0; i < 5; i++) {
        promises.push(apiCall('users-profile-patch', 'PATCH', {
            age: 28 + i
        }, {
            'Authorization': `Bearer ${authToken}`
        }));
    }
    
    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    const conflicts = results.filter(r => r.status === 409).length;
    
    console.log(`Successful Updates: ${successful}`);
    console.log(`Version Conflicts: ${conflicts}`);
    console.log('Concurrent Updates:', successful <= 1 && conflicts >= 4 ? '✅' : '❌');
}

async function testPerformance() {
    console.log('\n🧪 Testing Performance...');
    
    const authToken = generateTestToken(TEST_USER_ID);
    
    // Test GET performance
    console.log('1. Testing GET performance...');
    const getTimings = [];
    for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await apiCall('users-profile-get', 'GET', null, {
            'Authorization': `Bearer ${authToken}`
        });
        getTimings.push(Date.now() - start);
    }
    
    const avgGetTime = getTimings.reduce((a, b) => a + b, 0) / getTimings.length;
    console.log(`Average GET Time: ${avgGetTime.toFixed(2)}ms`);
    console.log('GET Performance:', avgGetTime < 200 ? '✅' : '❌');

    // Test PATCH performance
    console.log('2. Testing PATCH performance...');
    const patchTimings = [];
    for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await apiCall('users-profile-patch', 'PATCH', {
            age: 28 + i
        }, {
            'Authorization': `Bearer ${authToken}`
        });
        patchTimings.push(Date.now() - start);
    }
    
    const avgPatchTime = patchTimings.reduce((a, b) => a + b, 0) / patchTimings.length;
    console.log(`Average PATCH Time: ${avgPatchTime.toFixed(2)}ms`);
    console.log('PATCH Performance:', avgPatchTime < 500 ? '✅' : '❌');
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting User Profiles System Tests...');
    console.log('Base URL:', TEST_CONFIG.baseUrl);
    console.log('Test User ID:', TEST_CONFIG.userId);
    
    try {
        const authToken = await testProfileCreation();
        await testProfileRetrieval(authToken);
        await testProfileUpdates(authToken);
        await testProfileValidation(authToken);
        await testRateLimiting(authToken);
        await testSecurity();
        await testUnitConversion();
        await testConcurrentUpdates(authToken);
        await testPerformance();
        
        console.log('\n✅ All tests completed!');
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    runAllTests,
    testProfileCreation,
    testProfileRetrieval,
    testProfileUpdates,
    testProfileValidation,
    testRateLimiting,
    testSecurity,
    testUnitConversion,
    testConcurrentUpdates,
    testPerformance
};
