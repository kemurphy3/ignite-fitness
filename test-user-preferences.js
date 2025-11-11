// Comprehensive Test Suite for User Preferences System
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

const BASE_URL = 'https://your-site.netlify.app/.netlify/functions';
const TEST_USER_ID = 'test-user-123';
const TEST_EXTERNAL_ID = 'test-external-456';

// Test configuration
const TEST_CONFIG = {
  baseUrl: BASE_URL,
  userId: TEST_USER_ID,
  externalId: TEST_EXTERNAL_ID,
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
function generateTestToken(externalId = TEST_EXTERNAL_ID) {
  const secret = process.env.JWT_SECRET || 'test-secret-key-for-development-only';

  return jwt.sign(
    {
      sub: externalId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    },
    secret,
    { expiresIn: '24h' }
  );
}

// Test functions
async function testGetPreferences() {
  console.log('\n🧪 Testing GET Preferences...');

  const token = generateTestToken();

  // Test 1: Get preferences with valid token
  console.log('1. Testing get preferences with valid token...');
  const getResult = await apiCall('users-preferences-get', 'GET', null, {
    Authorization: `Bearer ${token}`,
  });

  console.log('Get Result:', getResult.status, getResult.success ? '✅' : '❌');
  if (getResult.success) {
    const data = getResult.data;
    console.log('Preferences:', {
      timezone: data.timezone,
      units: data.units,
      sleep_goal_hours: data.sleep_goal_hours,
      workout_goal_per_week: data.workout_goal_per_week,
      notifications_enabled: data.notifications_enabled,
      theme: data.theme,
    });

    // Check default values
    const hasDefaults =
      data.units === 'imperial' &&
      data.sleep_goal_hours === 8.0 &&
      data.workout_goal_per_week === 3 &&
      data.notifications_enabled === true &&
      data.theme === 'system';
    console.log('Default Values Test:', hasDefaults ? '✅' : '❌');
  }

  // Test 2: Missing authorization
  console.log('2. Testing get preferences without authorization...');
  const noAuthResult = await apiCall('users-preferences-get', 'GET');

  console.log('No Auth Result:', noAuthResult.status, noAuthResult.status === 401 ? '✅' : '❌');

  // Test 3: Invalid token
  console.log('3. Testing get preferences with invalid token...');
  const invalidTokenResult = await apiCall('users-preferences-get', 'GET', null, {
    Authorization: 'Bearer invalid-token',
  });

  console.log(
    'Invalid Token Result:',
    invalidTokenResult.status,
    invalidTokenResult.status === 401 ? '✅' : '❌'
  );

  // Test 4: Valid token for non-existent user
  console.log('4. Testing get preferences for non-existent user...');
  const nonExistentToken = generateTestToken('non-existent-user');
  const nonExistentResult = await apiCall('users-preferences-get', 'GET', null, {
    Authorization: `Bearer ${nonExistentToken}`,
  });

  console.log(
    'Non-existent User Result:',
    nonExistentResult.status,
    nonExistentResult.status === 403 ? '✅' : '❌'
  );

  return { token };
}

async function testPatchPreferences(token) {
  console.log('\n🧪 Testing PATCH Preferences...');

  // Test 1: Update all preferences
  console.log('1. Testing update all preferences...');
  const updateAllResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      timezone: 'America/New_York',
      units: 'metric',
      sleep_goal_hours: 7.5,
      workout_goal_per_week: 4,
      notifications_enabled: false,
      theme: 'dark',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Update All Result:',
    updateAllResult.status,
    updateAllResult.status === 204 ? '✅' : '❌'
  );

  // Test 2: Update partial preferences
  console.log('2. Testing update partial preferences...');
  const updatePartialResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      timezone: 'Europe/London',
      theme: 'light',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Update Partial Result:',
    updatePartialResult.status,
    updatePartialResult.status === 204 ? '✅' : '❌'
  );

  // Test 3: Empty body (no-op)
  console.log('3. Testing empty body (no-op)...');
  const emptyBodyResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {},
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Empty Body Result:',
    emptyBodyResult.status,
    emptyBodyResult.status === 204 ? '✅' : '❌'
  );

  // Test 4: Invalid JSON
  console.log('4. Testing invalid JSON...');
  const invalidJsonResult = await apiCall('users-preferences-patch', 'PATCH', 'invalid-json', {
    Authorization: `Bearer ${token}`,
  });

  console.log(
    'Invalid JSON Result:',
    invalidJsonResult.status,
    invalidJsonResult.status === 400 ? '✅' : '❌'
  );

  // Test 5: Large body
  console.log('5. Testing large body...');
  const largeBody = JSON.stringify({
    timezone: 'A'.repeat(10000), // Exceeds 10KB limit
  });
  const largeBodyResult = await apiCall('users-preferences-patch', 'PATCH', largeBody, {
    Authorization: `Bearer ${token}`,
  });

  console.log(
    'Large Body Result:',
    largeBodyResult.status,
    largeBodyResult.status === 400 ? '✅' : '❌'
  );
}

