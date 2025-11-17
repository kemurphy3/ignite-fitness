// test-index-performance.js
const { neon } = require('@neondatabase/serverless');

async function testIndexPerformance() {
  console.log('🔍 Testing Database Index Performance\n');

  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL || DATABASE_URL === 'your-neon-database-url-here') {
    console.log('❌ DATABASE_URL not set. Please set it first:');
    console.log(
      '   $env:DATABASE_URL = "postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"'
    );
    return;
  }

  try {
    const sql = neon(DATABASE_URL);

    // Test 1: User sessions query (most common)
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
    console.log(
      `💾 Buffers: ${sessionsResult['Shared Hit Blocks']} hit, ${sessionsResult['Shared Read Blocks']} read`
    );
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
    console.log(
      `💾 Buffers: ${exercisesResult['Shared Hit Blocks']} hit, ${exercisesResult['Shared Read Blocks']} read`
    );
    console.log('');

    // Test 3: User lookup by external_id
    console.log('📊 Test 3: User Lookup by External ID');
    console.log("Query: SELECT * FROM users WHERE external_id = 'test-user'");

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
    console.log(
      `💾 Buffers: ${userResult['Shared Hit Blocks']} hit, ${userResult['Shared Read Blocks']} read`
    );
    console.log('');

    // Test 4: Admin analytics query
    console.log('📊 Test 4: Admin Analytics Query');
    console.log(
      "Query: SELECT COUNT(*) FROM sessions WHERE created_at >= NOW() - INTERVAL '30 days'"
    );

    const adminPlan = await sql`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT COUNT(*) FROM sessions 
            WHERE created_at >= NOW() - INTERVAL '30 days'
        `;

    const adminResult = adminPlan[0]['QUERY PLAN'][0];
    console.log(`⏱️  Execution Time: ${adminResult['Execution Time']}ms`);
    console.log(`📈 Planning Time: ${adminResult['Planning Time']}ms`);
    console.log(`🔍 Index Used: ${adminResult['Index Name'] || 'None'}`);
    console.log(`📊 Rows Examined: ${adminResult['Actual Rows']}`);
    console.log(
      `💾 Buffers: ${adminResult['Shared Hit Blocks']} hit, ${adminResult['Shared Read Blocks']} read`
    );
    console.log('');

    // Test 5: Sleep sessions query
    console.log('📊 Test 5: Sleep Sessions Query');
    console.log('Query: SELECT * FROM sleep_sessions WHERE user_id = 1 ORDER BY start_at DESC');

    const sleepPlan = await sql`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM sleep_sessions 
            WHERE user_id = 1 
            ORDER BY start_at DESC 
            LIMIT 10
        `;

    const sleepResult = sleepPlan[0]['QUERY PLAN'][0];
    console.log(`⏱️  Execution Time: ${sleepResult['Execution Time']}ms`);
    console.log(`📈 Planning Time: ${sleepResult['Planning Time']}ms`);
    console.log(`🔍 Index Used: ${sleepResult['Index Name'] || 'None'}`);
    console.log(`📊 Rows Examined: ${sleepResult['Actual Rows']}`);
    console.log(
      `💾 Buffers: ${sleepResult['Shared Hit Blocks']} hit, ${sleepResult['Shared Read Blocks']} read`
    );
    console.log('');

    // Test 6: Strava activities query
    console.log('📊 Test 6: Strava Activities Query');
    console.log(
      'Query: SELECT * FROM strava_activities WHERE user_id = 1 ORDER BY start_date DESC'
    );

    const stravaPlan = await sql`
            EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT * FROM strava_activities 
            WHERE user_id = 1 
            ORDER BY start_date DESC 
            LIMIT 10
        `;

    const stravaResult = stravaPlan[0]['QUERY PLAN'][0];
    console.log(`⏱️  Execution Time: ${stravaResult['Execution Time']}ms`);
    console.log(`📈 Planning Time: ${stravaResult['Planning Time']}ms`);
    console.log(`🔍 Index Used: ${stravaResult['Index Name'] || 'None'}`);
    console.log(`📊 Rows Examined: ${stravaResult['Actual Rows']}`);
    console.log(
      `💾 Buffers: ${stravaResult['Shared Hit Blocks']} hit, ${stravaResult['Shared Read Blocks']} read`
    );
    console.log('');

    // Summary
    console.log('='.repeat(60));
    console.log('📊 PERFORMANCE TEST SUMMARY');
    console.log('='.repeat(60));

    const totalExecutionTime =
      sessionsResult['Execution Time'] +
      exercisesResult['Execution Time'] +
      userResult['Execution Time'] +
      adminResult['Execution Time'] +
      sleepResult['Execution Time'] +
      stravaResult['Execution Time'];

    console.log(`⏱️  Total Execution Time: ${totalExecutionTime}ms`);
    console.log(`📈 Average Execution Time: ${Math.round(totalExecutionTime / 6)}ms`);

    // Check if indexes are being used
    const indexesUsed = [
      sessionsResult['Index Name'],
      exercisesResult['Index Name'],
      userResult['Index Name'],
      adminResult['Index Name'],
      sleepResult['Index Name'],
      stravaResult['Index Name'],
    ].filter(name => name && name !== 'None').length;

    console.log(`🔍 Indexes Used: ${indexesUsed}/6 queries`);
    console.log(`📊 Index Usage Rate: ${Math.round((indexesUsed / 6) * 100)}%`);

    if (indexesUsed >= 4) {
      console.log('\n✅ EXCELLENT! Most queries are using indexes.');
    } else if (indexesUsed >= 2) {
      console.log("\n⚠️  GOOD! Some queries are using indexes, but there's room for improvement.");
    } else {
      console.log('\n❌ POOR! Most queries are not using indexes. Check your index migration.');
    }

    console.log('\n💡 Next Steps:');
    console.log('1. Run "node run-index-migration.js" to create missing indexes');
    console.log('2. Monitor index usage with: SELECT * FROM index_usage_stats;');
    console.log('3. Validate performance with: SELECT * FROM validate_index_performance();');
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
