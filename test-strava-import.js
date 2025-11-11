// Comprehensive Test Suite for Strava Activity Import System
const fetch = require('node-fetch');

const BASE_URL = 'https://your-site.netlify.app/.netlify/functions';
const TEST_USER_ID = 'test-strava-user-123';

// Test configuration
const TEST_CONFIG = {
  baseUrl: BASE_URL,
  userId: TEST_USER_ID,
  timeout: 30000,
};

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null, headers = {}) {
  const url = `${TEST_CONFIG.baseUrl}/${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    timeout: TEST_CONFIG.timeout,
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
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      success: false,
      error: error,
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
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    },
    secret,
    { expiresIn: '24h' }
  );
}

// Mock Strava activity data
const mockStravaActivity = {
  id: 123456789,
  name: 'Morning Run',
  sport_type: 'Run',
  start_date: '2024-01-15T12:00:00Z',
  start_date_local: '2024-01-15T07:00:00Z',
  timezone: '(GMT-05:00) America/New_York',
  moving_time: 1800,
  elapsed_time: 2000,
  distance: 5000,
  average_speed: 2.78,
  total_elevation_gain: 100,
  kilojoules: 400,
  average_heartrate: 150,
  max_heartrate: 170,
  has_heartrate: true,
  average_watts: 200,
  max_watts: 250,
  device_watts: true,
  manual: false,
  private: false,
  trainer: false,
  workout_type: 0,
  device_name: 'Garmin Forerunner 945',
  gear_id: 'g123456',
  achievement_count: 3,
  kudos_count: 5,
  comment_count: 2,
  suffer_score: 6,
  photo_count: 0,
  map: {
    summary_polyline: 'encoded_polyline_string',
  },
  version: 'abc123',
};

// Test functions
async function testStravaImport() {
  console.log('\n🧪 Testing Strava Activity Import...');

  const authToken = generateTestToken(TEST_USER_ID);

  // Test 1: Import without Strava connection
  console.log('1. Testing import without Strava connection...');
  const noConnectionResult = await apiCall(
    'integrations-strava-import',
    'POST',
    {},
    {
      Authorization: `Bearer ${authToken}`,
    }
  );

  console.log(
    'No Connection Result:',
    noConnectionResult.status,
    noConnectionResult.status === 403 ? '✅' : '❌'
  );
  if (noConnectionResult.data.error) {
    console.log('Error Code:', noConnectionResult.data.error.code);
  }

  // Test 2: Invalid after parameter
  console.log('2. Testing invalid after parameter...');
  const invalidAfterResult = await apiCall(
    'integrations-strava-import?after=99999999999',
    'POST',
    {},
    {
      Authorization: `Bearer ${authToken}`,
    }
  );

  console.log(
    'Invalid After Result:',
    invalidAfterResult.status,
    invalidAfterResult.status === 400 ? '✅' : '❌'
  );

  // Test 3: Invalid per_page parameter
  console.log('3. Testing invalid per_page parameter...');
  const invalidPerPageResult = await apiCall(
    'integrations-strava-import?per_page=200',
    'POST',
    {},
    {
      Authorization: `Bearer ${authToken}`,
    }
  );

  console.log(
    'Invalid Per Page Result:',
    invalidPerPageResult.status,
    invalidPerPageResult.status === 400 ? '✅' : '❌'
  );

  // Test 4: Missing authorization
  console.log('4. Testing missing authorization...');
  const noAuthResult = await apiCall('integrations-strava-import', 'POST');

  console.log('No Auth Result:', noAuthResult.status, noAuthResult.status === 401 ? '✅' : '❌');

  return { authToken };
}

async function testStravaStatus(authToken) {
  console.log('\n🧪 Testing Strava Status...');

  // Test 1: Get status without connection
  console.log('1. Testing status without connection...');
  const statusResult = await apiCall('integrations-strava-status', 'GET', null, {
    Authorization: `Bearer ${authToken}`,
  });

  console.log('Status Result:', statusResult.status, statusResult.success ? '✅' : '❌');
  if (statusResult.success) {
    console.log('Connected:', statusResult.data.connected);
    console.log('Import In Progress:', statusResult.data.import_in_progress);
  }

  // Test 2: Missing authorization
  console.log('2. Testing status without authorization...');
  const noAuthResult = await apiCall('integrations-strava-status', 'GET');

  console.log('No Auth Result:', noAuthResult.status, noAuthResult.status === 401 ? '✅' : '❌');

  // Test 3: Invalid token
  console.log('3. Testing status with invalid token...');
  const invalidTokenResult = await apiCall('integrations-strava-status', 'GET', null, {
    Authorization: 'Bearer invalid-token',
  });

  console.log(
    'Invalid Token Result:',
    invalidTokenResult.status,
    invalidTokenResult.status === 401 ? '✅' : '❌'
  );
}

async function testActivityMapping() {
  console.log('\n🧪 Testing Activity Mapping...');

  // Test 1: Complete activity mapping
  console.log('1. Testing complete activity mapping...');
  const { mapStravaActivity } = require('./netlify/functions/utils/strava-import');

  const session = mapStravaActivity(mockStravaActivity, TEST_USER_ID);

  console.log('Session Data:', {
    user_id: session.user_id,
    name: session.name,
    type: session.type,
    source: session.source,
    source_id: session.source_id,
    duration: session.duration,
    elapsed_duration: session.elapsed_duration,
    timezone_offset: session.timezone_offset,
  });

  // Validate required fields
  const requiredFields = ['user_id', 'name', 'type', 'source', 'source_id', 'date', 'utc_date'];
  const missingFields = requiredFields.filter(field => !session[field]);

  console.log('Required Fields Test:', missingFields.length === 0 ? '✅' : '❌');
  if (missingFields.length > 0) {
    console.log('Missing Fields:', missingFields);
  }

  // Test 2: Minimal activity mapping
  console.log('2. Testing minimal activity mapping...');
  const minimalActivity = {
    id: 123,
    sport_type: 'Workout',
    start_date: '2024-01-15T12:00:00Z',
  };

  const minimalSession = mapStravaActivity(minimalActivity, TEST_USER_ID);

  console.log('Minimal Session:', {
    name: minimalSession.name,
    duration: minimalSession.duration,
    payload_summary: minimalSession.payload.summary,
  });

  console.log('Minimal Mapping Test:', minimalSession.name === 'Workout Activity' ? '✅' : '❌');

  // Test 3: Timezone parsing
  console.log('3. Testing timezone parsing...');
  const timezoneActivity = {
    ...mockStravaActivity,
    timezone: '(GMT+02:00) Europe/Berlin',
  };

  const timezoneSession = mapStravaActivity(timezoneActivity, TEST_USER_ID);

  console.log('Timezone Offset:', timezoneSession.timezone_offset);
  console.log('Timezone Test:', timezoneSession.timezone_offset === 120 ? '✅' : '❌'); // +2 hours = 120 minutes
}

async function testValidation() {
  console.log('\n🧪 Testing Validation...');

  const { validateAfterParam } = require('./netlify/functions/utils/strava-import');

  // Test 1: Valid after parameter
  console.log('1. Testing valid after parameter...');
  const validAfter = '1704067200'; // Valid timestamp
  const validResult = validateAfterParam(validAfter);
  console.log('Valid After:', validResult ? '✅' : '❌');

  // Test 2: Invalid after parameter
  console.log('2. Testing invalid after parameter...');
  const invalidAfter = '99999999999'; // Future timestamp
  const invalidResult = validateAfterParam(invalidAfter);
  console.log('Invalid After:', !invalidResult ? '✅' : '❌');

  // Test 3: Null after parameter
  console.log('3. Testing null after parameter...');
  const nullResult = validateAfterParam(null);
  console.log('Null After:', nullResult ? '✅' : '❌');

  // Test 4: Non-numeric after parameter
  console.log('4. Testing non-numeric after parameter...');
  const nonNumericResult = validateAfterParam('abc');
  console.log('Non-numeric After:', !nonNumericResult ? '✅' : '❌');
}

async function testContinueToken() {
  console.log('\n🧪 Testing Continue Token...');

  const {
    generateContinueToken,
    parseContinueToken,
  } = require('./netlify/functions/utils/strava-import');

  // Test 1: Generate and parse continue token
  console.log('1. Testing continue token generation and parsing...');
  const state = {
    page: 2,
    after: '1704067200',
    lastActivityId: 123456789,
    maxActivityTime: '1704153600',
    imported: 50,
    duplicates: 10,
    updated: 5,
    failed: 0,
  };

  const token = generateContinueToken(state);
  console.log('Generated Token:', token ? '✅' : '❌');

  const parsedState = parseContinueToken(token);
  console.log('Parsed State:', JSON.stringify(parsedState, null, 2));

  const stateMatch = JSON.stringify(parsedState) === JSON.stringify(state);
  console.log('State Match:', stateMatch ? '✅' : '❌');

  // Test 2: Invalid continue token
  console.log('2. Testing invalid continue token...');
  try {
    parseContinueToken('invalid-token');
    console.log('Invalid Token Test:', '❌'); // Should throw error
  } catch (error) {
    console.log('Invalid Token Test:', '✅'); // Should throw error
    console.log('Error Message:', error.message);
  }
}

async function testPaceCalculation() {
  console.log('\n🧪 Testing Pace Calculation...');

  const { mapStravaActivity } = require('./netlify/functions/utils/strava-import');

  // Test 1: 5K run in 25 minutes
  console.log('1. Testing 5K run pace calculation...');
  const runActivity = {
    ...mockStravaActivity,
    moving_time: 1500, // 25 minutes
    distance: 5000, // 5K
    sport_type: 'Run',
  };

  const runSession = mapStravaActivity(runActivity, TEST_USER_ID);
  const pacePerKm = runSession.payload.summary.pace_per_km;
  const pacePerMi = runSession.payload.summary.pace_per_mi;

  console.log('Pace per KM:', pacePerKm);
  console.log('Pace per MI:', pacePerMi);
  console.log('Pace Calculation Test:', pacePerKm === '5:00' ? '✅' : '❌');

  // Test 2: No distance
  console.log('2. Testing pace calculation with no distance...');
  const noDistanceActivity = {
    ...mockStravaActivity,
    moving_time: 1800,
    distance: null,
  };

  const noDistanceSession = mapStravaActivity(noDistanceActivity, TEST_USER_ID);
  const noPace = noDistanceSession.payload.summary.pace_per_km;

  console.log('No Distance Pace:', noPace);
  console.log('No Distance Test:', noPace === null ? '✅' : '❌');
}

async function testSportTypeMapping() {
  console.log('\n🧪 Testing Sport Type Mapping...');

  const { mapStravaActivity } = require('./netlify/functions/utils/strava-import');

  const sportTypes = [
    { strava: 'Run', expected: 'run' },
    { strava: 'TrailRun', expected: 'run' },
    { strava: 'Ride', expected: 'cardio' },
    { strava: 'Swim', expected: 'cardio' },
    { strava: 'Workout', expected: 'workout' },
    { strava: 'WeightTraining', expected: 'workout' },
    { strava: 'Yoga', expected: 'flexibility' },
    { strava: 'Unknown', expected: 'cardio' },
  ];

  console.log('Testing sport type mappings...');

  for (const sport of sportTypes) {
    const activity = {
      ...mockStravaActivity,
      sport_type: sport.strava,
    };

    const session = mapStravaActivity(activity, TEST_USER_ID);
    const mappedType = session.type;

    console.log(`${sport.strava} -> ${mappedType}:`, mappedType === sport.expected ? '✅' : '❌');
  }
}

async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling...');

  const { ImportError } = require('./netlify/functions/utils/strava-import');

  // Test 1: ImportError creation
  console.log('1. Testing ImportError creation...');
  const error = new ImportError('TEST_ERROR', 'Test error message', 400, { field: 'test' });

  console.log('Error Code:', error.code);
  console.log('Error Message:', error.message);
  console.log('Error Status Code:', error.statusCode);
  console.log('Error Details:', error.details);

  console.log('ImportError Test:', error.code === 'TEST_ERROR' ? '✅' : '❌');

  // Test 2: Error response
  console.log('2. Testing error response...');
  const headers = { 'Content-Type': 'application/json' };
  const response = error.toResponse(headers);

  console.log('Response Status:', response.statusCode);
  console.log('Response Headers:', response.headers);
  console.log('Response Body:', response.body);

  const bodyData = JSON.parse(response.body);
  console.log('Error Response Test:', bodyData.error.code === 'TEST_ERROR' ? '✅' : '❌');
}

async function testRateLimitHandling() {
  console.log('\n🧪 Testing Rate Limit Handling...');

  const { handleStravaRateLimit } = require('./netlify/functions/utils/strava-import');

  // Test 1: Non-rate-limited response
  console.log('1. Testing non-rate-limited response...');
  const normalResponse = {
    status: 200,
    headers: new Map([['Content-Type', 'application/json']]),
  };

  const normalResult = await handleStravaRateLimit(normalResponse);
  console.log('Normal Response Test:', normalResult === normalResponse ? '✅' : '❌');

  // Test 2: Rate-limited response
  console.log('2. Testing rate-limited response...');
  const rateLimitedResponse = {
    status: 429,
    headers: new Map([
      ['Retry-After', '60'],
      ['X-RateLimit-Usage', '100,500'],
    ]),
  };

  const rateLimitedResult = await handleStravaRateLimit(rateLimitedResponse, 0);
  console.log('Rate Limited Response Test:', rateLimitedResult === null ? '✅' : '❌');
}

async function testURLBuilding() {
  console.log('\n🧪 Testing URL Building...');

  const { buildStravaUrl } = require('./netlify/functions/utils/strava-import');

  // Test 1: Basic URL with page
  console.log('1. Testing basic URL with page...');
  const basicUrl = buildStravaUrl({
    perPage: 30,
    page: 1,
    after: '1704067200',
  });

  console.log('Basic URL:', basicUrl);
  console.log(
    'Basic URL Test:',
    basicUrl.includes('page=1') && basicUrl.includes('after=1704067200') ? '✅' : '❌'
  );

  // Test 2: URL with cursor
  console.log('2. Testing URL with cursor...');
  const cursorUrl = buildStravaUrl({
    perPage: 50,
    lastActivityId: 123456789,
    after: '1704067200',
  });

  console.log('Cursor URL:', cursorUrl);
  console.log(
    'Cursor URL Test:',
    cursorUrl.includes('before=123456789') && !cursorUrl.includes('page=') ? '✅' : '❌'
  );

  // Test 3: URL without after
  console.log('3. Testing URL without after...');
  const noAfterUrl = buildStravaUrl({
    perPage: 20,
    page: 1,
  });

  console.log('No After URL:', noAfterUrl);
  console.log('No After URL Test:', !noAfterUrl.includes('after=') ? '✅' : '❌');
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Strava Activity Import System Tests...');
  console.log('Base URL:', TEST_CONFIG.baseUrl);
  console.log('Test User ID:', TEST_CONFIG.userId);

  try {
    const { authToken } = await testStravaImport();
    await testStravaStatus(authToken);
    await testActivityMapping();
    await testValidation();
    await testContinueToken();
    await testPaceCalculation();
    await testSportTypeMapping();
    await testErrorHandling();
    await testRateLimitHandling();
    await testURLBuilding();

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
  testStravaImport,
  testStravaStatus,
  testActivityMapping,
  testValidation,
  testContinueToken,
  testPaceCalculation,
  testSportTypeMapping,
  testErrorHandling,
  testRateLimitHandling,
  testURLBuilding,
};
