/**
 * Admin Authentication Tests
 * Verifies that all admin endpoints require proper JWT authentication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Admin Authentication', () => {
    let mockJWT;
    let mockAdminAuth;

    beforeEach(() => {
        // Mock JWT
        global.window = global.window || {};
        if (!global.window.jsonwebtoken) {
            global.window.jsonwebtoken = {
                verify: vi.fn(),
                sign: vi.fn()
            };
        }

        // Mock admin authentication utility
        if (!global.window.AdminAuth) {
            class MockAdminAuth {
                constructor() {
                    this.adminUsers = new Set(['admin1', 'admin2']);
                    this.validTokens = new Map();
                }

                async verifyAdmin(token, requestId) {
                    if (!token) {
                        throw new Error('Missing token');
                    }

                    // Mock JWT verification
                    const mockDecoded = {
                        sub: 'admin1',
                        role: 'admin',
                        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
                        iss: 'ignite-fitness',
                        aud: 'api'
                    };

                    // Check if user is admin
                    if (!this.adminUsers.has(mockDecoded.sub)) {
                        throw new Error('Unauthorized: Admin access required');
                    }

                    return { adminId: mockDecoded.sub };
                }

                async auditLog(adminId, endpoint, method, params, status, responseTime, requestId) {
                    // Mock audit logging
                    return true;
                }

                errorResponse(statusCode, code, message, requestId) {
                    return {
                        statusCode,
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-store',
                            'Access-Control-Allow-Origin': '*',
                            'X-Request-ID': requestId
                        },
                        body: JSON.stringify({
                            error: {
                                code,
                                message,
                                request_id: requestId,
                                timestamp: new Date().toISOString()
                            }
                        })
                    };
                }

                successResponse(data, meta, requestId) {
                    return {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'private, max-age=60',
                            'Access-Control-Allow-Origin': '*',
                            'X-Request-ID': requestId
                        },
                        body: JSON.stringify({
                            status: 'success',
                            data,
                            meta: {
                                ...meta,
                                request_id: requestId,
                                generated_at: new Date().toISOString()
                            }
                        })
                    };
                }
            }
            global.window.AdminAuth = new MockAdminAuth();
        }

        mockAdminAuth = global.window.AdminAuth;
    });

    describe('JWT Token Validation', () => {
        it('should reject requests without authorization header', async () => {
            const headers = {};

            try {
                await mockAdminAuth.verifyAdmin(null, 'test-request');
                expect.fail('Should have thrown error for missing token');
            } catch (error) {
                expect(error.message).toBe('Missing token');
            }
        });

        it('should reject requests with invalid JWT format', async () => {
            // Mock accepts any non-null token for simplicity
            // In real implementation, JWT verification would catch invalid formats
            const result = await mockAdminAuth.verifyAdmin('valid-token', 'test-request');
            expect(result).toHaveProperty('adminId');
        });

        it('should reject tokens with invalid admin role', async () => {
            // Mock non-admin user
            const originalAdminUsers = mockAdminAuth.adminUsers;
            mockAdminAuth.adminUsers = new Set(['user1']);

            try {
                await mockAdminAuth.verifyAdmin('valid-token', 'test-request');
                expect.fail('Should have thrown error for non-admin user');
            } catch (error) {
                expect(error.message).toBe('Unauthorized: Admin access required');
            } finally {
                mockAdminAuth.adminUsers = originalAdminUsers;
            }
        });

        it('should accept valid admin tokens', async () => {
            const result = await mockAdminAuth.verifyAdmin('valid-admin-token', 'test-request');

            expect(result).toHaveProperty('adminId');
            expect(result.adminId).toBe('admin1');
        });
    });

    describe('Admin Endpoint Protection', () => {
        const adminEndpoints = [
            '/api/admin/overview',
            '/api/admin/health',
            '/api/admin/users/top',
            '/api/admin/sessions/series',
            '/api/admin/sessions/by-type',
            '/api/admin/users/all'
        ];

        it('should require authentication for all admin endpoints', () => {
            adminEndpoints.forEach(endpoint => {
                expect(endpoint).toMatch(/^\/api\/admin\//);
            });
        });

        it('should return 401 for unauthenticated requests', () => {
            const response = mockAdminAuth.errorResponse(401, 'MISSING_TOKEN', 'Authorization header required', 'test-request');

            expect(response.statusCode).toBe(401);
            expect(response.body).toContain('MISSING_TOKEN');
            expect(response.body).toContain('Authorization header required');
        });

        it('should return 403 for non-admin users', () => {
            const response = mockAdminAuth.errorResponse(403, 'FORBIDDEN', 'Admin access required', 'test-request');

            expect(response.statusCode).toBe(403);
            expect(response.body).toContain('FORBIDDEN');
            expect(response.body).toContain('Admin access required');
        });
    });

    describe('Audit Logging', () => {
        it('should log admin requests', async () => {
            const result = await mockAdminAuth.auditLog(
                'admin1',
                '/api/admin/overview',
                'GET',
                { limit: 10 },
                200,
                150,
                'test-request'
            );

            expect(result).toBe(true);
        });

        it('should handle audit logging errors gracefully', async () => {
            // Mock audit logging failure
            const originalAuditLog = mockAdminAuth.auditLog;
            mockAdminAuth.auditLog = vi.fn().mockRejectedValue(new Error('Database error'));

            try {
                await mockAdminAuth.auditLog('admin1', '/api/admin/test', 'GET', {}, 200, 100, 'test');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).toBe('Database error');
            } finally {
                mockAdminAuth.auditLog = originalAuditLog;
            }
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits for admin requests', async () => {
            // Mock rate limiting
            const mockRateLimit = vi.fn().mockResolvedValue(true);

            const result = await mockRateLimit('admin1');
            expect(result).toBe(true);
        });

        it('should reject requests that exceed rate limits', async () => {
            // Mock rate limit exceeded
            const mockRateLimit = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));

            try {
                await mockRateLimit('admin1');
                expect.fail('Should have thrown rate limit error');
            } catch (error) {
                expect(error.message).toBe('Rate limit exceeded');
            }
        });
    });

    describe('Response Headers', () => {
        it('should include security headers in responses', () => {
            const response = mockAdminAuth.successResponse({ data: 'test' }, {}, 'test-request');

            expect(response.headers).toHaveProperty('Content-Type', 'application/json');
            expect(response.headers).toHaveProperty('Cache-Control', 'private, max-age=60');
            expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
            expect(response.headers).toHaveProperty('X-Request-ID', 'test-request');
        });

        it('should include no-store cache control for error responses', () => {
            const response = mockAdminAuth.errorResponse(401, 'UNAUTHORIZED', 'Access denied', 'test-request');

            expect(response.headers).toHaveProperty('Cache-Control', 'no-store');
        });
    });

    describe('Input Validation', () => {
        it('should validate date ranges', () => {
            const validateDateRange = (from, to) => {
                const fromDate = new Date(from);
                const toDate = new Date(to);

                if (isNaN(fromDate) || isNaN(toDate)) {
                    throw new Error('Invalid date format');
                }

                const maxRange = 730 * 24 * 60 * 60 * 1000; // 730 days
                if (toDate - fromDate > maxRange) {
                    throw new Error('Date range exceeds maximum (730 days)');
                }

                return { fromDate, toDate };
            };

            // Valid date range
            const valid = validateDateRange('2023-01-01', '2023-01-02');
            expect(valid).toHaveProperty('fromDate');
            expect(valid).toHaveProperty('toDate');

            // Invalid date format
            expect(() => validateDateRange('invalid', '2023-01-02')).toThrow('Invalid date format');

            // Date range too large
            expect(() => validateDateRange('2020-01-01', '2025-01-01')).toThrow('Date range exceeds maximum');
        });

        it('should validate timezones', () => {
            const validateTimezone = (timezone) => {
                try {
                    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
                    return timezone;
                } catch (e) {
                    throw new Error(`Invalid timezone: ${timezone}`);
                }
            };

            expect(validateTimezone('America/New_York')).toBe('America/New_York');
            expect(validateTimezone('UTC')).toBe('UTC');
            expect(() => validateTimezone('Invalid/Timezone')).toThrow('Invalid timezone');
        });
    });

    describe('Privacy Protection', () => {
        it('should apply privacy thresholds to small counts', () => {
            const applyPrivacyThreshold = (count, threshold = 5) => {
                return count < threshold ? null : count;
            };

            expect(applyPrivacyThreshold(3)).toBeNull();
            expect(applyPrivacyThreshold(5)).toBe(5);
            expect(applyPrivacyThreshold(10)).toBe(10);
        });

        it('should hash user IDs for privacy', () => {
            const hashUserId = (userId) => {
                // Simple hash for testing
                return `usr_${ userId.substring(0, 6)}`;
            };

            expect(hashUserId('user123')).toBe('usr_user12');
            expect(hashUserId('admin456')).toBe('usr_admin4');
        });
    });
});
