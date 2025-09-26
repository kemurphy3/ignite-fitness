/**
 * Test Suite: Admin Get All Users Authentication
 * 
 * Tests JWT authentication, admin role validation, and security features
 * for the admin-get-all-users endpoint.
 * 
 * Note: This test requires the database to have users with admin roles.
 * Run database migrations first: psql $DATABASE_URL -f database-admin-analytics-schema.sql
 */

const jwt = require('jsonwebtoken');

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8888/.netlify/functions';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-development-only';
const ADMIN_USER_ID = '1'; // Use existing admin user ID from database
const REGULAR_USER_ID = '2'; // Use existing regular user ID from database

// Test data
const testUsers = [
    {
        id: ADMIN_USER_ID,
        external_id: 'admin123',
        username: 'admin_user',
        role: 'admin',
        status: 'active',
        created_at: new Date().toISOString()
    },
    {
        id: REGULAR_USER_ID,
        external_id: 'user456',
        username: 'regular_user',
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString()
    }
];

// Helper functions
function generateTestToken(userId, role = 'user', expiresIn = '1h') {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (expiresIn === '1h' ? 3600 : 60);
    
    return jwt.sign(
        {
            sub: userId,
            role: role,
            iat: now,
            exp: exp
        },
        JWT_SECRET
    );
}

function generateExpiredToken(userId, role = 'user') {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
        {
            sub: userId,
            role: role,
            iat: now - 7200, // 2 hours ago
            exp: now - 3600  // 1 hour ago
        },
        JWT_SECRET
    );
}

function generateInvalidToken() {
    return 'invalid.jwt.token';
}

async function makeRequest(token, method = 'GET') {
    const url = `${BASE_URL}/admin-get-all-users`;
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
        method,
        headers
    });
    
    const data = await response.json();
    return { status: response.status, data };
}

