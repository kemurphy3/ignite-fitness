// Comprehensive Test Suite for Exercises API System
const fetch = require('node-fetch');

const BASE_URL = 'https://your-site.netlify.app/.netlify/functions';
const TEST_USER_ID = 'test-exercises-user-123';

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

// Helper functions for common operations
async function createTestSession(token) {
    const response = await apiCall('sessions-create', 'POST', {
        type: 'strength',
        start_at: new Date().toISOString(),
        end_at: new Date(Date.now() + 3600000).toISOString(),
        notes: 'Test session for exercises'
    }, {
        'Authorization': `Bearer ${token}`
    });
    
    if (response.success) {
        return response.data.session_id;
    }
    throw new Error('Failed to create test session');
}

async function createExercise(sessionId, exerciseData, token) {
    const response = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [exerciseData]
    }, {
        'Authorization': `Bearer ${token}`
    });
    
    if (response.success) {
        return response.data.exercises[0];
    }
    throw new Error('Failed to create exercise');
}

async function getExercises(sessionId, params = {}, token) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `sessions-${sessionId}-exercises${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiCall(endpoint, 'GET', null, {
        'Authorization': `Bearer ${token}`
    });
    
    if (response.success) {
        return response.data;
    }
    throw new Error('Failed to get exercises');
}

// Test functions
async function testExerciseCreation() {
    console.log('\n🧪 Testing Exercise Creation...');
    
    const authToken = generateTestToken(TEST_USER_ID);
    const sessionId = await createTestSession(authToken);
    
    // Test 1: Create valid exercises
    console.log('1. Creating valid exercises...');
    const createResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [
            {
                name: 'Barbell Squat',
                sets: 5,
                reps: 5,
                weight_kg: 102.5,
                rpe: 8,
                rest_seconds: 180,
                tempo: '2-0-2-0',
                notes: 'Felt strong today',
                muscle_groups: ['quadriceps', 'glutes'],
                equipment_type: 'barbell',
                order_index: 0
            },
            {
                name: 'Romanian Deadlift',
                sets: 4,
                reps: 8,
                weight_kg: 80,
                rpe: 7,
                rest_seconds: 120,
                muscle_groups: ['hamstrings', 'glutes', 'back'],
                equipment_type: 'barbell',
                order_index: 1
            }
        ]
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Create Result:', createResult.status, createResult.success ? '✅' : '❌');
    if (!createResult.success) {
        console.log('Error:', createResult.data);
    }

    // Test 2: Invalid exercise data
    console.log('2. Testing invalid exercise data...');
    const invalidResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [
            {
                name: 'Invalid Exercise',
                sets: 0, // Invalid: too low
                reps: 101, // Invalid: too high
                weight_kg: 501, // Invalid: too high
                rpe: 11 // Invalid: too high
            }
        ]
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Invalid Result:', invalidResult.status, invalidResult.status === 400 ? '✅' : '❌');

    // Test 3: Too many exercises
    console.log('3. Testing too many exercises...');
    const manyExercises = Array(51).fill().map((_, i) => ({
        name: `Exercise ${i}`,
        sets: 3,
        reps: 10
    }));
    
    const tooManyResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: manyExercises
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Too Many Result:', tooManyResult.status, tooManyResult.status === 400 ? '✅' : '❌');

    // Test 4: Idempotency
    console.log('4. Testing idempotency...');
    const sameExercises = [
        {
            name: 'Bench Press',
            sets: 3,
            reps: 10,
            weight_kg: 80
        }
    ];
    
    const firstResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: sameExercises
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    const secondResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: sameExercises
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Idempotency Test:', 
        firstResult.status === 201 && secondResult.status === 200 ? '✅' : '❌');

    return { authToken, sessionId };
}

async function testExerciseListing(authToken, sessionId) {
    console.log('\n🧪 Testing Exercise Listing...');
    
    // Test 1: List exercises
    console.log('1. Listing exercises...');
    const listResult = await apiCall(`sessions-${sessionId}-exercises`, 'GET', null, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('List Result:', listResult.status, listResult.success ? '✅' : '❌');
    if (listResult.success) {
        console.log('Exercise Count:', listResult.data.exercises.length);
        console.log('Has Pagination:', !!listResult.data.pagination);
    }

    // Test 2: Pagination
    console.log('2. Testing pagination...');
    // Create more exercises for pagination test
    const manyExercises = Array(25).fill().map((_, i) => ({
        name: `Exercise ${i}`,
        sets: 3,
        reps: 10,
        order_index: i + 10 // Start after existing exercises
    }));
    
    await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: manyExercises
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    // Test first page
    const page1Result = await apiCall(`sessions-${sessionId}-exercises?limit=10`, 'GET', null, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Page 1 Result:', page1Result.status, page1Result.success ? '✅' : '❌');
    if (page1Result.success) {
        console.log('Page 1 Count:', page1Result.data.exercises.length);
        console.log('Has More:', page1Result.data.pagination.has_more);
        console.log('Next Cursor:', !!page1Result.data.pagination.next_cursor);
    }

    // Test 3: Invalid cursor
    console.log('3. Testing invalid cursor...');
    const invalidCursorResult = await apiCall(`sessions-${sessionId}-exercises?cursor=invalid`, 'GET', null, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Invalid Cursor Result:', invalidCursorResult.status, invalidCursorResult.status === 400 ? '✅' : '❌');

    // Test 4: Without authentication
    console.log('4. Testing without authentication...');
    const noAuthResult = await apiCall(`sessions-${sessionId}-exercises`, 'GET');
    console.log('No Auth Result:', noAuthResult.status, noAuthResult.status === 401 ? '✅' : '❌');
}

async function testExerciseUpdates(authToken, sessionId) {
    console.log('\n🧪 Testing Exercise Updates...');
    
    // Create an exercise to update
    const exercise = await createExercise(sessionId, {
        name: 'Pull-ups',
        sets: 3,
        reps: 10,
        weight_kg: 0,
        order_index: 0
    }, authToken);
    
    // Test 1: Valid update
    console.log('1. Testing valid update...');
    const updateResult = await apiCall(`sessions-${sessionId}-exercises-${exercise.id}`, 'PUT', {
        sets: 4,
        reps: 12,
        weight_kg: 10,
        notes: 'Added weight'
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Update Result:', updateResult.status, updateResult.success ? '✅' : '❌');
    if (updateResult.success) {
        console.log('Updated Exercise:', updateResult.data.exercise.name);
    }

    // Test 2: Invalid update data
    console.log('2. Testing invalid update data...');
    const invalidUpdateResult = await apiCall(`sessions-${sessionId}-exercises-${exercise.id}`, 'PUT', {
        sets: 0, // Invalid
        reps: 101 // Invalid
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Invalid Update Result:', invalidUpdateResult.status, invalidUpdateResult.status === 400 ? '✅' : '❌');

    // Test 3: Update non-existent exercise
    console.log('3. Testing update non-existent exercise...');
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const notFoundResult = await apiCall(`sessions-${sessionId}-exercises-${fakeId}`, 'PUT', {
        sets: 5
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Not Found Result:', notFoundResult.status, notFoundResult.status === 404 ? '✅' : '❌');

    // Test 4: Update with different user
    console.log('4. Testing update with different user...');
    const otherUserToken = generateTestToken('other-user-123');
    const unauthorizedResult = await apiCall(`sessions-${sessionId}-exercises-${exercise.id}`, 'PUT', {
        sets: 5
    }, {
        'Authorization': `Bearer ${otherUserToken}`
    });
    console.log('Unauthorized Result:', unauthorizedResult.status, unauthorizedResult.status === 403 ? '✅' : '❌');

    return exercise;
}

async function testExerciseDeletion(authToken, sessionId, exerciseId) {
    console.log('\n🧪 Testing Exercise Deletion...');
    
    // Test 1: Valid deletion
    console.log('1. Testing valid deletion...');
    const deleteResult = await apiCall(`sessions-${sessionId}-exercises-${exerciseId}`, 'DELETE', null, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Delete Result:', deleteResult.status, deleteResult.status === 204 ? '✅' : '❌');

    // Test 2: Delete non-existent exercise
    console.log('2. Testing delete non-existent exercise...');
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const notFoundResult = await apiCall(`sessions-${sessionId}-exercises-${fakeId}`, 'DELETE', null, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Not Found Result:', notFoundResult.status, notFoundResult.status === 404 ? '✅' : '❌');

    // Test 3: Delete with different user
    console.log('3. Testing delete with different user...');
    const otherUserToken = generateTestToken('other-user-456');
    const unauthorizedResult = await apiCall(`sessions-${sessionId}-exercises-${exerciseId}`, 'DELETE', null, {
        'Authorization': `Bearer ${otherUserToken}`
    });
    console.log('Unauthorized Result:', unauthorizedResult.status, unauthorizedResult.status === 403 ? '✅' : '❌');
}

async function testRateLimiting(authToken, sessionId) {
    console.log('\n🧪 Testing Rate Limiting...');
    
    // Make multiple requests quickly to test rate limiting
    const promises = [];
    for (let i = 0; i < 65; i++) { // Exceed 60 req/min limit
        promises.push(apiCall(`sessions-${sessionId}-exercises`, 'GET', null, {
            'Authorization': `Bearer ${authToken}`
        }));
    }
    
    const results = await Promise.all(promises);
    const rateLimited = results.filter(r => r.status === 429);
    
    console.log(`Rate Limited Requests: ${rateLimited.length}/${results.length}`);
    console.log('Rate Limiting:', rateLimited.length > 0 ? '✅' : '❌');
}

async function testValidation() {
    console.log('\n🧪 Testing Validation...');
    
    const authToken = generateTestToken(TEST_USER_ID);
    const sessionId = await createTestSession(authToken);
    
    // Test 1: Tempo validation
    console.log('1. Testing tempo validation...');
    const tempoResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [{
            name: 'Test Exercise',
            sets: 3,
            reps: 10,
            tempo: '3-1-2-0' // Valid
        }]
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Valid Tempo:', tempoResult.status === 201 ? '✅' : '❌');
    
    const invalidTempoResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [{
            name: 'Test Exercise',
            sets: 3,
            reps: 10,
            tempo: '3-1-2' // Invalid
        }]
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Invalid Tempo:', invalidTempoResult.status === 400 ? '✅' : '❌');

    // Test 2: Muscle groups validation
    console.log('2. Testing muscle groups validation...');
    const validMuscleResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [{
            name: 'Test Exercise',
            sets: 3,
            reps: 10,
            muscle_groups: ['chest', 'triceps'] // Valid
        }]
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Valid Muscle Groups:', validMuscleResult.status === 201 ? '✅' : '❌');
    
    const invalidMuscleResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [{
            name: 'Test Exercise',
            sets: 3,
            reps: 10,
            muscle_groups: ['invalid_muscle'] // Invalid
        }]
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Invalid Muscle Groups:', invalidMuscleResult.status === 400 ? '✅' : '❌');

    // Test 3: String length validation
    console.log('3. Testing string length validation...');
    const longNameResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [{
            name: 'A'.repeat(101), // Too long
            sets: 3,
            reps: 10
        }]
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Long Name:', longNameResult.status === 400 ? '✅' : '❌');
    
    const longNotesResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [{
            name: 'Test Exercise',
            sets: 3,
            reps: 10,
            notes: 'A'.repeat(501) // Too long
        }]
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    console.log('Long Notes:', longNotesResult.status === 400 ? '✅' : '❌');
}

async function testSupersetGrouping(authToken, sessionId) {
    console.log('\n🧪 Testing Superset Grouping...');
    
    // Test superset creation
    console.log('1. Testing superset creation...');
    const supersetResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [
            {
                name: 'Bench Press',
                sets: 4,
                reps: 8,
                superset_group: 'A',
                order_index: 0,
                muscle_groups: ['chest', 'triceps']
            },
            {
                name: 'Bent Row',
                sets: 4,
                reps: 8,
                superset_group: 'A',
                order_index: 1,
                muscle_groups: ['back', 'biceps']
            }
        ]
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Superset Result:', supersetResult.status, supersetResult.success ? '✅' : '❌');
    if (supersetResult.success) {
        console.log('Superset Count:', supersetResult.data.count);
    }
}

async function testOrderIndexing(authToken, sessionId) {
    console.log('\n🧪 Testing Order Indexing...');
    
    // Create exercises with gaps in order_index
    console.log('1. Testing order index gaps...');
    const gapResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises: [
            {
                name: 'First Exercise',
                sets: 3,
                reps: 10,
                order_index: 0
            },
            {
                name: 'Second Exercise',
                sets: 3,
                reps: 10,
                order_index: 5 // Gap
            },
            {
                name: 'Third Exercise',
                sets: 3,
                reps: 10,
                order_index: 10 // Gap
            }
        ]
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    console.log('Gap Creation Result:', gapResult.status, gapResult.success ? '✅' : '❌');
    
    // Verify reindexing filled gaps
    const listResult = await getExercises(sessionId, {}, authToken);
    if (listResult.exercises.length >= 3) {
        const orderIndexes = listResult.exercises.map(ex => ex.order_index);
        const hasGaps = orderIndexes.some((index, i) => i > 0 && index !== orderIndexes[i-1] + 1);
        console.log('Gaps Filled:', !hasGaps ? '✅' : '❌');
    }
}

async function testPerformance() {
    console.log('\n🧪 Testing Performance...');
    
    const authToken = generateTestToken(TEST_USER_ID);
    const sessionId = await createTestSession(authToken);
    
    // Test bulk create performance
    console.log('1. Testing bulk create performance...');
    const exercises = Array(50).fill().map((_, i) => ({
        name: `Exercise ${i}`,
        sets: 3,
        reps: 10,
        weight_kg: 50 + i,
        order_index: i,
        muscle_groups: ['chest', 'triceps']
    }));
    
    const start = Date.now();
    const bulkResult = await apiCall(`sessions-${sessionId}-exercises`, 'POST', {
        exercises
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    const duration = Date.now() - start;
    
    console.log('Bulk Create Result:', bulkResult.status, bulkResult.success ? '✅' : '❌');
    console.log(`Bulk Create Time: ${duration}ms`);
    console.log('Performance:', duration < 500 ? '✅' : '❌');

    // Test list performance
    console.log('2. Testing list performance...');
    const listStart = Date.now();
    const listResult = await getExercises(sessionId, { limit: 100 }, authToken);
    const listDuration = Date.now() - listStart;
    
    console.log('List Result:', listResult.exercises ? '✅' : '❌');
    console.log(`List Time: ${listDuration}ms`);
    console.log('Performance:', listDuration < 200 ? '✅' : '❌');
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting Exercises API System Tests...');
    console.log('Base URL:', TEST_CONFIG.baseUrl);
    console.log('Test User ID:', TEST_CONFIG.userId);
    
    try {
        const { authToken, sessionId } = await testExerciseCreation();
        await testExerciseListing(authToken, sessionId);
        const exercise = await testExerciseUpdates(authToken, sessionId);
        await testExerciseDeletion(authToken, sessionId, exercise.id);
        await testRateLimiting(authToken, sessionId);
        await testValidation();
        await testSupersetGrouping(authToken, sessionId);
        await testOrderIndexing(authToken, sessionId);
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
    testExerciseCreation,
    testExerciseListing,
    testExerciseUpdates,
    testExerciseDeletion,
    testRateLimiting,
    testValidation,
    testSupersetGrouping,
    testOrderIndexing,
    testPerformance
};
