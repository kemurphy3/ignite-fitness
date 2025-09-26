// tests/unit/connection-pool.test.js
// Unit tests for connection pooling utilities

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getNeonClient, healthCheck, getStats } from '../../netlify/functions/utils/connection-pool-simple.js';

// Mock the Neon client
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => {
    // Return a function that can be called as a template literal
    const mockClient = vi.fn();
    mockClient.test = vi.fn();
    mockClient.query = vi.fn();
    return mockClient;
  })
}));

describe('Connection Pool Utilities', () => {
  beforeEach(() => {
    // Reset environment
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    vi.clearAllMocks();
  });
  
  describe('getNeonClient', () => {
    it('should return a Neon client instance', () => {
      const client = getNeonClient();
      
      expect(client).toBeDefined();
      expect(typeof client).toBe('function');
    });
    
    it('should throw error when DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;
      
      expect(() => getNeonClient()).toThrow('DATABASE_URL not configured');
    });
    
    it('should return the same client instance on multiple calls', () => {
      const client1 = getNeonClient();
      const client2 = getNeonClient();
      
      expect(client1).toBe(client2);
    });
  });
  
  describe('healthCheck', () => {
    it('should return health status', async () => {
      const result = await healthCheck();
      
      expect(result).toHaveProperty('neon');
      expect(result).toHaveProperty('stats');
      expect(result.neon).toHaveProperty('healthy');
    });
  });
  
  describe('getStats', () => {
    it('should return connection statistics', () => {
      const stats = getStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('lastReset');
      expect(stats).toHaveProperty('timestamp');
    });
  });
});
