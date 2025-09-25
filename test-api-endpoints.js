// Test script for Sessions API v1 endpoints
// Run with: node test-api-endpoints.js

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8888/.netlify/functions';
const API_KEY = 'test-api-key-123'; // Replace with actual API key

// Test configuration
const TEST_USER_ID = 1;
const TEST_SESSION_ID = 1;

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null, headers = {}) {
  const url = `${BASE_URL}/${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...headers
    }
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
      success: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      success: false
    };
  }
}

// Test functions
async function testUserProfile() {
  console.log('\n🧪 Testing User Profile API...');
  
  // Test 1: Create user profile
  console.log('1. Creating user profile...');
  const createResult = await apiCall('user-profile', 'POST', {
    age: 25,
    weight: 75.5,
    height: 180,
    sex: 'male',
    goals: ['strength', 'endurance'],
    baseline_lifts: {
      squat: 100,
      bench: 80,
      deadlift: 120
    }
  });
  
  console.log('Create Result:', createResult.status, createResult.success ? '✅' : '❌');
  if (!createResult.success) {
    console.log('Error:', createResult.data);
  }

  // Test 2: Get user profile
  console.log('2. Getting user profile...');
  const getResult = await apiCall('user-profile', 'GET');
  console.log('Get Result:', getResult.status, getResult.success ? '✅' : '❌');
  if (getResult.success) {
    console.log('Profile Data:', getResult.data);
  }

  // Test 3: Update user profile
  console.log('3. Updating user profile...');
  const updateResult = await apiCall('user-profile', 'POST', {
    age: 26,
    weight: 76.0,
    goals: ['strength', 'muscle_gain']
  });
  console.log('Update Result:', updateResult.status, updateResult.success ? '✅' : '❌');

  // Test 4: Validation errors
  console.log('4. Testing validation errors...');
  const invalidResult = await apiCall('user-profile', 'POST', {
    age: 12, // Invalid age
    weight: 500, // Invalid weight
    sex: 'invalid' // Invalid sex
  });
  console.log('Validation Result:', invalidResult.status, invalidResult.status === 400 ? '✅' : '❌');
}

async function testSessions() {
  console.log('\n🧪 Testing Sessions API...');
  
  // Test 1: Create session
  console.log('1. Creating session...');
  const createResult = await apiCall('sessions-create', 'POST', {
    type: 'workout',
    source: 'manual',
    source_id: 'test-session-123',
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
    payload: {
      notes: 'Great workout!',
      rpe: 7,
      location: 'Home Gym'
    }
  });
  
  console.log('Create Result:', createResult.status, createResult.success ? '✅' : '❌');
  if (createResult.success) {
    console.log('Session Data:', createResult.data);
  }

  // Test 2: Create duplicate session (should fail)
  console.log('2. Testing duplicate session...');
  const duplicateResult = await apiCall('sessions-create', 'POST', {
    type: 'workout',
    source: 'manual',
    source_id: 'test-session-123', // Same source_id
    start_at: new Date().toISOString()
  });
  console.log('Duplicate Result:', duplicateResult.status, duplicateResult.status === 409 ? '✅' : '❌');

  // Test 3: List sessions
  console.log('3. Listing sessions...');
  const listResult = await apiCall('sessions-list', 'GET');
  console.log('List Result:', listResult.status, listResult.success ? '✅' : '❌');
  if (listResult.success) {
    console.log('Sessions Count:', listResult.data.data.sessions.length);
  }

  // Test 4: List sessions with filters
  console.log('4. Testing filtered list...');
  const filteredResult = await apiCall('sessions-list?type=workout&limit=5', 'GET');
  console.log('Filtered Result:', filteredResult.status, filteredResult.success ? '✅' : '❌');

  // Test 5: Validation errors
  console.log('5. Testing validation errors...');
  const invalidResult = await apiCall('sessions-create', 'POST', {
    type: 'invalid_type',
    source: 'invalid_source',
    start_at: 'invalid_date'
  });
  console.log('Validation Result:', invalidResult.status, invalidResult.status === 400 ? '✅' : '❌');
}

async function testExercises() {
  console.log('\n🧪 Testing Exercises API...');
  
  // Test 1: Create exercises
  console.log('1. Creating exercises...');
  const createResult = await apiCall('exercises-bulk-create', 'POST', {
    session_id: TEST_SESSION_ID,
    exercises: [
      {
        name: 'Squat',
        sets: 3,
        reps: 10,
        weight: 100,
        rpe: 7,
        notes: 'Good form'
      },
      {
        name: 'Bench Press',
        sets: 3,
        reps: 8,
        weight: 80,
        rpe: 8,
        notes: 'Felt heavy'
      },
      {
        name: 'Deadlift',
        sets: 1,
        reps: 5,
        weight: 120,
        rpe: 9
      }
    ]
  });
  
  console.log('Create Result:', createResult.status, createResult.success ? '✅' : '❌');
  if (createResult.success) {
    console.log('Exercises Created:', createResult.data.count);
  }

  // Test 2: Validation errors
  console.log('2. Testing validation errors...');
  const invalidResult = await apiCall('exercises-bulk-create', 'POST', {
    session_id: 'invalid',
    exercises: [
      {
        name: '', // Invalid name
        sets: 0, // Invalid sets
        reps: 101, // Invalid reps
        weight: 600 // Invalid weight
      }
    ]
  });
  console.log('Validation Result:', invalidResult.status, invalidResult.status === 400 ? '✅' : '❌');

  // Test 3: Non-existent session
  console.log('3. Testing non-existent session...');
  const notFoundResult = await apiCall('exercises-bulk-create', 'POST', {
    session_id: 99999,
    exercises: [
      {
        name: 'Test Exercise',
        sets: 1,
        reps: 1
      }
    ]
  });
  console.log('Not Found Result:', notFoundResult.status, notFoundResult.status === 404 ? '✅' : '❌');
}

async function testRateLimiting() {
  console.log('\n🧪 Testing Rate Limiting...');
  
  // Make multiple requests quickly to test rate limiting
  const promises = [];
  for (let i = 0; i < 105; i++) { // Exceed 100 req/min limit
    promises.push(apiCall('user-profile', 'GET'));
  }
  
  const results = await Promise.all(promises);
  const rateLimited = results.filter(r => r.status === 429);
  
  console.log(`Rate Limited Requests: ${rateLimited.length}/${results.length}`);
  console.log('Rate Limiting:', rateLimited.length > 0 ? '✅' : '❌');
}

async function testAuthentication() {
  console.log('\n🧪 Testing Authentication...');
  
  // Test 1: Missing API key
  console.log('1. Testing missing API key...');
  const noKeyResult = await apiCall('user-profile', 'GET', null, { 'X-API-Key': '' });
  console.log('No Key Result:', noKeyResult.status, noKeyResult.status === 401 ? '✅' : '❌');

  // Test 2: Invalid API key
  console.log('2. Testing invalid API key...');
  const invalidKeyResult = await apiCall('user-profile', 'GET', null, { 'X-API-Key': 'invalid-key' });
  console.log('Invalid Key Result:', invalidKeyResult.status, invalidKeyResult.status === 401 ? '✅' : '❌');
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting API Endpoint Tests...');
  console.log('Base URL:', BASE_URL);
  console.log('API Key:', API_KEY);
  
  try {
    await testAuthentication();
    await testUserProfile();
    await testSessions();
    await testExercises();
    await testRateLimiting();
    
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
  testUserProfile,
  testSessions,
  testExercises,
  testRateLimiting,
  testAuthentication
};
