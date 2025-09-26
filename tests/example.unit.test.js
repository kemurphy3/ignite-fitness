// tests/example.unit.test.js
// Example unit test file for Ticket 9
// This demonstrates basic unit testing without database dependencies

import { describe, it, expect, beforeEach } from 'vitest';

// Example utility functions to test
function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

function isEven(number) {
  return number % 2 === 0;
}

function formatUserName(firstName, lastName) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

describe('Math Utilities', () => {
  describe('add', () => {
    it('should add two positive numbers correctly', () => {
      expect(add(2, 3)).toBe(5);
    });

    it('should add negative numbers correctly', () => {
      expect(add(-2, -3)).toBe(-5);
    });

    it('should add positive and negative numbers correctly', () => {
      expect(add(5, -3)).toBe(2);
    });

    it('should handle zero correctly', () => {
      expect(add(0, 5)).toBe(5);
      expect(add(5, 0)).toBe(5);
    });
  });

  describe('multiply', () => {
    it('should multiply two positive numbers correctly', () => {
      expect(multiply(3, 4)).toBe(12);
    });

    it('should multiply by zero correctly', () => {
      expect(multiply(5, 0)).toBe(0);
    });

    it('should multiply negative numbers correctly', () => {
      expect(multiply(-3, -4)).toBe(12);
    });

    it('should multiply positive and negative numbers correctly', () => {
      expect(multiply(3, -4)).toBe(-12);
    });
  });

  describe('isEven', () => {
    it('should return true for even numbers', () => {
      expect(isEven(2)).toBe(true);
      expect(isEven(4)).toBe(true);
      expect(isEven(100)).toBe(true);
    });

    it('should return false for odd numbers', () => {
      expect(isEven(1)).toBe(false);
      expect(isEven(3)).toBe(false);
      expect(isEven(99)).toBe(false);
    });

    it('should handle zero correctly', () => {
      expect(isEven(0)).toBe(true);
    });
  });
});

describe('String Utilities', () => {
  describe('formatUserName', () => {
    it('should format first and last name correctly', () => {
      expect(formatUserName('John', 'Doe')).toBe('John Doe');
    });

    it('should handle single name correctly', () => {
      expect(formatUserName('John', '')).toBe('John');
      expect(formatUserName('', 'Doe')).toBe('Doe');
    });

    it('should handle empty strings correctly', () => {
      expect(formatUserName('', '')).toBe('');
    });

    it('should trim whitespace correctly', () => {
      expect(formatUserName('  John  ', '  Doe  ')).toBe('John Doe');
    });
  });
});

describe('Edge Cases', () => {
  it('should handle very large numbers', () => {
    expect(add(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER + 1);
  });

  it('should handle decimal numbers', () => {
    expect(add(0.1, 0.2)).toBeCloseTo(0.3);
  });

  it('should handle special characters in names', () => {
    expect(formatUserName('José', 'García')).toBe('José García');
  });
});
