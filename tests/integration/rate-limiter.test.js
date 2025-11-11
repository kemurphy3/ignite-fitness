/**
 * Rate Limiter Tests
 * Verifies token bucket algorithm, exponential backoff, and circuit breaker functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Rate Limiter Tests', () => {
  let rateLimiter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Mock RateLimiter class
    class MockRateLimiter {
      constructor(options = {}) {
        this.maxRequests = options.maxRequests || 600;
        this.windowMs = options.windowMs || 15 * 60 * 1000;
        this.tokensPerSecond = options.tokensPerSecond || this.maxRequests / (this.windowMs / 1000);
        this.maxRetries = options.maxRetries || 3;
        this.baseDelayMs = options.baseDelayMs || 1000;

        this.tokens = this.maxRequests;
        this.lastRefill = Date.now();
        this.requestTimes = [];

        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.circuitOpen = false;
        this.circuitOpenTime = 0;
        this.circuitTimeout = 60000;

        this.logger = options.logger || console;
      }

      refillTokens() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;

        if (elapsed > 0) {
          const tokensToAdd = (elapsed / 1000) * this.tokensPerSecond;
          this.tokens = Math.min(this.maxRequests, this.tokens + tokensToAdd);
          this.lastRefill = now;
        }
      }

      cleanOldRequests() {
        const now = Date.now();
        const cutoff = now - this.windowMs;
        this.requestTimes = this.requestTimes.filter(time => time > cutoff);
      }

      canMakeRequest() {
        if (this.circuitOpen) {
          const now = Date.now();
          if (now - this.circuitOpenTime > this.circuitTimeout) {
            this.circuitOpen = false;
            this.failureCount = 0;
            this.logger.info('Circuit breaker reset');
          } else {
            return {
              allowed: false,
              reason: 'circuit_open',
              waitTime: this.circuitTimeout - (now - this.circuitOpenTime),
            };
          }
        }

        this.refillTokens();
        this.cleanOldRequests();

        if (this.tokens < 1) {
          const waitTime = (1 / this.tokensPerSecond) * 1000;
          return {
            allowed: false,
            reason: 'no_tokens',
            waitTime: Math.ceil(waitTime),
          };
        }

        if (this.requestTimes.length >= this.maxRequests) {
          const oldestRequest = Math.min(...this.requestTimes);
          const waitTime = oldestRequest + this.windowMs - Date.now();

          return {
            allowed: false,
            reason: 'window_limit',
            waitTime: Math.max(0, waitTime),
          };
        }

        return { allowed: true };
      }

      recordRequest() {
        const now = Date.now();
        this.tokens = Math.max(0, this.tokens - 1);
        this.requestTimes.push(now);
        this.failureCount = Math.max(0, this.failureCount - 1);
      }

      recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= 5) {
          this.circuitOpen = true;
          this.circuitOpenTime = Date.now();
          this.logger.warn('Circuit breaker opened due to failures', {
            failureCount: this.failureCount,
          });
        }
      }

      calculateBackoffDelay(attempt) {
        const delay = this.baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * delay;
        return Math.min(delay + jitter, 30000);
      }

      async executeRequest(requestFn, options = {}) {
        const maxRetries = options.maxRetries || this.maxRetries;
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          const canRequest = this.canMakeRequest();

          if (!canRequest.allowed) {
            if (canRequest.reason === 'circuit_open') {
              throw new Error(
                `Circuit breaker is open. Wait ${Math.ceil(canRequest.waitTime / 1000)} seconds.`
              );
            }

            if (attempt === maxRetries) {
              throw new Error(
                `Rate limit exceeded. Wait ${Math.ceil(canRequest.waitTime / 1000)} seconds.`
              );
            }

            await this.sleep(canRequest.waitTime);
            continue;
          }

          try {
            const response = await requestFn();
            this.recordRequest();

            if (response.status === 429) {
              const retryAfter =
                response.headers?.['retry-after'] || response.headers?.['Retry-After'];
              const waitTime = retryAfter
                ? parseInt(retryAfter) * 1000
                : this.calculateBackoffDelay(attempt);

              this.logger.warn('Rate limited by API', {
                attempt,
                retryAfter,
                waitTime,
              });

              if (attempt === maxRetries) {
                throw new Error(
                  `Rate limited by API. Retry after ${Math.ceil(waitTime / 1000)} seconds.`
                );
              }

              await this.sleep(waitTime);
              continue;
            }

            if (response.status >= 400) {
              this.recordFailure();
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
          } catch (error) {
            lastError = error;
            this.recordFailure();

            if (
              error.message.includes('Circuit breaker') ||
              error.message.includes('Rate limit exceeded')
            ) {
              throw error;
            }

            if (attempt === maxRetries) {
              break;
            }

            const delay = this.calculateBackoffDelay(attempt);
            this.logger.warn('Request failed, retrying', {
              attempt: attempt + 1,
              error: error.message,
              delay,
            });

            await this.sleep(delay);
          }
        }

        throw lastError || new Error('Request failed after all retries');
      }

      sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      getStatus() {
        this.refillTokens();
        this.cleanOldRequests();

        return {
          tokensAvailable: Math.floor(this.tokens),
          maxTokens: this.maxRequests,
          requestsInWindow: this.requestTimes.length,
          maxRequestsPerWindow: this.maxRequests,
          windowMs: this.windowMs,
          circuitOpen: this.circuitOpen,
          failureCount: this.failureCount,
          tokensPerSecond: this.tokensPerSecond,
          utilizationPercent: Math.round((this.requestTimes.length / this.maxRequests) * 100),
        };
      }

      reset() {
        this.tokens = this.maxRequests;
        this.lastRefill = Date.now();
        this.requestTimes = [];
        this.failureCount = 0;
        this.circuitOpen = false;
        this.circuitOpenTime = 0;
        this.logger.info('Rate limiter reset');
      }
    }

    rateLimiter = new MockRateLimiter({
      maxRequests: 10, // Small limit for testing
      windowMs: 60000, // 1 minute window
      logger: mockLogger,
    });
  });

  describe('Token Bucket Algorithm', () => {
    it('should allow requests when tokens are available', () => {
      const result = rateLimiter.canMakeRequest();
      expect(result.allowed).toBe(true);
    });

    it('should deny requests when no tokens available', () => {
      // Consume all tokens
      rateLimiter.tokens = 0;

      const result = rateLimiter.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no_tokens');
      expect(result.waitTime).toBeGreaterThan(0);
    });

    it('should refill tokens over time', () => {
      // Consume all tokens
      rateLimiter.tokens = 0;
      rateLimiter.lastRefill = Date.now() - 1000; // 1 second ago

      rateLimiter.refillTokens();

      expect(rateLimiter.tokens).toBeGreaterThan(0);
    });

    it('should not exceed maximum tokens', () => {
      rateLimiter.tokens = rateLimiter.maxRequests;
      rateLimiter.lastRefill = Date.now() - 10000; // 10 seconds ago

      rateLimiter.refillTokens();

      expect(rateLimiter.tokens).toBeLessThanOrEqual(rateLimiter.maxRequests);
    });
  });

  describe('Sliding Window', () => {
    it('should track request times', () => {
      rateLimiter.recordRequest();
      expect(rateLimiter.requestTimes.length).toBe(1);
    });

    it('should clean old request times', () => {
      // Add old request time
      rateLimiter.requestTimes.push(Date.now() - 70000); // 70 seconds ago
      rateLimiter.requestTimes.push(Date.now() - 1000); // 1 second ago

      rateLimiter.cleanOldRequests();

      expect(rateLimiter.requestTimes.length).toBe(1);
    });

    it('should enforce window limit', () => {
      // Fill up the window
      for (let i = 0; i < rateLimiter.maxRequests; i++) {
        rateLimiter.requestTimes.push(Date.now());
      }

      const result = rateLimiter.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('window_limit');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after multiple failures', () => {
      // Record multiple failures
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordFailure();
      }

      expect(rateLimiter.circuitOpen).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Circuit breaker opened due to failures',
        expect.objectContaining({ failureCount: 5 })
      );
    });

    it('should deny requests when circuit is open', () => {
      rateLimiter.circuitOpen = true;
      rateLimiter.circuitOpenTime = Date.now();

      const result = rateLimiter.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('circuit_open');
    });

    it('should reset circuit after timeout', () => {
      rateLimiter.circuitOpen = true;
      rateLimiter.circuitOpenTime = Date.now() - 70000; // 70 seconds ago
      rateLimiter.failureCount = 5;

      const result = rateLimiter.canMakeRequest();
      expect(result.allowed).toBe(true);
      expect(rateLimiter.circuitOpen).toBe(false);
      expect(rateLimiter.failureCount).toBe(0);
    });
  });

  describe('Exponential Backoff', () => {
    it('should calculate increasing delays', () => {
      const delay1 = rateLimiter.calculateBackoffDelay(0);
      const delay2 = rateLimiter.calculateBackoffDelay(1);
      const delay3 = rateLimiter.calculateBackoffDelay(2);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should cap delay at maximum', () => {
      const delay = rateLimiter.calculateBackoffDelay(20); // Very high attempt
      expect(delay).toBeLessThanOrEqual(30000);
    });

    it('should include jitter', () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(rateLimiter.calculateBackoffDelay(1));
      }

      // Should have some variation due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Request Execution', () => {
    it('should execute successful requests', async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
      });

      const result = await rateLimiter.executeRequest(mockRequest);

      expect(result.status).toBe(200);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limit responses', async () => {
      const mockRequest = vi
        .fn()
        .mockResolvedValueOnce({
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'retry-after': '1' },
        })
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {},
        });

      const result = await rateLimiter.executeRequest(mockRequest);

      expect(result.status).toBe(200);
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(rateLimiter.executeRequest(mockRequest)).rejects.toThrow('Network error');
      expect(mockRequest).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should handle circuit breaker errors', async () => {
      rateLimiter.circuitOpen = true;
      rateLimiter.circuitOpenTime = Date.now();

      const mockRequest = vi.fn();

      await expect(rateLimiter.executeRequest(mockRequest)).rejects.toThrow(
        'Circuit breaker is open'
      );
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  describe('Status Monitoring', () => {
    it('should provide accurate status', () => {
      rateLimiter.recordRequest();
      rateLimiter.recordRequest();

      const status = rateLimiter.getStatus();

      expect(status.tokensAvailable).toBeLessThanOrEqual(rateLimiter.maxRequests);
      expect(status.requestsInWindow).toBe(2);
      expect(status.maxRequestsPerWindow).toBe(rateLimiter.maxRequests);
      expect(status.circuitOpen).toBe(false);
      expect(status.utilizationPercent).toBeGreaterThanOrEqual(0);
    });

    it('should calculate utilization correctly', () => {
      // Fill half the window
      for (let i = 0; i < rateLimiter.maxRequests / 2; i++) {
        rateLimiter.requestTimes.push(Date.now());
      }

      const status = rateLimiter.getStatus();
      expect(status.utilizationPercent).toBe(50);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all state', () => {
      // Modify state
      rateLimiter.tokens = 0;
      rateLimiter.requestTimes.push(Date.now());
      rateLimiter.failureCount = 3;
      rateLimiter.circuitOpen = true;

      rateLimiter.reset();

      expect(rateLimiter.tokens).toBe(rateLimiter.maxRequests);
      expect(rateLimiter.requestTimes.length).toBe(0);
      expect(rateLimiter.failureCount).toBe(0);
      expect(rateLimiter.circuitOpen).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Rate limiter reset');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty request times array', () => {
      rateLimiter.requestTimes = [];
      const result = rateLimiter.canMakeRequest();
      expect(result.allowed).toBe(true);
    });

    it('should handle zero tokens per second', () => {
      rateLimiter.tokensPerSecond = 0;
      rateLimiter.tokens = 0;

      const result = rateLimiter.canMakeRequest();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no_tokens');
    });

    it('should handle very small window', () => {
      rateLimiter.windowMs = 1000; // 1 second
      rateLimiter.maxRequests = 1;

      rateLimiter.recordRequest();
      const result = rateLimiter.canMakeRequest();
      expect(result.allowed).toBe(false);
    });
  });
});
