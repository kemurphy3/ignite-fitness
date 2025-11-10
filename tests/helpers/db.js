// tests/helpers/db.js
// Database setup/teardown utilities for Neon/Postgres testing
// This file provides the specific functions requested in Ticket 9

import {
  setupTestDatabase,
  teardownTestDatabase,
  getTestDatabase,
  getTestPool,
  createTestUser,
  createTestSession,
  createTestExercise,
  cleanupTestData
} from './database.js';

/**
 * Setup test database - wrapper for the main setup function
 * This is the specific function requested in Ticket 9
 */
export async function setupTestDB() {
  return await setupTestDatabase();
}

/**
 * Teardown test database - wrapper for the main teardown function
 * This is the specific function requested in Ticket 9
 */
export async function teardownTestDB() {
  return await teardownTestDatabase();
}

// Re-export other useful functions for tests
export {
  getTestDatabase,
  getTestPool,
  createTestUser,
  createTestSession,
  createTestExercise,
  cleanupTestData
};