async function testValidation() {
  console.log('\n🧪 Testing Validation...');

  const token = generateTestToken();

  // Test 1: Invalid timezone
  console.log('1. Testing invalid timezone...');
  const invalidTzResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      timezone: 'Invalid/Zone',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Invalid Timezone Result:',
    invalidTzResult.status,
    invalidTzResult.status === 400 ? '✅' : '❌'
  );
  if (invalidTzResult.data.code) {
    console.log('Error Code:', invalidTzResult.data.code);
  }

  // Test 2: Invalid units
  console.log('2. Testing invalid units...');
  const invalidUnitsResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      units: 'kilometers',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Invalid Units Result:',
    invalidUnitsResult.status,
    invalidUnitsResult.status === 400 ? '✅' : '❌'
  );

  // Test 3: Invalid sleep goal
  console.log('3. Testing invalid sleep goal...');
  const invalidSleepResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      sleep_goal_hours: 25,
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Invalid Sleep Goal Result:',
    invalidSleepResult.status,
    invalidSleepResult.status === 400 ? '✅' : '❌'
  );

  // Test 4: Invalid workout goal
  console.log('4. Testing invalid workout goal...');
  const invalidWorkoutResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      workout_goal_per_week: -1,
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Invalid Workout Goal Result:',
    invalidWorkoutResult.status,
    invalidWorkoutResult.status === 400 ? '✅' : '❌'
  );

  // Test 5: Invalid theme
  console.log('5. Testing invalid theme...');
  const invalidThemeResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      theme: 'purple',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Invalid Theme Result:',
    invalidThemeResult.status,
    invalidThemeResult.status === 400 ? '✅' : '❌'
  );

  // Test 6: Valid timezone
  console.log('6. Testing valid timezone...');
  const validTzResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      timezone: 'America/Denver',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Valid Timezone Result:',
    validTzResult.status,
    validTzResult.status === 204 ? '✅' : '❌'
  );
}

async function testCoercion() {
  console.log('\n🧪 Testing Coercion...');

  const token = generateTestToken();

  // Test 1: String to boolean coercion
  console.log('1. Testing string to boolean coercion...');
  const stringBoolResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      notifications_enabled: 'true',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'String Bool Result:',
    stringBoolResult.status,
    stringBoolResult.status === 204 ? '✅' : '❌'
  );

  // Test 2: Case insensitive units
  console.log('2. Testing case insensitive units...');
  const caseInsensitiveResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      units: 'METRIC',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Case Insensitive Result:',
    caseInsensitiveResult.status,
    caseInsensitiveResult.status === 204 ? '✅' : '❌'
  );

  // Test 3: Decimal sleep goal rounding
  console.log('3. Testing decimal sleep goal rounding...');
  const decimalSleepResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      sleep_goal_hours: 7.55,
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Decimal Sleep Result:',
    decimalSleepResult.status,
    decimalSleepResult.status === 204 ? '✅' : '❌'
  );

  // Test 4: Case insensitive theme
  console.log('4. Testing case insensitive theme...');
  const caseInsensitiveThemeResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      theme: 'DARK',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Case Insensitive Theme Result:',
    caseInsensitiveThemeResult.status,
    caseInsensitiveThemeResult.status === 204 ? '✅' : '❌'
  );
}

