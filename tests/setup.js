// tests/setup.js
// Global test setup and teardown

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestDatabase } from './helpers/database.js';
import { setupTestEnvironment } from './helpers/environment.js';

// Global test setup
beforeAll(async () => {
  console.log('🚀 Setting up test environment...');
  
  // Setup test environment variables
  await setupTestEnvironment();
  
  // Setup test database
  await setupTestDatabase();
  
  console.log('✅ Test environment ready');
});

// Global test teardown
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Teardown test database
  await teardownTestDatabase();
  
  console.log('✅ Test environment cleaned up');
});

// Before each test
beforeEach(async () => {
  // Skip cleanup in mock mode to preserve test data across tests
  if (process.env.MOCK_DATABASE === 'true') {
    return;
  }
  
  // Reset database state if needed
  const db = getTestDatabase();
  if (db) {
    // Clear any test data that might interfere
    try {
      await db`DELETE FROM sessions WHERE source = 'test'`;
      await db`DELETE FROM users WHERE username LIKE 'test_%'`;
    } catch (error) {
      // Ignore errors if tables don't exist yet
    }
  }
});

// After each test
afterEach(async () => {
  // Skip cleanup in mock mode to preserve test data across tests
  if (process.env.MOCK_DATABASE === 'true') {
    return;
  }
  
  // Clean up any test data created during the test
  const db = getTestDatabase();
  if (db) {
    try {
      await db`DELETE FROM sessions WHERE source = 'test'`;
      await db`DELETE FROM users WHERE username LIKE 'test_%'`;
    } catch (error) {
      // Ignore errors if tables don't exist yet
    }
  }
});
