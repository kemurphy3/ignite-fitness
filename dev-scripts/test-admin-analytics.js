// Comprehensive Test Suite for Admin Analytics System
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

const BASE_URL = 'https://your-site.netlify.app/.netlify/functions';
const TEST_ADMIN_ID = 'test-admin-123';
const TEST_USER_ID = 'test-user-456';

// Test configuration
const TEST_CONFIG = {
  baseUrl: BASE_URL,
  adminId: TEST_ADMIN_ID,
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

// Generate test JWT tokens
function generateAdminToken(adminId = TEST_ADMIN_ID) {
  const secret = process.env.JWT_SECRET || 'test-secret-key-for-development-only';

  return jwt.sign(
    {
      sub: adminId,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    },
    secret,
    {
      expiresIn: '24h',
      issuer: 'ignite-fitness',
      audience: 'api',
    }
  );
}

function generateUserToken(userId = TEST_USER_ID) {
  const secret = process.env.JWT_SECRET || 'test-secret-key-for-development-only';

  return jwt.sign(
    {
      sub: userId,
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    },
    secret,
    {
      expiresIn: '24h',
      issuer: 'ignite-fitness',
      audience: 'api',
    }
  );
}

// Test functions
async function testAdminAuthentication() {
  console.log('\n🧪 Testing Admin Authentication...');

  const adminToken = generateAdminToken();
  const userToken = generateUserToken();

  // Test 1: Valid admin token
  console.log('1. Testing valid admin token...');
  const adminResult = await apiCall('admin-overview', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log('Admin Token Result:', adminResult.status, adminResult.success ? '✅' : '❌');
  if (adminResult.success) {
    console.log('Response includes data:', !!adminResult.data.data);
  }

  // Test 2: User token (should fail)
  console.log('2. Testing user token (should fail)...');
  const userResult = await apiCall('admin-overview', 'GET', null, {
    Authorization: `Bearer ${userToken}`,
  });

  console.log('User Token Result:', userResult.status, userResult.status === 403 ? '✅' : '❌');
  if (userResult.data.error) {
    console.log('Error Code:', userResult.data.error.code);
  }

  // Test 3: Missing authorization
  console.log('3. Testing missing authorization...');
  const noAuthResult = await apiCall('admin-overview', 'GET');

  console.log('No Auth Result:', noAuthResult.status, noAuthResult.status === 401 ? '✅' : '❌');

  // Test 4: Invalid token
  console.log('4. Testing invalid token...');
  const invalidResult = await apiCall('admin-overview', 'GET', null, {
    Authorization: 'Bearer invalid-token',
  });

  console.log(
    'Invalid Token Result:',
    invalidResult.status,
    invalidResult.status === 401 ? '✅' : '❌'
  );

  return { adminToken, userToken };
}

async function testAdminOverview(adminToken) {
  console.log('\n🧪 Testing Admin Overview...');

  // Test 1: Get overview metrics
  console.log('1. Testing overview metrics...');
  const overviewResult = await apiCall('admin-overview', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log('Overview Result:', overviewResult.status, overviewResult.success ? '✅' : '❌');
  if (overviewResult.success) {
    const data = overviewResult.data.data;
    console.log('Metrics:', {
      total_users: data.total_users,
      total_sessions: data.total_sessions,
      sessions_7d: data.sessions_7d,
      new_users_7d: data.new_users_7d,
      active_users_30d: data.active_users_30d,
      avg_sessions_per_user: data.avg_sessions_per_user,
    });

    // Check required fields
    const requiredFields = ['total_users', 'total_sessions', 'last_updated'];
    const missingFields = requiredFields.filter(field => !(field in data));
    console.log('Required Fields Test:', missingFields.length === 0 ? '✅' : '❌');
    if (missingFields.length > 0) {
      console.log('Missing Fields:', missingFields);
    }
  }

  // Test 2: Check response metadata
  console.log('2. Testing response metadata...');
  if (overviewResult.success) {
    const meta = overviewResult.data.meta;
    console.log('Metadata:', {
      request_id: meta.request_id,
      generated_at: meta.generated_at,
      cache_hit: meta.cache_hit,
      response_time_ms: meta.response_time_ms,
      data_version: meta.data_version,
    });

    const requiredMeta = ['request_id', 'generated_at', 'response_time_ms'];
    const missingMeta = requiredMeta.filter(field => !(field in meta));
    console.log('Metadata Test:', missingMeta.length === 0 ? '✅' : '❌');
  }
}

async function testSessionsSeries(adminToken) {
  console.log('\n🧪 Testing Sessions Series...');

  // Test 1: Valid date range
  console.log('1. Testing valid date range...');
  const seriesResult = await apiCall(
    'admin-sessions-series?from=2024-01-01&to=2024-01-31&bucket=day&timezone=UTC',
    'GET',
    null,
    {
      Authorization: `Bearer ${adminToken}`,
    }
  );

  console.log('Series Result:', seriesResult.status, seriesResult.success ? '✅' : '❌');
  if (seriesResult.success) {
    const data = seriesResult.data.data;
    console.log('Series Data:', {
      series_length: data.series.length,
      summary: data.summary,
    });

    // Check series structure
    if (data.series.length > 0) {
      const firstItem = data.series[0];
      const requiredFields = [
        'date',
        'session_count',
        'unique_users',
        'completed_count',
        'privacy_applied',
      ];
      const missingFields = requiredFields.filter(field => !(field in firstItem));
      console.log('Series Structure Test:', missingFields.length === 0 ? '✅' : '❌');
    }
  }

  // Test 2: Invalid date range
  console.log('2. Testing invalid date range...');
  const invalidRangeResult = await apiCall(
    'admin-sessions-series?from=2024-01-01&to=2023-01-01',
    'GET',
    null,
    {
      Authorization: `Bearer ${adminToken}`,
    }
  );

  console.log(
    'Invalid Range Result:',
    invalidRangeResult.status,
    invalidRangeResult.status === 400 ? '✅' : '❌'
  );

  // Test 3: Missing parameters
  console.log('3. Testing missing parameters...');
  const missingParamsResult = await apiCall('admin-sessions-series', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log(
    'Missing Params Result:',
    missingParamsResult.status,
    missingParamsResult.status === 400 ? '✅' : '❌'
  );

  // Test 4: Invalid timezone
  console.log('4. Testing invalid timezone...');
  const invalidTzResult = await apiCall(
    'admin-sessions-series?from=2024-01-01&to=2024-01-31&timezone=Invalid/Zone',
    'GET',
    null,
    {
      Authorization: `Bearer ${adminToken}`,
    }
  );

  console.log(
    'Invalid Timezone Result:',
    invalidTzResult.status,
    invalidTzResult.status === 400 ? '✅' : '❌'
  );

  // Test 5: Week bucket
  console.log('5. Testing week bucket...');
  const weekResult = await apiCall(
    'admin-sessions-series?from=2024-01-01&to=2024-01-31&bucket=week&timezone=America/New_York',
    'GET',
    null,
    {
      Authorization: `Bearer ${adminToken}`,
    }
  );

  console.log('Week Bucket Result:', weekResult.status, weekResult.success ? '✅' : '❌');
}

async function testSessionsByType(adminToken) {
  console.log('\n🧪 Testing Sessions By Type...');

  // Test 1: Get session distribution
  console.log('1. Testing session distribution...');
  const byTypeResult = await apiCall('admin-sessions-by-type', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log('By Type Result:', byTypeResult.status, byTypeResult.success ? '✅' : '❌');
  if (byTypeResult.success) {
    const data = byTypeResult.data.data;
    console.log('Distribution:', {
      distribution_length: data.distribution.length,
      total: data.total,
    });

    // Check distribution structure
    if (data.distribution.length > 0) {
      const firstItem = data.distribution[0];
      const requiredFields = ['session_type', 'count', 'percentage', 'unique_users'];
      const missingFields = requiredFields.filter(field => !(field in firstItem));
      console.log('Distribution Structure Test:', missingFields.length === 0 ? '✅' : '❌');
    }
  }

  // Test 2: With date range
  console.log('2. Testing with date range...');
  const dateRangeResult = await apiCall(
    'admin-sessions-by-type?from=2024-01-01&to=2024-01-31',
    'GET',
    null,
    {
      Authorization: `Bearer ${adminToken}`,
    }
  );

  console.log('Date Range Result:', dateRangeResult.status, dateRangeResult.success ? '✅' : '❌');
}

async function testTopUsers(adminToken) {
  console.log('\n🧪 Testing Top Users...');

  // Test 1: Get top users by sessions
  console.log('1. Testing top users by sessions...');
  const topSessionsResult = await apiCall('admin-users-top?metric=sessions&limit=10', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log(
    'Top Sessions Result:',
    topSessionsResult.status,
    topSessionsResult.success ? '✅' : '❌'
  );
  if (topSessionsResult.success) {
    const data = topSessionsResult.data.data;
    console.log('Top Users:', {
      users_length: data.users.length,
      has_next_cursor: !!data.next_cursor,
    });

    // Check user structure
    if (data.users.length > 0) {
      const firstUser = data.users[0];
      const requiredFields = ['user_alias', 'metric_value', 'rank', 'last_active'];
      const missingFields = requiredFields.filter(field => !(field in firstUser));
      console.log('User Structure Test:', missingFields.length === 0 ? '✅' : '❌');
    }
  }

  // Test 2: Get top users by duration
  console.log('2. Testing top users by duration...');
  const topDurationResult = await apiCall('admin-users-top?metric=duration&limit=5', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log(
    'Top Duration Result:',
    topDurationResult.status,
    topDurationResult.success ? '✅' : '❌'
  );

  // Test 3: Invalid metric
  console.log('3. Testing invalid metric...');
  const invalidMetricResult = await apiCall('admin-users-top?metric=invalid', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log(
    'Invalid Metric Result:',
    invalidMetricResult.status,
    invalidMetricResult.status === 400 ? '✅' : '❌'
  );

  // Test 4: Invalid limit
  console.log('4. Testing invalid limit...');
  const invalidLimitResult = await apiCall('admin-users-top?limit=200', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log(
    'Invalid Limit Result:',
    invalidLimitResult.status,
    invalidLimitResult.status === 400 ? '✅' : '❌'
  );

  // Test 5: Keyset pagination
  console.log('5. Testing keyset pagination...');
  if (topSessionsResult.success && topSessionsResult.data.data.next_cursor) {
    const paginationResult = await apiCall(
      `admin-users-top?metric=sessions&limit=5&cursor=${topSessionsResult.data.data.next_cursor}`,
      'GET',
      null,
      {
        Authorization: `Bearer ${adminToken}`,
      }
    );

    console.log(
      'Pagination Result:',
      paginationResult.status,
      paginationResult.success ? '✅' : '❌'
    );
  }
}

async function testAdminHealth(adminToken) {
  console.log('\n🧪 Testing Admin Health...');

  // Test 1: Get health status
  console.log('1. Testing health status...');
  const healthResult = await apiCall('admin-health', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log('Health Result:', healthResult.status, healthResult.success ? '✅' : '❌');
  if (healthResult.success) {
    const data = healthResult.data.data;
    console.log('Health Data:', {
      database_connected: data.database.connected,
      migrations_version: data.database.migrations_version,
      views_freshness: data.database.views_freshness,
      strava_last_import: data.integrations.strava.last_import,
      strava_active_imports: data.integrations.strava.active_imports,
      environment: data.config.environment,
      version: data.config.version,
    });

    // Check health structure
    const requiredSections = ['database', 'integrations', 'config'];
    const missingSections = requiredSections.filter(section => !(section in data));
    console.log('Health Structure Test:', missingSections.length === 0 ? '✅' : '❌');
  }

  // Test 2: Health without auth (should fail)
  console.log('2. Testing health without auth...');
  const noAuthHealthResult = await apiCall('admin-health', 'GET');

  console.log(
    'No Auth Health Result:',
    noAuthHealthResult.status,
    noAuthHealthResult.status === 401 ? '✅' : '❌'
  );
}

async function testPrivacyProtection(adminToken) {
  console.log('\n🧪 Testing Privacy Protection...');

  // Test 1: Check privacy thresholds in overview
  console.log('1. Testing privacy thresholds in overview...');
  const overviewResult = await apiCall('admin-overview', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  if (overviewResult.success) {
    const data = overviewResult.data.data;
    console.log('Privacy Check:', {
      new_users_7d: data.new_users_7d,
      active_users_30d: data.active_users_30d,
    });

    // Check if privacy is applied (null values for small counts)
    const privacyApplied = data.new_users_7d === null || data.active_users_30d === null;
    console.log('Privacy Applied:', privacyApplied ? '✅' : '❌');
  }

  // Test 2: Check privacy in series data
  console.log('2. Testing privacy in series data...');
  const seriesResult = await apiCall(
    'admin-sessions-series?from=2024-01-01&to=2024-01-31&bucket=day',
    'GET',
    null,
    {
      Authorization: `Bearer ${adminToken}`,
    }
  );

  if (seriesResult.success) {
    const data = seriesResult.data.data;
    const privacyApplied = data.series.some(item => item.privacy_applied);
    console.log('Series Privacy Applied:', privacyApplied ? '✅' : '❌');
  }

  // Test 3: Check user aliases are hashed
  console.log('3. Testing user aliases are hashed...');
  const topUsersResult = await apiCall('admin-users-top?metric=sessions&limit=5', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  if (topUsersResult.success) {
    const data = topUsersResult.data.data;
    if (data.users.length > 0) {
      const firstUser = data.users[0];
      const isHashed =
        firstUser.user_alias.startsWith('usr_') && firstUser.user_alias.length === 10;
      console.log('User Aliases Hashed:', isHashed ? '✅' : '❌');
    }
  }
}

async function testErrorHandling(adminToken) {
  console.log('\n🧪 Testing Error Handling...');

  // Test 1: Invalid cursor format
  console.log('1. Testing invalid cursor format...');
  const invalidCursorResult = await apiCall('admin-users-top?cursor=invalid-cursor', 'GET', null, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log(
    'Invalid Cursor Result:',
    invalidCursorResult.status,
    invalidCursorResult.status === 400 ? '✅' : '❌'
  );

  // Test 2: Large date range
  console.log('2. Testing large date range...');
  const largeRangeResult = await apiCall(
    'admin-sessions-series?from=2020-01-01&to=2024-01-01',
    'GET',
    null,
    {
      Authorization: `Bearer ${adminToken}`,
    }
  );

  console.log(
    'Large Range Result:',
    largeRangeResult.status,
    largeRangeResult.status === 400 ? '✅' : '❌'
  );

  // Test 3: Invalid timezone
  console.log('3. Testing invalid timezone...');
  const invalidTzResult = await apiCall(
    'admin-sessions-series?from=2024-01-01&to=2024-01-31&timezone=Invalid/Zone',
    'GET',
    null,
    {
      Authorization: `Bearer ${adminToken}`,
    }
  );

  console.log(
    'Invalid Timezone Result:',
    invalidTzResult.status,
    invalidTzResult.status === 400 ? '✅' : '❌'
  );
}

async function testRateLimiting(adminToken) {
  console.log('\n🧪 Testing Rate Limiting...');

  // Test 1: Multiple rapid requests
  console.log('1. Testing multiple rapid requests...');
  const requests = Array(5)
    .fill()
    .map(() =>
      apiCall('admin-overview', 'GET', null, {
        Authorization: `Bearer ${adminToken}`,
      })
    );

  const results = await Promise.all(requests);
  const successCount = results.filter(r => r.success).length;

  console.log('Rate Limit Test:', successCount === 5 ? '✅' : '❌');
  console.log('Successful Requests:', successCount);
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Admin Analytics System Tests...');
  console.log('Base URL:', TEST_CONFIG.baseUrl);
  console.log('Admin ID:', TEST_CONFIG.adminId);

  try {
    const { adminToken } = await testAdminAuthentication();
    await testAdminOverview(adminToken);
    await testSessionsSeries(adminToken);
    await testSessionsByType(adminToken);
    await testTopUsers(adminToken);
    await testAdminHealth(adminToken);
    await testPrivacyProtection(adminToken);
    await testErrorHandling(adminToken);
    await testRateLimiting(adminToken);

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
  testAdminAuthentication,
  testAdminOverview,
  testSessionsSeries,
  testSessionsByType,
  testTopUsers,
  testAdminHealth,
  testPrivacyProtection,
  testErrorHandling,
  testRateLimiting,
};
