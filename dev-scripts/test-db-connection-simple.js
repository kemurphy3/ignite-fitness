/**
 * Simple Database Connection Test
 *
 * Tests if the database is accessible and has the required tables.
 */

const { neon } = require('@neondatabase/serverless');

async function testDatabaseConnection() {
  console.log('🔍 Testing Database Connection\n');

  try {
    const sql = neon(process.env.DATABASE_URL);
    console.log('✅ Neon client created successfully');

    // Test basic connection
    const result = await sql`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    console.log('📋 Test query result:', result);

    // Check if users table exists
    const usersTable = await sql`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            ) as exists
        `;
    console.log('📋 Users table exists:', usersTable[0].exists);

    // Check if user_preferences table exists
    const prefsTable = await sql`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'user_preferences'
            ) as exists
        `;
    console.log('📋 User preferences table exists:', prefsTable[0].exists);

    // Check if sessions table exists
    const sessionsTable = await sql`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'sessions'
            ) as exists
        `;
    console.log('📋 Sessions table exists:', sessionsTable[0].exists);

    // Try a simple users query
    const userCount = await sql`SELECT COUNT(*) as count FROM users`;
    console.log('📋 User count:', userCount[0].count);

    console.log('\n✅ Database is accessible and ready!');
    return true;
  } catch (error) {
    console.log('❌ Database connection failed:');
    console.log('   Error:', error.message);
    console.log('   Type:', error.name);

    if (error.message.includes('DATABASE_URL')) {
      console.log('\n💡 Solution: Set DATABASE_URL environment variable');
      console.log('   Example: $env:DATABASE_URL = "postgresql://user:pass@host:port/db"');
    }

    return false;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDatabaseConnection().catch(console.error);
}

module.exports = { testDatabaseConnection };
