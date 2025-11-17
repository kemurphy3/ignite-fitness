// tests/helpers/database.js
// Test database setup and utilities

import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { getTestConfig } from './environment.js';

let testClient = null;
let testPool = null;

// Shared mock data storage for the test session
const mockDataStore = {
  sessions: [],
  users: [],
  exercises: [],
};

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
    // For local PostgreSQL (CI), use pg Pool instead of Neon client
    if (config.databaseUrl.includes('localhost') || config.databaseUrl.includes('127.0.0.1')) {
      console.log('🔧 Using PostgreSQL Pool for local database');

      // Create pg pool for local PostgreSQL
      testPool = new Pool({
        connectionString: config.databaseUrl,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Create a client wrapper that mimics Neon's template literal interface
      testClient = async (strings, ...values) => {
        const client = await testPool.connect();
        try {
          const query = strings.join(`$${values.length + 1}`).replace(/\$(\d+)/g, (match, num) => {
            const index = parseInt(num) - 1;
            return index < values.length ? `$${index + 1}` : match;
          });

          let finalQuery = '';
          for (let i = 0; i < strings.length; i++) {
            finalQuery += strings[i];
            if (i < values.length) {
              finalQuery += `$${i + 1}`;
            }
          }

          const result = await client.query(finalQuery, values);
          return result.rows;
        } finally {
          client.release();
        }
      };
    } else {
      console.log('🔧 Using Neon client for cloud database');

      // Create Neon client for cloud database
      testClient = neon(config.databaseUrl, {
        poolQueryViaFetch: true,
        fetchOptions: {
          priority: 'high',
        },
      });

      // Create pg pool for more complex operations
      testPool = new Pool({
        connectionString: config.databaseUrl,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }

    // Test database connection
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
    // Ignore errors during pre-cleanup
  }

  try {
    // Create test tables with IF NOT EXISTS for safety
    await testClient`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        external_id VARCHAR(255) UNIQUE,
        username VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(50) DEFAULT 'active'
      )
    `;

    await testClient`
      CREATE TABLE IF NOT EXISTS test_sessions (
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
      CREATE TABLE IF NOT EXISTS test_exercises (
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
    // For "already exists" errors, just log a warning instead of failing
    if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
      console.log('⚠️  Test schema already exists, continuing...');
    } else {
      console.error('❌ Test schema creation failed:', error.message);
      throw error;
    }
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
  // Return mock database function in mock mode
  if (process.env.MOCK_DATABASE === 'true' || !testClient) {
    return createMockDatabase();
  }
  return testClient;
}

/**
 * Create mock database function for testing without real database
 */
function createMockDatabase() {
  const mockDb = (strings, ...values) => {
    // Build query string for pattern matching - each ${} becomes a ?
    let query = '';
    let paramIndex = 0;
    const paramPositions = []; // Track which value index corresponds to each ? position

    for (let i = 0; i < strings.length; i++) {
      query += strings[i];
      if (i < values.length) {
        query += '?';
        paramPositions.push(i); // Map ? position to values array index
      }
    }

    // Return mock results based on query type
    if (query.includes('SELECT')) {
      if (query.includes('test_sessions')) {
        let filteredSessions = [...mockDataStore.sessions];

        // Apply user_id filter
        if (query.includes('user_id')) {
          // Find user_id parameter position in the query
          const user_id_pattern = /user_id\s*=\s*\?/;
          const match = query.match(user_id_pattern);
          if (match) {
            // Find which parameter index this is
            const beforeMatch = query.substring(0, match.index);
            const paramIndex = (beforeMatch.match(/\?/g) || []).length;
            const userId = values[paramIndex];
            if (userId !== undefined) {
              filteredSessions = filteredSessions.filter(s => s.user_id === userId);
            }
          }
        }

        // Apply type filter - handle both literal and parameterized
        if (query.includes("type = 'workout'")) {
          filteredSessions = filteredSessions.filter(s => s.type === 'workout');
        } else if (query.includes("type = 'cardio'")) {
          filteredSessions = filteredSessions.filter(s => s.type === 'cardio');
        } else if (query.includes("type = 'recovery'")) {
          filteredSessions = filteredSessions.filter(s => s.type === 'recovery');
        } else if (query.includes('type = $')) {
          // Parameterized type filter
          const typeIndex = strings.findIndex(s => s.includes('type ='));
          if (typeIndex >= 0 && typeIndex < values.length) {
            const typeValue = values[typeIndex];
            filteredSessions = filteredSessions.filter(s => s.type === typeValue);
          }
        }

        // Apply AND type filter
        if (query.includes("AND type = 'workout'")) {
          filteredSessions = filteredSessions.filter(s => s.type === 'workout');
        }

        // Apply date range filter if present
        if (
          query.includes('start_at >=') ||
          query.includes('start_at <=') ||
          query.includes('start_at <')
        ) {
          // Handle date range queries (both >= and <= together)
          if (
            query.includes('start_at >=') &&
            query.includes('start_at <=') &&
            !query.includes('(start_at <')
          ) {
            const gteIndex = query.indexOf('start_at >=');
            const beforeGte = query.substring(0, gteIndex);
            const gteParamIndex = (beforeGte.match(/\?/g) || []).length;

            const lteIndex = query.indexOf('start_at <=');
            const beforeLte = query.substring(0, lteIndex);
            const lteParamIndex = (beforeLte.match(/\?/g) || []).length;

            if (gteParamIndex < values.length && lteParamIndex < values.length) {
              const minDate = values[gteParamIndex] instanceof Date ? values[gteParamIndex] : null;
              const maxDate = values[lteParamIndex] instanceof Date ? values[lteParamIndex] : null;

              if (minDate && maxDate) {
                filteredSessions = filteredSessions.filter(s => {
                  const sessionDate = new Date(s.start_at);
                  return sessionDate >= minDate && sessionDate <= maxDate;
                });
              }
            }
          } else if (
            query.includes('start_at >=') &&
            !query.includes('start_at <') &&
            !query.includes('(start_at <')
          ) {
            // Apply >= filter only
            const gteIndex = query.indexOf('start_at >=');
            const beforeGte = query.substring(0, gteIndex);
            const gteParamIndex = (beforeGte.match(/\?/g) || []).length;
            if (gteParamIndex < values.length && values[gteParamIndex] instanceof Date) {
              const minDate = values[gteParamIndex];
              filteredSessions = filteredSessions.filter(s => {
                const sessionDate = new Date(s.start_at);
                return sessionDate >= minDate;
              });
            }
          } else if (query.includes('start_at <=') && !query.includes('(start_at <')) {
            // Apply <= filter only
            const lteIndex = query.indexOf('start_at <=');
            const beforeLte = query.substring(0, lteIndex);
            const lteParamIndex = (beforeLte.match(/\?/g) || []).length;
            if (lteParamIndex < values.length && values[lteParamIndex] instanceof Date) {
              const maxDate = values[lteParamIndex];
              filteredSessions = filteredSessions.filter(s => {
                const sessionDate = new Date(s.start_at);
                return sessionDate <= maxDate;
              });
            }
          }

          // Handle complex cursor conditions: (start_at < ${timestamp} OR (start_at = ${timestamp} AND id > ${id}))
          if (query.includes('(start_at <') && query.includes('OR')) {
            // Find the first timestamp parameter (for start_at <)
            const ltIndex = query.indexOf('start_at <');
            const beforeLt = query.substring(0, ltIndex);
            const ltParamPos = (beforeLt.match(/\?/g) || []).length;
            const ltValueIndex = paramPositions[ltParamPos];

            // Find the id parameter (for id >) - it's the last parameter in the cursor condition
            let cursorId = null;
            if (query.includes('id >')) {
              const idGtIndex = query.indexOf('id >');
              const beforeIdGt = query.substring(0, idGtIndex);
              const idParamPos = (beforeIdGt.match(/\?/g) || []).length;
              const idValueIndex = paramPositions[idParamPos];
              if (idValueIndex !== undefined && idValueIndex < values.length) {
                cursorId = values[idValueIndex];
              }
            }

            // Get timestamp value (appears twice but same value)
            if (ltValueIndex !== undefined && ltValueIndex < values.length) {
              const cursorTimestamp = values[ltValueIndex];
              // Handle both Date objects and timestamps/strings
              let cursorTime;
              if (cursorTimestamp instanceof Date) {
                cursorTime = cursorTimestamp.getTime();
              } else if (
                typeof cursorTimestamp === 'string' ||
                typeof cursorTimestamp === 'number'
              ) {
                cursorTime = new Date(cursorTimestamp).getTime();
              } else {
                cursorTime = null;
              }

              if (cursorTime !== null) {
                filteredSessions = filteredSessions.filter(s => {
                  const sessionDate = new Date(s.start_at);
                  const sessionTime = sessionDate.getTime();

                  // Apply: start_at < timestamp OR (start_at = timestamp AND id > cursorId)
                  if (sessionTime < cursorTime) {
                    return true;
                  }
                  // For exact match, also check id
                  if (Math.abs(sessionTime - cursorTime) < 1000) {
                    if (cursorId !== null && s.id > cursorId) {
                      return true;
                    }
                  }
                  return false;
                });
              }
            }
          }
        }

        // Handle COUNT queries
        if (query.includes('COUNT(*)') || query.includes('count(*)')) {
          return Promise.resolve([{ count: filteredSessions.length.toString() }]);
        }

        // Handle SUM queries
        if (query.includes('SUM(duration)') || query.includes('sum(duration)')) {
          const total = filteredSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
          return Promise.resolve([{ total_duration: total }]);
        }

        // Handle MAX queries
        if (query.includes('MAX(start_at)') || query.includes('max(start_at)')) {
          if (filteredSessions.length > 0) {
            const mostRecent = filteredSessions.reduce((max, s) => {
              return new Date(s.start_at) > new Date(max.start_at) ? s : max;
            });
            return Promise.resolve([{ most_recent: mostRecent.start_at }]);
          }
          return Promise.resolve([{ most_recent: null }]);
        }

        // Apply ORDER BY if present
        if (query.includes('ORDER BY')) {
          if (query.includes('start_at DESC')) {
            filteredSessions.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
            // Secondary sort by id if specified
            if (query.includes('id ASC')) {
              filteredSessions.sort((a, b) => {
                const dateDiff = new Date(b.start_at) - new Date(a.start_at);
                if (dateDiff === 0) {
                  return (a.id || 0) - (b.id || 0);
                }
                return dateDiff;
              });
            }
          } else if (query.includes('start_at ASC')) {
            filteredSessions.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
          }
        }

        // Apply LIMIT if present
        if (query.includes('LIMIT')) {
          const limitMatch = query.match(/LIMIT\s+(\d+)/i);
          if (limitMatch) {
            const limitValue = parseInt(limitMatch[1], 10);
            filteredSessions = filteredSessions.slice(0, limitValue);
          } else {
            // Try to get limit from values array (last value is often LIMIT)
            const limitValue = values[values.length - 1];
            if (typeof limitValue === 'number') {
              filteredSessions = filteredSessions.slice(0, limitValue);
            }
          }
        }

        // Special case for non-existent user or type (returns empty)
        if (query.includes('999999') || query.includes("type = 'nonexistent'")) {
          return Promise.resolve([]);
        }

        return Promise.resolve(filteredSessions);
      }

      if (query.includes('test_users')) {
        return Promise.resolve(mockDataStore.users);
      }

      if (query.includes('test_exercises')) {
        return Promise.resolve(mockDataStore.exercises);
      }

      return Promise.resolve([]);
    }

    if (query.includes('INSERT')) {
      if (query.includes('test_sessions')) {
        const newSession = {
          id: mockDataStore.sessions.length + 1,
          user_id: values[0] || 1,
          type: values[1] || 'workout',
          source: values[2] || 'test',
          source_id: values[3] || `mock_session_${mockDataStore.sessions.length + 1}`,
          start_at: values[4] || new Date(),
          end_at: values[5] || new Date(),
          duration: values[6] || 3600,
          payload: values[7] || { test: true },
          session_hash: `mock_hash_${mockDataStore.sessions.length + 1}`,
          created_at: new Date(),
          updated_at: new Date(),
        };
        mockDataStore.sessions.push(newSession);
        return Promise.resolve([newSession]);
      }

      if (query.includes('test_users')) {
        const newUser = {
          id: mockDataStore.users.length + 1,
          external_id: values[0] || `test_${Date.now()}`,
          username: values[1] || `testuser_${Date.now()}`,
          status: values[2] || 'active',
          created_at: new Date(),
          updated_at: new Date(),
        };
        mockDataStore.users.push(newUser);
        return Promise.resolve([newUser]);
      }

      return Promise.resolve([{ id: 1, affected: 1 }]);
    }

    if (query.includes('DELETE')) {
      if (query.includes('test_sessions')) {
        mockDataStore.sessions = [];
      }
      if (query.includes('test_users')) {
        mockDataStore.users = [];
      }
      if (query.includes('test_exercises')) {
        mockDataStore.exercises = [];
      }
      return Promise.resolve([{ affected: 1 }]);
    }

    if (query.includes('UPDATE')) {
      return Promise.resolve([{ id: 1, affected: 1 }]);
    }

    return Promise.resolve([]);
  };

  return mockDb;
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
  // Use mock database function if in mock mode
  if (process.env.MOCK_DATABASE === 'true' || !testClient) {
    const defaultUser = {
      external_id: `test_${Date.now()}`,
      username: `testuser_${Date.now()}`,
      status: 'active',
    };

    const user = { ...defaultUser, ...userData };

    // Use the mock database function to store the user
    const mockDb = getTestDatabase();
    const result = await mockDb`
      INSERT INTO test_users (external_id, username, status)
      VALUES (${user.external_id}, ${user.username}, ${user.status})
      RETURNING *
    `;

    return result[0];
  }

  const defaultUser = {
    external_id: `test_${Date.now()}`,
    username: `testuser_${Date.now()}`,
    status: 'active',
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
  // Use mock database function if in mock mode
  if (process.env.MOCK_DATABASE === 'true' || !testClient) {
    const defaultSession = {
      user_id: 1,
      type: 'workout',
      source: 'test',
      source_id: `test_${Date.now()}`,
      start_at: new Date(),
      end_at: new Date(Date.now() + 3600000),
      duration: 3600,
      payload: { test: true },
    };

    const session = { ...defaultSession, ...sessionData };

    // Use the mock database function to store the session
    const mockDb = getTestDatabase();
    const result = await mockDb`
      INSERT INTO test_sessions (user_id, type, source, source_id, start_at, end_at, duration, payload)
      VALUES (${session.user_id}, ${session.type}, ${session.source}, ${session.source_id}, 
              ${session.start_at}, ${session.end_at}, ${session.duration}, ${session.payload})
      RETURNING *
    `;

    return result[0];
  }

  const defaultSession = {
    user_id: 1,
    type: 'workout',
    source: 'test',
    source_id: `test_${Date.now()}`,
    start_at: new Date(),
    end_at: new Date(Date.now() + 3600000), // 1 hour later
    duration: 3600,
    payload: { test: true },
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
      order_index: 0,
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
      updated_at: new Date(),
    };
  }

  const defaultExercise = {
    session_id: 1,
    name: 'Test Exercise',
    sets: 3,
    reps: 10,
    weight_kg: 50.0,
    rpe: 7,
    order_index: 0,
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
  // Reset mock data store in mock mode
  if (process.env.MOCK_DATABASE === 'true' || !testClient) {
    mockDataStore.sessions = [];
    mockDataStore.users = [];
    mockDataStore.exercises = [];
    return;
  }

  if (testClient) {
    try {
      await testClient`DELETE FROM test_exercises`;
    } catch (e) {
      // Table might not exist, ignore error
    }
    try {
      await testClient`DELETE FROM test_sessions`;
    } catch (e) {
      // Table might not exist, ignore error
    }
    try {
      await testClient`DELETE FROM test_users`;
    } catch (e) {
      // Table might not exist, ignore error
    }
  }
}
