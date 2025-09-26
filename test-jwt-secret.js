/**
 * Test JWT Secret Match
 * 
 * This script tests if the JWT secret used in tests matches
 * what the endpoint expects.
 */

const jwt = require('jsonwebtoken');

// Test JWT secrets
const TEST_SECRET = 'test-jwt-secret-for-development-only';
const PROD_SECRET = 'your-super-secure-jwt-secret-at-least-32-characters';
const ENV_SECRET = process.env.JWT_SECRET;

console.log('🔍 JWT Secret Test\n');

console.log('Environment JWT_SECRET:', ENV_SECRET ? 'SET' : 'NOT SET');
console.log('Test secret length:', TEST_SECRET.length);
console.log('Prod secret length:', PROD_SECRET.length);

// Test token generation and verification
function testSecret(secret, name) {
    console.log(`\nTesting ${name}:`);
    
    try {
        const token = jwt.sign(
            { 
                sub: 'test-user', 
                role: 'admin',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600
            },
            secret
        );
        
        console.log('  ✅ Token generated successfully');
        
        // Try to verify with the same secret
        const decoded = jwt.verify(token, secret);
        console.log('  ✅ Token verified successfully');
        console.log('  📋 Decoded payload:', { sub: decoded.sub, role: decoded.role });
        
        return true;
    } catch (error) {
        console.log('  ❌ Error:', error.message);
        return false;
    }
}

// Test cross-verification
function testCrossVerification() {
    console.log('\n🔄 Cross-verification test:');
    
    try {
        const token = jwt.sign(
            { 
                sub: 'test-user', 
                role: 'admin',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600
            },
            TEST_SECRET
        );
        
        // Try to verify with prod secret
        const decoded = jwt.verify(token, PROD_SECRET);
        console.log('  ✅ Cross-verification successful (unexpected!)');
        return true;
    } catch (error) {
        console.log('  ✅ Cross-verification failed as expected:', error.message);
        return false;
    }
}

// Run tests
testSecret(TEST_SECRET, 'Test Secret');
testSecret(PROD_SECRET, 'Production Secret');
if (ENV_SECRET) {
    testSecret(ENV_SECRET, 'Environment Secret');
}
testCrossVerification();

console.log('\n💡 Recommendation:');
console.log('   Make sure the test uses the same JWT_SECRET as the endpoint.');
console.log('   Set JWT_SECRET environment variable or update the test default.');
