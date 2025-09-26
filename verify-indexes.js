// verify-indexes.js
const { neon } = require('@neondatabase/serverless');

async function verifyIndexes() {
    console.log('🔍 Verifying Database Indexes\n');
    
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL || DATABASE_URL === 'your-neon-database-url-here') {
        console.log('❌ DATABASE_URL not set. Please set it first:');
        console.log('   $env:DATABASE_URL = "postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"');
        return;
    }
    
    try {
        const sql = neon(DATABASE_URL);
        
        // Check if indexes exist
        console.log('📊 Checking Index Status...');
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
        
        console.log(`📋 Found ${indexCheck.length} indexes:\n`);
        
        const indexesByTable = {};
        indexCheck.forEach(idx => {
            if (!indexesByTable[idx.tablename]) {
                indexesByTable[idx.tablename] = [];
            }
            indexesByTable[idx.tablename].push(idx.indexname);
        });
        
        Object.keys(indexesByTable).forEach(table => {
            console.log(`📊 ${table}:`);
            indexesByTable[table].forEach(indexName => {
                console.log(`   ✅ ${indexName}`);
            });
            console.log('');
        });
        
        // Check table row counts
        console.log('📊 Table Row Counts:');
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
        
        tableCounts.forEach(row => {
            console.log(`   ${row.table_name}: ${row.count} rows`);
        });
        console.log('');
        
        // Check index usage statistics
        console.log('📊 Index Usage Statistics:');
        const usageStats = await sql`
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan,
                idx_tup_read,
                idx_tup_fetch
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            AND indexname LIKE 'idx_%'
            ORDER BY idx_scan DESC
        `;
        
        if (usageStats.length > 0) {
            usageStats.forEach(stat => {
                console.log(`   ${stat.tablename}.${stat.indexname}: ${stat.idx_scan} scans, ${stat.idx_tup_read} tuples read`);
            });
        } else {
            console.log('   No usage statistics available yet (indexes may not have been used)');
        }
        
        console.log('\n✅ Index verification complete!');
        
        if (indexCheck.length >= 16) {
            console.log('🎉 All critical indexes are present!');
        } else {
            console.log(`⚠️  Expected 16+ indexes, found ${indexCheck.length}. Some may be missing.`);
        }
        
    } catch (error) {
        console.log('❌ Index verification failed:', error.message);
    }
}

// Run verification if this file is executed directly
if (require.main === module) {
    verifyIndexes().catch(console.error);
}

module.exports = { verifyIndexes };
