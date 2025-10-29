// Test setup file for Vitest
// This file is run before all tests

// Mock localStorage for Node.js environment
if (typeof localStorage === 'undefined') {
  const localStorageMock = {
    _store: {},
    getItem: function(key) {
      return this._store[key] || null;
    },
    setItem: function(key, value) {
      this._store[key] = value.toString();
    },
    removeItem: function(key) {
      delete this._store[key];
    },
    clear: function() {
      this._store = {};
    },
    key: function(index) {
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
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return true; }
  };
}

// Keep console methods available for debugging
// Tests can override if needed
