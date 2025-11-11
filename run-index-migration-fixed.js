// run-index-migration-fixed.js
const { neon } = require('@neondatabase/serverless');

async function runIndexMigration() {
  console.log('🚀 Running Database Index Optimization Migration (Fixed Version)\n');

  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL || DATABASE_URL === 'your-neon-database-url-here') {
    console.log('❌ DATABASE_URL not set or is placeholder. Please set it first:');
    console.log(
      '   $env:DATABASE_URL = "postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"'
    );
    return;
  }

  try {
    const sql = neon(DATABASE_URL);

    // Critical indexes - using direct SQL execution
    const indexes = [
      // Sessions table - most critical
      () =>
        sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_start_desc ON sessions(user_id, start_at DESC)`,
      () => sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_type ON sessions(user_id, type)`,
      () =>
        sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_source ON sessions(user_id, source, source_id) WHERE source_id IS NOT NULL`,
      () => sql`CREATE INDEX IF NOT EXISTS idx_sessions_start_at_type ON sessions(start_at, type)`,
      () => sql`CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)`,

      // Exercises table
      () => sql`CREATE INDEX IF NOT EXISTS idx_exercises_session_id ON exercises(session_id, id)`,
      () =>
        sql`CREATE INDEX IF NOT EXISTS idx_exercises_user_session ON exercises(user_id, session_id)`,
      () => sql`CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name)`,
      () => sql`CREATE INDEX IF NOT EXISTS idx_exercises_created_at ON exercises(created_at)`,

      // Users table
      () => sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
      () => sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      () => sql`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`,

      // Sleep sessions
      () =>
        sql`CREATE INDEX IF NOT EXISTS idx_sleep_sessions_user_start_desc ON sleep_sessions(user_id, start_at DESC)`,

      // Strava activities
      () =>
        sql`CREATE INDEX IF NOT EXISTS idx_strava_activities_user_start_desc ON strava_activities(user_id, start_date DESC)`,
      () => sql`CREATE INDEX IF NOT EXISTS idx_strava_activities_type ON strava_activities(type)`,

      // User preferences
      () =>
        sql`CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)`,
    ];

    console.log(`📝 Found ${indexes.length} critical indexes to create\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < indexes.length; i++) {
      const indexFunction = indexes[i];
      const indexName = `idx_${i + 1}`;

      try {
        console.log(`Creating index ${i + 1}/${indexes.length}...`);
        await indexFunction();
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

    // Update statistics
    console.log('\n📊 Updating table statistics...');
    try {
      await sql`ANALYZE users`;
      await sql`ANALYZE sessions`;
      await sql`ANALYZE exercises`;
      await sql`ANALYZE sleep_sessions`;
      await sql`ANALYZE strava_activities`;
      await sql`ANALYZE user_preferences`;
      console.log('✅ Statistics updated');
    } catch (error) {
      console.log(`⚠️  Statistics update failed: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(
      `📈 Success Rate: ${Math.round((successCount / (successCount + errorCount)) * 100)}%`
    );

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
