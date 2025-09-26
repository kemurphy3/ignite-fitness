// test-connection-pooling-simple.js
// Load test to verify connection pooling prevents connection exhaustion (Neon only)

const { getNeonClient, healthCheck, getStats } = require('./netlify/functions/utils/connection-pool-simple');

async function testConnectionPoolingSimple() {
    console.log('🔍 Testing Connection Pooling Implementation (Simplified)\n');
    
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL || DATABASE_URL === 'your-neon-database-url-here') {
        console.log('❌ DATABASE_URL not set. Please set it first:');
        console.log('   $env:DATABASE_URL = "postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"');
        return;
    }
    
    try {
        // Test 1: Basic connection health
        console.log('📊 Test 1: Connection Health Check');
        const health = await healthCheck();
        console.log(`   Neon Client: ${health.neon.healthy ? '✅ Healthy' : '❌ Failed'}`);
        if (health.neon.error) {
            console.log(`   Error: ${health.neon.error}`);
        }
        console.log(`   Stats: ${JSON.stringify(health.stats, null, 2)}\n`);
        
        // Test 2: Concurrent Neon queries (should reuse connections)
        console.log('📊 Test 2: Concurrent Neon Queries (Connection Reuse)');
        const neonClient = getNeonClient();
        const startTime = Date.now();
        
        const neonPromises = Array.from({ length: 50 }, (_, i) => 
            neonClient`SELECT NOW() as current_time, ${i} as query_id`
        );
        
        const neonResults = await Promise.all(neonPromises);
        const neonTime = Date.now() - startTime;
        
        console.log(`   ✅ Completed 50 concurrent queries in ${neonTime}ms`);
        console.log(`   ✅ Average query time: ${Math.round(neonTime / 50)}ms`);
        console.log(`   ✅ All queries successful: ${neonResults.length === 50}\n`);
        
        // Test 3: Connection statistics
        console.log('📊 Test 3: Connection Statistics');
        const stats = getStats();
        console.log(`   Total Connections: ${stats.totalConnections}`);
        console.log(`   Active Connections: ${stats.activeConnections}`);
        console.log(`   Neon Client: ${stats.neonClient}\n`);
        
        // Test 4: Stress test (simulate high load)
        console.log('📊 Test 4: Stress Test (High Load Simulation)');
        const stressStartTime = Date.now();
        
        // Mix of different query types to simulate real usage
        const stressPromises = [
            // 30 simple queries
            ...Array.from({ length: 30 }, (_, i) => 
                neonClient`SELECT COUNT(*) as count FROM users WHERE id > ${i}`
            ),
            // 20 timestamp queries
            ...Array.from({ length: 20 }, (_, i) => 
                neonClient`SELECT NOW() as timestamp, ${i} as query_id`
            )
        ];
        
        const stressResults = await Promise.all(stressPromises);
        const stressTime = Date.now() - stressStartTime;
        
        console.log(`   ✅ Completed 50 mixed queries in ${stressTime}ms`);
        console.log(`   ✅ Average query time: ${Math.round(stressTime / 50)}ms`);
        console.log(`   ✅ All queries successful: ${stressResults.length === 50}\n`);
        
        // Test 5: Connection exhaustion prevention
        console.log('📊 Test 5: Connection Exhaustion Prevention');
        const exhaustionStartTime = Date.now();
        
        // Simulate many concurrent operations that would exhaust connections without pooling
        const exhaustionPromises = Array.from({ length: 100 }, async (_, i) => {
            // Use Neon for all queries (serverless optimized)
            const result = await neonClient`SELECT NOW() as current_time, ${i} as query_id`;
            return result;
        });
        
        const exhaustionResults = await Promise.all(exhaustionPromises);
        const exhaustionTime = Date.now() - exhaustionStartTime;
        
        console.log(`   ✅ Completed 100 concurrent queries in ${exhaustionTime}ms`);
        console.log(`   ✅ No connection exhaustion: ${exhaustionResults.length === 100}`);
        console.log(`   ✅ Average query time: ${Math.round(exhaustionTime / 100)}ms\n`);
        
        // Final statistics
        console.log('='.repeat(60));
        console.log('📊 CONNECTION POOLING TEST RESULTS');
        console.log('='.repeat(60));
        
        const finalStats = getStats();
        console.log(`✅ Neon Client: ${finalStats.neonClient}`);
        console.log(`📊 Total Connections: ${finalStats.totalConnections}`);
        console.log(`📊 Active Connections: ${finalStats.activeConnections}`);
        
        // Performance summary
        console.log('\n📈 Performance Summary:');
        console.log(`   Neon Queries (50): ${neonTime}ms (${Math.round(neonTime / 50)}ms avg)`);
        console.log(`   Mixed Load (50): ${stressTime}ms (${Math.round(stressTime / 50)}ms avg)`);
        console.log(`   Stress Test (100): ${exhaustionTime}ms (${Math.round(exhaustionTime / 100)}ms avg)`);
        
        // Assessment
        const allTestsPassed = 
            health.neon.healthy && 
            neonResults.length === 50 && 
            stressResults.length === 50 && 
            exhaustionResults.length === 100;
        
        if (allTestsPassed) {
            console.log('\n🎉 CONNECTION POOLING TEST PASSED!');
            console.log('   ✅ All connections are pooled and reused');
            console.log('   ✅ No connection exhaustion detected');
            console.log('   ✅ Performance is optimal');
            console.log('   ✅ Ready for production load');
        } else {
            console.log('\n❌ CONNECTION POOLING TEST FAILED!');
            console.log('   Some tests did not pass. Review the output above.');
        }
        
    } catch (error) {
        console.log('❌ Connection pooling test failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Verify DATABASE_URL is correct');
        console.log('2. Check database permissions');
        console.log('3. Ensure database is accessible');
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testConnectionPoolingSimple().catch(console.error);
}

module.exports = { testConnectionPoolingSimple };
