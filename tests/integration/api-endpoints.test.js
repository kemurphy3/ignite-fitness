// tests/integration/api-endpoints.test.js
// Integration tests for API endpoints

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDatabase, createTestUser, createTestSession, cleanupTestData } from '../helpers/database.js';

// Mock the Netlify function handler
const mockHandler = async (event, userId = 1) => {
  // Simulate sessions-list.js handler logic
  const testDb = getTestDatabase();
  const queryParams = event.queryStringParameters || {};
  
  // Validate pagination parameters
  const limit = Math.min(parseInt(queryParams.limit) || 20, 100);
  
  // Get sessions with pagination
  const sessions = await testDb`
    SELECT id, type, source, source_id, start_at, end_at, duration, 
           payload, session_hash, created_at, updated_at
    FROM test_sessions
    WHERE user_id = ${userId}
    ORDER BY start_at DESC, id ASC
    LIMIT ${limit + 1}
  `;
  
  const hasMore = sessions.length > limit;
  const returnSessions = hasMore ? sessions.slice(0, limit) : sessions;
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      sessions: returnSessions,
      pagination: {
        has_more: hasMore,
        count: returnSessions.length,
        limit: limit
      }
    })
  };
};

describe('API Endpoints Integration', () => {
  let testDb;
  let testUser;
  let testSessions = [];
  
  beforeAll(async () => {
    testDb = getTestDatabase();
    expect(testDb).toBeDefined();
    
    // Create test user
    testUser = await createTestUser({
      external_id: 'api_test_user',
      username: 'apitestuser'
    });
    
    // Create test sessions
    for (let i = 0; i < 8; i++) {
      const session = await createTestSession({
        user_id: testUser.id,
        type: 'workout',
        source: 'test',
        source_id: `api_session_${i}`,
        start_at: new Date(Date.now() - (i * 2 * 60 * 60 * 1000)), // Every 2 hours
        duration: 3600
      });
      testSessions.push(session);
    }
  });
  
  afterAll(async () => {
    await cleanupTestData();
  });
  
  describe('Sessions List API', () => {
    it('should return sessions with default pagination', async () => {
      const event = {
        queryStringParameters: {}
      };
      
      const response = await mockHandler(event, testUser.id);
      const body = JSON.parse(response.body);
      
      expect(response.statusCode).toBe(200);
      expect(body.sessions).toHaveLength(8); // All sessions since limit > count
      expect(body.pagination.has_more).toBe(false);
      expect(body.pagination.count).toBe(8);
      expect(body.pagination.limit).toBe(20);
    });
    
    it('should return sessions with custom limit', async () => {
      const event = {
        queryStringParameters: { limit: '3' }
      };
      
      const response = await mockHandler(event, testUser.id);
      const body = JSON.parse(response.body);
      
      expect(response.statusCode).toBe(200);
      expect(body.sessions).toHaveLength(3);
      expect(body.pagination.has_more).toBe(true);
      expect(body.pagination.count).toBe(3);
      expect(body.pagination.limit).toBe(3);
    });
    
    it('should enforce maximum limit', async () => {
      const event = {
        queryStringParameters: { limit: '150' }
      };
      
      const response = await mockHandler(event, testUser.id);
      const body = JSON.parse(response.body);
      
      expect(response.statusCode).toBe(200);
      expect(body.pagination.limit).toBe(100); // Should be capped at 100
    });
    
    it('should handle empty result set', async () => {
      // Create a handler that returns no sessions
      const emptyHandler = async (event) => {
        const testDb = getTestDatabase();
        const limit = Math.min(parseInt(event.queryStringParameters?.limit) || 20, 100);
        
        const sessions = await testDb`
          SELECT id, type, source, source_id, start_at, end_at, duration, 
                 payload, session_hash, created_at, updated_at
          FROM test_sessions
          WHERE user_id = 999999 -- Non-existent user
          ORDER BY start_at DESC, id ASC
          LIMIT ${limit + 1}
        `;
        
        const hasMore = sessions.length > limit;
        const returnSessions = hasMore ? sessions.slice(0, limit) : sessions;
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            sessions: returnSessions,
            pagination: {
              has_more: hasMore,
              count: returnSessions.length,
              limit: limit
            }
          })
        };
      };
      
      const event = {
        queryStringParameters: { limit: '10' }
      };
      
      const response = await emptyHandler(event);
      const body = JSON.parse(response.body);
      
      expect(response.statusCode).toBe(200);
      expect(body.sessions).toHaveLength(0);
      expect(body.pagination.has_more).toBe(false);
      expect(body.pagination.count).toBe(0);
    });
  });
  
  describe('API Response Format', () => {
    it('should return properly formatted session data', async () => {
      const event = {
        queryStringParameters: { limit: '1' }
      };
      
      const response = await mockHandler(event, testUser.id);
      const body = JSON.parse(response.body);
      
      expect(body.sessions).toHaveLength(1);
      
      const session = body.sessions[0];
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('type');
      expect(session).toHaveProperty('source');
      expect(session).toHaveProperty('source_id');
      expect(session).toHaveProperty('start_at');
      expect(session).toHaveProperty('end_at');
      expect(session).toHaveProperty('duration');
      expect(session).toHaveProperty('payload');
      expect(session).toHaveProperty('session_hash');
      expect(session).toHaveProperty('created_at');
      expect(session).toHaveProperty('updated_at');
    });
    
    it('should return properly formatted pagination metadata', async () => {
      const event = {
        queryStringParameters: { limit: '3' }
      };
      
      const response = await mockHandler(event, testUser.id);
      const body = JSON.parse(response.body);
      
      expect(body.pagination).toHaveProperty('has_more');
      expect(body.pagination).toHaveProperty('count');
      expect(body.pagination).toHaveProperty('limit');
      expect(typeof body.pagination.has_more).toBe('boolean');
      expect(typeof body.pagination.count).toBe('number');
      expect(typeof body.pagination.limit).toBe('number');
    });
  });
});
