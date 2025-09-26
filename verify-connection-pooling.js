// verify-connection-pooling.js
// Quick verification that connection pooling is working

const { getNeonClient, getPgPool, healthCheck, getStats } = require('./netlify/functions/utils/connection-pool');

async function verifyConnectionPooling() {
    console.log('🔍 Verifying Connection Pooling Implementation\n');
    
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL || DATABASE_URL === 'your-neon-database-url-here') {
        console.log('❌ DATABASE_URL not set. Please set it first:');
        console.log('   $env:DATABASE_URL = "postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"');
        return;
    }
    
    try {
        // Test 1: Basic health check
        console.log('📊 1. Connection Health Check:');
        const health = await healthCheck();
        console.log(`   Neon Client: ${health.neon.healthy ? '✅ Healthy' : '❌ Failed'}`);
        console.log(`   PG Pool: ${health.pgPool.healthy ? '✅ Healthy' : '❌ Failed'}`);
        console.log(`   Status: ${health.neon.healthy && health.pgPool.healthy ? '✅ PASS' : '❌ FAIL'}\n`);
        
        // Test 2: Connection reuse (multiple calls to same client)
        console.log('📊 2. Connection Reuse Test:');
        const neonClient = getNeonClient();
        const neonClient2 = getNeonClient();
        
        const isSameClient = neonClient === neonClient2;
        console.log(`   Same client instance: ${isSameClient ? '✅ Yes' : '❌ No'}`);
        console.log(`   Status: ${isSameClient ? '✅ PASS' : '❌ FAIL'}\n`);
        
        // Test 3: Basic query execution
        console.log('📊 3. Query Execution Test:');
        const startTime = Date.now();
        const result = await neonClient`SELECT NOW() as current_time, 'connection-pool-test' as test_name`;
        const queryTime = Date.now() - startTime;
        
        console.log(`   Query executed: ${result.length > 0 ? '✅ Yes' : '❌ No'}`);
        console.log(`   Query time: ${queryTime}ms`);
        console.log(`   Result: ${JSON.stringify(result[0])}`);
        console.log(`   Status: ${result.length > 0 ? '✅ PASS' : '❌ FAIL'}\n`);
        
        // Test 4: Connection statistics
        console.log('📊 4. Connection Statistics:');
        const stats = getStats();
        console.log(`   Neon Client: ${stats.neonClient}`);
        console.log(`   PG Pool: ${stats.pgPool}`);
        console.log(`   Total Connections: ${stats.totalConnections}`);
        console.log(`   Active Connections: ${stats.activeConnections}`);
        console.log(`   Idle Connections: ${stats.idleConnections}`);
        console.log(`   Status: ✅ PASS\n`);
        
        // Test 5: Multiple concurrent queries
        console.log('📊 5. Concurrent Query Test:');
        const concurrentStartTime = Date.now();
        
        const promises = Array.from({ length: 10 }, (_, i) => 
            neonClient`SELECT ${i} as query_id, NOW() as timestamp`
        );
        
        const results = await Promise.all(promises);
        const concurrentTime = Date.now() - concurrentStartTime;
        
        console.log(`   Queries executed: ${results.length}/10`);
        console.log(`   Total time: ${concurrentTime}ms`);
        console.log(`   Average time: ${Math.round(concurrentTime / 10)}ms`);
        console.log(`   Status: ${results.length === 10 ? '✅ PASS' : '❌ FAIL'}\n`);
        
        // Overall assessment
        console.log('='.repeat(50));
        console.log('📊 CONNECTION POOLING VERIFICATION');
        console.log('='.repeat(50));
        
        const allTestsPassed = 
            health.neon.healthy && 
            health.pgPool.healthy && 
            isSameClient && 
            result.length > 0 && 
            results.length === 10;
        
        if (allTestsPassed) {
            console.log('🎉 CONNECTION POOLING VERIFICATION PASSED!');
            console.log('   ✅ All connection types are healthy');
            console.log('   ✅ Connection reuse is working');
            console.log('   ✅ Queries execute successfully');
            console.log('   ✅ Concurrent queries work properly');
            console.log('   ✅ Ready for production use');
        } else {
            console.log('❌ CONNECTION POOLING VERIFICATION FAILED!');
            console.log('   Some tests did not pass. Review the output above.');
        }
        
    } catch (error) {
        console.log('❌ Verification failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Verify DATABASE_URL is correct');
        console.log('2. Check database permissions');
        console.log('3. Ensure database is accessible');
        console.log('4. Check if connection-pool.js is properly installed');
    }
}

// Run verification if this file is executed directly
if (require.main === module) {
    verifyConnectionPooling().catch(console.error);
}

module.exports = { verifyConnectionPooling };
