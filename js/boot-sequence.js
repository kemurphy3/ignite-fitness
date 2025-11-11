/**
 * Boot Sequence - Deterministic initialization order
 * Ensures all systems initialize in correct order before routing
 */

class BootSequence {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.swRegistration = null;
  }

  /**
   * Initialize service worker (optional)
   */
  async initServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      this.logger.debug('Service Worker not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      this.swRegistration = registration;

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed - notify app
              this.showUpdateNotification(registration);
            }
          });
        }
      });

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'SW_ACTIVATED') {
          this.logger.info('Service Worker activated', { version: event.data.cacheVersion });
        }
      });

      this.logger.info('Service Worker registered');
      return registration;
    } catch (error) {
      this.logger.warn('Service Worker registration failed', error);
      return null;
    }
  }

  /**
   * Show update notification
   */
  showUpdateNotification(registration) {
    const notification = document.createElement('div');
    notification.id = 'sw-update-notification';
    notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #4299e1;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 300px;
        `;
    notification.innerHTML = `
            <p style="margin: 0 0 0.5rem 0; font-weight: 600;">Update available</p>
            <p style="margin: 0 0 1rem 0; font-size: 0.875rem;">Reload to get the latest version.</p>
            <button id="sw-reload-btn" style="
                background: white;
                color: #4299e1;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                width: 100%;
            ">Reload</button>
        `;

    document.body.appendChild(notification);

    document.getElementById('sw-reload-btn').addEventListener('click', () => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    });
  }

  /**
   * Initialize storage systems
   */
  async initStorage() {
    // StorageManager should already be available
    if (window.StorageManager) {
      this.logger.debug('Storage system ready');
      return true;
    }
    return false;
  }

  /**
   * Initialize auth system and read from storage
   */
  async initAuth() {
    if (!window.AuthManager) {
      throw new Error('AuthManager not available');
    }

    await window.AuthManager.readFromStorage();
    const authState = window.AuthManager.getAuthState();
    this.logger.info('Auth initialized', { isAuthenticated: authState.isAuthenticated });
    return authState;
  }

  /**
   * Initialize router with auth state
   */
  initRouter(authState) {
    if (!window.Router) {
      throw new Error('Router not available');
    }

    window.Router.init(authState);
    this.logger.info('Router initialized');
  }

  /**
   * Initialize UI shell
   */
  initUIShell() {
    // UI shell components should already be loaded
    // This is where you'd initialize header, navigation, etc.
    this.logger.debug('UI shell ready');
  }

  /**
   * Main boot sequence
   */
  async boot() {
    try {
      this.logger.info('Starting boot sequence...');

      // 1. Initialize service worker (optional, non-blocking)
      await this.initServiceWorker();

      // 2. Initialize storage
      await this.initStorage();

      // 3. Initialize auth and read from storage (CRITICAL - must complete)
      const authState = await this.initAuth();

      // 4. Initialize router with auth state
      this.initRouter(authState);

      // 5. Initialize UI shell
      this.initUIShell();

      this.logger.info('Boot sequence complete');
      return { success: true, authState };
    } catch (error) {
      this.logger.error('Boot sequence failed', error);
      // Route to login on boot failure
      if (window.Router) {
        window.Router.navigate('#/login', { replace: true });
      }
      throw error;
    }
  }
}

// Create global instance
window.BootSequence = new BootSequence();
