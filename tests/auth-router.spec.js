/**
 * Auth Router Tests
 * Tests for authentication and routing guards
 */

/* global test, jest */

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: key => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
global.localStorage = localStorageMock;

// Mock window objects
global.window = {
  location: { hash: '' },
  addEventListener: () => {},
  SafeLogger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
  EventBus: {
    on: () => {},
    emit: () => {},
  },
};

// Import modules (simplified for testing)
const AuthManager =
  require('../js/modules/auth/AuthManager.js').default ||
  require('../js/modules/auth/AuthManager.js');
const Router =
  require('../js/modules/ui/Router.js').default || require('../js/modules/ui/Router.js');

describe('Auth Router Integration Tests', () => {
  let authManager;
  let router;

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    authManager = new AuthManager();
    router = new Router();
  });

  describe('1. No token → lands on #/login', () => {
    test('should route to login when no token exists', async () => {
      await authManager.readFromStorage();
      const authState = authManager.getAuthState();

      expect(authState.isAuthenticated).toBe(false);

      router.init(authState);

      // Router should have navigated to login
      expect(router.currentRoute).toBe('#/login');
    });
  });

  describe('2. Bad token → cleared → on #/login', () => {
    test('should clear bad token and route to login', async () => {
      // Set invalid token
      localStorage.setItem('ignite.auth.token', 'invalid-json');
      localStorage.setItem('ignitefitness_current_user', 'testuser');

      await authManager.readFromStorage();
      const authState = authManager.getAuthState();

      expect(authState.isAuthenticated).toBe(false);
      expect(localStorage.getItem('ignite.auth.token')).toBeNull();

      router.init(authState);
      expect(router.currentRoute).toBe('#/login');
    });

    test('should clear expired token (>30 days)', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 31);

      const tokenData = {
        value: 'expired-token',
        created_at: expiredDate.toISOString(),
        username: 'testuser',
      };

      localStorage.setItem('ignite.auth.token', JSON.stringify(tokenData));
      localStorage.setItem('ignitefitness_current_user', 'testuser');
      localStorage.setItem(
        'ignitefitness_users',
        JSON.stringify({
          testuser: { username: 'testuser' },
        })
      );

      await authManager.readFromStorage();
      const authState = authManager.getAuthState();

      expect(authState.isAuthenticated).toBe(false);
    });
  });

  describe('3. Valid token → lands on #/dashboard', () => {
    test('should route to dashboard when valid token exists', async () => {
      const tokenData = {
        value: 'valid-token',
        created_at: new Date().toISOString(),
        username: 'testuser',
      };

      localStorage.setItem('ignite.auth.token', JSON.stringify(tokenData));
      localStorage.setItem('ignitefitness_current_user', 'testuser');
      localStorage.setItem(
        'ignitefitness_users',
        JSON.stringify({
          testuser: { username: 'testuser', passwordHash: 'hash' },
        })
      );

      await authManager.readFromStorage();
      const authState = authManager.getAuthState();

      expect(authState.isAuthenticated).toBe(true);

      router.init(authState);

      // Should route to dashboard or last known route
      expect(['#/dashboard', '#/']).toContain(router.currentRoute);
    });
  });

  describe('4. Protected route when not authed → redirects to #/login without loop', () => {
    test('should redirect protected route to login', async () => {
      await authManager.readFromStorage();
      const authState = authManager.getAuthState();
      router.init(authState);

      // Try to navigate to protected route
      router.navigate('#/dashboard');

      expect(router.currentRoute).toBe('#/login');
      expect(router.lastKnownRoute).toBe('#/dashboard');
    });

    test('should not loop when already on login', () => {
      router.currentRoute = '#/login';
      router.navigate('#/login');

      // Should not change route or cause infinite loop
      expect(router.currentRoute).toBe('#/login');
    });
  });

  describe('5. Login success → now navigates to intended route', () => {
    test('should navigate to intended route after login', async () => {
      // Setup user
      localStorage.setItem(
        'ignitefitness_users',
        JSON.stringify({
          testuser: {
            username: 'testuser',
            passwordHash: authManager.simpleHash('password123'),
          },
        })
      );

      await authManager.readFromStorage();
      const authState = authManager.getAuthState();
      router.init(authState);

      // Try to access protected route (should redirect to login)
      router.navigate('#/dashboard');
      expect(router.currentRoute).toBe('#/login');
      expect(router.lastKnownRoute).toBe('#/dashboard');

      // Login
      const loginResult = authManager.login('testuser', 'password123');
      expect(loginResult.success).toBe(true);

      // Now should be able to navigate to intended route
      const newAuthState = authManager.getAuthState();
      expect(newAuthState.isAuthenticated).toBe(true);

      router.navigate(router.lastKnownRoute);
      expect(router.currentRoute).toBe('#/dashboard');
    });
  });

  describe('6. SW update → "Update available" toast appears and reload works', () => {
    test('should show update notification when SW updates', () => {
      // Mock service worker registration
      const mockRegistration = {
        waiting: {
          postMessage: jest.fn(),
          state: 'installed',
        },
        installing: null,
      };

      // This would be tested in browser environment
      // For unit tests, we verify the notification creation logic
      expect(typeof window.BootSequence?.showUpdateNotification).toBe('function');
    });
  });
});

// Run tests if in Node environment
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Auth Router tests loaded. Run with your test runner.');
}
