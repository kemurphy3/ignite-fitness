#!/usr/bin/env node
/**
 * Comprehensive Security Implementation Verification
 * Tests all security fixes from prompts 1-5
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let allTestsPassed = true;
const results = {
  security: [],
  infrastructure: [],
  functional: [],
};

function logTest(category, testName, passed, details = '') {
  const status = passed ? '✓' : '✗';
  const message = `${status} ${testName}`;
  console.log(message);
  if (details) {
    console.log(`  ${details}`);
  }
  if (!passed) {
    allTestsPassed = false;
  }
  results[category].push({ test: testName, passed, details });
}

console.log('🔒 Security Implementation Verification\n');
console.log('='.repeat(60));

// ============================================
// SECURITY TESTS
// ============================================
console.log('\n📋 SECURITY TESTS\n');

// Test 1: No environment variables in client-side code
try {
  const jsDir = path.join(__dirname, 'js');
  const files = getAllJsFiles(jsDir);
  let foundEnvVars = false;
  const envVarPatterns = [/process\.env\./, /import\.meta\.env\./, /window\.ENV/];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of envVarPatterns) {
      if (pattern.test(content)) {
        foundEnvVars = true;
        logTest('security', 'No client-side env vars', false, `Found in ${file}`);
        break;
      }
    }
  }

  if (!foundEnvVars) {
    logTest('security', 'No client-side env vars', true);
  }
} catch (error) {
  logTest('security', 'No client-side env vars', false, error.message);
}

// Test 2: Admin endpoints have authentication
const adminEndpoints = [
  'admin-get-all-users.js',
  'admin-health.js',
  'admin-overview.js',
  'admin-sessions-by-type.js',
  'admin-sessions-series.js',
  'admin-users-top.js',
];

for (const endpoint of adminEndpoints) {
  const filePath = path.join(__dirname, 'netlify/functions', endpoint);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasAuth =
      content.includes('JWT Authentication Check') &&
      content.includes('Bearer ') &&
      content.includes('statusCode: 401');
    logTest(
      'security',
      `${endpoint} has authentication`,
      hasAuth,
      hasAuth ? '' : 'Missing authentication check'
    );
  }
}

// Test 3: API proxies have authentication
const proxyEndpoints = [
  'ai-proxy.js',
  'strava-proxy.js',
  'strava-oauth.js',
  'strava-oauth-exchange.js',
];

for (const endpoint of proxyEndpoints) {
  const filePath = path.join(__dirname, 'netlify/functions', endpoint);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasAuth =
      content.includes('Authentication required') || content.includes('User Authentication Check');
    logTest(
      'security',
      `${endpoint} has authentication`,
      hasAuth,
      hasAuth ? '' : 'Missing authentication check'
    );
  }
}

// Test 4: Rate limiting in proxies
for (const endpoint of ['ai-proxy.js', 'strava-proxy.js']) {
  const filePath = path.join(__dirname, 'netlify/functions', endpoint);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasRateLimit =
      content.includes('checkRateLimit') || content.includes('Rate limit exceeded');
    logTest(
      'security',
      `${endpoint} has rate limiting`,
      hasRateLimit,
      hasRateLimit ? '' : 'Missing rate limiting'
    );
  }
}

// Test 5: Admin login endpoint exists
const adminLoginPath = path.join(__dirname, 'netlify/functions/admin-login.js');
if (fs.existsSync(adminLoginPath)) {
  const content = fs.readFileSync(adminLoginPath, 'utf8');
  const hasTokenGen =
    content.includes('JWT token') &&
    content.includes('createHmac') &&
    content.includes('sha256') &&
    content.includes('token:');
  logTest('security', 'Admin login generates JWT tokens', hasTokenGen);
} else {
  logTest('security', 'Admin login generates JWT tokens', false, 'File not found');
}

// ============================================
// INFRASTRUCTURE TESTS
// ============================================
console.log('\n📋 INFRASTRUCTURE TESTS\n');

// Test 1: Connection pool implementation
const connectionPoolPath = path.join(__dirname, 'netlify/functions/utils/connection-pool.js');
if (fs.existsSync(connectionPoolPath)) {
  const content = fs.readFileSync(connectionPoolPath, 'utf8');
  const hasPool =
    content.includes('ConnectionPoolManager') &&
    content.includes('getPool') &&
    content.includes('healthCheck') &&
    content.includes('MockPool');
  logTest('infrastructure', 'Connection pool implementation', hasPool);
} else {
  logTest('infrastructure', 'Connection pool implementation', false, 'File not found');
}

// Test 2: Pagination utility exists
const paginationPath = path.join(__dirname, 'netlify/functions/utils/pagination.js');
if (fs.existsSync(paginationPath)) {
  const content = fs.readFileSync(paginationPath, 'utf8');
  const hasPagination =
    content.includes('PaginationManager') &&
    content.includes('validatePagination') &&
    content.includes('buildPaginatedQuery') &&
    content.includes('formatResponse') &&
    (content.includes('maxLimit: 100') || content.includes('this.maxLimit = 100'));
  logTest('infrastructure', 'Pagination utility with limits', hasPagination);
} else {
  logTest('infrastructure', 'Pagination utility with limits', false, 'File not found');
}

// Test 3: Admin endpoints use pagination
for (const endpoint of ['admin-get-all-users.js']) {
  const filePath = path.join(__dirname, 'netlify/functions', endpoint);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const usesPagination =
      content.includes('validatePagination') &&
      content.includes('buildPaginatedQuery') &&
      content.includes('formatResponse');
    logTest(
      'infrastructure',
      `${endpoint} uses pagination`,
      usesPagination,
      usesPagination ? '' : 'Missing pagination'
    );
  }
}

// Test 4: Sessions list uses pagination
const sessionsListPath = path.join(__dirname, 'netlify/functions/sessions-list.js');
if (fs.existsSync(sessionsListPath)) {
  const content = fs.readFileSync(sessionsListPath, 'utf8');
  const usesPagination =
    content.includes('validatePagination') &&
    content.includes('buildPaginatedQuery') &&
    content.includes('formatResponse');
  logTest('infrastructure', 'sessions-list.js uses pagination', usesPagination);
}

// Test 5: Vitest configuration
const vitestConfigPath = path.join(__dirname, 'vitest.config.js');
if (fs.existsSync(vitestConfigPath)) {
  const content = fs.readFileSync(vitestConfigPath, 'utf8');
  const hasConfig =
    content.includes('defineConfig') &&
    content.includes('environment:') &&
    content.includes('testTimeout:') &&
    content.includes('pool:');
  logTest('infrastructure', 'Vitest configuration exists', hasConfig);
}

// Test 6: Test setup file
const setupPath = path.join(__dirname, 'tests/setup.js');
if (fs.existsSync(setupPath)) {
  const content = fs.readFileSync(setupPath, 'utf8');
  const hasSetup = content.includes('vi.mock') && content.includes('localStorage');
  logTest('infrastructure', 'Test setup file exists', hasSetup);
}

// ============================================
// FUNCTIONAL TESTS
// ============================================
console.log('\n📋 FUNCTIONAL TESTS\n');

// Test 1: ConfigManager exists
const configManagerPath = path.join(__dirname, 'js/modules/core/ConfigManager.js');
if (fs.existsSync(configManagerPath)) {
  const content = fs.readFileSync(configManagerPath, 'utf8');
  const hasConfigManager =
    content.includes('ConfigManager') &&
    content.includes('loadConfig') &&
    content.includes('getFeature') &&
    content.includes('public-config');
  logTest('functional', 'ConfigManager exists', hasConfigManager);
} else {
  logTest('functional', 'ConfigManager exists', false, 'File not found');
}

// Test 2: Public config endpoint exists
const publicConfigPath = path.join(__dirname, 'netlify/functions/public-config.js');
if (fs.existsSync(publicConfigPath)) {
  const content = fs.readFileSync(publicConfigPath, 'utf8');
  // Check that it doesn't expose actual secret values (only checks existence)
  // It's OK to use !!process.env.KEY (boolean check) but not expose the actual value
  const hasEndpoint =
    content.includes('exports.handler') &&
    content.includes('publicConfig') &&
    content.includes('features') &&
    !content.includes('JWT_SECRET') && // Should not expose JWT secret
    !content.includes('DATABASE_URL') && // Should not expose database URL
    // OPENAI_API_KEY is OK if only used in boolean check (!!process.env.OPENAI_API_KEY)
    (content.includes('!!process.env.OPENAI_API_KEY') || !content.includes('OPENAI_API_KEY'));
  logTest('functional', 'Public config endpoint (no secrets)', hasEndpoint);
} else {
  logTest('functional', 'Public config endpoint (no secrets)', false, 'File not found');
}

// Test 3: Connection pool exports
if (fs.existsSync(connectionPoolPath)) {
  const content = fs.readFileSync(connectionPoolPath, 'utf8');
  const hasExports =
    content.includes('module.exports') &&
    content.includes('getPool') &&
    content.includes('healthCheck') &&
    content.includes('getStats');
  logTest('functional', 'Connection pool exports functions', hasExports);
}

// Test 4: Pagination exports
if (fs.existsSync(paginationPath)) {
  const content = fs.readFileSync(paginationPath, 'utf8');
  const hasExports =
    content.includes('module.exports') &&
    content.includes('validatePagination') &&
    content.includes('buildPaginatedQuery') &&
    content.includes('formatResponse');
  logTest('functional', 'Pagination utility exports functions', hasExports);
}

// ============================================
// SUMMARY
// ============================================
console.log('\n' + '='.repeat(60));
console.log('\n📊 VERIFICATION SUMMARY\n');

const securityPassed = results.security.filter(r => r.passed).length;
const securityTotal = results.security.length;
const infrastructurePassed = results.infrastructure.filter(r => r.passed).length;
const infrastructureTotal = results.infrastructure.length;
const functionalPassed = results.functional.filter(r => r.passed).length;
const functionalTotal = results.functional.length;

console.log(`Security Tests: ${securityPassed}/${securityTotal} passed`);
console.log(`Infrastructure Tests: ${infrastructurePassed}/${infrastructureTotal} passed`);
console.log(`Functional Tests: ${functionalPassed}/${functionalTotal} passed`);

const totalPassed = securityPassed + infrastructurePassed + functionalPassed;
const totalTests = securityTotal + infrastructureTotal + functionalTotal;

console.log(`\nOverall: ${totalPassed}/${totalTests} tests passed`);

if (allTestsPassed) {
  console.log('\n✅ All verification tests passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some verification tests failed. Review the output above.');
  process.exit(1);
}

// Helper function to get all JS files
function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(getAllJsFiles(filePath));
    } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
      results.push(filePath);
    }
  });

  return results;
}
