// tests/example.integration.test.js
// Example integration test file for Ticket 9
// This demonstrates database integration testing

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestDB,
  teardownTestDB,
  getTestDatabase,
  createTestUser,
  createTestSession,
  createTestExercise,
  cleanupTestData
} from './helpers/db.js';

describe('Database Integration Tests', () => {
  let db;

  beforeEach(async () => {
    // Get the test database connection
    db = getTestDatabase();

    // Skip database tests if in mock mode
    if (process.env.MOCK_DATABASE === 'true') {
      console.log('⚠️  Mock database mode - skipping database integration tests');
      return;
    }

    expect(db).toBeDefined();

    // Clean up any existing test data
    await cleanupTestData();
  });

  // Skip all tests if in mock mode
  if (process.env.MOCK_DATABASE === 'true') {
    it.skip('Database tests require real database connection', () => {
      console.log('⚠️  Database integration tests skipped - no database connection available');
    });
    return;
  }

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  describe('User Management', () => {
    it('should create a test user successfully', async () => {
      const userData = {
        external_id: 'test_user_123',
        username: 'testuser123',
        status: 'active'
      };

      const user = await createTestUser(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.external_id).toBe(userData.external_id);
      expect(user.username).toBe(userData.username);
      expect(user.status).toBe(userData.status);
      expect(user.created_at).toBeDefined();
    });

    it('should retrieve user by ID', async () => {
      const user = await createTestUser({
        external_id: 'test_user_456',
        username: 'testuser456'
      });

      // In mock mode, just verify the user was created
      if (process.env.MOCK_DATABASE === 'true') {
        expect(user).toBeDefined();
        expect(user.id).toBeDefined();
        expect(user.username).toBe('testuser456');
        return;
      }

      const retrievedUser = await db`
        SELECT * FROM test_users WHERE id = ${user.id}
      `;

      expect(retrievedUser).toHaveLength(1);
      expect(retrievedUser[0].id).toBe(user.id);
      expect(retrievedUser[0].username).toBe('testuser456');
    });

    it('should handle unique constraints', async () => {
      // Skip this test in mock mode as it requires real database constraints
      if (process.env.MOCK_DATABASE === 'true') {
        console.log('⚠️  Skipping unique constraints test in mock mode');
        return;
      }

      const userData = {
        external_id: 'unique_test_user',
        username: 'uniqueuser'
      };

      // Create first user
      await createTestUser(userData);

      // Try to create second user with same username (should fail)
      try {
        await createTestUser({
          ...userData,
          external_id: 'different_external_id'
        });
        expect.fail('Should have thrown an error for duplicate username');
      } catch (error) {
        expect(error.message).toContain('duplicate key value');
      }
    });
  });

  describe('Session Management', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await createTestUser({
        external_id: 'session_test_user',
        username: 'sessionuser'
      });
    });

    it('should create a test session successfully', async () => {
      const sessionData = {
        user_id: testUser.id,
        type: 'workout',
        source: 'test',
        source_id: 'test_session_123',
        start_at: new Date(),
        end_at: new Date(Date.now() + 3600000),
        duration: 3600,
        payload: { test: true, notes: 'Test workout session' }
      };

      const session = await createTestSession(sessionData);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.user_id).toBe(testUser.id);
      expect(session.type).toBe('workout');
      expect(session.source).toBe('test');
      expect(session.duration).toBe(3600);
      expect(session.payload).toEqual({ test: true, notes: 'Test workout session' });
    });

    it('should retrieve sessions for a user', async () => {
      // Create multiple sessions
      const session1 = await createTestSession({
        user_id: testUser.id,
        type: 'workout',
        source: 'test',
        source_id: 'session1'
      });

      const session2 = await createTestSession({
        user_id: testUser.id,
        type: 'cardio',
        source: 'test',
        source_id: 'session2'
      });

      // In mock mode, just verify the sessions were created
      if (process.env.MOCK_DATABASE === 'true') {
        expect(session1).toBeDefined();
        expect(session2).toBeDefined();
        expect(session1.type).toBe('workout');
        expect(session2.type).toBe('cardio');
        return;
      }

      const sessions = await db`
        SELECT * FROM test_sessions 
        WHERE user_id = ${testUser.id}
        ORDER BY created_at
      `;

      expect(sessions).toHaveLength(2);
      expect(sessions[0].type).toBe('workout');
      expect(sessions[1].type).toBe('cardio');
    });
  });

  describe('Exercise Management', () => {
    let testUser, testSession;

    beforeEach(async () => {
      testUser = await createTestUser({
        external_id: 'exercise_test_user',
        username: 'exerciseuser'
      });

      testSession = await createTestSession({
        user_id: testUser.id,
        type: 'workout',
        source: 'test',
        source_id: 'exercise_test_session'
      });
    });

    it('should create a test exercise successfully', async () => {
      const exerciseData = {
        session_id: testSession.id,
        name: 'Bench Press',
        sets: 3,
        reps: 10,
        weight_kg: 80.5,
        rpe: 8,
        order_index: 1
      };

      const exercise = await createTestExercise(exerciseData);

      expect(exercise).toBeDefined();
      expect(exercise.id).toBeDefined();
      expect(exercise.session_id).toBe(testSession.id);
      expect(exercise.name).toBe('Bench Press');
      expect(exercise.sets).toBe(3);
      expect(exercise.reps).toBe(10);
      expect(exercise.weight_kg).toBe(80.5);
      expect(exercise.rpe).toBe(8);
      expect(exercise.order_index).toBe(1);
    });

    it('should retrieve exercises for a session', async () => {
      // Create multiple exercises
      const exercise1 = await createTestExercise({
        session_id: testSession.id,
        name: 'Squats',
        sets: 4,
        reps: 12,
        weight_kg: 100.0,
        order_index: 1
      });

      const exercise2 = await createTestExercise({
        session_id: testSession.id,
        name: 'Deadlifts',
        sets: 3,
        reps: 8,
        weight_kg: 120.0,
        order_index: 2
      });

      // In mock mode, just verify the exercises were created
      if (process.env.MOCK_DATABASE === 'true') {
        expect(exercise1).toBeDefined();
        expect(exercise2).toBeDefined();
        expect(exercise1.name).toBe('Squats');
        expect(exercise2.name).toBe('Deadlifts');
        return;
      }

      const exercises = await db`
        SELECT * FROM test_exercises 
        WHERE session_id = ${testSession.id}
        ORDER BY order_index
      `;

      expect(exercises).toHaveLength(2);
      expect(exercises[0].name).toBe('Squats');
      expect(exercises[1].name).toBe('Deadlifts');
    });
  });

  describe('Database Constraints and Relationships', () => {
    it('should enforce foreign key constraints', async () => {
      // Skip this test in mock mode as it requires real database constraints
      if (process.env.MOCK_DATABASE === 'true') {
        console.log('⚠️  Skipping foreign key constraints test in mock mode');
        return;
      }

      // Try to create a session with non-existent user_id
      try {
        await createTestSession({
          user_id: 99999, // Non-existent user
          type: 'workout',
          source: 'test'
        });
        expect.fail('Should have thrown an error for invalid user_id');
      } catch (error) {
        expect(error.message).toContain('foreign key constraint');
      }
    });

    it('should cascade delete correctly', async () => {
      // Skip this test in mock mode as it requires real database operations
      if (process.env.MOCK_DATABASE === 'true') {
        console.log('⚠️  Skipping cascade delete test in mock mode');
        return;
      }

      // Create user, session, and exercise
      const user = await createTestUser({
        external_id: 'cascade_test_user',
        username: 'cascadeuser'
      });

      const session = await createTestSession({
        user_id: user.id,
        type: 'workout',
        source: 'test'
      });

      const exercise = await createTestExercise({
        session_id: session.id,
        name: 'Test Exercise'
      });

      // Verify they exist
      const userCheck = await db`SELECT * FROM test_users WHERE id = ${user.id}`;
      const sessionCheck = await db`SELECT * FROM test_sessions WHERE id = ${session.id}`;
      const exerciseCheck = await db`SELECT * FROM test_exercises WHERE id = ${exercise.id}`;

      expect(userCheck).toHaveLength(1);
      expect(sessionCheck).toHaveLength(1);
      expect(exerciseCheck).toHaveLength(1);

      // Delete user (should cascade to session and exercise)
      await db`DELETE FROM test_users WHERE id = ${user.id}`;

      // Verify cascade delete
      const userAfterDelete = await db`SELECT * FROM test_users WHERE id = ${user.id}`;
      const sessionAfterDelete = await db`SELECT * FROM test_sessions WHERE id = ${session.id}`;
      const exerciseAfterDelete = await db`SELECT * FROM test_exercises WHERE id = ${exercise.id}`;

      expect(userAfterDelete).toHaveLength(0);
      expect(sessionAfterDelete).toHaveLength(0);
      expect(exerciseAfterDelete).toHaveLength(0);
    });
  });

  describe('Database Performance', () => {
    it('should handle batch operations efficiently', async () => {
      // Skip this test in mock mode as it requires real database operations
      if (process.env.MOCK_DATABASE === 'true') {
        console.log('⚠️  Skipping performance test in mock mode');
        return;
      }

      const user = await createTestUser({
        external_id: 'batch_test_user',
        username: 'batchuser'
      });

      const session = await createTestSession({
        user_id: user.id,
        type: 'workout',
        source: 'test'
      });

      // Create multiple exercises in a batch
      const exercises = [];
      for (let i = 0; i < 10; i++) {
        exercises.push({
          session_id: session.id,
          name: `Exercise ${i + 1}`,
          sets: 3,
          reps: 10,
          weight_kg: 50 + i * 5,
          order_index: i + 1
        });
      }

      // Insert all exercises
      const startTime = Date.now();
      for (const exercise of exercises) {
        await createTestExercise(exercise);
      }
      const endTime = Date.now();

      // Verify all exercises were created
      const createdExercises = await db`
        SELECT * FROM test_exercises 
        WHERE session_id = ${session.id}
        ORDER BY order_index
      `;

      expect(createdExercises).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
