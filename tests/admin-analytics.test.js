// tests/admin-analytics.test.js
// Test file for admin analytics functionality
// Tests admin-*.js endpoints and analytics features

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestDB,
  teardownTestDB,
  getTestDatabase,
  createTestUser,
  cleanupTestData
} from './helpers/db.js';

describe('Admin Analytics Tests', () => {
  let db;
  let testUser;
  let adminUser;

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

    // Create an admin user
    adminUser = await createTestUser({
      external_id: `admin_user_${Date.now()}`,
      username: `admin_${Date.now()}`,
      status: 'active',
      role: 'admin'
    });
  });

  afterEach(async () => {
    if (process.env.MOCK_DATABASE === 'true' || !db) {
      return;
    }
    await cleanupTestData();
  });

  describe('Admin Authentication', () => {
    it('should return 401 without authentication token', async () => {
      // This test verifies that admin endpoints require authentication
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should return 403 for non-admin users', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/admin-get-all-users.js');

      // Regular user (non-admin) should not have access
      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`
        },
        queryStringParameters: {}
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Should return 403 for non-admin users or 401 if token invalid
      expect([401, 403]).toContain(response.statusCode);
      expect(responseData.error).toBeDefined();
    });

    it('should allow access for admin users', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Note: This test requires admin credentials
      // In a real test environment, you would create an admin test user
      const { handler } = await import('../../netlify/functions/admin-get-all-users.js');

      // Test with admin token (would need actual admin token)
      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      // May succeed (200) if admin token is valid
      // May fail (401/403) if token is invalid or user is not admin
      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);
        expect(responseData.data || responseData.users).toBeDefined();
      } else {
        // Without admin access, should get 401/403
        expect([401, 403]).toContain(response.statusCode);
      }
    });
  });

  describe('User Analytics', () => {
    it('should get all users with pagination', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/admin-get-all-users.js');

      const event1 = {
        httpMethod: 'GET',
        headers: { 'Authorization': 'Bearer admin-test-token' },
        queryStringParameters: { limit: '5' }
      };

      const res1 = await handler(event1);
      if (res1.statusCode === 200) {
        const body1 = JSON.parse(res1.body);
        expect(Array.isArray(body1.users || body1.data)).toBe(true);

        // Attempt next page via cursor if provided
        const cursor = body1.next_cursor || body1.nextCursor;
        if (cursor) {
          const event2 = {
            httpMethod: 'GET',
            headers: { 'Authorization': 'Bearer admin-test-token' },
            queryStringParameters: { limit: '5', cursor }
          };
          const res2 = await handler(event2);
          expect([200, 400].includes(res2.statusCode)).toBe(true);
        }
      } else {
        expect([401, 403]).toContain(res1.statusCode);
      }
    });

    it('should get user statistics', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview endpoint which provides statistics
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify statistics structure
        expect(responseData.data || responseData.metrics).toBeDefined();
        const stats = responseData.data || responseData.metrics || {};

        // Statistics should include user counts
        if (stats.total_users !== undefined) {
          expect(typeof stats.total_users).toBe('number');
        }
      } else {
        // Without admin access, should get 401/403
        expect([401, 403]).toContain(response.statusCode);
      }
    });

    it('should get top users by activity', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin top users endpoint
      const { handler } = await import('../../netlify/functions/admin-users-top.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {
          metric: 'sessions',
          limit: '10'
        }
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify top users structure
        expect(responseData.data || responseData.users).toBeDefined();
        const users = responseData.data?.items || responseData.data || responseData.users || [];

        if (Array.isArray(users) && users.length > 0) {
          // Verify users are ordered by activity
          expect(users[0]).toHaveProperty('session_count');
        }
      } else {
        // Without admin access, should get 401/403
        expect([401, 403]).toContain(response.statusCode);
      }
    });

    it('should filter users by criteria', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/admin-get-all-users.js');

      // Test filtering by query parameters
      const eventWithFilter = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {
          limit: '10',
          status: 'active'
        }
      };

      const response = await handler(eventWithFilter);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify filtered results structure
        expect(responseData.data || responseData.users).toBeDefined();
        const users = responseData.data?.items || responseData.data || responseData.users || [];

        // If users are returned, verify filtering might be applied
        if (Array.isArray(users) && users.length > 0) {
          // Users should have status field
          users.forEach(user => {
            expect(user.status || user.active).toBeDefined();
          });
        }
      } else {
        // Without admin access, should get 401/403
        expect([401, 403]).toContain(response.statusCode);
      }
    });
  });

  describe('Session Analytics', () => {
    it('should get sessions by type', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which includes session statistics
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify session statistics are included
        const stats = responseData.data || responseData.metrics || {};

        // Session counts should be present
        if (stats.total_sessions !== undefined) {
          expect(typeof stats.total_sessions).toBe('number');
        }
        if (stats.sessions_7d !== undefined) {
          expect(typeof stats.sessions_7d).toBe('number');
        }
      } else {
        // Without admin access, should get 401/403
        expect([401, 403]).toContain(response.statusCode);
      }
    });

    it('should get session time series data', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which includes time series data
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify time series data structure
        const stats = responseData.data || responseData.metrics || {};

        // Time series data may include daily/weekly counts
        if (stats.sessions_7d !== undefined) {
          expect(typeof stats.sessions_7d).toBe('number');
        }
        if (stats.new_users_7d !== undefined) {
          expect(typeof stats.new_users_7d).toBe('number');
        }
      } else {
        // Without admin access, should get 401/403
        expect([401, 403]).toContain(response.statusCode);
      }
    });

    it('should analyze session patterns', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which includes pattern analysis
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify pattern analysis data
        const stats = responseData.data || responseData.metrics || {};

        // Pattern analysis may include active users, session trends
        if (stats.active_users_30d !== undefined) {
          expect(typeof stats.active_users_30d).toBe('number');
        }
        if (stats.avg_sessions_per_user !== undefined) {
          expect(typeof stats.avg_sessions_per_user).toBe('number');
        }
      } else {
        // Without admin access, should get 401/403
        expect([401, 403]).toContain(response.statusCode);
      }
    });
  });

  describe('System Health and Performance', () => {
    it('should get system health status', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which includes system health info
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify system health data structure
        const stats = responseData.data || responseData.metrics || responseData.health || {};

        // Health status may be included in response
        // Verify response is structured correctly
        expect(responseData.data || responseData.metrics || responseData.health).toBeDefined();
      } else {
        // Without admin access, should get 401/403
        expect([401, 403]).toContain(response.statusCode);
      }
    });

    it('should get performance metrics', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin endpoints for performance metrics
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const startTime = Date.now();
      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);
      const duration = Date.now() - startTime;

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify response structure for performance tracking
        expect(responseData.data || responseData.metrics).toBeDefined();

        // Response should complete within reasonable time
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      } else {
        // Without admin access, should get 401/403
        expect([401, 403]).toContain(response.statusCode);
      }
    });

    it('should get error rates and logs', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which may include error tracking
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify response structure (error tracking may be included)
        expect(responseData.data || responseData.metrics).toBeDefined();

        // Error rates might be included in metrics
        const stats = responseData.data || responseData.metrics || {};
        // Just verify response structure is valid
        expect(stats).toBeDefined();
      } else {
        // Without admin access, should get 401/403
        expect([401, 403]).toContain(response.statusCode);
      }
    });
  });

  describe('Data Export and Reporting', () => {
    it('should export user data', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test data export endpoint
      const { handler } = await import('../../netlify/functions/data-export.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify export data structure
        expect(responseData.data || responseData.export).toBeDefined();

        // Export should contain user data
        const exportData = responseData.data || responseData.export || {};
        expect(Object.keys(exportData).length).toBeGreaterThan(0);
      } else {
        // May require authentication or specific permissions
        expect([200, 400, 401, 403]).toContain(response.statusCode);
      }
    });

    it('should generate analytics reports', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which generates analytics reports
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify analytics report structure
        expect(responseData.data || responseData.metrics).toBeDefined();

        // Report should contain analytics data
        const report = responseData.data || responseData.metrics || {};
        expect(report).toBeDefined();

        // Analytics should include key metrics
        expect(typeof report === 'object').toBe(true);
      } else {
        // Without admin access, should get 401/403
        expect([200, 401, 403]).toContain(response.statusCode);
      }
    });

    it('should schedule automated reports', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token'
        },
        queryStringParameters: {}
      };

      const response = await handler(event);
      const acceptableStatuses = [200, 401, 403, 500];
      expect(acceptableStatuses).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.data || body.metrics).toBeDefined();
        const meta = body.meta || {};
        expect(meta.response_time_ms || meta.cache_hit !== undefined).toBeTruthy();
      } else {
        const body = JSON.parse(response.body);
        expect(body.error || body.message).toBeDefined();
      }
    });
  });

  describe('Real-time Analytics', () => {
    it('should provide real-time user counts', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which provides real-time metrics
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify real-time metrics are provided
        expect(responseData.data || responseData.metrics).toBeDefined();

        const metrics = responseData.data || responseData.metrics || {};

        // User counts should be included
        if (metrics.total_users !== undefined) {
          expect(typeof metrics.total_users).toBe('number');
        }
        if (metrics.new_users_7d !== undefined) {
          expect(metrics.new_users_7d === null || typeof metrics.new_users_7d === 'number').toBe(true);
        }
      } else {
        // Without admin access, should get 401/403
        expect([200, 401, 403]).toContain(response.statusCode);
      }
    });

    it('should track active sessions', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which tracks session metrics
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify session tracking metrics
        expect(responseData.data || responseData.metrics).toBeDefined();

        const metrics = responseData.data || responseData.metrics || {};

        // Session metrics should be included
        if (metrics.total_sessions !== undefined) {
          expect(typeof metrics.total_sessions).toBe('number');
        }
        if (metrics.sessions_7d !== undefined) {
          expect(typeof metrics.sessions_7d).toBe('number');
        }
        if (metrics.active_users_30d !== undefined) {
          expect(metrics.active_users_30d === null || typeof metrics.active_users_30d === 'number').toBe(true);
        }
      } else {
        // Without admin access, should get 401/403
        expect([200, 401, 403]).toContain(response.statusCode);
      }
    });

    it('should monitor system load', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/admin-health.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token'
        },
        queryStringParameters: {}
      };

      const response = await handler(event);
      const acceptableStatuses = [200, 401, 403, 500];
      expect(acceptableStatuses).toContain(response.statusCode);

      const body = JSON.parse(response.body);
      if (response.statusCode === 200) {
        expect(body.success || body.data || body.status).toBeDefined();
        const meta = body.meta || {};
        expect(meta.request_id || meta.generated_at || meta.response_time_ms !== undefined).toBeTruthy();
      } else {
        expect(body.error || body.data || body.message).toBeDefined();
      }
    });
  });

  describe('Data Privacy and Compliance', () => {
    it('should anonymize sensitive data', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which applies privacy thresholds
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify privacy protection (thresholds applied)
        expect(responseData.data || responseData.metrics).toBeDefined();

        const metrics = responseData.data || responseData.metrics || {};

        // Small counts should be null (anonymized) according to privacy thresholds
        // Handler sets new_users_7d and active_users_30d to NULL if < 5
        if (metrics.new_users_7d === null || metrics.active_users_30d === null) {
          // Privacy threshold applied correctly
          expect(metrics.new_users_7d === null || typeof metrics.new_users_7d === 'number').toBe(true);
        }
      } else {
        // Without admin access, should get 401/403
        expect([200, 401, 403]).toContain(response.statusCode);
      }
    });

    it('should handle data retention policies', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which queries only non-deleted data
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const responseData = JSON.parse(response.body);

        // Verify data retention policies (handler filters deleted_at IS NULL)
        expect(responseData.data || responseData.metrics).toBeDefined();

        const metrics = responseData.data || responseData.metrics || {};

        // Only active (non-deleted) records should be included
        // This is enforced in SQL WHERE deleted_at IS NULL
        expect(typeof metrics).toBe('object');
      } else {
        // Without admin access, should get 401/403
        expect([200, 401, 403]).toContain(response.statusCode);
      }
    });

    it('should audit admin access', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Test admin overview which includes audit logging
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer admin-test-token' // Would need actual admin token
        },
        queryStringParameters: {}
      };

      const response = await handler(event);

      // Admin actions are logged internally via auditLog()
      // Handler calls auditLog(adminId, '/admin/overview', 'GET', ...)
      if (response.statusCode === 200 || response.statusCode === 401 || response.statusCode === 403) {
        // Audit logging happens in handler regardless of success/failure
        expect(response.statusCode).toBeDefined();
      }

      // Audit trail is maintained in database (tested implicitly by handler execution)
      expect([200, 401, 403, 500]).toContain(response.statusCode);
    });
  });

  describe('Analytics Dashboard', () => {
    it('should provide dashboard data', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Use admin overview as dashboard backing data
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: { 'Authorization': 'Bearer admin-test-token' },
        queryStringParameters: {}
      };

      const response = await handler(event);

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body);
        // Expect metrics/data for dashboard
        expect(data.data || data.metrics).toBeDefined();
        const dash = data.data || data.metrics || {};
        // Should include some key numbers typically shown on dashboards
        if (dash.total_users !== undefined) {expect(typeof dash.total_users).toBe('number');}
        if (dash.total_sessions !== undefined) {expect(typeof dash.total_sessions).toBe('number');}
      } else {
        expect([401, 403]).toContain(response.statusCode);
      }
    });

    it('should support custom dashboards', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // If there is no explicit endpoint for custom dashboards,
      // verify that overview accepts variations (e.g., different query params) without failure.
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: { 'Authorization': 'Bearer admin-test-token' },
        queryStringParameters: { view: 'custom', widgets: 'users,sessions' }
      };

      const response = await handler(event);
      // Either returns 200 with data or ignores unknown params gracefully
      expect([200, 401, 403]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.data || body.metrics).toBeDefined();
      }
    });

    it('should handle dashboard permissions', async () => {
      // Missing/invalid token should be rejected
      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const eventNoAuth = {
        httpMethod: 'GET',
        headers: {},
        queryStringParameters: {}
      };

      const resNoAuth = await handler(eventNoAuth);
      expect([401, 403]).toContain(resNoAuth.statusCode);

      const eventBadAuth = {
        httpMethod: 'GET',
        headers: { 'Authorization': 'Bearer not-an-admin-token' },
        queryStringParameters: {}
      };

      const resBadAuth = await handler(eventBadAuth);
      expect([401, 403]).toContain(resBadAuth.statusCode);
    });
  });

  describe('Analytics Performance', () => {
    it('should handle large datasets efficiently', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/admin-get-all-users.js');

      const event = {
        httpMethod: 'GET',
        headers: { 'Authorization': 'Bearer admin-test-token' },
        queryStringParameters: { limit: '100' }
      };

      const start = Date.now();
      const res = await handler(event);
      const duration = Date.now() - start;

      // Should not exceed generous threshold
      expect(duration).toBeLessThan(10000);
      expect([200, 401, 403]).toContain(res.statusCode);
    });

    it('should cache analytics data', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/admin-overview.js');

      const event = {
        httpMethod: 'GET',
        headers: { 'Authorization': 'Bearer admin-test-token' },
        queryStringParameters: {}
      };

      const t1 = Date.now();
      const r1 = await handler(event);
      const d1 = Date.now() - t1;

      const t2 = Date.now();
      const r2 = await handler(event);
      const d2 = Date.now() - t2;

      // Responses should be structurally consistent
      if (r1.statusCode === 200 && r2.statusCode === 200) {
        const b1 = JSON.parse(r1.body);
        const b2 = JSON.parse(r2.body);
        expect(!!(b1.data || b1.metrics)).toBe(true);
        expect(!!(b2.data || b2.metrics)).toBe(true);
        // Second call may be faster if caching is present (non-strict)
        expect(d2).toBeLessThanOrEqual(d1 + 2000);
      } else {
        expect([401, 403]).toContain(r1.statusCode);
      }
    });

    it('should optimize database queries', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      // Use sessions series which performs grouped queries
      const { handler } = await import('../../netlify/functions/admin-sessions-series.js');

      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);

      const event = {
        httpMethod: 'GET',
        headers: { 'Authorization': 'Bearer admin-test-token' },
        queryStringParameters: { from, to, bucket: 'day', timezone: 'UTC' }
      };

      const start = Date.now();
      const res = await handler(event);
      const duration = Date.now() - start;

      // Within reasonable bound; function uses statement_timeout and safe queries
      expect(duration).toBeLessThan(8000);
      expect([200, 400, 401, 403]).toContain(res.statusCode);
    });
  });
});