// Test cases
async function runTests() {
    console.log('🧪 Running Admin Get All Users Authentication Tests\n');
    
    let passed = 0;
    let failed = 0;
    
    // Test 1: Missing Authorization Header
    console.log('Test 1: Missing Authorization Header');
    try {
        const { status, data } = await makeRequest(null);
        if (status === 401 && data.error === 'UNAUTHORIZED') {
            console.log('✅ PASS - Returns 401 for missing token');
            passed++;
        } else {
            console.log('❌ FAIL - Expected 401 UNAUTHORIZED, got:', status, data);
            failed++;
        }
    } catch (error) {
        console.log('❌ FAIL - Request failed:', error.message);
        failed++;
    }
    
    // Test 2: Invalid Token Format
    console.log('\nTest 2: Invalid Token Format');
    try {
        const { status, data } = await makeRequest('invalid-token');
        if (status === 401 && data.error === 'UNAUTHORIZED') {
            console.log('✅ PASS - Returns 401 for invalid token format');
            passed++;
        } else {
            console.log('❌ FAIL - Expected 401 UNAUTHORIZED, got:', status, data);
            failed++;
        }
    } catch (error) {
        console.log('❌ FAIL - Request failed:', error.message);
        failed++;
    }
    
    // Test 3: Expired Token
    console.log('\nTest 3: Expired Token');
    try {
        const expiredToken = generateExpiredToken(ADMIN_USER_ID, 'admin');
        const { status, data } = await makeRequest(expiredToken);
        if (status === 401 && data.error === 'UNAUTHORIZED') {
            console.log('✅ PASS - Returns 401 for expired token');
            passed++;
        } else {
            console.log('❌ FAIL - Expected 401 UNAUTHORIZED, got:', status, data);
            failed++;
        }
    } catch (error) {
        console.log('❌ FAIL - Request failed:', error.message);
        failed++;
    }
    
    // Test 4: Regular User Token (Non-Admin)
    console.log('\nTest 4: Regular User Token (Non-Admin)');
    try {
        const regularToken = generateTestToken(REGULAR_USER_ID, 'user');
        const { status, data } = await makeRequest(regularToken);
        if (status === 403 && data.error === 'FORBIDDEN') {
            console.log('✅ PASS - Returns 403 for non-admin user');
            passed++;
        } else {
            console.log('❌ FAIL - Expected 403 FORBIDDEN, got:', status, data);
            failed++;
        }
    } catch (error) {
        console.log('❌ FAIL - Request failed:', error.message);
        failed++;
    }
    
    // Test 5: Valid Admin Token
    console.log('\nTest 5: Valid Admin Token');
    try {
        const adminToken = generateTestToken(ADMIN_USER_ID, 'admin');
        const { status, data } = await makeRequest(adminToken);
        if (status === 200 && data.success === true) {
            console.log('✅ PASS - Returns 200 for valid admin token');
            passed++;
        } else {
            console.log('❌ FAIL - Expected 200 success, got:', status, data);
            failed++;
        }
    } catch (error) {
        console.log('❌ FAIL - Request failed:', error.message);
        failed++;
    }
    
    // Test 6: Method Not Allowed (POST)
    console.log('\nTest 6: Method Not Allowed (POST)');
    try {
        const adminToken = generateTestToken(ADMIN_USER_ID, 'admin');
        const { status, data } = await makeRequest(adminToken, 'POST');
        if (status === 405 && data.error === 'METHOD_NOT_ALLOWED') {
            console.log('✅ PASS - Returns 405 for POST method');
            passed++;
        } else {
            console.log('❌ FAIL - Expected 405 METHOD_NOT_ALLOWED, got:', status, data);
            failed++;
        }
    } catch (error) {
        console.log('❌ FAIL - Request failed:', error.message);
        failed++;
    }
    
    // Test 7: OPTIONS Request (CORS Preflight)
    console.log('\nTest 7: OPTIONS Request (CORS Preflight)');
    try {
        const { status, data } = await makeRequest(null, 'OPTIONS');
        if (status === 200) {
            console.log('✅ PASS - Returns 200 for OPTIONS request');
            passed++;
        } else {
            console.log('❌ FAIL - Expected 200 for OPTIONS, got:', status, data);
            failed++;
        }
    } catch (error) {
        console.log('❌ FAIL - Request failed:', error.message);
        failed++;
    }
    
    // Test 8: Token with Invalid Signature
    console.log('\nTest 8: Token with Invalid Signature');
    try {
        const now = Math.floor(Date.now() / 1000);
        const invalidToken = jwt.sign(
            { 
                sub: ADMIN_USER_ID, 
                role: 'admin',
                iat: now,
                exp: now + 3600
            },
            'wrong-secret'
        );
        const { status, data } = await makeRequest(invalidToken);
        if (status === 401 && data.error === 'UNAUTHORIZED') {
            console.log('✅ PASS - Returns 401 for invalid signature');
            passed++;
        } else {
            console.log('❌ FAIL - Expected 401 UNAUTHORIZED, got:', status, data);
            failed++;
        }
    } catch (error) {
        console.log('❌ FAIL - Request failed:', error.message);
        failed++;
    }
    
    // Test 9: Token Missing Required Claims
    console.log('\nTest 9: Token Missing Required Claims');
    try {
        const now = Math.floor(Date.now() / 1000);
        const incompleteToken = jwt.sign(
            { 
                role: 'admin', // Missing 'sub' claim
                iat: now,
                exp: now + 3600
            },
            JWT_SECRET
        );
        const { status, data } = await makeRequest(incompleteToken);
        if (status === 401 && data.error === 'UNAUTHORIZED') {
            console.log('✅ PASS - Returns 401 for missing claims');
            passed++;
        } else {
            console.log('❌ FAIL - Expected 401 UNAUTHORIZED, got:', status, data);
            failed++;
        }
    } catch (error) {
        console.log('❌ FAIL - Request failed:', error.message);
        failed++;
    }
    
    // Test 10: Security Headers Check
    console.log('\nTest 10: Security Headers Check');
    try {
        const adminToken = generateTestToken(ADMIN_USER_ID, 'admin');
        const response = await fetch(`${BASE_URL}/admin-get-all-users`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const headers = response.headers;
        const hasSecurityHeaders = 
            headers.get('X-Content-Type-Options') === 'nosniff' &&
            headers.get('X-Frame-Options') === 'DENY' &&
            headers.get('X-XSS-Protection') === '1; mode=block';
            
        if (hasSecurityHeaders) {
            console.log('✅ PASS - Security headers present');
            passed++;
        } else {
            console.log('❌ FAIL - Missing security headers');
            failed++;
        }
    } catch (error) {
        console.log('❌ FAIL - Request failed:', error.message);
        failed++;
    }
    
    // Test Results Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! Admin endpoint is properly secured.');
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed. Please review the implementation.`);
    }
    
    return { passed, failed };
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests, generateTestToken, generateExpiredToken };
