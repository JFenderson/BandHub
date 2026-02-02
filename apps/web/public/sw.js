/**
 * HBCU Band Hub Service Worker
 *
 * Implements:
 * - Cache-first strategy for static assets (images, fonts, CSS, JS)
 * - Network-first strategy for API calls with fallback
 * - Offline page support
 */

const CACHE_NAME = 'hbcu-band-hub-v1';
const OFFLINE_URL = '/offline';

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Cache patterns for different strategies
const CACHE_PATTERNS = {
  // Static assets - cache first
  static: [
    /\.(js|css|woff2?|ttf|eot|otf)$/,
    /\/_next\/static\//,
    /\/icons\//,
    /\/band-logos\//,
  ],
  // Images - cache first with network fallback
  images: [
    /\.(png|jpg|jpeg|gif|svg|webp|ico)$/,
    /i\.ytimg\.com/,
    /yt3\.ggpht\.com/,
    /yt3\.googleusercontent\.com/,
  ],
  // API calls - network first with cache fallback
  api: [
    /\/api\//,
    /localhost:3001/,
  ],
  // HTML pages - network first
  pages: [
    /\/$/,
    /\/bands/,
    /\/videos/,
    /\/profile/,
    /\/discover/,
  ],
};

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('[SW] Failed to cache some static assets:', error);
        // Continue even if some assets fail to cache
        return Promise.resolve();
      });
    })
  );

  // Activate immediately
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );

  // Take control of all clients immediately
  self.clients.claim();
});

/**
 * Check if URL matches any pattern in the list
 */
function matchesPattern(url, patterns) {
  return patterns.some((pattern) => pattern.test(url));
}

/**
 * Cache-first strategy
 * Try cache first, fall back to network, then cache the response
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Cache-first fetch failed:', error);
    throw error;
  }
}

/**
 * Network-first strategy
 * Try network first, fall back to cache if offline
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache...');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * Stale-while-revalidate strategy
 * Return cached version immediately, update cache in background
 */
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);

  // Start fetch in background
  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        // Clone before using the response
        const responseToCache = networkResponse.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, responseToCache);
      }
      return networkResponse;
    })
    .catch((error) => {
      console.warn('[SW] Background fetch failed:', error);
      return cachedResponse || null;
    });

  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // Otherwise wait for network
  return fetchPromise;
}

/**
 * Fetch event - apply appropriate caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.startsWith('http')) {
    return;
  }

  // Skip WebSocket connections
  if (url.includes('_next/webpack-hmr')) {
    return;
  }

  // Skip Next.js image optimization - let it handle its own caching
  if (url.includes('/_next/image')) {
    return;
  }

  // Determine caching strategy based on URL pattern
  if (matchesPattern(url, CACHE_PATTERNS.static)) {
    // Static assets: cache-first
    event.respondWith(cacheFirst(request));
  } else if (matchesPattern(url, CACHE_PATTERNS.images)) {
    // Images: cache-first with longer TTL
    event.respondWith(cacheFirst(request));
  } else if (matchesPattern(url, CACHE_PATTERNS.api)) {
    // API calls: network-first with cache fallback
    event.respondWith(
      networkFirst(request).catch(async () => {
        // Return cached API response or error
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        // Return a JSON error response for failed API calls
        return new Response(
          JSON.stringify({ error: 'You are offline', offline: true }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
  } else if (matchesPattern(url, CACHE_PATTERNS.pages) || request.mode === 'navigate') {
    // HTML pages: network-first, fallback to offline page
    event.respondWith(
      networkFirst(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        // Return offline page for navigation requests
        return caches.match(OFFLINE_URL);
      })
    );
  } else {
    // Default: stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request));
  }
});

/**
 * Background sync for failed requests
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  }
});

async function syncFavorites() {
  // This would sync any queued favorite actions when back online
  console.log('[SW] Syncing favorites...');
  // Implementation depends on IndexedDB queue
}

/**
 * Push notification support
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

/**
 * Message handler for cache management
 */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data === 'clearCache') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared');
    });
  }

  if (event.data?.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(CACHE_NAME).then((cache) => {
      cache.addAll(urls);
    });
  }
});
