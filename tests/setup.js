// Test setup file for Vitest
// This file is run before all tests

import { vi } from 'vitest';

// Mock localStorage for Node.js environment
if (typeof localStorage === 'undefined') {
  const localStorageMock = {
    _store: {},
    getItem(key) {
      return this._store[key] || null;
    },
    setItem(key, value) {
      this._store[key] = value.toString();
    },
    removeItem(key) {
      delete this._store[key];
    },
    clear() {
      this._store = {};
    },
    key(index) {
      return Object.keys(this._store)[index] || null;
    },
    get length() {
      return Object.keys(this._store).length;
    }
  };
  global.localStorage = localStorageMock;
}

// Mock window object
if (typeof window === 'undefined') {
  global.window = {
    location: { hash: '', href: 'http://localhost' },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; }
  };
}

// Setup global mock functions for common patterns
global.createMockFunction = () => vi.fn();
global.createMockObject = (methods = []) => {
  const mock = {};
  methods.forEach(method => {
    mock[method] = vi.fn();
  });
  return mock;
};

// Global mock managers that tests expect
global.window = global.window || {};
global.window.AuthManager = {
  getCurrentUser: vi.fn(),
  getCurrentUsername: vi.fn(),
  isLoggedIn: vi.fn()
};

global.window.LoadCalculator = {
  calculateWeeklyLoad: vi.fn(),
  computeLoad: vi.fn()
};

global.window.StorageManager = {
  getItem: vi.fn(),
  setItem: vi.fn()
};

global.window.EventBus = {
  on: vi.fn(),
  emit: vi.fn()
};

global.window.SafeLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

// Keep console methods available for debugging
// Tests can override if needed
