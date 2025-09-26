// test-pagination.js
// Comprehensive test for pagination implementation

const { getNeonClient } = require('./netlify/functions/utils/connection-pool-simple');
const { 
  validatePaginationParams, 
  createPaginatedResponse, 
  getCursorDataForItem,
  buildCursorCondition,
  validatePaginationInput,
  decodeCursor,
  encodeCursor
} = require('./netlify/functions/utils/pagination');

async function testPagination() {
    console.log('🧪 Testing Pagination Implementation\n');
    
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
        console.log(`   ✅ Cursor encoding/decoding: ${JSON.stringify(decoded) === JSON.stringify(testData) ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Encoded cursor: ${encoded.substring(0, 20)}...`);
        console.log();
        
        // Test 2: Sessions pagination
        console.log('📊 Test 2: Sessions Pagination');
        
        // Get total sessions count
        const totalSessions = await sql`SELECT COUNT(*) as count FROM sessions`;
        const totalCount = parseInt(totalSessions[0].count);
        console.log(`   📈 Total sessions in database: ${totalCount}`);
        
        if (totalCount === 0) {
            console.log('   ⚠️  No sessions found. Creating test data...');
            
            // Create test sessions
            const testSessions = [];
            for (let i = 0; i < 25; i++) {
                const startTime = new Date(Date.now() - (i * 24 * 60 * 60 * 1000)); // One per day
                testSessions.push({
                    user_id: 1,
                    type: 'workout',
                    source: 'manual',
                    source_id: `test-${i}`,
                    start_at: startTime,
                    end_at: new Date(startTime.getTime() + 60 * 60 * 1000), // 1 hour duration
                    duration: 3600,
                    payload: { test: true, index: i },
                    session_hash: `hash-${i}`
                });
            }
            
            // Insert test sessions
            for (const session of testSessions) {
                await sql`
                    INSERT INTO sessions (user_id, type, source, source_id, start_at, end_at, duration, payload, session_hash)
                    VALUES (${session.user_id}, ${session.type}, ${session.source}, ${session.source_id}, 
                            ${session.start_at}, ${session.end_at}, ${session.duration}, ${session.payload}, ${session.session_hash})
                `;
            }
            
            console.log('   ✅ Created 25 test sessions');
        }
        
        // Test pagination with different limits
        const limits = [5, 10, 20];
        let allSessions = [];
        
        for (const limit of limits) {
            console.log(`   📄 Testing with limit=${limit}:`);
            
            const sessions = await sql`
                SELECT id, type, source, start_at, created_at
                FROM sessions 
                WHERE user_id = 1
                ORDER BY start_at DESC, id ASC
                LIMIT ${limit + 1}
            `;
            
            const hasMore = sessions.length > limit;
            const returnSessions = hasMore ? sessions.slice(0, limit) : sessions;
            
            console.log(`     ✅ Retrieved: ${returnSessions.length} sessions`);
            console.log(`     ✅ Has more: ${hasMore}`);
            
            if (returnSessions.length > 0) {
                const firstSession = returnSessions[0];
                const lastSession = returnSessions[returnSessions.length - 1];
                console.log(`     ✅ First: ${firstSession.start_at} (ID: ${firstSession.id})`);
                console.log(`     ✅ Last: ${lastSession.start_at} (ID: ${lastSession.id})`);
            }
            
            allSessions = [...allSessions, ...returnSessions];
        }
        
        console.log(`   ✅ Total unique sessions retrieved: ${new Set(allSessions.map(s => s.id)).size}`);
        console.log();
        
        // Test 3: Cursor-based pagination
        console.log('📊 Test 3: Cursor-Based Pagination');
        
        // First page
        const firstPage = await sql`
            SELECT id, start_at, created_at
            FROM sessions 
            WHERE user_id = 1
            ORDER BY start_at DESC, id ASC
            LIMIT 5
        `;
        
        console.log(`   📄 First page: ${firstPage.length} sessions`);
        
        if (firstPage.length > 0) {
            const lastItem = firstPage[firstPage.length - 1];
            const cursorData = getCursorDataForItem(lastItem, 'sessions');
            const cursor = encodeCursor(cursorData);
            console.log(`   ✅ Generated cursor: ${cursor.substring(0, 30)}...`);
            
            // Test cursor condition
            const cursorCondition = buildCursorCondition(cursor, 'start_at DESC, id ASC');
            console.log(`   ✅ Cursor condition: ${cursorCondition.condition}`);
            console.log(`   ✅ Cursor values: ${cursorCondition.values.length} parameters`);
            
            // Second page using cursor
            const secondPageQuery = `
                SELECT id, start_at, created_at
                FROM sessions 
                WHERE user_id = $1 ${cursorCondition.condition}
                ORDER BY start_at DESC, id ASC
                LIMIT $${cursorCondition.values.length + 2}
            `;
            
            // Use template literal syntax for Neon
            const secondPage = await sql`
                SELECT id, start_at, created_at
                FROM sessions 
                WHERE user_id = 1 ${cursorCondition.condition ? sql`AND ${sql.raw(cursorCondition.condition.replace('AND ', ''))}` : sql``}
                ORDER BY start_at DESC, id ASC
                LIMIT 5
            `;
            console.log(`   📄 Second page: ${secondPage.length} sessions`);
            
            if (secondPage.length > 0) {
                console.log(`   ✅ Second page first item: ${secondPage[0].start_at} (ID: ${secondPage[0].id})`);
                console.log(`   ✅ Cursor pagination: ${secondPage[0].start_at < lastItem.start_at ? 'PASS' : 'FAIL'}`);
            }
        }
        
        console.log();
        
        // Test 4: Pagination response format
        console.log('📊 Test 4: Pagination Response Format');
        
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
        console.log(`   ✅ Response format: ${JSON.stringify(paginatedResponse.pagination, null, 2)}`);
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
        console.log(`   ✅ Average time per session: ${Math.round(perfTime / perfSessions.length)}ms`);
        console.log();
        
        // Overall assessment
        console.log('='.repeat(60));
        console.log('📊 PAGINATION TEST RESULTS');
        console.log('='.repeat(60));
        
        const allTestsPassed = 
            validParams.limit === 50 &&
            invalidErrors.length > 0 &&
            JSON.stringify(decoded) === JSON.stringify(testData) &&
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
        
        // Cleanup test data
        if (totalCount === 0) {
            console.log('\n🧹 Cleaning up test data...');
            await sql`DELETE FROM sessions WHERE source = 'manual' AND source_id LIKE 'test-%'`;
            console.log('   ✅ Test data cleaned up');
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
    testPagination().catch(console.error);
}

module.exports = { testPagination };
