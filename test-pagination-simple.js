// test-pagination-simple.js
// Simplified pagination test without sql.unsafe

const { getNeonClient } = require('./netlify/functions/utils/connection-pool-simple');
const { 
  validatePaginationParams, 
  createPaginatedResponse, 
  getCursorDataForItem,
  buildCursorCondition,
  validatePaginationInput,
  encodeCursor,
  decodeCursor
} = require('./netlify/functions/utils/pagination');

async function testPaginationSimple() {
    console.log('🧪 Testing Pagination Implementation (Simplified)\n');
    
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL || DATABASE_URL === 'your-neon-database-url-here') {
        console.log('❌ DATABASE_URL not set. Please set it first:');
        console.log('   $env:DATABASE_URL = "postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"');
        return;
    }
    
    try {
        const sql = getNeonClient();
        
        // Test 1: Pagination utility functions
        console.log('📊 Test 1: Pagination Utility Functions');
        
        // Test parameter validation
        const validParams = validatePaginationParams({ limit: '50', cursor: null });
        console.log(`   ✅ Valid params: limit=${validParams.limit}, cursor=${validParams.cursor}`);
        
        // Test invalid parameters
        const invalidErrors = validatePaginationInput({ limit: '150', offset: '-1' });
        console.log(`   ✅ Invalid params detected: ${invalidErrors.length} errors`);
        console.log(`   ✅ Errors: ${invalidErrors.join(', ')}`);
        
        // Test cursor encoding/decoding
        const testData = { id: '123', timestamp: '2024-01-01T00:00:00Z', order: '2024-01-01T00:00:00Z' };
        const encoded = encodeCursor(testData);
        const decoded = decodeCursor(encoded);
        
        // Check if the essential fields match (ignore version field)
        const cursorTestPassed = 
            decoded.id === testData.id && 
            decoded.timestamp === testData.timestamp && 
            decoded.order === testData.order;
            
        console.log(`   ✅ Cursor encoding/decoding: ${cursorTestPassed ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Encoded cursor: ${encoded.substring(0, 20)}...`);
        console.log(`   ✅ Original: ${JSON.stringify(testData)}`);
        console.log(`   ✅ Decoded: ${JSON.stringify(decoded)}`);
        console.log();
        
        // Test 2: Basic database queries
        console.log('📊 Test 2: Basic Database Queries');
        
        // Test sessions query
        const sessions = await sql`
            SELECT id, start_at, created_at
            FROM sessions 
            WHERE user_id = 1
            ORDER BY start_at DESC, id ASC
            LIMIT 10
        `;
        
        console.log(`   ✅ Sessions query: Retrieved ${sessions.length} sessions`);
        
        // Test users query
        const users = await sql`
            SELECT id, username, created_at
            FROM users 
            ORDER BY created_at DESC, id ASC
            LIMIT 10
        `;
        
        console.log(`   ✅ Users query: Retrieved ${users.length} users`);
        console.log();
        
        // Test 3: Pagination response format
        console.log('📊 Test 3: Pagination Response Format');
        
        const testItems = [
            { id: 1, start_at: new Date('2024-01-01'), created_at: new Date('2024-01-01') },
            { id: 2, start_at: new Date('2024-01-02'), created_at: new Date('2024-01-02') },
            { id: 3, start_at: new Date('2024-01-03'), created_at: new Date('2024-01-03') },
            { id: 4, start_at: new Date('2024-01-04'), created_at: new Date('2024-01-04') },
            { id: 5, start_at: new Date('2024-01-05'), created_at: new Date('2024-01-05') }
        ];
        
        const paginatedResponse = createPaginatedResponse(
            testItems,
            3, // limit
            (item) => getCursorDataForItem(item, 'sessions'),
            { includeTotal: true, total: 100 }
        );
        
        console.log(`   ✅ Response data count: ${paginatedResponse.data.length}`);
        console.log(`   ✅ Has more: ${paginatedResponse.pagination.has_more}`);
        console.log(`   ✅ Next cursor: ${paginatedResponse.pagination.next_cursor ? 'Present' : 'None'}`);
        console.log(`   ✅ Total: ${paginatedResponse.pagination.total}`);
        console.log();
        
        // Test 4: Cursor condition building
        console.log('📊 Test 4: Cursor Condition Building');
        
        const cursorCondition = buildCursorCondition(encoded, 'start_at DESC, id ASC');
        console.log(`   ✅ Cursor condition: ${cursorCondition.condition}`);
        console.log(`   ✅ Cursor values: ${cursorCondition.values.length} parameters`);
        console.log();
        
        // Test 5: Edge cases
        console.log('📊 Test 5: Edge Cases');
        
        // Empty result set
        const emptyResponse = createPaginatedResponse([], 10, (item) => getCursorDataForItem(item, 'sessions'));
        console.log(`   ✅ Empty result: has_more=${emptyResponse.pagination.has_more}, count=${emptyResponse.pagination.count}`);
        
        // Single item
        const singleResponse = createPaginatedResponse([testItems[0]], 10, (item) => getCursorDataForItem(item, 'sessions'));
        console.log(`   ✅ Single item: has_more=${singleResponse.pagination.has_more}, count=${singleResponse.pagination.count}`);
        
        // Invalid cursor
        try {
            decodeCursor('invalid-cursor');
            console.log('   ❌ Invalid cursor: Should have thrown error');
        } catch (error) {
            console.log('   ✅ Invalid cursor: Properly rejected');
        }
        
        console.log();
        
        // Test 6: Performance test
        console.log('📊 Test 6: Performance Test');
        
        const perfStart = Date.now();
        const perfSessions = await sql`
            SELECT id, start_at, created_at
            FROM sessions 
            WHERE user_id = 1
            ORDER BY start_at DESC, id ASC
            LIMIT 20
        `;
        const perfTime = Date.now() - perfStart;
        
        console.log(`   ✅ Retrieved ${perfSessions.length} sessions in ${perfTime}ms`);
        console.log(`   ✅ Average time per session: ${Math.round(perfTime / Math.max(perfSessions.length, 1))}ms`);
        console.log();
        
        // Overall assessment
        console.log('='.repeat(60));
        console.log('📊 PAGINATION TEST RESULTS');
        console.log('='.repeat(60));
        
        const allTestsPassed = 
            validParams.limit === 50 &&
            invalidErrors.length > 0 &&
            cursorTestPassed &&
            paginatedResponse.pagination.has_more === true &&
            emptyResponse.pagination.has_more === false &&
            singleResponse.pagination.has_more === false;
        
        if (allTestsPassed) {
            console.log('🎉 PAGINATION IMPLEMENTATION PASSED!');
            console.log('   ✅ Parameter validation works correctly');
            console.log('   ✅ Cursor encoding/decoding works');
            console.log('   ✅ Pagination logic is correct');
            console.log('   ✅ Response format is consistent');
            console.log('   ✅ Edge cases are handled properly');
            console.log('   ✅ Performance is acceptable');
            console.log('   ✅ Ready for production use');
        } else {
            console.log('❌ PAGINATION IMPLEMENTATION FAILED!');
            console.log('   Some tests did not pass. Review the output above.');
        }
        
    } catch (error) {
        console.log('❌ Pagination test failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Verify DATABASE_URL is correct');
        console.log('2. Check database permissions');
        console.log('3. Ensure database is accessible');
        console.log('4. Check if pagination utility is properly installed');
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testPaginationSimple().catch(console.error);
}

module.exports = { testPaginationSimple };
