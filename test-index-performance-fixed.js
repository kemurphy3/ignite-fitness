// test-index-performance-fixed.js
const { neon } = require('@neondatabase/serverless');

async function testIndexPerformance() {
    console.log('🔍 Testing Database Index Performance (Fixed Version)\n');
    
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL || DATABASE_URL === 'your-neon-database-url-here') {
        console.log('❌ DATABASE_URL not set. Please set it first:');
        console.log('   $env:DATABASE_URL = "postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"');
        return;
    }
    
    try {
        const sql = neon(DATABASE_URL);
        
        // First, check if we have any data
        console.log('📊 Checking Database Status...');
        
        const tableCounts = await sql`
            SELECT 
                'users' as table_name, COUNT(*) as count FROM users
            UNION ALL
            SELECT 'sessions', COUNT(*) FROM sessions
            UNION ALL
            SELECT 'exercises', COUNT(*) FROM exercises
            UNION ALL
            SELECT 'sleep_sessions', COUNT(*) FROM sleep_sessions
            UNION ALL
            SELECT 'strava_activities', COUNT(*) FROM strava_activities
            UNION ALL
            SELECT 'user_preferences', COUNT(*) FROM user_preferences
        `;
        
        console.log('📋 Table Row Counts:');
        tableCounts.forEach(row => {
            console.log(`   ${row.table_name}: ${row.count} rows`);
        });
        console.log('');
        
        // Check if indexes exist
        console.log('🔍 Checking Index Status...');
        const indexCheck = await sql`
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname LIKE 'idx_%'
            ORDER BY tablename, indexname
        `;
        
        console.log(`📊 Found ${indexCheck.length} indexes:`);
        indexCheck.forEach(idx => {
            console.log(`   ✅ ${idx.tablename}.${idx.indexname}`);
        });
        console.log('');
        
        // If no data, create some test data
        if (tableCounts.every(row => row.count === 0)) {
            console.log('⚠️  No test data found. Creating sample data for testing...');
            
            try {
                // Create a test user
                await sql`INSERT INTO users (external_id, username, email) VALUES ('test-user', 'testuser', 'test@example.com') ON CONFLICT (external_id) DO NOTHING`;
                
                // Create some test sessions
                await sql`
                    INSERT INTO sessions (user_id, type, source, start_at, end_at) 
                    VALUES 
                        (1, 'workout', 'manual', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '1 hour'),
                        (1, 'workout', 'manual', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes'),
                        (1, 'soccer', 'manual', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '90 minutes')
                    ON CONFLICT DO NOTHING
                `;
                
                // Create some test exercises
                await sql`
                    INSERT INTO exercises (user_id, session_id, name, weight, reps, sets) 
                    VALUES 
                        (1, 1, 'Bench Press', 135, 10, 3),
                        (1, 1, 'Squat', 185, 8, 3),
                        (1, 2, 'Deadlift', 225, 5, 3)
                    ON CONFLICT DO NOTHING
                `;
                
                console.log('✅ Test data created successfully');
            } catch (error) {
                console.log(`⚠️  Could not create test data: ${error.message}`);
            }
        }
        
        // Now run performance tests
        console.log('\n📊 Running Performance Tests...\n');
        
        // Test 1: User sessions query
        console.log('📊 Test 1: User Sessions Query');
        console.log('Query: SELECT * FROM sessions WHERE user_id = 1 ORDER BY start_at DESC');
        
        const sessionsPlan = await sql`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM sessions 
            WHERE user_id = 1 
            ORDER BY start_at DESC 
            LIMIT 10
        `;
        
        const sessionsResult = sessionsPlan[0]['QUERY PLAN'][0];
        console.log(`⏱️  Execution Time: ${sessionsResult['Execution Time']}ms`);
        console.log(`📈 Planning Time: ${sessionsResult['Planning Time']}ms`);
        console.log(`🔍 Index Used: ${sessionsResult['Index Name'] || 'None'}`);
        console.log(`📊 Rows Examined: ${sessionsResult['Actual Rows']}`);
        console.log(`💾 Buffers: ${sessionsResult['Shared Hit Blocks'] || 0} hit, ${sessionsResult['Shared Read Blocks'] || 0} read`);
        console.log('');
        
        // Test 2: Session exercises query
        console.log('📊 Test 2: Session Exercises Query');
        console.log('Query: SELECT * FROM exercises WHERE session_id = 1 ORDER BY id');
        
        const exercisesPlan = await sql`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM exercises 
            WHERE session_id = 1 
            ORDER BY id 
            LIMIT 10
        `;
        
        const exercisesResult = exercisesPlan[0]['QUERY PLAN'][0];
        console.log(`⏱️  Execution Time: ${exercisesResult['Execution Time']}ms`);
        console.log(`📈 Planning Time: ${exercisesResult['Planning Time']}ms`);
        console.log(`🔍 Index Used: ${exercisesResult['Index Name'] || 'None'}`);
        console.log(`📊 Rows Examined: ${exercisesResult['Actual Rows']}`);
        console.log(`💾 Buffers: ${exercisesResult['Shared Hit Blocks'] || 0} hit, ${exercisesResult['Shared Read Blocks'] || 0} read`);
        console.log('');
        
        // Test 3: User lookup by external_id
        console.log('📊 Test 3: User Lookup by External ID');
        console.log('Query: SELECT * FROM users WHERE external_id = \'test-user\'');
        
        const userPlan = await sql`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM users 
            WHERE external_id = 'test-user'
        `;
        
        const userResult = userPlan[0]['QUERY PLAN'][0];
        console.log(`⏱️  Execution Time: ${userResult['Execution Time']}ms`);
        console.log(`📈 Planning Time: ${userResult['Planning Time']}ms`);
        console.log(`🔍 Index Used: ${userResult['Index Name'] || 'None'}`);
        console.log(`📊 Rows Examined: ${userResult['Actual Rows']}`);
        console.log(`💾 Buffers: ${userResult['Shared Hit Blocks'] || 0} hit, ${userResult['Shared Read Blocks'] || 0} read`);
        console.log('');
        
        // Summary
        console.log('='.repeat(60));
        console.log('📊 PERFORMANCE TEST SUMMARY');
        console.log('='.repeat(60));
        
        const totalExecutionTime = sessionsResult['Execution Time'] + 
                                 exercisesResult['Execution Time'] + 
                                 userResult['Execution Time'];
        
        console.log(`⏱️  Total Execution Time: ${totalExecutionTime}ms`);
        console.log(`📈 Average Execution Time: ${Math.round(totalExecutionTime / 3)}ms`);
        
        // Check if indexes are being used
        const indexesUsed = [
            sessionsResult['Index Name'],
            exercisesResult['Index Name'],
            userResult['Index Name']
        ].filter(name => name && name !== 'None').length;
        
        console.log(`🔍 Indexes Used: ${indexesUsed}/3 queries`);
        console.log(`📊 Index Usage Rate: ${Math.round((indexesUsed / 3) * 100)}%`);
        
        if (indexesUsed >= 2) {
            console.log('\n✅ EXCELLENT! Most queries are using indexes.');
        } else if (indexesUsed >= 1) {
            console.log('\n⚠️  GOOD! Some queries are using indexes, but there\'s room for improvement.');
        } else {
            console.log('\n❌ POOR! Most queries are not using indexes. This might be due to:');
            console.log('   1. Very small dataset (PostgreSQL may choose sequential scan)');
            console.log('   2. Indexes not created properly');
            console.log('   3. Query patterns not matching index patterns');
        }
        
        console.log('\n💡 Next Steps:');
        console.log('1. Check index usage: SELECT * FROM pg_stat_user_indexes WHERE schemaname = \'public\';');
        console.log('2. Verify indexes exist: SELECT indexname FROM pg_indexes WHERE schemaname = \'public\';');
        console.log('3. Test with more data for better index utilization');
        
    } catch (error) {
        console.log('❌ Performance test failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Verify DATABASE_URL is correct');
        console.log('2. Check database permissions');
        console.log('3. Ensure database is accessible');
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testIndexPerformance().catch(console.error);
}

module.exports = { testIndexPerformance };
