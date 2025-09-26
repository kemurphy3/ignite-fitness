// tests/helpers/database.js
// Test database setup and utilities

import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { getTestConfig } from './environment.js';

let testClient = null;
let testPool = null;

/**
 * Setup test database with temporary schema
 */
export async function setupTestDatabase() {
  const config = getTestConfig();
  
  // Check if we're in mock mode (no real database available)
  if (config.databaseUrl.includes('mock') || process.env.MOCK_DATABASE === 'true') {
    console.log('⚠️  Mock database mode - skipping real database setup');
    testClient = null;
    testPool = null;
    return;
  }
  
  try {
    // Create Neon client for testing
    testClient = neon(config.databaseUrl, {
      poolQueryViaFetch: true,
      fetchOptions: {
        priority: 'high'
      }
    });
    
    // Create pg pool for more complex operations
    testPool = new Pool({
      connectionString: config.databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
    
    // Test database connection
    // Drop existing tables first to avoid conflicts
    await testClient`DROP TABLE IF EXISTS test_exercises CASCADE`;
    await testClient`DROP TABLE IF EXISTS test_sessions CASCADE`;
    await testClient`DROP TABLE IF EXISTS test_users CASCADE`;
    
    // Drop sequences
    await testClient`DROP SEQUENCE IF EXISTS test_users_id_seq CASCADE`;
    await testClient`DROP SEQUENCE IF EXISTS test_sessions_id_seq CASCADE`;
    await testClient`DROP SEQUENCE IF EXISTS test_exercises_id_seq CASCADE`;
    
    // Now create the tables
    await testClient`SELECT NOW() as current_time`;
    console.log('✅ Test database connection established');
    
    // Create test schema if it doesn't exist
    await createTestSchema();
    
    console.log('✅ Test database setup complete');
    
  } catch (error) {
    console.error('❌ Test database setup failed:', error.message);
    throw error;
  }
}

/**
 * Create test schema and tables
 */
async function createTestSchema() {
  try {
    // Drop existing tables first to avoid conflicts
    await testClient`DROP TABLE IF EXISTS test_exercises CASCADE`;
    await testClient`DROP TABLE IF EXISTS test_sessions CASCADE`;
    await testClient`DROP TABLE IF EXISTS test_users CASCADE`;
    
    // Drop sequences
    await testClient`DROP SEQUENCE IF EXISTS test_users_id_seq CASCADE`;
    await testClient`DROP SEQUENCE IF EXISTS test_sessions_id_seq CASCADE`;
    await testClient`DROP SEQUENCE IF EXISTS test_exercises_id_seq CASCADE`;
  } catch (e) {
    console.log('⚠️  Pre-cleanup warnings:', e.message);
  }

  try {
    // Create test tables (simplified versions for testing)
    await testClient`
      CREATE TABLE test_users (
        id SERIAL PRIMARY KEY,
        external_id VARCHAR(255) UNIQUE,
        username VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(50) DEFAULT 'active'
      )
    `;

    await testClient`
      CREATE TABLE test_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES test_users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        source VARCHAR(50) DEFAULT 'test',
        source_id VARCHAR(255),
        start_at TIMESTAMP NOT NULL,
        end_at TIMESTAMP,
        duration INTEGER,
        payload JSONB,
        session_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await testClient`
      CREATE TABLE test_exercises (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES test_sessions(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        sets INTEGER,
        reps INTEGER,
        weight_kg DECIMAL(5,2),
        rpe INTEGER,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create indexes for better test performance
    await testClient`CREATE INDEX IF NOT EXISTS idx_test_sessions_user_id ON test_sessions(user_id)`;
    await testClient`CREATE INDEX IF NOT EXISTS idx_test_sessions_start_at ON test_sessions(start_at)`;
    await testClient`CREATE INDEX IF NOT EXISTS idx_test_exercises_session_id ON test_exercises(session_id)`;

    console.log('✅ Test schema created');
  } catch (error) {
    console.error('❌ Test schema creation failed:', error.message);
    throw error;
  }
}

/**
 * Teardown test database
 */
export async function teardownTestDatabase() {
  try {
    // Skip teardown in mock mode
    if (process.env.MOCK_DATABASE === 'true') {
      console.log('⚠️  Mock database mode - skipping teardown');
      return;
    }
    
    // Clean up test data
    if (testClient) {
      await testClient`DELETE FROM test_exercises`;
      await testClient`DELETE FROM test_sessions`;
      await testClient`DELETE FROM test_users`;
    }
    
    // Close connections
    if (testPool) {
      await testPool.end();
      testPool = null;
    }
    
    testClient = null;
    console.log('✅ Test database cleaned up');
    
  } catch (error) {
    console.error('❌ Test database teardown failed:', error.message);
    // Don't throw error during teardown
  }
}

/**
 * Get test database client
 */
export function getTestDatabase() {
  return testClient;
}

/**
 * Get test database pool
 */
export function getTestPool() {
  return testPool;
}

/**
 * Create test user
 */
export async function createTestUser(userData = {}) {
  // Return mock data if in mock mode
  if (process.env.MOCK_DATABASE === 'true' || !testClient) {
    const defaultUser = {
      external_id: `test_${Date.now()}`,
      username: `testuser_${Date.now()}`,
      status: 'active'
    };
    
    const user = { ...defaultUser, ...userData };
    
    return {
      id: Math.floor(Math.random() * 1000),
      external_id: user.external_id,
      username: user.username,
      status: user.status,
      created_at: new Date(),
      updated_at: new Date()
    };
  }
  
  const defaultUser = {
    external_id: `test_${Date.now()}`,
    username: `testuser_${Date.now()}`,
    status: 'active'
  };
  
  const user = { ...defaultUser, ...userData };
  
  const result = await testClient`
    INSERT INTO test_users (external_id, username, status)
    VALUES (${user.external_id}, ${user.username}, ${user.status})
    RETURNING *
  `;
  
  return result[0];
}

/**
 * Create test session
 */
export async function createTestSession(sessionData = {}) {
  // Return mock data if in mock mode
  if (process.env.MOCK_DATABASE === 'true' || !testClient) {
    const defaultSession = {
      user_id: 1,
      type: 'workout',
      source: 'test',
      source_id: `test_${Date.now()}`,
      start_at: new Date(),
      end_at: new Date(Date.now() + 3600000),
      duration: 3600,
      payload: { test: true }
    };
    
    const session = { ...defaultSession, ...sessionData };
    
    return {
      id: Math.floor(Math.random() * 1000),
      user_id: session.user_id,
      type: session.type,
      source: session.source,
      source_id: session.source_id,
      start_at: session.start_at,
      end_at: session.end_at,
      duration: session.duration,
      payload: session.payload,
      created_at: new Date(),
      updated_at: new Date()
    };
  }
  
  const defaultSession = {
    user_id: 1,
    type: 'workout',
    source: 'test',
    source_id: `test_${Date.now()}`,
    start_at: new Date(),
    end_at: new Date(Date.now() + 3600000), // 1 hour later
    duration: 3600,
    payload: { test: true }
  };
  
  const session = { ...defaultSession, ...sessionData };
  
  const result = await testClient`
    INSERT INTO test_sessions (user_id, type, source, source_id, start_at, end_at, duration, payload)
    VALUES (${session.user_id}, ${session.type}, ${session.source}, ${session.source_id}, 
            ${session.start_at}, ${session.end_at}, ${session.duration}, ${session.payload})
    RETURNING *
  `;
  
  return result[0];
}

/**
 * Create test exercise
 */
export async function createTestExercise(exerciseData = {}) {
  // Return mock data if in mock mode
  if (process.env.MOCK_DATABASE === 'true' || !testClient) {
    const defaultExercise = {
      session_id: 1,
      name: 'Test Exercise',
      sets: 3,
      reps: 10,
      weight_kg: 50.0,
      rpe: 7,
      order_index: 0
    };
    
    const exercise = { ...defaultExercise, ...exerciseData };
    
    return {
      id: Math.floor(Math.random() * 1000),
      session_id: exercise.session_id,
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      weight_kg: exercise.weight_kg,
      rpe: exercise.rpe,
      order_index: exercise.order_index,
      created_at: new Date(),
      updated_at: new Date()
    };
  }
  
  const defaultExercise = {
    session_id: 1,
    name: 'Test Exercise',
    sets: 3,
    reps: 10,
    weight_kg: 50.0,
    rpe: 7,
    order_index: 0
  };
  
  const exercise = { ...defaultExercise, ...exerciseData };
  
  const result = await testClient`
    INSERT INTO test_exercises (session_id, name, sets, reps, weight_kg, rpe, order_index)
    VALUES (${exercise.session_id}, ${exercise.name}, ${exercise.sets}, ${exercise.reps}, 
            ${exercise.weight_kg}, ${exercise.rpe}, ${exercise.order_index})
    RETURNING *
  `;
  
  return result[0];
}

/**
 * Clean up test data
 */
export async function cleanupTestData() {
  // Skip cleanup in mock mode
  if (process.env.MOCK_DATABASE === 'true' || !testClient) {
    return;
  }
  
  if (testClient) {
    await testClient`DELETE FROM test_exercises`;
    await testClient`DELETE FROM test_sessions`;
    await testClient`DELETE FROM test_users`;
  }
}
