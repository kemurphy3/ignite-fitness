// test-quick-fix.js
// Quick test to verify the fixes

const { validatePaginationParams, encodeCursor, decodeCursor, PAGINATION_CONFIG } = require('./netlify/functions/utils/pagination');

console.log('🔍 Testing Pagination Fixes\n');

// Test 1: Pagination parameter validation
console.log('📊 Test 1: Pagination Parameter Validation');
const params1 = { limit: '0' };
const result1 = validatePaginationParams(params1);
console.log(`   Limit '0': ${result1.limit} (expected: ${PAGINATION_CONFIG.MIN_LIMIT})`);
console.log(`   ✅ ${result1.limit === PAGINATION_CONFIG.MIN_LIMIT ? 'PASS' : 'FAIL'}`);

const params2 = { limit: '50' };
const result2 = validatePaginationParams(params2);
console.log(`   Limit '50': ${result2.limit} (expected: 50)`);
console.log(`   ✅ ${result2.limit === 50 ? 'PASS' : 'FAIL'}`);

const params3 = { limit: '150' };
const result3 = validatePaginationParams(params3);
console.log(`   Limit '150': ${result3.limit} (expected: ${PAGINATION_CONFIG.MAX_LIMIT})`);
console.log(`   ✅ ${result3.limit === PAGINATION_CONFIG.MAX_LIMIT ? 'PASS' : 'FAIL'}\n`);

// Test 2: Cursor encoding/decoding
console.log('📊 Test 2: Cursor Encoding/Decoding');
const testData = {
  id: '123',
  timestamp: '2024-01-01T00:00:00Z',
  order: '2024-01-01T00:00:00Z'
};

const encoded = encodeCursor(testData);
const decoded = decodeCursor(encoded);

console.log(`   Original: ${JSON.stringify(testData)}`);
console.log(`   Decoded: ${JSON.stringify(decoded)}`);
console.log(`   ID match: ${decoded.id === testData.id ? 'PASS' : 'FAIL'}`);
console.log(`   Timestamp match: ${decoded.timestamp === testData.timestamp ? 'PASS' : 'FAIL'}`);
console.log(`   Order match: ${decoded.order === testData.order ? 'PASS' : 'FAIL'}`);
console.log(`   Version present: ${decoded.v === PAGINATION_CONFIG.CURSOR_VERSION ? 'PASS' : 'FAIL'}\n`);

console.log('🎉 Quick fix verification complete!');
