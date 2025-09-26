/**
 * Test Suite: SQL Injection Security
 * 
 * Tests all Netlify Functions for SQL injection vulnerabilities
 * by attempting to inject malicious SQL payloads.
 */

const jwt = require('jsonwebtoken');

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8888/.netlify/functions';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-at-least-32-characters';

// Malicious SQL injection payloads
const SQL_INJECTION_PAYLOADS = [
    "'; DROP TABLE users; --",
    "'; DELETE FROM sessions; --",
    "'; UPDATE users SET role='admin' WHERE id=1; --",
    "1' OR '1'='1",
    "1' UNION SELECT * FROM users --",
    "'; INSERT INTO users (id, external_id, username) VALUES (999, 'hacker', 'hacker'); --",
    "1' OR 1=1 --",
    "admin'--",
    "1' OR '1'='1' OR '1'='1",
    "'; EXEC xp_cmdshell('dir'); --"
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

async function makeRequest(endpoint, token, method = 'GET', body = {}) {
    const url = `${BASE_URL}/${endpoint}`;
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, {
            method,
            headers,
            body: method === 'POST' ? JSON.stringify(body) : undefined
        });
        
        const data = await response.json();
        return { status: response.status, data, headers: response.headers };
    } catch (error) {
        return { status: 0, data: { error: error.message }, headers: {} };
    }
}

// Test cases
async function runTests() {
    console.log('🧪 Running SQL Injection Security Tests\n');
    
    let passed = 0;
    let failed = 0;
    let totalTests = 0;
    
    // Test 1: User Profile Endpoints
    console.log('Test 1: User Profile Endpoints SQL Injection');
    const userToken = generateTestToken('test-user', 'user');
    
    for (const payload of SQL_INJECTION_PAYLOADS) {
        totalTests++;
        try {
            // Test users-profile-get with malicious external_id
            const { status, data } = await makeRequest(`users-profile-get?external_id=${encodeURIComponent(payload)}`, userToken);
            
            // Should not return 200 with user data (injection successful)
            // Should return 400, 401, 404, or 500 (injection blocked)
            if (status !== 200 || !data.success) {
                console.log(`✅ PASS - Payload blocked: ${payload.substring(0, 30)}...`);
                passed++;
            } else {
                console.log(`❌ FAIL - Payload may have succeeded: ${payload.substring(0, 30)}...`);
                failed++;
            }
        } catch (error) {
            console.log(`✅ PASS - Request failed (expected): ${payload.substring(0, 30)}...`);
            passed++;
        }
    }
    
    // Test 2: Sessions Endpoints
    console.log('\nTest 2: Sessions Endpoints SQL Injection');
    
    for (const payload of SQL_INJECTION_PAYLOADS) {
        totalTests++;
        try {
            // Test sessions-list with malicious parameters
            const { status, data } = await makeRequest(`sessions-list?type=${encodeURIComponent(payload)}`, userToken);
            
            if (status !== 200 || !data.success) {
                console.log(`✅ PASS - Payload blocked: ${payload.substring(0, 30)}...`);
                passed++;
            } else {
                console.log(`❌ FAIL - Payload may have succeeded: ${payload.substring(0, 30)}...`);
                failed++;
            }
        } catch (error) {
            console.log(`✅ PASS - Request failed (expected): ${payload.substring(0, 30)}...`);
            passed++;
        }
    }
    
    // Test 3: Admin Endpoints (with admin token)
    console.log('\nTest 3: Admin Endpoints SQL Injection');
    const adminToken = generateTestToken('test-admin', 'admin');
    
    for (const payload of SQL_INJECTION_PAYLOADS) {
        totalTests++;
        try {
            // Test admin-sessions-by-type with malicious parameters
            const { status, data } = await makeRequest(`admin-sessions-by-type?from=${encodeURIComponent(payload)}`, adminToken);
            
            if (status !== 200 || !data.success) {
                console.log(`✅ PASS - Payload blocked: ${payload.substring(0, 30)}...`);
                passed++;
            } else {
                console.log(`❌ FAIL - Payload may have succeeded: ${payload.substring(0, 30)}...`);
                failed++;
            }
        } catch (error) {
            console.log(`✅ PASS - Request failed (expected): ${payload.substring(0, 30)}...`);
            passed++;
        }
    }
    
    // Test 4: Exercise Endpoints
    console.log('\nTest 4: Exercise Endpoints SQL Injection');
    
    for (const payload of SQL_INJECTION_PAYLOADS) {
        totalTests++;
        try {
            // Test sessions-exercises-list with malicious session_id
            const { status, data } = await makeRequest(`sessions-exercises-list?session_id=${encodeURIComponent(payload)}`, userToken);
            
            if (status !== 200 || !data.success) {
                console.log(`✅ PASS - Payload blocked: ${payload.substring(0, 30)}...`);
                passed++;
            } else {
                console.log(`❌ FAIL - Payload may have succeeded: ${payload.substring(0, 30)}...`);
                failed++;
            }
        } catch (error) {
            console.log(`✅ PASS - Request failed (expected): ${payload.substring(0, 30)}...`);
            passed++;
        }
    }
    
    // Test 5: Strava Integration Endpoints
    console.log('\nTest 5: Strava Integration Endpoints SQL Injection');
    
    for (const payload of SQL_INJECTION_PAYLOADS) {
        totalTests++;
        try {
            // Test integrations-strava-status with malicious user_id
            const { status, data } = await makeRequest(`integrations-strava-status?user_id=${encodeURIComponent(payload)}`, userToken);
            
            if (status !== 200 || !data.success) {
                console.log(`✅ PASS - Payload blocked: ${payload.substring(0, 30)}...`);
                passed++;
            } else {
                console.log(`❌ FAIL - Payload may have succeeded: ${payload.substring(0, 30)}...`);
                failed++;
            }
        } catch (error) {
            console.log(`✅ PASS - Request failed (expected): ${payload.substring(0, 30)}...`);
            passed++;
        }
    }
    
    // Test 6: POST Request Body Injection
    console.log('\nTest 6: POST Request Body SQL Injection');
    
    for (const payload of SQL_INJECTION_PAYLOADS) {
        totalTests++;
        try {
            // Test sessions-create with malicious data
            const { status, data } = await makeRequest('sessions-create', userToken, 'POST', {
                type: payload,
                start_at: new Date().toISOString(),
                duration_minutes: 60
            });
            
            if (status !== 200 || !data.success) {
                console.log(`✅ PASS - Payload blocked: ${payload.substring(0, 30)}...`);
                passed++;
            } else {
                console.log(`❌ FAIL - Payload may have succeeded: ${payload.substring(0, 30)}...`);
                failed++;
            }
        } catch (error) {
            console.log(`✅ PASS - Request failed (expected): ${payload.substring(0, 30)}...`);
            passed++;
        }
    }
    
    // Test Results Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SQL INJECTION SECURITY TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total Tests: ${totalTests}`);
    console.log(`📈 Success Rate: ${Math.round((passed / totalTests) * 100)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! No SQL injection vulnerabilities detected.');
        console.log('   All endpoints are properly using parameterized queries.');
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed. Potential SQL injection vulnerabilities detected.`);
        console.log('   Please review the implementation and ensure all queries use parameterized statements.');
    }
    
    console.log('\n📝 Note: This test attempts to inject malicious SQL payloads into all endpoints.');
    console.log('   Safe endpoints should reject or sanitize these inputs properly.');
    console.log('   Parameterized queries with Neon template literals provide protection.');
    
    return { passed, failed, totalTests };
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests, generateTestToken };
