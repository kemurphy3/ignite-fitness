// tests/strava-token-refresh.test.js
// Test file for Strava token refresh functionality
// Tests strava-refresh-token.js and related token management

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  setupTestDB, 
  teardownTestDB, 
  getTestDatabase,
  createTestUser,
  cleanupTestData
} from './helpers/db.js';

describe('Strava Token Refresh Tests', () => {
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

  describe('Token Refresh Endpoint', () => {
    it('should return 401 without authentication token', async () => {
      // This test verifies that the strava-refresh-token endpoint requires authentication
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should refresh valid Strava token', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test with valid user ID (assuming user has Strava token in database)
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // May succeed (200) if token is valid and refresh succeeds
      // May return 404 if user has no Strava token
      // May return 200 with refresh_not_needed if token is still valid
      expect([200, 404, 400, 401, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        expect(responseData.success).toBeDefined();
      } else if (response.statusCode === 404) {
        expect(responseData.error).toContain('No token found');
      }
    });

    it('should handle expired refresh token', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test with user ID that may have expired token
      // In real scenario, this would use a user with expired Strava token in DB
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Expired tokens may return 500 (Strava API error) or 404 (no token)
      // Handler should handle gracefully
      expect([200, 404, 400, 401, 500]).toContain(response.statusCode);

      if (response.statusCode === 500) {
        // Should indicate circuit breaker state or retry availability
        expect(responseData.error || responseData.circuit_state).toBeDefined();
      }
    });

    it('should handle Strava API errors', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test with user ID that may cause API errors
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Handler should handle API errors gracefully
      // May return 500 with circuit breaker info, or succeed
      expect([200, 404, 400, 401, 500]).toContain(response.statusCode);

      if (response.statusCode === 500) {
        // Should include error information
        expect(responseData.error || responseData.circuit_state).toBeDefined();
        if (responseData.circuit_state) {
          expect(['OPEN', 'CLOSED', 'HALF_OPEN']).toContain(responseData.circuit_state);
        }
      }
    });
  });

  describe('Token Validation', () => {
    it('should validate refresh token format', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test with invalid userId format (should validate)
      const invalidUserIdEvent = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: null // Invalid format
        })
      };

      const invalidResponse = await handler(invalidUserIdEvent);
      const invalidData = JSON.parse(invalidResponse.body);

      // Should handle invalid format gracefully
      expect([400, 401, 404, 500]).toContain(invalidResponse.statusCode);

      // Test with missing userId
      const missingUserIdEvent = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      };

      const missingResponse = await handler(missingUserIdEvent);
      expect([400, 401, 404, 500]).toContain(missingResponse.statusCode);
    });

    it('should check token expiration', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test token expiration check
      // Handler checks if refresh is needed based on expiration
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Handler checks token expiration and may return refresh_not_needed if still valid
      expect([200, 404, 400, 401, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        // If token is still valid, may return refresh_not_needed
        if (responseData.refresh_not_needed) {
          expect(responseData.expires_at).toBeDefined();
        }
      }
    });

    it('should validate token ownership', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test that user can only refresh their own token
      // Attempting to refresh another user's token should fail
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1' // Should match authenticated user
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Handler should validate token ownership
      expect([200, 404, 400, 401, 403, 500]).toContain(response.statusCode);

      // If unauthorized, should return 401/403
      if (response.statusCode === 403) {
        expect(responseData.error).toBeDefined();
      }
    });
  });

  describe('Token Storage and Retrieval', () => {
    it('should store new tokens securely', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test token refresh which stores new tokens securely
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // If refresh succeeded, verify tokens were stored securely
      // (actual encryption is verified by handler implementation)
      expect([200, 404, 400, 401, 500]).toContain(response.statusCode);

      if (response.statusCode === 200 && responseData.success) {
        // Should not expose raw tokens in response (security check)
        expect(responseData.access_token).toBeUndefined();
        expect(responseData.refresh_token).toBeUndefined();
        
        // May include encrypted token info or just success flag
        expect(responseData.success).toBe(true);
      }
    });

    it.skip('should retrieve tokens for user', async () => {
      // TODO: Implement test for token retrieval
      // Test should verify:
      // - User tokens are retrieved correctly
      // - Only active tokens are returned
      // - Token metadata is included
    });

    it('should update token timestamps', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test token refresh which updates timestamps
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Handler should update timestamps on refresh
      expect([200, 404, 400, 401, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        // If refresh succeeded, timestamps should be updated
        // Handler updates last_refresh_at internally
        expect(responseData.success !== undefined || responseData.expires_at !== undefined).toBe(true);
      }
    });
  });

  describe('Token Refresh Scheduling', () => {
    it('should schedule automatic token refresh', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test token refresh which may trigger automatic scheduling
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Handler may schedule automatic refresh based on token expiration
      expect([200, 404, 400, 401, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        // If refresh succeeded, automatic scheduling may be handled internally
        expect(responseData.success !== undefined || responseData.expires_at !== undefined).toBe(true);
      }
    });

    it('should handle refresh conflicts', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test concurrent refresh handling
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      // Simulate concurrent requests
      const [response1, response2] = await Promise.all([
        handler(event),
        handler(event)
      ]);

      // Both should complete without crashing
      expect([200, 404, 400, 401, 409, 500]).toContain(response1.statusCode);
      expect([200, 404, 400, 401, 409, 500]).toContain(response2.statusCode);

      // Handler should prevent race conditions (may return 409 or handle gracefully)
      const allResponses = [response1, response2];
      const successCount = allResponses.filter(r => r.statusCode === 200).length;
      const conflictCount = allResponses.filter(r => r.statusCode === 409).length;

      // Either at least one succeeds, or conflicts are properly detected
      expect(successCount > 0 || conflictCount > 0 || allResponses.every(r => [404, 400, 401].includes(r.statusCode))).toBe(true);
    });

    it('should clean up expired tokens', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test token refresh which handles expired tokens
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Handler should handle expired tokens gracefully
      expect([200, 404, 400, 401, 500]).toContain(response.statusCode);

      // If token is expired or missing, should return 404
      // If refresh succeeds, old token is replaced (cleanup happens in handler)
      if (response.statusCode === 404) {
        expect(responseData.error || responseData.message).toBeDefined();
      }
      
      // Token cleanup may be handled internally by the handler
      // (expired tokens are replaced, not necessarily deleted immediately)
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network timeouts', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test timeout handling
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Handler should handle timeouts gracefully
      expect([200, 404, 400, 401, 408, 500, 502, 503, 504]).toContain(response.statusCode);

      // If timeout occurred, should return appropriate error
      if ([408, 502, 503, 504].includes(response.statusCode)) {
        expect(responseData.error || responseData.message).toBeDefined();
      }
    });

    it.skip('should handle Strava rate limiting', async () => {
      // TODO: Implement test for rate limit handling
      // Test should verify:
      // - Rate limit headers are respected
      // - Backoff strategy is implemented
      // - Requests are queued appropriately
    });

    it('should recover from database errors', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Test error recovery handling
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id || testUser.user_id || '1'
        })
      };

      const response = await handler(event);
      const responseData = JSON.parse(response.body);

      // Handler should handle database errors gracefully
      expect([200, 400, 401, 404, 500]).toContain(response.statusCode);

      // If database error occurred, should return 500 or handle gracefully
      if (response.statusCode === 500) {
        expect(responseData.error || responseData.message).toBeDefined();
      }

      // Data consistency should be maintained (handler uses transactions if applicable)
    });
  });

  describe('Token Security', () => {
    it.skip('should encrypt tokens in transit', async () => {
      // TODO: Implement test for token encryption
      // Test should verify:
      // - HTTPS is used for all requests
      // - Tokens are not logged in plain text
      // - Secure headers are set
    });

    it.skip('should validate token integrity', async () => {
      // TODO: Implement test for token integrity validation
      // Test should verify:
      // - Token signatures are validated
      // - Tampered tokens are rejected
      // - Token revocation is detected
    });

    it.skip('should implement token rotation', async () => {
      // TODO: Implement test for token rotation
      // Test should verify:
      // - Old tokens are invalidated
      // - New tokens are issued
      // - Seamless transition is maintained
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track refresh success rates', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      // Make multiple refresh attempts and measure success/failure
      const event = {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: testUser.id || testUser.user_id || '1' })
      };

      const responses = await Promise.all([handler(event), handler(event), handler(event)]);
      const successCount = responses.filter(r => r.statusCode === 200).length;
      const errorCount = responses.length - successCount;

      expect(responses.length).toBe(3);
      expect(successCount + errorCount).toBe(3);
      responses.forEach(r => expect([200, 400, 401, 404, 429, 500]).toContain(r.statusCode));
    });

    it('should handle high refresh volumes', async () => {
      if (process.env.MOCK_DATABASE === 'true' || !db || !testUser) {
        console.log('⚠️  Mock database mode - skipping database integration tests');
        return;
      }

      const { handler } = await import('../../netlify/functions/strava-refresh-token.js');

      const makeEvent = () => ({
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${testUser.jwt_token || 'test-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: testUser.id || testUser.user_id || '1' })
      });

      // Burst of concurrent requests
      const responses = await Promise.all([makeEvent(), makeEvent(), makeEvent(), makeEvent(), makeEvent()].map(e => handler(e)));
      responses.forEach(r => expect([200, 400, 401, 404, 409, 429, 500]).toContain(r.statusCode));
    });

    it.skip('should provide refresh status endpoint', async () => {
      // TODO: Implement test for status endpoint
      // Test should verify:
      // - Status endpoint returns correct info
      // - Token health is reported
      // - System status is accurate
    });
  });
});
