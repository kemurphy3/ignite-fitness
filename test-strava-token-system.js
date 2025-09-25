// Comprehensive Test Suite for Strava Token Management System
const fetch = require('node-fetch');

const BASE_URL = 'https://your-site.netlify.app/.netlify/functions';
const TEST_USER_ID = 'test-user-123';

// Test configuration
const TEST_CONFIG = {
  baseUrl: BASE_URL,
  userId: TEST_USER_ID,
  testCode: 'test-auth-code-123',
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

// Test functions
async function testOAuthExchange() {
  console.log('\n🧪 Testing Strava OAuth Exchange...');
  
  // Test 1: Valid OAuth exchange
  console.log('1. Testing valid OAuth exchange...');
  const exchangeResult = await apiCall('strava-oauth-exchange', 'POST', {
    code: TEST_CONFIG.testCode,
    userId: TEST_CONFIG.userId
  });
  
  console.log('Exchange Result:', exchangeResult.status, exchangeResult.success ? '✅' : '❌');
  if (!exchangeResult.success) {
    console.log('Error:', exchangeResult.data);
  }

  // Test 2: Missing parameters
  console.log('2. Testing missing parameters...');
  const missingParamsResult = await apiCall('strava-oauth-exchange', 'POST', {
    code: TEST_CONFIG.testCode
    // Missing userId
  });
  console.log('Missing Params Result:', missingParamsResult.status, missingParamsResult.status === 400 ? '✅' : '❌');

  // Test 3: Invalid method
  console.log('3. Testing invalid method...');
  const invalidMethodResult = await apiCall('strava-oauth-exchange', 'GET');
  console.log('Invalid Method Result:', invalidMethodResult.status, invalidMethodResult.status === 405 ? '✅' : '❌');
}

async function testTokenRefresh() {
  console.log('\n🧪 Testing Token Refresh...');
  
  // Test 1: Refresh token
  console.log('1. Testing token refresh...');
  const refreshResult = await apiCall('strava-refresh-token', 'POST', {
    userId: TEST_CONFIG.userId
  });
  
  console.log('Refresh Result:', refreshResult.status, refreshResult.success ? '✅' : '❌');
  if (!refreshResult.success) {
    console.log('Error:', refreshResult.data);
  }

  // Test 2: Missing user ID
  console.log('2. Testing missing user ID...');
  const missingUserIdResult = await apiCall('strava-refresh-token', 'POST', {});
  console.log('Missing User ID Result:', missingUserIdResult.status, missingUserIdResult.status === 400 ? '✅' : '❌');

  // Test 3: Non-existent user
  console.log('3. Testing non-existent user...');
  const nonExistentResult = await apiCall('strava-refresh-token', 'POST', {
    userId: 'non-existent-user'
  });
  console.log('Non-existent User Result:', nonExistentResult.status, nonExistentResult.status === 404 ? '✅' : '❌');
}

async function testTokenStatus() {
  console.log('\n🧪 Testing Token Status...');
  
  // Test 1: Get token status
  console.log('1. Testing token status...');
  const statusResult = await apiCall(`strava-token-status?userId=${TEST_CONFIG.userId}`, 'GET');
  
  console.log('Status Result:', statusResult.status, statusResult.success ? '✅' : '❌');
  if (statusResult.success) {
    console.log('Status Data:', statusResult.data);
  }

  // Test 2: Missing user ID
  console.log('2. Testing missing user ID...');
  const missingUserIdResult = await apiCall('strava-token-status', 'GET');
  console.log('Missing User ID Result:', missingUserIdResult.status, missingUserIdResult.status === 400 ? '✅' : '❌');

  // Test 3: Non-existent user
  console.log('3. Testing non-existent user...');
  const nonExistentResult = await apiCall('strava-token-status?userId=non-existent-user', 'GET');
  console.log('Non-existent User Result:', nonExistentResult.status, nonExistentResult.status === 404 ? '✅' : '❌');
}

async function testRateLimiting() {
  console.log('\n🧪 Testing Rate Limiting...');
  
  // Test rate limiting by making multiple requests quickly
  const promises = [];
  for (let i = 0; i < 15; i++) { // Exceed some rate limits
    promises.push(apiCall(`strava-token-status?userId=${TEST_CONFIG.userId}`, 'GET'));
  }
  
  const results = await Promise.all(promises);
  const rateLimited = results.filter(r => r.status === 429);
  
  console.log(`Rate Limited Requests: ${rateLimited.length}/${results.length}`);
  console.log('Rate Limiting:', rateLimited.length > 0 ? '✅' : '❌');
}

async function testCircuitBreaker() {
  console.log('\n🧪 Testing Circuit Breaker...');
  
  // Test circuit breaker by making requests that might fail
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(apiCall('strava-oauth-exchange', 'POST', {
      code: 'invalid-code',
      userId: TEST_CONFIG.userId
    }));
  }
  
  const results = await Promise.all(promises);
  const circuitOpen = results.filter(r => r.data.circuit_state === 'OPEN');
  
  console.log(`Circuit Open Responses: ${circuitOpen.length}/${results.length}`);
  console.log('Circuit Breaker:', circuitOpen.length > 0 ? '✅' : '❌');
}

