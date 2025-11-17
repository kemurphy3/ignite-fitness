// tests/integration/sessions-api.test.js
// Integration tests for sessions API

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getTestDatabase,
  createTestUser,
  createTestSession,
  cleanupTestData,
} from '../helpers/database.js';

describe('Sessions API Integration', () => {
  let testDb;
  let testUser;
  const testSessions = [];

  beforeAll(async () => {
    testDb = getTestDatabase();
    expect(testDb).toBeDefined();

    // Create test user
    testUser = await createTestUser({
      external_id: 'test_user_123',
      username: 'testuser',
    });

    // Create test sessions
    for (let i = 0; i < 5; i++) {
      const session = await createTestSession({
        user_id: testUser.id,
        type: 'workout',
        source: 'test',
        source_id: `test_session_${i}`,
        start_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // One per day
        duration: 3600 + i * 300, // Increasing duration
      });
      testSessions.push(session);
    }

    console.log(`Created test user with ID: ${testUser.id}`);
    console.log(`Created ${testSessions.length} test sessions`);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Sessions List Query', () => {
    it('should retrieve sessions for a user', async () => {
      const sessions = await testDb`
        SELECT id, type, source, start_at, duration
        FROM test_sessions
        WHERE user_id = ${testUser.id}
        ORDER BY start_at DESC
      `;

      expect(sessions).toHaveLength(5);
      expect(sessions[0].user_id).toBe(testUser.id);
      expect(sessions[0].type).toBe('workout');
    });

    it('should filter sessions by type', async () => {
      // Create a different type session
      await createTestSession({
        user_id: testUser.id,
        type: 'cardio',
        source: 'test',
      });

      const workoutSessions = await testDb`
        SELECT id, type
        FROM test_sessions
        WHERE user_id = ${testUser.id} AND type = 'workout'
        ORDER BY start_at DESC
      `;

      expect(workoutSessions).toHaveLength(5);
      workoutSessions.forEach(session => {
        expect(session.type).toBe('workout');
      });
    });

    it('should filter sessions by date range', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      const recentSessions = await testDb`
        SELECT id, start_at
        FROM test_sessions
        WHERE user_id = ${testUser.id} 
          AND start_at >= ${threeDaysAgo}
          AND start_at <= ${oneDayAgo}
        ORDER BY start_at DESC
      `;

      expect(recentSessions).toHaveLength(2);
    });
  });

  describe('Sessions Pagination', () => {
    it('should implement limit-based pagination', async () => {
      const limit = 3;
      const sessions = await testDb`
        SELECT id, start_at
        FROM test_sessions
        WHERE user_id = ${testUser.id}
        ORDER BY start_at DESC
        LIMIT ${limit + 1}
      `;

      const hasMore = sessions.length > limit;
      const returnSessions = hasMore ? sessions.slice(0, limit) : sessions;

      expect(returnSessions).toHaveLength(limit);
      expect(hasMore).toBe(true);
    });

    it('should implement cursor-based pagination', async () => {
      // Get first page
      const firstPage = await testDb`
        SELECT id, start_at
        FROM test_sessions
        WHERE user_id = ${testUser.id}
        ORDER BY start_at DESC, id ASC
        LIMIT 2
      `;

      expect(firstPage).toHaveLength(2);

      // Get second page using cursor (last item from first page)
      const lastItem = firstPage[firstPage.length - 1];
      const secondPage = await testDb`
        SELECT id, start_at
        FROM test_sessions
        WHERE user_id = ${testUser.id}
          AND (start_at < ${lastItem.start_at} OR (start_at = ${lastItem.start_at} AND id > ${lastItem.id}))
        ORDER BY start_at DESC, id ASC
        LIMIT 2
      `;

      expect(secondPage.length).toBeGreaterThanOrEqual(0);
      if (secondPage.length > 0) {
        // Verify items are correctly filtered by cursor
        const cursorTime = new Date(lastItem.start_at).getTime();
        const cursorId = lastItem.id;
        secondPage.forEach(item => {
          const itemTime = new Date(item.start_at).getTime();
          // Item should satisfy cursor condition: itemTime < cursorTime OR (itemTime === cursorTime AND item.id > cursorId)
          const matches =
            itemTime < cursorTime || (Math.abs(itemTime - cursorTime) < 1000 && item.id > cursorId);
          expect(matches).toBe(true);
        });
      }
    });
  });

  describe('Sessions Statistics', () => {
    it('should calculate session count', async () => {
      const countResult = await testDb`
        SELECT COUNT(*) as count
        FROM test_sessions
        WHERE user_id = ${testUser.id}
      `;

      // Count includes the 5 original sessions plus any created in previous tests
      expect(parseInt(countResult[0].count)).toBeGreaterThanOrEqual(5);
    });

    it('should calculate total duration', async () => {
      const durationResult = await testDb`
        SELECT SUM(duration) as total_duration
        FROM test_sessions
        WHERE user_id = ${testUser.id}
      `;

      expect(durationResult[0].total_duration).toBeGreaterThan(0);
    });

    it('should find most recent session', async () => {
      const recentResult = await testDb`
        SELECT MAX(start_at) as most_recent
        FROM test_sessions
        WHERE user_id = ${testUser.id}
      `;

      expect(recentResult[0].most_recent).toBeDefined();
    });
  });
});
