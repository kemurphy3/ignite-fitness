// tests/integration/pagination-integration.test.js
// Integration tests for pagination functionality

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getTestDatabase,
  createTestUser,
  createTestSession,
  cleanupTestData,
} from '../helpers/database.js';
import {
  createPaginatedResponse,
  getCursorDataForItem,
  buildCursorCondition,
  encodeCursor,
  decodeCursor,
} from '../../netlify/functions/utils/pagination.js';

describe('Pagination Integration Tests', () => {
  let testDb;
  let testUser;
  const testSessions = [];

  beforeAll(async () => {
    testDb = getTestDatabase();
    expect(testDb).toBeDefined();

    // Create test user
    testUser = await createTestUser({
      external_id: 'pagination_test_user',
      username: 'paginationuser',
    });

    // Create test sessions for pagination testing
    for (let i = 0; i < 10; i++) {
      const session = await createTestSession({
        user_id: testUser.id,
        type: 'workout',
        source: 'test',
        source_id: `pagination_session_${i}`,
        start_at: new Date(Date.now() - i * 60 * 60 * 1000), // One per hour
        duration: 3600,
      });
      testSessions.push(session);
    }
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Cursor-Based Pagination Integration', () => {
    it('should implement full cursor pagination workflow', async () => {
      // Step 1: Get first page
      const firstPage = await testDb`
        SELECT id, start_at, created_at
        FROM test_sessions
        WHERE user_id = ${testUser.id}
        ORDER BY start_at DESC, id ASC
        LIMIT 3
      `;

      expect(firstPage).toHaveLength(3);

      // Step 2: Create cursor from last item
      const lastItem = firstPage[firstPage.length - 1];
      const cursorData = getCursorDataForItem(lastItem, 'sessions');
      const cursor = encodeCursor(cursorData);

      expect(cursor).toBeDefined();

      // Step 3: Decode cursor and verify
      const decodedCursor = decodeCursor(cursor);
      expect(decodedCursor.id).toBe(lastItem.id);
      expect(new Date(decodedCursor.timestamp)).toEqual(lastItem.start_at);

      // Step 4: Build cursor condition
      const cursorCondition = buildCursorCondition(cursor, 'start_at DESC, id ASC');
      expect(cursorCondition.condition).toContain('start_at <');
      expect(cursorCondition.condition).toContain('id >');

      // Step 5: Get second page using cursor
      const secondPage = await testDb`
        SELECT id, start_at, created_at
        FROM test_sessions
        WHERE user_id = ${testUser.id}
          AND (start_at < ${decodedCursor.timestamp} OR (start_at = ${decodedCursor.timestamp} AND id > ${decodedCursor.id}))
        ORDER BY start_at DESC, id ASC
        LIMIT 3
      `;

      expect(secondPage).toHaveLength(3);
      expect(secondPage[0].start_at.getTime()).toBeLessThanOrEqual(
        lastItem.start_at.getTime() + 1000
      ); // Allow 1 second tolerance
    });

    it('should handle pagination with createPaginatedResponse', async () => {
      // Get all sessions
      const allSessions = await testDb`
        SELECT id, start_at, created_at
        FROM test_sessions
        WHERE user_id = ${testUser.id}
        ORDER BY start_at DESC, id ASC
      `;

      // Create paginated response
      const paginatedResponse = createPaginatedResponse(
        allSessions,
        3, // limit
        item => getCursorDataForItem(item, 'sessions'),
        { includeTotal: true, total: allSessions.length }
      );

      expect(paginatedResponse.data).toHaveLength(3);
      expect(paginatedResponse.pagination.has_more).toBe(true);
      expect(paginatedResponse.pagination.count).toBe(3);
      expect(paginatedResponse.pagination.limit).toBe(3);
      expect(paginatedResponse.pagination.next_cursor).toBeTruthy();
      expect(paginatedResponse.pagination.total).toBe(allSessions.length);
    });

    it('should handle last page correctly', async () => {
      // Get sessions with limit larger than available
      const sessions = await testDb`
        SELECT id, start_at, created_at
        FROM test_sessions
        WHERE user_id = ${testUser.id}
        ORDER BY start_at DESC, id ASC
        LIMIT 20
      `;

      const paginatedResponse = createPaginatedResponse(
        sessions,
        15, // limit larger than available
        item => getCursorDataForItem(item, 'sessions')
      );

      expect(paginatedResponse.data).toHaveLength(sessions.length);
      expect(paginatedResponse.pagination.has_more).toBe(false);
      expect(paginatedResponse.pagination.next_cursor).toBeNull();
    });
  });

  describe('Pagination Edge Cases', () => {
    it('should handle empty result set', async () => {
      const emptySessions = await testDb`
        SELECT id, start_at, created_at
        FROM test_sessions
        WHERE user_id = ${testUser.id} AND type = 'nonexistent'
        ORDER BY start_at DESC, id ASC
      `;

      const paginatedResponse = createPaginatedResponse(emptySessions, 10, item =>
        getCursorDataForItem(item, 'sessions')
      );

      expect(paginatedResponse.data).toHaveLength(0);
      expect(paginatedResponse.pagination.has_more).toBe(false);
      expect(paginatedResponse.pagination.count).toBe(0);
      expect(paginatedResponse.pagination.next_cursor).toBeNull();
    });

    it('should handle single item result', async () => {
      const singleSession = await testDb`
        SELECT id, start_at, created_at
        FROM test_sessions
        WHERE user_id = ${testUser.id}
        ORDER BY start_at DESC, id ASC
        LIMIT 1
      `;

      const paginatedResponse = createPaginatedResponse(
        singleSession,
        5, // limit larger than available
        item => getCursorDataForItem(item, 'sessions')
      );

      expect(paginatedResponse.data).toHaveLength(1);
      expect(paginatedResponse.pagination.has_more).toBe(false);
      expect(paginatedResponse.pagination.count).toBe(1);
      expect(paginatedResponse.pagination.next_cursor).toBeNull();
    });
  });

  describe('Pagination Performance', () => {
    it('should perform well with large datasets', async () => {
      const startTime = Date.now();

      // Query with pagination
      const sessions = await testDb`
        SELECT id, start_at, created_at
        FROM test_sessions
        WHERE user_id = ${testUser.id}
        ORDER BY start_at DESC, id ASC
        LIMIT 5
      `;

      const queryTime = Date.now() - startTime;

      expect(sessions).toHaveLength(5);
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