async function testConcurrentRefresh() {
  console.log('\n🧪 Testing Concurrent Refresh Prevention...');
  
  // Test concurrent refresh attempts to ensure only one succeeds
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(apiCall('strava-refresh-token', 'POST', {
      userId: TEST_CONFIG.userId
    }));
  }
  
  const results = await Promise.all(promises);
  const successful = results.filter(r => r.success).length;
  const locked = results.filter(r => r.status === 423).length;
  
  console.log(`Successful: ${successful}, Locked: ${locked}`);
  console.log('Concurrent Prevention:', successful <= 1 && locked >= 4 ? '✅' : '❌');
}

async function testCaching() {
  console.log('\n🧪 Testing Caching...');
  
  // Test 1: First request (cache miss)
  console.log('1. Testing cache miss...');
  const firstResult = await apiCall(`strava-token-status?userId=${TEST_CONFIG.userId}`, 'GET');
  console.log('First Request Cache:', firstResult.headers['x-cache'], firstResult.headers['x-cache'] === 'MISS' ? '✅' : '❌');

  // Test 2: Second request (cache hit)
  console.log('2. Testing cache hit...');
  const secondResult = await apiCall(`strava-token-status?userId=${TEST_CONFIG.userId}`, 'GET');
  console.log('Second Request Cache:', secondResult.headers['x-cache'], secondResult.headers['x-cache'] === 'HIT' ? '✅' : '❌');
}

async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling...');
  
  // Test 1: Invalid JSON
  console.log('1. Testing invalid JSON...');
  const invalidJsonResult = await apiCall('strava-oauth-exchange', 'POST', 'invalid-json');
  console.log('Invalid JSON Result:', invalidJsonResult.status, invalidJsonResult.status >= 400 ? '✅' : '❌');

  // Test 2: Network timeout simulation
  console.log('2. Testing timeout handling...');
  const timeoutResult = await apiCall('strava-token-status', 'GET', null, {
    'X-Timeout': '1' // Simulate timeout
  });
  console.log('Timeout Result:', timeoutResult.status, timeoutResult.status >= 400 ? '✅' : '❌');
}

async function testSecurityHeaders() {
  console.log('\n🧪 Testing Security Headers...');
  
  const result = await apiCall(`strava-token-status?userId=${TEST_CONFIG.userId}`, 'GET');
  
  const securityHeaders = [
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection',
    'strict-transport-security'
  ];
  
  const presentHeaders = securityHeaders.filter(header => 
    result.headers[header] || result.headers[header.toLowerCase()]
  );
  
  console.log(`Security Headers Present: ${presentHeaders.length}/${securityHeaders.length}`);
  console.log('Security Headers:', presentHeaders.length >= 2 ? '✅' : '❌');
}

// Performance test
async function testPerformance() {
  console.log('\n🧪 Testing Performance...');
  
  const startTime = Date.now();
  const promises = [];
  
  for (let i = 0; i < 20; i++) {
    promises.push(apiCall(`strava-token-status?userId=${TEST_CONFIG.userId}`, 'GET'));
  }
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  const duration = endTime - startTime;
  const avgResponseTime = duration / results.length;
  
  console.log(`Total Duration: ${duration}ms`);
  console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`Successful Requests: ${results.filter(r => r.success).length}/${results.length}`);
  console.log('Performance:', avgResponseTime < 1000 ? '✅' : '❌');
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Strava Token Management System Tests...');
  console.log('Base URL:', TEST_CONFIG.baseUrl);
  console.log('Test User ID:', TEST_CONFIG.userId);
  
  try {
    await testOAuthExchange();
    await testTokenRefresh();
    await testTokenStatus();
    await testRateLimiting();
    await testCircuitBreaker();
    await testConcurrentRefresh();
    await testCaching();
    await testErrorHandling();
    await testSecurityHeaders();
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
  testOAuthExchange,
  testTokenRefresh,
  testTokenStatus,
  testRateLimiting,
  testCircuitBreaker,
  testConcurrentRefresh,
  testCaching,
  testErrorHandling,
  testSecurityHeaders,
  testPerformance
};
