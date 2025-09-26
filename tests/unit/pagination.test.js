// tests/unit/pagination.test.js
// Unit tests for pagination utilities

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validatePaginationParams,
  createPaginatedResponse,
  getCursorDataForItem,
  buildCursorCondition,
  validatePaginationInput,
  encodeCursor,
  decodeCursor,
  PAGINATION_CONFIG
} from '../../netlify/functions/utils/pagination.js';

describe('Pagination Utilities', () => {
  describe('validatePaginationParams', () => {
    it('should validate and normalize pagination parameters', () => {
      const params = { limit: '50', cursor: null, before: '2024-01-01' };
      const result = validatePaginationParams(params);
      
      expect(result.limit).toBe(50);
      expect(result.cursor).toBe(null);
      expect(result.before).toBe('2024-01-01');
    });
    
    it('should enforce minimum limit', () => {
      const params = { limit: '0' };
      const result = validatePaginationParams(params);
      
      expect(result.limit).toBe(PAGINATION_CONFIG.MIN_LIMIT);
    });
    
    it('should enforce maximum limit', () => {
      const params = { limit: '150' };
      const result = validatePaginationParams(params);
      
      expect(result.limit).toBe(PAGINATION_CONFIG.MAX_LIMIT);
    });
    
    it('should use default limit when not provided', () => {
      const params = {};
      const result = validatePaginationParams(params);
      
      expect(result.limit).toBe(PAGINATION_CONFIG.DEFAULT_LIMIT);
    });
  });
  
  describe('validatePaginationInput', () => {
    it('should return empty array for valid input', () => {
      const params = { limit: '50', cursor: null };
      const errors = validatePaginationInput(params);
      
      expect(errors).toHaveLength(0);
    });
    
    it('should return errors for invalid limit', () => {
      const params = { limit: '150' };
      const errors = validatePaginationInput(params);
      
      expect(errors).toContain('Limit must be between 1 and 100');
    });
    
    it('should return errors for negative offset', () => {
      const params = { offset: '-1' };
      const errors = validatePaginationInput(params);
      
      expect(errors).toContain('Offset must be a non-negative integer');
    });
    
    it('should return errors for invalid cursor', () => {
      const params = { cursor: 'invalid-cursor' };
      const errors = validatePaginationInput(params);
      
      expect(errors).toContain('Invalid cursor format');
    });
  });
  
  describe('encodeCursor and decodeCursor', () => {
    it('should encode and decode cursor correctly', () => {
      const testData = {
        id: '123',
        timestamp: '2024-01-01T00:00:00Z',
        order: '2024-01-01T00:00:00Z'
      };
      
      const encoded = encodeCursor(testData);
      const decoded = decodeCursor(encoded);
      
      expect(decoded.id).toBe(testData.id);
      expect(decoded.timestamp).toBe(testData.timestamp);
      expect(decoded.order).toBe(testData.order);
      expect(decoded.v).toBe(PAGINATION_CONFIG.CURSOR_VERSION);
    });
    
    it('should throw error for invalid cursor', () => {
      expect(() => decodeCursor('invalid-cursor')).toThrow('Invalid cursor format');
    });
  });
  
  describe('getCursorDataForItem', () => {
    it('should get cursor data for sessions', () => {
      const item = {
        id: 1,
        start_at: new Date('2024-01-01'),
        created_at: new Date('2024-01-01')
      };
      
      const cursorData = getCursorDataForItem(item, 'sessions');
      
      expect(cursorData.id).toBe(1);
      expect(cursorData.timestamp).toBe(item.start_at);
      expect(cursorData.order).toBe(item.start_at);
    });
    
    it('should get cursor data for exercises', () => {
      const item = {
        id: 1,
        created_at: new Date('2024-01-01'),
        order_index: 5
      };
      
      const cursorData = getCursorDataForItem(item, 'exercises');
      
      expect(cursorData.id).toBe(1);
      expect(cursorData.timestamp).toBe(item.created_at);
      expect(cursorData.order).toBe(item.order_index);
    });
  });
  
  describe('buildCursorCondition', () => {
    it('should build cursor condition for valid cursor', () => {
      const testData = {
        id: '123',
        timestamp: '2024-01-01T00:00:00Z',
        order: '2024-01-01T00:00:00Z'
      };
      
      const encoded = encodeCursor(testData);
      const condition = buildCursorCondition(encoded, 'created_at DESC, id ASC');
      
      expect(condition.condition).toContain('created_at <');
      expect(condition.condition).toContain('id >');
      expect(condition.values).toHaveLength(2);
    });
    
    it('should return empty condition for null cursor', () => {
      const condition = buildCursorCondition(null, 'created_at DESC');
      
      expect(condition.condition).toBe('');
      expect(condition.values).toHaveLength(0);
    });
  });
  
  describe('createPaginatedResponse', () => {
    it('should create paginated response with has_more true', () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
        { id: 4, name: 'Item 4' }
      ];
      
      const response = createPaginatedResponse(
        items,
        3, // limit
        (item) => ({ id: item.id, timestamp: new Date(), order: new Date() }),
        { includeTotal: true, total: 100 }
      );
      
      expect(response.data).toHaveLength(3);
      expect(response.pagination.has_more).toBe(true);
      expect(response.pagination.count).toBe(3);
      expect(response.pagination.limit).toBe(3);
      expect(response.pagination.next_cursor).toBeTruthy();
      expect(response.pagination.total).toBe(100);
    });
    
    it('should create paginated response with has_more false', () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];
      
      const response = createPaginatedResponse(
        items,
        5, // limit
        (item) => ({ id: item.id, timestamp: new Date(), order: new Date() })
      );
      
      expect(response.data).toHaveLength(2);
      expect(response.pagination.has_more).toBe(false);
      expect(response.pagination.count).toBe(2);
      expect(response.pagination.next_cursor).toBeNull();
    });
    
    it('should handle empty items array', () => {
      const response = createPaginatedResponse(
        [],
        10,
        (item) => ({ id: item.id, timestamp: new Date(), order: new Date() })
      );
      
      expect(response.data).toHaveLength(0);
      expect(response.pagination.has_more).toBe(false);
      expect(response.pagination.count).toBe(0);
      expect(response.pagination.next_cursor).toBeNull();
    });
  });
});
