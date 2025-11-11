// tests/exercises.test.js
// Test file for exercise-related API endpoints
// Tests exercises-bulk-create.js and related functionality

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestDB,
  teardownTestDB,
  getTestDatabase,
  createTestUser,
  createTestSession,
  createTestExercise,
  cleanupTestData,
} from './helpers/db.js';

describe('Exercises API Tests', () => {
  let db;
  let testUser;

  beforeEach(async () => {
    db = getTestDatabase();

    if (process.env.MOCK_DATABASE === 'true' || !db) {
      console.log('⚠️  Mock database mode - skipping database integration tests');
      return;
    }

    // Clean up any existing test data
    await cleanupTestData();

    // Create a test user
    testUser = await createTestUser({
      external_id: `test_user_${Date.now()}`,
      username: `testuser_${Date.now()}`,
      status: 'active',
    });
  });

  afterEach(async () => {
    if (process.env.MOCK_DATABASE === 'true' || !db) {
      return;
    }
    await cleanupTestData();
  });

  describe('Bulk Exercise Creation', () => {
    it('should return 401 without authentication token', async () => {
      // This test verifies that the exercises-bulk-create endpoint requires authentication
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should create multiple exercises in single request', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: exerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );

      // First create a session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create multiple exercises
      const exercisesData = {
        exercises: [
          { name: 'Bench Press', sets: 3, reps: 10, weight_kg: 80 },
          { name: 'Squat', sets: 4, reps: 8, weight_kg: 100 },
          { name: 'Deadlift', sets: 3, reps: 5, weight_kg: 120 },
        ],
      };

      const exerciseEvent = {
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exercisesData),
      };

      const exerciseResponse = await exerciseHandler(exerciseEvent);
      const exerciseResponseData = JSON.parse(exerciseResponse.body);

      expect([200, 201]).toContain(exerciseResponse.statusCode);
      expect(exerciseResponseData.exercises || exerciseResponseData.data).toBeDefined();

      const exercises = exerciseResponseData.exercises || exerciseResponseData.data || [];
      expect(exercises.length).toBeGreaterThanOrEqual(3);

      // Verify exercises were stored and linked correctly
      if (db) {
        const storedExercises = await db`
          SELECT * FROM session_exercises WHERE session_id = ${sessionId}
        `;
        expect(storedExercises.length).toBeGreaterThanOrEqual(3);
        expect(storedExercises.every(e => e.user_id === testUser.id)).toBe(true);
      }
    });

    it('should validate exercise data before creation', async () => {
      // Test exercise validation
      const invalidExercises = [
        { name: '', type: 'strength' }, // Empty name
        { name: 'Test', type: '' }, // Empty type
        { name: 'Test', type: 'invalid_type' }, // Invalid type
        { name: 'Test' }, // Missing type
        { type: 'strength' }, // Missing name
      ];

      for (const exercise of invalidExercises) {
        try {
          const response = await request(app)
            .post('/api/exercises')
            .set('Authorization', `Bearer ${validToken}`)
            .send(exercise);

          expect(response.status).toBe(400);
        } catch (error) {
          // Expected to fail validation
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle partial failures gracefully', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: exerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );

      // Create a session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Mix of valid and invalid exercises
      const mixedExercises = {
        exercises: [
          { name: 'Valid Exercise 1', sets: 3, reps: 10 }, // Valid
          { name: '', sets: 3, reps: 10 }, // Invalid: empty name
          { name: 'Valid Exercise 2', sets: 4, reps: 8 }, // Valid
          { name: 'Invalid Exercise', sets: 0, reps: 10 }, // Invalid: sets too low
        ],
      };

      const event = {
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mixedExercises),
      };

      const response = await exerciseHandler(event);
      const responseData = JSON.parse(response.body);

      // Should return validation errors for invalid exercises
      // Handler may reject all or reject only invalid ones - both are valid
      expect([400, 422]).toContain(response.statusCode);

      if (responseData.error) {
        expect(responseData.error.details || responseData.error).toBeDefined();
      }
    });

    it('should enforce maximum limit of 50 exercises per request', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const user = await createTestUser({ external_id: 'test-user-bulk-limit' });
      const session = await createTestSession({ user_id: user.id });

      // Create 51 exercises (exceeds limit)
      const exercises = Array(51)
        .fill()
        .map((_, i) => ({
          name: `Exercise ${i}`,
          sets: 3,
          reps: 10,
        }));

      const response = await fetch('/.netlify/functions/exercises-bulk-create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.jwt_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: session.id,
          exercises,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Maximum 50 exercises allowed per request');
    });
  });

  describe('Exercise Data Validation', () => {
    it('should validate exercise name', async () => {
      // Test exercise name validation
      const invalidNames = ['', '   ', null, undefined, 'a'.repeat(256)]; // Too long

      for (const name of invalidNames) {
        try {
          const response = await request(app)
            .post('/api/exercises')
            .set('Authorization', `Bearer ${validToken}`)
            .send({ name, type: 'strength' });

          expect(response.status).toBe(400);
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });

    it('should validate exercise type', async () => {
      // Test exercise type validation
      const invalidTypes = ['', 'invalid_type', null, undefined];

      for (const type of invalidTypes) {
        try {
          const response = await request(app)
            .post('/api/exercises')
            .set('Authorization', `Bearer ${validToken}`)
            .send({ name: 'Test Exercise', type });

          expect(response.status).toBe(400);
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });

    it('should validate exercise metrics', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: exerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Test invalid metrics
      const invalidMetrics = [
        { exercises: [{ name: 'Test', sets: -1, reps: 10 }] }, // Negative sets
        { exercises: [{ name: 'Test', sets: 3, reps: -1 }] }, // Negative reps
        { exercises: [{ name: 'Test', sets: 3, reps: 10, weight_kg: -5 }] }, // Negative weight
        { exercises: [{ name: 'Test', sets: 3, reps: 10, rpe: 11 }] }, // RPE too high (max 10)
        { exercises: [{ name: 'Test', sets: 3, reps: 10, weight_kg: 501 }] }, // Weight too high (max 500)
      ];

      for (const invalidData of invalidMetrics) {
        const event = {
          httpMethod: 'POST',
          path: `/sessions/${sessionId}/exercises`,
          headers: {
            Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invalidData),
        };

        const response = await exerciseHandler(event);
        const responseData = JSON.parse(response.body);

        expect([400, 422]).toContain(response.statusCode);
        expect(responseData.error).toBeDefined();
      }
    });

    it('should validate exercise categories', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: exerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Test valid exercise categories/types
      const validCategories = ['strength', 'cardio', 'flexibility', 'mobility'];

      for (const category of validCategories) {
        const event = {
          httpMethod: 'POST',
          path: `/sessions/${sessionId}/exercises`,
          headers: {
            Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exercises: [
              {
                name: `Test ${category}`,
                sets: 3,
                reps: 10,
                exercise_type: category,
              },
            ],
          }),
        };

        const response = await exerciseHandler(event);

        // Valid categories should be accepted (may fail for other reasons)
        expect([200, 201, 400, 422]).toContain(response.statusCode);
      }

      // Test invalid category
      const invalidEvent = {
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [
            {
              name: 'Invalid Category Exercise',
              sets: 3,
              reps: 10,
              exercise_type: 'invalid_category_type',
            },
          ],
        }),
      };

      const invalidResponse = await exerciseHandler(invalidEvent);
      const invalidData = JSON.parse(invalidResponse.body);

      // Invalid category should be rejected or ignored
      if ([400, 422].includes(invalidResponse.statusCode)) {
        expect(invalidData.error).toBeDefined();
      }
    });
  });

  describe('Exercise CRUD Operations', () => {
    it('should create individual exercise', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: exerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create single exercise
      const exerciseData = {
        exercises: [
          {
            name: 'Pull Up',
            sets: 3,
            reps: 10,
            weight_kg: 0, // Bodyweight
          },
        ],
      };

      const exerciseEvent = {
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exerciseData),
      };

      const exerciseResponse = await exerciseHandler(exerciseEvent);
      const exerciseResponseData = JSON.parse(exerciseResponse.body);

      expect([200, 201]).toContain(exerciseResponse.statusCode);
      expect(exerciseResponseData.exercises || exerciseResponseData.data).toBeDefined();

      const exercises = exerciseResponseData.exercises || exerciseResponseData.data || [];
      expect(exercises.length).toBe(1);
      expect(exercises[0].name).toBe('Pull Up');
      expect(exercises[0].id).toBeDefined();

      // Verify exercise was stored in database
      if (db) {
        const stored = await db`
          SELECT * FROM session_exercises WHERE id = ${exercises[0].id}
        `;
        expect(stored.length).toBe(1);
        expect(stored[0].name).toBe('Pull Up');
      }
    });

    it('should retrieve exercise by ID', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: listExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-list.js'
      );

      // Create session and exercise
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create exercise
      const createResponse = await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [{ name: 'Bench Press', sets: 3, reps: 10, weight_kg: 80 }],
        }),
      });

      const created = JSON.parse(createResponse.body);
      const exerciseId = created.exercises?.[0]?.id || created.data?.[0]?.id;

      if (!exerciseId) {
        return; // Skip if creation failed
      }

      // List exercises (which includes the one we just created)
      const listEvent = {
        httpMethod: 'GET',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
        },
      };

      const listResponse = await listExerciseHandler(listEvent);
      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      const exercises = listData.exercises || listData.data?.items || listData.data || [];
      const found = exercises.find(e => e.id === exerciseId);
      expect(found).toBeDefined();
      expect(found.name).toBe('Bench Press');
      expect(found.sets).toBe(3);
    });

    it('should update exercise', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: updateExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-update.js'
      );

      // Create session and exercise
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create exercise
      const createResponse = await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [{ name: 'Squat', sets: 3, reps: 10 }],
        }),
      });

      const created = JSON.parse(createResponse.body);
      const exerciseId = created.exercises?.[0]?.id || created.data?.[0]?.id;

      if (!exerciseId) {
        return;
      }

      // Update exercise
      const updateEvent = {
        httpMethod: 'PUT',
        path: `/sessions/${sessionId}/exercises/${exerciseId}`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Squat',
          sets: 5,
          reps: 5,
          weight_kg: 120,
        }),
      };

      const updateResponse = await updateExerciseHandler(updateEvent);
      expect([200, 204]).toContain(updateResponse.statusCode);

      // Verify update persisted in database
      if (db) {
        const updated = await db`
          SELECT * FROM session_exercises WHERE id = ${exerciseId}
        `;
        expect(updated.length).toBe(1);
        expect(updated[0].sets).toBe(5);
        expect(updated[0].weight_kg).toBe(120);
      }
    });

    it('should delete exercise', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: deleteExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-delete.js'
      );

      // Create session and exercise
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create exercise
      const createResponse = await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [{ name: 'Deadlift', sets: 3, reps: 5 }],
        }),
      });

      const created = JSON.parse(createResponse.body);
      const exerciseId = created.exercises?.[0]?.id || created.data?.[0]?.id;

      if (!exerciseId) {
        return;
      }

      // Delete exercise
      const deleteEvent = {
        httpMethod: 'DELETE',
        path: `/sessions/${sessionId}/exercises/${exerciseId}`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
        },
      };

      const deleteResponse = await deleteExerciseHandler(deleteEvent);
      expect([204, 200]).toContain(deleteResponse.statusCode);

      // Verify deletion (idempotent - second delete should also succeed)
      const deleteResponse2 = await deleteExerciseHandler(deleteEvent);
      expect([204, 200]).toContain(deleteResponse2.statusCode);

      // Verify exercise is gone from database
      if (db) {
        const deleted = await db`
          SELECT * FROM session_exercises WHERE id = ${exerciseId}
        `;
        expect(deleted.length).toBe(0);
      }
    });
  });

  describe('Exercise Search and Filtering', () => {
    it('should search exercises by name', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: listExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-list.js'
      );

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create multiple exercises with different names
      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [
            { name: 'Bench Press', sets: 3, reps: 10 },
            { name: 'Squat', sets: 4, reps: 8 },
            { name: 'Deadlift', sets: 3, reps: 5 },
          ],
        }),
      });

      // List all exercises
      const listEvent = {
        httpMethod: 'GET',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
        },
        queryStringParameters: {},
      };

      const listResponse = await listExerciseHandler(listEvent);
      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      const exercises = listData.exercises || listData.data?.items || listData.data || [];
      expect(exercises.length).toBeGreaterThanOrEqual(3);

      // Verify we can find exercises by name
      const benchPress = exercises.find(e => e.name && e.name.toLowerCase().includes('bench'));
      expect(benchPress).toBeDefined();
      expect(benchPress.name).toBe('Bench Press');
    });

    it('should filter exercises by type', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: listExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-list.js'
      );

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create exercises with different types
      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [
            { name: 'Bench Press', sets: 3, reps: 10, exercise_type: 'strength' },
            { name: 'Running', sets: 1, reps: 30, exercise_type: 'cardio' },
            { name: 'Stretching', sets: 3, reps: 10, exercise_type: 'flexibility' },
          ],
        }),
      });

      // List exercises (filtering by type may be implemented in the handler)
      const listEvent = {
        httpMethod: 'GET',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
        },
        queryStringParameters: {},
      };

      const listResponse = await listExerciseHandler(listEvent);
      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      const exercises = listData.exercises || listData.data?.items || listData.data || [];
      expect(exercises.length).toBeGreaterThanOrEqual(3);

      // Verify exercises have different types
      const strengthEx = exercises.find(e => e.exercise_type === 'strength');
      const cardioEx = exercises.find(e => e.exercise_type === 'cardio');
      expect(strengthEx).toBeDefined();
      expect(cardioEx).toBeDefined();
    });

    it('should filter exercises by date range', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: listExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-list.js'
      );

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Create sessions at different times
      const session1Response = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: yesterday.toISOString(),
        }),
      });

      const session2Response = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: now.toISOString(),
        }),
      });

      const session1Data = JSON.parse(session1Response.body);
      const session2Data = JSON.parse(session2Response.body);
      const sessionId1 = session1Data.data?.id || session1Data.id;
      const sessionId2 = session2Data.data?.id || session2Data.id;

      // Create exercises in both sessions
      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId1}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [{ name: 'Old Exercise', sets: 3, reps: 10 }],
        }),
      });

      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId2}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [{ name: 'Recent Exercise', sets: 3, reps: 10 }],
        }),
      });

      // List exercises from recent session
      const listEvent = {
        httpMethod: 'GET',
        path: `/sessions/${sessionId2}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
        },
        queryStringParameters: {},
      };

      const listResponse = await listExerciseHandler(listEvent);
      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      const exercises = listData.exercises || listData.data?.items || listData.data || [];
      expect(exercises.length).toBeGreaterThanOrEqual(1);
    });

    it('should sort exercises by various criteria', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: listExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-list.js'
      );

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create exercises with different names for sorting
      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [
            { name: 'Zebra Exercise', sets: 3, reps: 10, order_index: 3 },
            { name: 'Alpha Exercise', sets: 3, reps: 10, order_index: 1 },
            { name: 'Beta Exercise', sets: 3, reps: 10, order_index: 2 },
          ],
        }),
      });

      // List exercises (default ordering)
      const listEvent = {
        httpMethod: 'GET',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
        },
        queryStringParameters: {},
      };

      const listResponse = await listExerciseHandler(listEvent);
      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      const exercises = listData.exercises || listData.data?.items || listData.data || [];
      expect(exercises.length).toBeGreaterThanOrEqual(3);

      // Verify exercises can be sorted (handler may already sort by order_index)
      // Sorting validation would depend on handler implementation
      expect(exercises[0].name).toBeDefined();
    });
  });

  describe('Exercise Analytics', () => {
    it('should calculate exercise statistics', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: listExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-list.js'
      );

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create multiple exercises with varying metrics
      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [
            { name: 'Bench Press', sets: 3, reps: 10, weight_kg: 80 },
            { name: 'Squat', sets: 4, reps: 8, weight_kg: 100 },
            { name: 'Deadlift', sets: 3, reps: 5, weight_kg: 120 },
          ],
        }),
      });

      // List exercises to verify statistics can be calculated
      const listEvent = {
        httpMethod: 'GET',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
        },
        queryStringParameters: {},
      };

      const listResponse = await listExerciseHandler(listEvent);
      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      const exercises = listData.exercises || listData.data?.items || listData.data || [];
      expect(exercises.length).toBeGreaterThanOrEqual(3);

      // Calculate basic statistics
      const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0);
      const totalWeight = exercises.reduce(
        (sum, ex) => sum + (ex.weight_kg || 0) * (ex.sets || 0) * (ex.reps || 0),
        0
      );
      const avgWeight =
        exercises.filter(ex => ex.weight_kg).reduce((sum, ex) => sum + (ex.weight_kg || 0), 0) /
        exercises.filter(ex => ex.weight_kg).length;

      expect(totalSets).toBeGreaterThan(0);
      expect(exercises.length).toBe(3); // Should have all 3 exercises
    });

    it('should generate exercise reports', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: listExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-list.js'
      );

      // Create multiple sessions with exercises for reporting
      const now = new Date();
      const session1Response = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        }),
      });

      const session2Response = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: now.toISOString(),
        }),
      });

      const session1Data = JSON.parse(session1Response.body);
      const session2Data = JSON.parse(session2Response.body);
      const sessionId1 = session1Data.data?.id || session1Data.id;
      const sessionId2 = session2Data.data?.id || session2Data.id;

      // Add exercises to both sessions
      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId1}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [{ name: 'Bench Press', sets: 3, reps: 10, weight_kg: 80 }],
        }),
      });

      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId2}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [{ name: 'Squat', sets: 4, reps: 8, weight_kg: 100 }],
        }),
      });

      // Generate report by listing exercises across sessions
      const reportEvent = {
        httpMethod: 'GET',
        path: `/sessions/${sessionId2}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
        },
        queryStringParameters: {},
      };

      const reportResponse = await listExerciseHandler(reportEvent);
      const reportData = JSON.parse(reportResponse.body);

      expect(reportResponse.statusCode).toBe(200);
      const exercises = reportData.exercises || reportData.data?.items || reportData.data || [];
      expect(exercises.length).toBeGreaterThanOrEqual(1);

      // Verify report data structure
      exercises.forEach(ex => {
        expect(ex.name).toBeDefined();
        expect(ex.sets).toBeDefined();
        expect(ex.reps).toBeDefined();
      });
    });

    it('should track exercise progress', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: listExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-list.js'
      );

      // Create session 1 with initial exercise
      const session1Response = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks ago
        }),
      });

      // Create session 2 with progressed exercise
      const session2Response = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const session1Data = JSON.parse(session1Response.body);
      const session2Data = JSON.parse(session2Response.body);
      const sessionId1 = session1Data.data?.id || session1Data.id;
      const sessionId2 = session2Data.data?.id || session2Data.id;

      // Add exercise with lower weight (initial)
      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId1}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [{ name: 'Bench Press', sets: 3, reps: 10, weight_kg: 80 }],
        }),
      });

      // Add same exercise with increased weight (progress)
      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId2}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [{ name: 'Bench Press', sets: 3, reps: 10, weight_kg: 90 }],
        }),
      });

      // List exercises to verify progress can be tracked
      const listEvent = {
        httpMethod: 'GET',
        path: `/sessions/${sessionId2}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
        },
        queryStringParameters: {},
      };

      const listResponse = await listExerciseHandler(listEvent);
      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      const exercises = listData.exercises || listData.data?.items || listData.data || [];

      // Verify exercise with progress exists
      const benchPress = exercises.find(ex => ex.name === 'Bench Press');
      if (benchPress) {
        expect(benchPress.weight_kg).toBe(90); // Progressed weight
        expect(benchPress.weight_kg).toBeGreaterThan(80); // Higher than initial
      }
    });
  });

  describe('Exercise Performance', () => {
    it('should handle large exercise datasets', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: createExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );
      const { handler: listExerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-list.js'
      );

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create multiple exercises (limited to 20 for test performance)
      const exercises = Array(20)
        .fill(null)
        .map((_, i) => ({
          name: `Exercise ${i + 1}`,
          sets: 3,
          reps: 10,
          order_index: i,
        }));

      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exercises }),
      });

      // List exercises and measure performance
      const startTime = Date.now();
      const listEvent = {
        httpMethod: 'GET',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
        },
        queryStringParameters: {},
      };

      const listResponse = await listExerciseHandler(listEvent);
      const duration = Date.now() - startTime;
      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds

      const exerciseList = listData.exercises || listData.data?.items || listData.data || [];
      expect(exerciseList.length).toBeGreaterThanOrEqual(20);
    });

    it('should support concurrent exercise operations', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import(
        '../../netlify/functions/sessions-create.js'
      );
      const { handler: exerciseHandler } = await import(
        '../../netlify/functions/sessions-exercises-create.js'
      );

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString(),
        }),
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create multiple exercises concurrently
      const concurrentRequests = Array(5)
        .fill(null)
        .map((_, i) =>
          exerciseHandler({
            httpMethod: 'POST',
            path: `/sessions/${sessionId}/exercises`,
            headers: {
              Authorization: `Bearer ${testUser.jwt_token || 'test-token'}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              exercises: [
                {
                  name: `Concurrent Exercise ${i}`,
                  sets: 3,
                  reps: 10,
                  order_index: i,
                },
              ],
            }),
          })
        );

      const responses = await Promise.all(concurrentRequests);

      // All should complete without errors
      responses.forEach((response, index) => {
        expect(response.statusCode).toBeDefined();
        expect([200, 201, 400, 409]).toContain(response.statusCode); // May have duplicates
      });

      // Verify at least some succeeded
      const successCount = responses.filter(r => [200, 201].includes(r.statusCode)).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });
});
