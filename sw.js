/**
 * Service Worker - Aggressive caching for offline functionality
 * Implements cache-first strategy for static assets and network-first for API calls
 */

// Version from package.json or fallback
// Increment CACHE_VERSION to bust caches
const CACHE_VERSION = 2; // Increment this to bust caches
const APP_VERSION = '1.0.0'; // This should be updated from package.json in build
const CACHE_NAME = `ignite-fitness-v${CACHE_VERSION}`;
const STATIC_CACHE = `ignite-fitness-static-v${CACHE_VERSION}`;
const API_CACHE = `ignite-fitness-api-v${CACHE_VERSION}`;
const WORKOUT_CACHE = `ignite-fitness-workout-v${CACHE_VERSION}`;

// Expose version to main thread and handle update requests
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: APP_VERSION, cacheVersion: CACHE_VERSION });
    }
    
    // Handle SKIP_WAITING request from app
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Cache size limits (in MB)
const MAX_CACHE_SIZE = 50;
const STATIC_CACHE_SIZE = 20;
const API_CACHE_SIZE = 15;
const WORKOUT_CACHE_SIZE = 15;

// Cache TTL (in milliseconds)
const STATIC_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const API_TTL = 5 * 60 * 1000; // 5 minutes
const WORKOUT_TTL = 60 * 60 * 1000; // 1 hour

// Static assets to cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/styles/mobile-first.css',
    '/styles/charts.css',
    '/js/app.js',
    '/js/modules/ui/VirtualList.js',
    '/js/modules/cache/LRUCache.js',
    '/js/modules/cache/PlanCache.js',
    '/js/modules/ui/charts/ChartManager.js',
    '/js/workers/ChartWorker.js',
    '/js/modules/sports/SoccerExercises.js',
    '/js/modules/integrations/dedup/BatchProcessor.js',
    '/manifest.json',
    '/favicon.ico'
];

// API endpoints to cache
const API_ENDPOINTS = [
    '/.netlify/functions/',
    '/api/'
];

// Workout data patterns
const WORKOUT_PATTERNS = [
    '/api/workouts/',
    '/api/exercises/',
    '/api/plans/'
];

/**
 * Install event - Cache static assets
 */
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Caching static assets...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Failed to cache static assets:', error);
            })
    );
});

/**
 * Activate event - Clean up old caches
 */
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                const currentCaches = [STATIC_CACHE, API_CACHE, WORKOUT_CACHE];
                const oldCaches = cacheNames.filter(cacheName => 
                    !currentCaches.includes(cacheName) && 
                    cacheName.startsWith('ignite-fitness')
                );
                
                console.log(`Found ${oldCaches.length} old caches to delete:`, oldCaches);
                
                return Promise.all(
                    oldCaches.map(cacheName => {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
            .then(() => {
                // Notify all clients about activation
                return self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({ type: 'SW_ACTIVATED', cacheVersion: CACHE_VERSION });
                    });
                });
            })
            .catch(error => {
                console.error('Failed to activate service worker:', error);
            })
    );
});

/**
 * Fetch event - Implement caching strategies
 */
self.addEventListener('fetch', event => {
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
    
    // Determine caching strategy based on request type
    if (isStaticAsset(request)) {
        event.respondWith(cacheFirstStrategy(request, STATIC_CACHE, STATIC_TTL));
    } else if (isWorkoutData(request)) {
        event.respondWith(staleWhileRevalidateStrategy(request, WORKOUT_CACHE, WORKOUT_TTL));
    } else if (isAPIRequest(request)) {
        event.respondWith(networkFirstStrategy(request, API_CACHE, API_TTL));
    } else {
        event.respondWith(networkFirstStrategy(request, API_CACHE, API_TTL));
    }
});

/**
 * Cache-first strategy for static assets
 */
async function cacheFirstStrategy(request, cacheName, ttl) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            // Check if cache is still valid
            if (isCacheValid(cachedResponse, ttl)) {
                console.log('Serving from cache:', request.url);
                return cachedResponse;
            } else {
                // Cache expired, remove it
                await cache.delete(request);
            }
        }
        
        // Fetch from network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Clone response before caching
            const responseToCache = networkResponse.clone();
            await cache.put(request, responseToCache);
            console.log('Cached new response:', request.url);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Cache-first strategy failed:', error);
        
        // Fallback to cache even if expired
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('Serving expired cache as fallback:', request.url);
            return cachedResponse;
        }
        
        // Return offline page if available
        return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    }
}

/**
 * Network-first strategy for API requests
 */
async function networkFirstStrategy(request, cacheName, ttl) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful response
            const cache = await caches.open(cacheName);
            const responseToCache = networkResponse.clone();
            await cache.put(request, responseToCache);
            
            // Clean up old entries
            await cleanupCache(cache, cacheName);
            
            console.log('Network response cached:', request.url);
            return networkResponse;
        }
        
        throw new Error('Network response not ok');
        
    } catch (error) {
        console.log('Network failed, trying cache:', request.url);
        
        // Fallback to cache
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse && isCacheValid(cachedResponse, ttl)) {
            console.log('Serving from cache:', request.url);
            return cachedResponse;
        }
        
        // Return error response
        return new Response('Network error', { status: 503 });
    }
}

