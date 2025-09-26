// tests/helpers/environment.js
// Test environment setup utilities

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Setup test environment variables
 */
export async function setupTestEnvironment() {
  // Load environment variables from .env.test if it exists
  const envPath = join(__dirname, '../../.env.test');
  
  try {
    dotenv.config({ path: envPath });
  } catch (error) {
    // .env.test doesn't exist, that's okay
  }
  
  // Set test-specific environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
  
  // Use test database URL if available, otherwise use main database with test schema
  if (!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL) {
    console.warn('⚠️  No DATABASE_URL or TEST_DATABASE_URL found. Using mock database for unit tests only.');
    // Set a mock database URL for unit tests that don't need real database
    process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
    process.env.MOCK_DATABASE = 'true';
  }
  
  // Ensure we have a test database URL
  if (!process.env.TEST_DATABASE_URL) {
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
  }
  
  // Set DATABASE_URL for compatibility
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
  
  console.log('✅ Test environment variables configured');
}

/**
 * Get test environment configuration
 */
export function getTestConfig() {
  return {
    databaseUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret',
    nodeEnv: process.env.NODE_ENV,
    testMode: process.env.TEST_MODE === 'true'
  };
}
