const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  // Check environment variables
  console.log('Environment variables:');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  console.log('  TEST_DATABASE_URL:', process.env.TEST_DATABASE_URL ? 'SET' : 'NOT SET');
  
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  console.log('  Final URL:', databaseUrl ? databaseUrl.substring(0, 50) + '...' : 'NOT SET');
  
  if (!databaseUrl) {
    console.error('❌ No database URL found');
    return;
  }
  
  try {
    // Test connection
    const sql = neon(databaseUrl);
    const result = await sql`SELECT 1 as test`;
    console.log('✅ Database connection successful!');
    console.log('  Test query result:', result);
    
    // Test a simple table query
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      LIMIT 5
    `;
    console.log('✅ Database tables accessible!');
    console.log('  Available tables:', tables.map(t => t.table_name));
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('  Error:', error.message);
    console.error('  Code:', error.code);
    console.error('  Detail:', error.detail);
  }
}

testDatabaseConnection();

