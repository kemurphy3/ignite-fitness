// Test setup file for Vitest
// This file is run before all tests

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

// Keep console methods available for debugging
// Tests can override if needed
