// Service Worker for IgniteFitness PWA
const APP_VERSION = '2.0.0';
const CACHE_NAME = `ignitefitness-v${APP_VERSION}`;
const STATIC_CACHE = `ignitefitness-static-v${APP_VERSION}`;
const DYNAMIC_CACHE = `ignitefitness-dynamic-v${APP_VERSION}`;

// Core files to cache immediately
const STATIC_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/styles/main.css',
  '/js/app.js',
  '/js/main.js',
  '/js/core/data-store.js',
  '/js/core/auth.js',
  '/js/training/workout-generator.js',
  '/js/training/seasonal-training.js',
  '/js/ai/pattern-detector.js',
  '/js/ai/context-aware-ai.js',
  '/config.js',
  '/icon-192.png',
  '/icon-512.png'
];

// API endpoints to cache dynamically
const API_CACHE_PATTERNS = [
  /\/\.netlify\/functions\//,
  /\/api\//
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static resources');
        return cache.addAll(STATIC_URLS);
      })
      .then(() => {
        console.log('[SW] Static resources cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static resources:', error);
      })
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(handleRequest(request));
});

// Handle different types of requests with appropriate caching strategies
async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Static resources - Cache First strategy
    if (isStaticResource(url)) {
      return await cacheFirst(request, STATIC_CACHE);
    }
    
    // API requests - Network First strategy
    if (isApiRequest(url)) {
      return await networkFirst(request, DYNAMIC_CACHE);
    }
    
    // HTML pages - Network First with offline fallback
    if (isHtmlRequest(request)) {
      return await networkFirstWithOfflineFallback(request, DYNAMIC_CACHE);
    }
    
    // Other requests - Stale While Revalidate
    return await staleWhileRevalidate(request, DYNAMIC_CACHE);
    
  } catch (error) {
    console.error('[SW] Error handling request:', error);
    
    // Return offline page for navigation requests
    if (isNavigationRequest(request)) {
      return await caches.match('/offline.html');
    }
    
    // Return a basic error response for other requests
    return new Response('Offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Cache First strategy - for static resources
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    throw error;
  }
}

// Network First strategy - for API requests (no caching for dynamic data)
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    // Only cache GET requests for static API endpoints (like public config)
    // Don't cache user-specific or dynamic data
    if (networkResponse.ok && shouldCacheApiResponse(request)) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Network First with offline fallback - for HTML pages
async function networkFirstWithOfflineFallback(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (isNavigationRequest(request)) {
      return await caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Stale While Revalidate strategy - for other resources
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const cache = caches.open(cacheName);
      cache.then(c => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(() => {
    // Network failed, return cached version if available
    return cachedResponse;
  });
  
  return cachedResponse || fetchPromise;
}

// Helper functions to categorize requests
function isStaticResource(url) {
  return STATIC_URLS.some(staticUrl => url.pathname === staticUrl) ||
         url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
}

function isApiRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// Determine if API response should be cached (only static, non-user-specific data)
function shouldCacheApiResponse(request) {
  const url = new URL(request.url);
  
  // Only cache public, non-user-specific endpoints
  const cacheableEndpoints = [
    '/.netlify/functions/public-config',
    '/manifest.json'
  ];
  
  // Don't cache if it's a user-specific endpoint
  const userSpecificPatterns = [
    /sessions/,
    /exercises/,
    /users/,
    /admin/,
    /strava/,
    /auth/
  ];
  
  // Don't cache if it contains user-specific data
  if (userSpecificPatterns.some(pattern => pattern.test(url.pathname))) {
    return false;
  }
  
  // Only cache specific safe endpoints
  return cacheableEndpoints.some(endpoint => url.pathname === endpoint);
}

function isHtmlRequest(request) {
  return request.headers.get('accept')?.includes('text/html');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from IgniteFitness',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('IgniteFitness', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync implementation
async function doBackgroundSync() {
  try {
    console.log('[SW] Performing background sync...');
    // Implement offline data sync logic here
    // This would sync any offline data when connection is restored
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Cache cleanup - remove old entries
async function cleanupCache(cacheName, maxEntries = 50) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxEntries) {
    const entriesToDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(entriesToDelete.map(key => cache.delete(key)));
  }
}

// Periodic cache cleanup
setInterval(() => {
  cleanupCache(DYNAMIC_CACHE, 100);
}, 60000); // Clean up every minute
