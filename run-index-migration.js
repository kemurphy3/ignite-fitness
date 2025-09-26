// run-index-migration.js
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

async function runIndexMigration() {
    console.log('🚀 Running Database Index Optimization Migration\n');
    
    const DATABASE_URL = process.env.DATABASE_URL;
    
    if (!DATABASE_URL || DATABASE_URL === 'your-neon-database-url-here') {
        console.log('❌ DATABASE_URL not set or is placeholder. Please set it first:');
        console.log('   $env:DATABASE_URL = "postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"');
        return;
    }
    
    try {
        const sql = neon(DATABASE_URL);
        
        // Read the migration file
        const migrationSQL = fs.readFileSync('database-index-optimization.sql', 'utf8');
        
        // Split into individual statements more carefully
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'))
            .filter(stmt => !stmt.includes('$$') || stmt.includes('CREATE OR REPLACE FUNCTION'))
            .filter(stmt => stmt.length > 0 && !stmt.includes('SELECT') || stmt.includes('CREATE INDEX'));
        
        console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.length === 0) continue;
            
            try {
                console.log(`Executing statement ${i + 1}/${statements.length}...`);
                console.log(`SQL: ${statement.substring(0, 100)}...`);
                
                // Use raw SQL execution with template literals
                await sql`${statement}`;
                successCount++;
                console.log(`✅ Success`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`⚠️  Index already exists (skipping)`);
                    successCount++;
                } else {
                    console.log(`❌ Error: ${error.message}`);
                    errorCount++;
                }
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 MIGRATION RESULTS');
        console.log('='.repeat(50));
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📈 Success Rate: ${Math.round((successCount / (successCount + errorCount)) * 100)}%`);
        
        if (errorCount === 0) {
            console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
            console.log('   Database indexes have been optimized.');
            console.log('   Run "node test-index-performance.js" to verify performance improvements.');
        } else {
            console.log(`\n⚠️  Migration completed with ${errorCount} errors.`);
            console.log('   Some indexes may already exist or there may be permission issues.');
        }
        
    } catch (error) {
        console.log('❌ Migration failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Verify DATABASE_URL is correct');
        console.log('2. Check database permissions');
        console.log('3. Ensure database is accessible');
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    runIndexMigration().catch(console.error);
}

module.exports = { runIndexMigration };