/**
 * Stale-while-revalidate strategy for workout data
 */
async function staleWhileRevalidateStrategy(request, cacheName, ttl) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Serve stale cache immediately if available
    if (cachedResponse && isCacheValid(cachedResponse, ttl)) {
        console.log('Serving stale cache:', request.url);
        
        // Revalidate in background
        fetch(request)
            .then(response => {
                if (response.ok) {
                    cache.put(request, response.clone());
                    console.log('Background revalidation completed:', request.url);
                }
            })
            .catch(error => {
                console.log('Background revalidation failed:', error);
            });
        
        return cachedResponse;
    }
    
    // No valid cache, try network
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            await cache.put(request, networkResponse.clone());
            console.log('Network response cached:', request.url);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Network failed:', error);
        
        // Return expired cache if available
        if (cachedResponse) {
            console.log('Serving expired cache as fallback:', request.url);
            return cachedResponse;
        }
        
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Check if request is for static assets
 */
function isStaticAsset(request) {
    const url = new URL(request.url);
    
    return STATIC_ASSETS.includes(url.pathname) ||
           url.pathname.endsWith('.css') ||
           url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.png') ||
           url.pathname.endsWith('.jpg') ||
           url.pathname.endsWith('.jpeg') ||
           url.pathname.endsWith('.gif') ||
           url.pathname.endsWith('.svg') ||
           url.pathname.endsWith('.woff') ||
           url.pathname.endsWith('.woff2') ||
           url.pathname.endsWith('.ttf');
}

/**
 * Check if request is for workout data
 */
function isWorkoutData(request) {
    const url = new URL(request.url);
    
    return WORKOUT_PATTERNS.some(pattern => url.pathname.includes(pattern));
}

/**
 * Check if request is for API
 */
function isAPIRequest(request) {
    const url = new URL(request.url);
    
    return API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint));
}

/**
 * Check if cached response is still valid
 */
function isCacheValid(response, ttl) {
    const cacheDate = response.headers.get('sw-cache-date');
    if (!cacheDate) return false;
    
    const age = Date.now() - parseInt(cacheDate);
    return age < ttl;
}

/**
 * Clean up cache to stay within size limits
 */
async function cleanupCache(cache, cacheName) {
    const keys = await cache.keys();
    
    if (keys.length === 0) return;
    
    // Calculate cache size limit based on cache type
    let maxSize;
    switch (cacheName) {
        case STATIC_CACHE:
            maxSize = STATIC_CACHE_SIZE * 1024 * 1024;
            break;
        case API_CACHE:
            maxSize = API_CACHE_SIZE * 1024 * 1024;
            break;
        case WORKOUT_CACHE:
            maxSize = WORKOUT_CACHE_SIZE * 1024 * 1024;
            break;
        default:
            maxSize = 10 * 1024 * 1024; // 10MB default
    }
    
    // Estimate cache size (rough calculation)
    const estimatedSize = keys.length * 50 * 1024; // 50KB per entry estimate
    
    if (estimatedSize > maxSize) {
        // Remove oldest entries (first 25% of cache)
        const entriesToRemove = Math.floor(keys.length * 0.25);
        
        for (let i = 0; i < entriesToRemove; i++) {
            await cache.delete(keys[i]);
        }
        
        console.log(`Cleaned up ${entriesToRemove} cache entries`);
    }
}

/**
 * Message handler for cache management
 */
self.addEventListener('message', event => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'CACHE_WORKOUT_DATA':
            cacheWorkoutData(data);
            break;
        case 'CLEAR_CACHE':
            clearCache(data.cacheName);
            break;
        case 'GET_CACHE_STATS':
            getCacheStats().then(stats => {
                event.ports[0].postMessage(stats);
            });
            break;
    }
});

/**
 * Cache workout data
 */
async function cacheWorkoutData(data) {
    const cache = await caches.open(WORKOUT_CACHE);
    const request = new Request(data.url);
    const response = new Response(JSON.stringify(data.data), {
        headers: {
            'Content-Type': 'application/json',
            'sw-cache-date': Date.now().toString()
        }
    });
    
    await cache.put(request, response);
    console.log('Workout data cached:', data.url);
}

/**
 * Clear specific cache
 */
async function clearCache(cacheName) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    await Promise.all(keys.map(key => cache.delete(key)));
    console.log(`Cleared cache: ${cacheName}`);
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
    const stats = {
        static: { size: 0, entries: 0 },
        api: { size: 0, entries: 0 },
        workout: { size: 0, entries: 0 }
    };
    
    for (const [cacheName, statKey] of [
        [STATIC_CACHE, 'static'],
        [API_CACHE, 'api'],
        [WORKOUT_CACHE, 'workout']
    ]) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        stats[statKey].entries = keys.length;
        stats[statKey].size = keys.length * 50 * 1024; // Rough estimate
    }
    
    return stats;
}

console.log('Service Worker loaded');