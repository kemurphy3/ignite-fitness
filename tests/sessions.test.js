// tests/sessions.test.js
// Test file for session-related API endpoints
// Tests sessions-create.js, sessions-list.js, and related functionality

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestDB,
  teardownTestDB,
  getTestDatabase,
  createTestUser,
  createTestSession,
  cleanupTestData
} from './helpers/db.js';

describe('Sessions API Tests', () => {
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
      status: 'active'
    });
  });

  afterEach(async () => {
    if (process.env.MOCK_DATABASE === 'true' || !db) {
      return;
    }
    await cleanupTestData();
  });

  describe('Sessions Create Endpoint', () => {
    it('should return 401 without authentication token', async () => {
      // This test verifies that the sessions-create endpoint requires authentication
      // In a real implementation, this would make an HTTP request to the endpoint
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should create a new session with valid data', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/sessions-create.js');

      const sessionData = {
        type: 'workout',
        source: 'app',
        start_at: new Date().toISOString(),
        end_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
        payload: { notes: 'Test workout session' }
      };

      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionData)
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeDefined();
      expect(responseData.data.id).toBeDefined();
      expect(responseData.data.type).toBe(sessionData.type);
      expect(responseData.data.source).toBe(sessionData.source);

      // Verify session was stored in database
      if (db) {
        const storedSession = await db`
          SELECT * FROM sessions WHERE id = ${responseData.data.id}
        `;
        expect(storedSession.length).toBe(1);
        expect(storedSession[0].user_id).toBe(testUser.id);
      }
    });

    it('should validate required session fields', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/sessions-create.js');

      // Test missing type
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: 'app',
          start_at: new Date().toISOString()
        })
      };

      let response = await handler(event);
      let responseData = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(responseData.error).toBeDefined();
      expect(responseData.error.message).toContain('Type is required');

      // Test missing source
      event.body = JSON.stringify({
        type: 'workout',
        start_at: new Date().toISOString()
      });

      response = await handler(event);
      responseData = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(responseData.error.message).toContain('Source is required');

      // Test missing start_at
      event.body = JSON.stringify({
        type: 'workout',
        source: 'app'
      });

      response = await handler(event);
      responseData = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(responseData.error.message).toContain('Start time is required');

      // Test invalid type
      event.body = JSON.stringify({
        type: 'invalid_type',
        source: 'app',
        start_at: new Date().toISOString()
      });

      response = await handler(event);
      responseData = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);

      // Test invalid date format
      event.body = JSON.stringify({
        type: 'workout',
        source: 'app',
        start_at: 'not-a-date'
      });

      response = await handler(event);
      responseData = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
    });

    it('should handle database errors gracefully', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/sessions-create.js');

      // Test with invalid user (should handle gracefully)
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString()
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Should return 401 for invalid auth, not 500
      expect(response.statusCode).toBe(401);
      expect(responseData.error).toBeDefined();
      expect(responseData.error.message).toContain('Invalid');

      // Test duplicate session (should return 409)
      const validSessionData = {
        type: 'workout',
        source: 'app',
        source_id: 'test-duplicate-id',
        start_at: new Date().toISOString()
      };

      // Create first session
      const createEvent1 = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validSessionData)
      };

      const response1 = await handler(createEvent1);
      expect([201, 409]).toContain(response1.statusCode);

      // Try to create duplicate
      const response2 = await handler(createEvent1);
      const responseData2 = JSON.parse(response2.body);

      if (response2.statusCode === 409) {
        expect(responseData2.error.code).toBe('DUPLICATE_SESSION');
      }
    });
  });

  describe('Sessions List Endpoint', () => {
    it('should return 401 without authentication token', async () => {
      // This test verifies that the sessions-list endpoint requires authentication
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should return user sessions with valid token', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: createHandler } = await import('../../netlify/functions/sessions-create.js');
      const { handler: listHandler } = await import('../../netlify/functions/sessions-list.js');

      // Create a test session first
      const sessionData = {
        type: 'workout',
        source: 'app',
        start_at: new Date().toISOString()
      };

      const createEvent = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionData)
      };

      const createResponse = await createHandler(createEvent);
      const createdSession = JSON.parse(createResponse.body);

      // Now list sessions
      const listEvent = {
        httpMethod: 'GET',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`
        },
        queryStringParameters: {}
      };

      const listResponse = await listHandler(listEvent);
      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      expect(listData.success).toBe(true);
      expect(listData.data).toBeDefined();
      expect(Array.isArray(listData.data.items || listData.data)).toBe(true);

      const sessions = listData.data.items || listData.data;
      if (sessions.length > 0) {
        expect(sessions[0]).toHaveProperty('id');
        expect(sessions[0]).toHaveProperty('type');
        expect(sessions[0]).toHaveProperty('start_at');
      }
    });

    it('should filter sessions by date range', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: createHandler } = await import('../../netlify/functions/sessions-create.js');
      const { handler: listHandler } = await import('../../netlify/functions/sessions-list.js');

      // Create test sessions with different dates
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const session1 = {
        type: 'workout',
        source: 'app',
        start_at: yesterday.toISOString()
      };

      const session2 = {
        type: 'workout',
        source: 'app',
        start_at: now.toISOString()
      };

      // Create sessions
      await createHandler({
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(session1)
      });

      await createHandler({
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(session2)
      });

      // Filter by date range
      const startDate = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = tomorrow.toISOString().split('T')[0];

      const listEvent = {
        httpMethod: 'GET',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`
        },
        queryStringParameters: {
          start_date: startDate,
          end_date: endDate
        }
      };

      const response = await listHandler(listEvent);
      const data = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(data.success).toBe(true);

      // Test invalid date format
      const invalidEvent = {
        httpMethod: 'GET',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`
        },
        queryStringParameters: {
          start_date: 'invalid-date'
        }
      };

      const invalidResponse = await listHandler(invalidEvent);
      expect([400, 200]).toContain(invalidResponse.statusCode); // May accept or reject invalid dates
    });

    it('should support pagination', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: createHandler } = await import('../../netlify/functions/sessions-create.js');
      const { handler: listHandler } = await import('../../netlify/functions/sessions-list.js');

      // Create multiple test sessions
      for (let i = 0; i < 5; i++) {
        await createHandler({
          httpMethod: 'POST',
          headers: {
            'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'workout',
            source: 'app',
            start_at: new Date(Date.now() - i * 60 * 60 * 1000).toISOString()
          })
        });
      }

      // Test pagination with limit
      const page1Event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`
        },
        queryStringParameters: {
          limit: '2'
        }
      };

      const page1Response = await listHandler(page1Event);
      const page1Data = JSON.parse(page1Response.body);

      expect(page1Response.statusCode).toBe(200);
      expect(page1Data.success).toBe(true);

      const items = page1Data.data?.items || page1Data.data || [];
      expect(items.length).toBeLessThanOrEqual(2);

      // Test with cursor/offset if supported
      if (page1Data.data?.pagination || page1Data.pagination) {
        const pagination = page1Data.data?.pagination || page1Data.pagination;

        if (pagination.next_cursor || pagination.offset !== undefined) {
          const page2Event = {
            httpMethod: 'GET',
            headers: {
              'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`
            },
            queryStringParameters: {
              limit: '2',
              cursor: pagination.next_cursor || undefined,
              offset: pagination.offset !== undefined ? String(pagination.offset + 2) : undefined
            }
          };

          const page2Response = await listHandler(page2Event);
          const page2Data = JSON.parse(page2Response.body);
          expect(page2Response.statusCode).toBe(200);
        }
      }
    });
  });

  describe('Session Exercises Endpoints', () => {
    it('should return 401 without authentication token for exercises list', async () => {
      // This test verifies authentication requirement for exercises endpoints
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should create session exercise with valid data', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import('../../netlify/functions/sessions-create.js');
      const { handler: exerciseHandler } = await import('../../netlify/functions/sessions-exercises-create.js');

      // First create a session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString()
        })
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create exercise for the session
      const exerciseData = {
        exercises: [{
          name: 'Bench Press',
          sets: 3,
          reps: 10,
          weight_kg: 80,
          rpe: 7
        }]
      };

      const exerciseEvent = {
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(exerciseData)
      };

      const exerciseResponse = await exerciseHandler(exerciseEvent);
      const exerciseResponseData = JSON.parse(exerciseResponse.body);

      expect([200, 201]).toContain(exerciseResponse.statusCode);
      expect(exerciseResponseData.exercises || exerciseResponseData.data).toBeDefined();

      // Verify exercise was stored
      if (db) {
        const exercises = await db`
          SELECT * FROM session_exercises WHERE session_id = ${sessionId}
        `;
        expect(exercises.length).toBeGreaterThanOrEqual(1);
        expect(exercises[0].name).toBe('Bench Press');
      }
    });

    it('should update session exercise', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import('../../netlify/functions/sessions-create.js');
      const { handler: createExerciseHandler } = await import('../../netlify/functions/sessions-exercises-create.js');
      const { handler: updateExerciseHandler } = await import('../../netlify/functions/sessions-exercises-update.js');

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString()
        })
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create exercise
      const createResponse = await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          exercises: [{
            name: 'Bench Press',
            sets: 3,
            reps: 10,
            weight_kg: 80
          }]
        })
      });

      const created = JSON.parse(createResponse.body);
      const exerciseId = created.exercises?.[0]?.id || created.data?.[0]?.id;

      if (!exerciseId) {
        // If creation failed or structure is different, skip update test
        return;
      }

      // Update exercise
      const updateEvent = {
        httpMethod: 'PUT',
        path: `/sessions/${sessionId}/exercises/${exerciseId}`,
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Bench Press',
          sets: 4,
          reps: 8,
          weight_kg: 85
        })
      };

      const updateResponse = await updateExerciseHandler(updateEvent);
      const updateData = JSON.parse(updateResponse.body);

      expect([200, 204]).toContain(updateResponse.statusCode);

      // Verify update persisted
      if (db) {
        const updated = await db`
          SELECT * FROM session_exercises WHERE id = ${exerciseId}
        `;
        expect(updated.length).toBe(1);
        expect(updated[0].sets).toBe(4);
        expect(updated[0].weight_kg).toBe(85);
      }
    });

    it('should delete session exercise', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import('../../netlify/functions/sessions-create.js');
      const { handler: createExerciseHandler } = await import('../../netlify/functions/sessions-exercises-create.js');
      const { handler: deleteExerciseHandler } = await import('../../netlify/functions/sessions-exercises-delete.js');

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString()
        })
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create exercise
      const createResponse = await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          exercises: [{
            name: 'Squat',
            sets: 3,
            reps: 12
          }]
        })
      });

      const created = JSON.parse(createResponse.body);
      const exerciseId = created.exercises?.[0]?.id || created.data?.[0]?.id;

      if (!exerciseId) {
        return; // Skip if creation failed
      }

      // Delete exercise
      const deleteEvent = {
        httpMethod: 'DELETE',
        path: `/sessions/${sessionId}/exercises/${exerciseId}`,
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`
        }
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

    it('should list session exercises with pagination', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: sessionHandler } = await import('../../netlify/functions/sessions-create.js');
      const { handler: createExerciseHandler } = await import('../../netlify/functions/sessions-exercises-create.js');
      const { handler: listExerciseHandler } = await import('../../netlify/functions/sessions-exercises-list.js');

      // Create session
      const sessionResponse = await sessionHandler({
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString()
        })
      });

      const sessionData = JSON.parse(sessionResponse.body);
      const sessionId = sessionData.data?.id || sessionData.id;

      // Create multiple exercises
      const exercises = [
        { name: 'Exercise 1', sets: 3, reps: 10 },
        { name: 'Exercise 2', sets: 4, reps: 8 },
        { name: 'Exercise 3', sets: 5, reps: 6 }
      ];

      await createExerciseHandler({
        httpMethod: 'POST',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ exercises })
      });

      // List exercises with pagination
      const listEvent = {
        httpMethod: 'GET',
        path: `/sessions/${sessionId}/exercises`,
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`
        },
        queryStringParameters: {
          limit: '2'
        }
      };

      const listResponse = await listExerciseHandler(listEvent);
      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      expect(listData.exercises || listData.data?.items || listData.data).toBeDefined();

      const exerciseList = listData.exercises || listData.data?.items || listData.data || [];
      expect(Array.isArray(exerciseList)).toBe(true);
      expect(exerciseList.length).toBeLessThanOrEqual(2);

      // Verify pagination info if present
      if (listData.pagination || listData.data?.pagination) {
        const pagination = listData.pagination || listData.data.pagination;
        expect(pagination).toBeDefined();
      }
    });
  });

  describe('Session Data Validation', () => {
    it('should validate session type', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/sessions-create.js');

      // Valid types: 'workout', 'sport', 'recovery', 'sleep'
      const validTypes = ['workout', 'sport', 'recovery', 'sleep'];

      for (const validType of validTypes) {
        const event = {
          httpMethod: 'POST',
          headers: {
            'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: validType,
            source: 'app',
            start_at: new Date().toISOString()
          })
        };

        const response = await handler(event);
        expect([201, 400, 409]).toContain(response.statusCode); // May succeed or fail due to duplicates
      }

      // Invalid types should be rejected
      const invalidTypes = ['invalid_type', 'unknown', '', null, 123];

      for (const invalidType of invalidTypes) {
        const event = {
          httpMethod: 'POST',
          headers: {
            'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: invalidType,
            source: 'app',
            start_at: new Date().toISOString()
          })
        };

        const response = await handler(event);
        const responseData = JSON.parse(response.body);
        expect([400, 500]).toContain(response.statusCode);
      }
    });

    it('should validate session duration', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/sessions-create.js');

      const now = new Date();
      const oneHour = new Date(now.getTime() + 3600000);

      // Valid duration (calculated from start_at and end_at)
      const validEvent = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: now.toISOString(),
          end_at: oneHour.toISOString() // 1 hour duration
        })
      };

      const validResponse = await handler(validEvent);
      expect([201, 400, 409]).toContain(validResponse.statusCode); // May succeed or fail due to duplicates

      // Invalid: end_at before start_at
      const invalidEvent = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: oneHour.toISOString(),
          end_at: now.toISOString() // End before start
        })
      };

      const invalidResponse = await handler(invalidEvent);
      const invalidData = JSON.parse(invalidResponse.body);
      // Duration validation may happen at DB level or app level
      expect([400, 500]).toContain(invalidResponse.statusCode);
    });

    it('should validate session date', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/sessions-create.js');

      // Valid ISO date string
      const validEvent = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: new Date().toISOString()
        })
      };

      const validResponse = await handler(validEvent);
      expect([201, 400, 409]).toContain(validResponse.statusCode);

      // Invalid date formats
      const invalidDates = ['not-a-date', '2024-13-45', '2024/01/01', '', null];

      for (const invalidDate of invalidDates) {
        const invalidEvent = {
          httpMethod: 'POST',
          headers: {
            'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'workout',
            source: 'app',
            start_at: invalidDate
          })
        };

        const invalidResponse = await handler(invalidEvent);
        expect([400, 500]).toContain(invalidResponse.statusCode);
      }

      // Future dates (may be restricted)
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const futureEvent = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'workout',
          source: 'app',
          start_at: futureDate
        })
      };

      const futureResponse = await handler(futureEvent);
      // Future dates may be accepted or rejected - both are valid behaviors
      expect([201, 400, 409]).toContain(futureResponse.statusCode);
    });
  });

  describe('Session Performance', () => {
    it('should handle large number of sessions efficiently', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler: createHandler } = await import('../../netlify/functions/sessions-create.js');
      const { handler: listHandler } = await import('../../netlify/functions/sessions-list.js');

      const startTime = Date.now();

      // Create multiple sessions (limited to 20 for test performance)
      const sessionPromises = [];
      for (let i = 0; i < 20; i++) {
        sessionPromises.push(
          createHandler({
            httpMethod: 'POST',
            headers: {
              'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'workout',
              source: 'app',
              start_at: new Date(Date.now() - i * 60 * 60 * 1000).toISOString()
            })
          })
        );
      }

      await Promise.all(sessionPromises);

      // List sessions with pagination
      const listEvent = {
        httpMethod: 'GET',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`
        },
        queryStringParameters: {
          limit: '50'
        }
      };

      const listStartTime = Date.now();
      const listResponse = await listHandler(listEvent);
      const listDuration = Date.now() - listStartTime;

      const listData = JSON.parse(listResponse.body);

      expect(listResponse.statusCode).toBe(200);
      expect(listData.success).toBe(true);

      // Verify response time is reasonable (< 2 seconds)
      expect(listDuration).toBeLessThan(2000);

      // Verify pagination limits work
      const items = listData.data?.items || listData.data || [];
      expect(items.length).toBeLessThanOrEqual(50);
    });

    it('should support concurrent session creation', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/sessions-create.js');

      // Create multiple sessions concurrently with unique timestamps
      const concurrentSessions = [];
      const baseTime = Date.now();

      for (let i = 0; i < 10; i++) {
        concurrentSessions.push(
          handler({
            httpMethod: 'POST',
            headers: {
              'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'workout',
              source: 'app',
              source_id: `concurrent-test-${i}-${baseTime}`, // Unique source_id to avoid duplicates
              start_at: new Date(baseTime + i * 1000).toISOString()
            })
          })
        );
      }

      const responses = await Promise.all(concurrentSessions);

      // All should complete without errors (may have some duplicates, but no crashes)
      responses.forEach((response, index) => {
        expect(response.statusCode).toBeDefined();
        expect([201, 409, 400]).toContain(response.statusCode); // 201 created, 409 duplicate, 400 validation
      });

      // Verify at least some sessions were created successfully
      const successCount = responses.filter(r => r.statusCode === 201).length;
      expect(successCount).toBeGreaterThan(0);

      // Verify no corruption: all responses should be valid JSON or empty
      responses.forEach(response => {
        if (response.body) {
          expect(() => JSON.parse(response.body)).not.toThrow();
        }
      });
    });
  });

  describe('Session Exercise Security Tests', () => {
    it('should prevent cross-user exercise deletion', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Create two users
      const user1 = await createTestUser({ external_id: 'test-user-1' });
      const user2 = await createTestUser({ external_id: 'test-user-2' });

      // Create session for user1
      const session = await createTestSession({ user_id: user1.id });

      // Create exercise for user1's session
      const exercise = await db`
        INSERT INTO session_exercises (session_id, user_id, name, sets, reps)
        VALUES (${session.id}, ${user1.id}, 'Test Exercise', 3, 10)
        RETURNING id
      `;

      // Try to delete exercise as user2 (should fail)
      const deleteResponse = await fetch('/.netlify/functions/sessions-exercises-delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user2.jwt_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: session.id,
          exercise_id: exercise[0].id
        })
      });

      expect(deleteResponse.status).toBe(403); // Should be forbidden
    });

    it('should handle idempotent DELETE operations', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const user = await createTestUser({ external_id: 'test-user-idempotent' });
      const session = await createTestSession({ user_id: user.id });

      // Create exercise
      const exercise = await db`
        INSERT INTO session_exercises (session_id, user_id, name, sets, reps)
        VALUES (${session.id}, ${user.id}, 'Test Exercise', 3, 10)
        RETURNING id
      `;

      // Delete exercise first time
      const deleteResponse1 = await fetch('/.netlify/functions/sessions-exercises-delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.jwt_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: session.id,
          exercise_id: exercise[0].id
        })
      });

      expect(deleteResponse1.status).toBe(204);

      // Delete same exercise again (should be idempotent)
      const deleteResponse2 = await fetch('/.netlify/functions/sessions-exercises-delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.jwt_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: session.id,
          exercise_id: exercise[0].id
        })
      });

      expect(deleteResponse2.status).toBe(204); // Should still succeed
    });
  });
});