async function testUnknownFields() {
  console.log('\n🧪 Testing Unknown Fields...');

  const token = generateTestToken();

  // Test 1: Unknown fields are ignored
  console.log('1. Testing unknown fields are ignored...');
  const unknownFieldsResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      timezone: 'America/Chicago',
      unknown_field: 'should be ignored',
      another_unknown: 123,
      units: 'imperial',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log(
    'Unknown Fields Result:',
    unknownFieldsResult.status,
    unknownFieldsResult.status === 204 ? '✅' : '❌'
  );
}

async function testConcurrentUpdates() {
  console.log('\n🧪 Testing Concurrent Updates...');

  const token = generateTestToken();

  // Test 1: Concurrent updates
  console.log('1. Testing concurrent updates...');
  const update1 = apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      timezone: 'America/New_York',
      theme: 'dark',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  const update2 = apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      units: 'metric',
      sleep_goal_hours: 8.5,
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  const [result1, result2] = await Promise.all([update1, update2]);

  console.log('Concurrent Update 1:', result1.status, result1.status === 204 ? '✅' : '❌');
  console.log('Concurrent Update 2:', result2.status, result2.status === 204 ? '✅' : '❌');
}

async function testCORS() {
  console.log('\n🧪 Testing CORS...');

  const token = generateTestToken();

  // Test 1: OPTIONS request
  console.log('1. Testing OPTIONS request...');
  const optionsResult = await apiCall('users-preferences-get', 'OPTIONS');

  console.log('OPTIONS Result:', optionsResult.status, optionsResult.status === 204 ? '✅' : '❌');

  // Test 2: CORS headers
  console.log('2. Testing CORS headers...');
  const getResult = await apiCall('users-preferences-get', 'GET', null, {
    Authorization: `Bearer ${token}`,
  });

  const corsHeaders = getResult.headers;
  const hasCORS =
    corsHeaders['access-control-allow-origin'] === '*' &&
    corsHeaders['access-control-allow-headers'] &&
    corsHeaders['access-control-allow-methods'];

  console.log('CORS Headers Test:', hasCORS ? '✅' : '❌');
}

async function testPersistence() {
  console.log('\n🧪 Testing Persistence...');

  const token = generateTestToken();

  // Test 1: Update preferences
  console.log('1. Testing update preferences...');
  const updateResult = await apiCall(
    'users-preferences-patch',
    'PATCH',
    {
      timezone: 'Europe/Berlin',
      units: 'metric',
      sleep_goal_hours: 7.0,
      workout_goal_per_week: 5,
      notifications_enabled: false,
      theme: 'light',
    },
    {
      Authorization: `Bearer ${token}`,
    }
  );

  console.log('Update Result:', updateResult.status, updateResult.status === 204 ? '✅' : '❌');

  // Test 2: Get preferences to verify persistence
  console.log('2. Testing get preferences to verify persistence...');
  const getResult = await apiCall('users-preferences-get', 'GET', null, {
    Authorization: `Bearer ${token}`,
  });

  console.log('Get Result:', getResult.status, getResult.success ? '✅' : '❌');
  if (getResult.success) {
    const data = getResult.data;
    const persistenceCheck =
      data.timezone === 'Europe/Berlin' &&
      data.units === 'metric' &&
      data.sleep_goal_hours === 7.0 &&
      data.workout_goal_per_week === 5 &&
      data.notifications_enabled === false &&
      data.theme === 'light';

    console.log('Persistence Test:', persistenceCheck ? '✅' : '❌');
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting User Preferences System Tests...');
  console.log('Base URL:', TEST_CONFIG.baseUrl);
  console.log('External ID:', TEST_CONFIG.externalId);

  try {
    const { token } = await testGetPreferences();
    await testPatchPreferences(token);
    await testValidation();
    await testCoercion();
    await testUnknownFields();
    await testConcurrentUpdates();
    await testCORS();
    await testPersistence();

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
  testGetPreferences,
  testPatchPreferences,
  testValidation,
  testCoercion,
  testUnknownFields,
  testConcurrentUpdates,
  testCORS,
  testPersistence,
};
