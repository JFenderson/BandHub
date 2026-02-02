/**
 * HBCU Band Hub Service Worker - Advanced Implementation
 *
 * Features:
 * - Cache versioning with automatic cleanup
 * - Multi-tier caching strategy for static assets, images, fonts
 * - Video metadata caching for offline browsing
 * - Background sync for failed API requests
 * - Push notification support for new content
 * - Offline fallback page with cached bands list
 * - Cache management: max size limits, expiration policies
 */

// =============================================================================
// CACHE CONFIGURATION
// =============================================================================

const CACHE_VERSION = 'v2';
const CACHE_PREFIX = 'hbcu-band-hub';

// Separate caches for different resource types
const CACHE_NAMES = {
  static: `${CACHE_PREFIX}-static-${CACHE_VERSION}`,
  images: `${CACHE_PREFIX}-images-${CACHE_VERSION}`,
  fonts: `${CACHE_PREFIX}-fonts-${CACHE_VERSION}`,
  api: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  videos: `${CACHE_PREFIX}-video-meta-${CACHE_VERSION}`,
  pages: `${CACHE_PREFIX}-pages-${CACHE_VERSION}`,
};

// Cache size limits (in bytes)
const CACHE_LIMITS = {
  images: 50 * 1024 * 1024, // 50MB for images
  api: 10 * 1024 * 1024, // 10MB for API responses
  videos: 20 * 1024 * 1024, // 20MB for video metadata
  pages: 5 * 1024 * 1024, // 5MB for HTML pages
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
  static: 7 * 24 * 60 * 60 * 1000, // 7 days
  images: 30 * 24 * 60 * 60 * 1000, // 30 days
  fonts: 365 * 24 * 60 * 60 * 1000, // 1 year
  api: 5 * 60 * 1000, // 5 minutes
  videos: 60 * 60 * 1000, // 1 hour
  pages: 24 * 60 * 60 * 1000, // 24 hours
};

// Maximum entries per cache
const MAX_ENTRIES = {
  images: 200,
  api: 100,
  videos: 500,
  pages: 50,
};

const OFFLINE_URL = '/offline';
const OFFLINE_BANDS_KEY = 'offline-bands-data';
const SYNC_QUEUE_NAME = 'sync-queue';
const FAILED_REQUESTS_STORE = 'failed-requests';

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
];

// API endpoints to cache for offline access
const OFFLINE_API_ENDPOINTS = [
  '/api/v1/bands',
  '/api/v1/bands/featured',
  '/api/v1/categories',
  '/api/v1/videos/trending',
];

// =============================================================================
// URL PATTERN MATCHERS
// =============================================================================

const PATTERNS = {
  static: [
    /\/_next\/static\//,
    /\.js(\?.*)?$/,
    /\.css(\?.*)?$/,
  ],
  fonts: [
    /\.woff2?(\?.*)?$/,
    /\.ttf(\?.*)?$/,
    /\.eot(\?.*)?$/,
    /\.otf(\?.*)?$/,
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/,
  ],
  images: [
    /\.png(\?.*)?$/,
    /\.jpg(\?.*)?$/,
    /\.jpeg(\?.*)?$/,
    /\.gif(\?.*)?$/,
    /\.svg(\?.*)?$/,
    /\.webp(\?.*)?$/,
    /\.ico(\?.*)?$/,
    /\/band-logos\//,
    /\/icons\//,
    /i\.ytimg\.com/,
    /yt3\.ggpht\.com/,
    /yt3\.googleusercontent\.com/,
  ],
  api: [
    /\/api\//,
    /localhost:3001/,
  ],
  videoMeta: [
    /\/api\/.*\/videos/,
    /\/api\/.*\/trending/,
  ],
  pages: [
    /\/bands/,
    /\/videos/,
    /\/profile/,
    /\/discover/,
  ],
};

// =============================================================================
// INDEXEDDB FOR BACKGROUND SYNC
// =============================================================================

const DB_NAME = 'hbcu-band-hub-sw';
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store for failed requests to retry
      if (!db.objectStoreNames.contains(FAILED_REQUESTS_STORE)) {
        const store = db.createObjectStore(FAILED_REQUESTS_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('url', 'url', { unique: false });
      }

      // Store for cached bands data (offline access)
      if (!db.objectStoreNames.contains('bands-cache')) {
        db.createObjectStore('bands-cache', { keyPath: 'id' });
      }

      // Store for video metadata
      if (!db.objectStoreNames.contains('video-metadata')) {
        const videoStore = db.createObjectStore('video-metadata', { keyPath: 'id' });
        videoStore.createIndex('bandId', 'bandId', { unique: false });
        videoStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      // Store for cache metadata (expiration tracking)
      if (!db.objectStoreNames.contains('cache-metadata')) {
        const metaStore = db.createObjectStore('cache-metadata', { keyPath: 'url' });
        metaStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        metaStore.createIndex('cacheName', 'cacheName', { unique: false });
      }
    };
  });
}

async function addToSyncQueue(requestData) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(FAILED_REQUESTS_STORE, 'readwrite');
    const store = tx.objectStore(FAILED_REQUESTS_STORE);

    await store.add({
      ...requestData,
      timestamp: Date.now(),
      retryCount: 0,
    });

    await tx.complete;
    console.log('[SW] Request added to sync queue:', requestData.url);
  } catch (error) {
    console.error('[SW] Failed to add to sync queue:', error);
  }
}

async function getFailedRequests() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(FAILED_REQUESTS_STORE, 'readonly');
    const store = tx.objectStore(FAILED_REQUESTS_STORE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Failed to get failed requests:', error);
    return [];
  }
}

async function removeFromSyncQueue(id) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(FAILED_REQUESTS_STORE, 'readwrite');
    const store = tx.objectStore(FAILED_REQUESTS_STORE);
    await store.delete(id);
  } catch (error) {
    console.error('[SW] Failed to remove from sync queue:', error);
  }
}

async function updateRetryCount(id, retryCount) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(FAILED_REQUESTS_STORE, 'readwrite');
    const store = tx.objectStore(FAILED_REQUESTS_STORE);

    const request = store.get(id);
    request.onsuccess = () => {
      const data = request.result;
      if (data) {
        data.retryCount = retryCount;
        store.put(data);
      }
    };
  } catch (error) {
    console.error('[SW] Failed to update retry count:', error);
  }
}

// =============================================================================
// CACHE MANAGEMENT UTILITIES
// =============================================================================

async function setCacheMetadata(url, cacheName, expiresIn) {
  try {
    const db = await openDatabase();
    const tx = db.transaction('cache-metadata', 'readwrite');
    const store = tx.objectStore('cache-metadata');

    await store.put({
      url,
      cacheName,
      cachedAt: Date.now(),
      expiresAt: Date.now() + expiresIn,
    });
  } catch (error) {
    console.error('[SW] Failed to set cache metadata:', error);
  }
}

async function isCacheExpired(url) {
  try {
    const db = await openDatabase();
    const tx = db.transaction('cache-metadata', 'readonly');
    const store = tx.objectStore('cache-metadata');

    return new Promise((resolve) => {
      const request = store.get(url);
      request.onsuccess = () => {
        const data = request.result;
        if (!data) {
          resolve(true); // No metadata means expired
        } else {
          resolve(Date.now() > data.expiresAt);
        }
      };
      request.onerror = () => resolve(true);
    });
  } catch (error) {
    return true;
  }
}

async function cleanExpiredCache() {
  try {
    const db = await openDatabase();
    const tx = db.transaction('cache-metadata', 'readwrite');
    const store = tx.objectStore('cache-metadata');
    const index = store.index('expiresAt');

    const now = Date.now();
    const range = IDBKeyRange.upperBound(now);

    const expiredItems = [];

    return new Promise((resolve) => {
      const cursorRequest = index.openCursor(range);
      cursorRequest.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          expiredItems.push(cursor.value);
          cursor.continue();
        } else {
          // Delete expired items from caches
          for (const item of expiredItems) {
            try {
              const cache = await caches.open(item.cacheName);
              await cache.delete(item.url);
              await store.delete(item.url);
              console.log('[SW] Cleaned expired cache:', item.url);
            } catch (e) {
              // Ignore deletion errors
            }
          }
          resolve(expiredItems.length);
        }
      };
    });
  } catch (error) {
    console.error('[SW] Failed to clean expired cache:', error);
    return 0;
  }
}

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    if (keys.length > maxEntries) {
      const deleteCount = keys.length - maxEntries;
      console.log(`[SW] Trimming ${deleteCount} entries from ${cacheName}`);

      // Delete oldest entries (first in array)
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (error) {
    console.error('[SW] Failed to trim cache:', error);
  }
}

async function getCacheSize(cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let totalSize = 0;

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }

    return totalSize;
  } catch (error) {
    console.error('[SW] Failed to get cache size:', error);
    return 0;
  }
}

async function enforceCacheSizeLimit(cacheName, maxSize) {
  const currentSize = await getCacheSize(cacheName);

  if (currentSize > maxSize) {
    console.log(`[SW] Cache ${cacheName} exceeds limit (${currentSize} > ${maxSize})`);

    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    // Delete entries until we're under the limit
    let deletedSize = 0;
    const targetDeletion = currentSize - maxSize + (maxSize * 0.1); // Delete 10% extra

    for (const request of keys) {
      if (deletedSize >= targetDeletion) break;

      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        deletedSize += blob.size;
        await cache.delete(request);
      }
    }

    console.log(`[SW] Deleted ${deletedSize} bytes from ${cacheName}`);
  }
}

// =============================================================================
// CACHING STRATEGIES
// =============================================================================

function matchesPattern(url, patterns) {
  return patterns.some((pattern) => pattern.test(url));
}

async function cacheFirst(request, cacheName, expiration) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Check expiration in background
    isCacheExpired(request.url).then(async (expired) => {
      if (expired) {
        // Update cache in background
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            await cache.put(request, networkResponse);
            await setCacheMetadata(request.url, cacheName, expiration);
          }
        } catch (e) {
          // Network failed, keep stale cache
        }
      }
    });

    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      await setCacheMetadata(request.url, cacheName, expiration);
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Cache-first fetch failed:', error);
    throw error;
  }
}

async function networkFirst(request, cacheName, expiration) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      await setCacheMetadata(request.url, cacheName, expiration);
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

async function staleWhileRevalidate(request, cacheName, expiration) {
  const cachedResponse = await caches.match(request);

  // Start fetch in background
  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        const cache = await caches.open(cacheName);
        await cache.put(request, networkResponse.clone());
        await setCacheMetadata(request.url, cacheName, expiration);
      }
      return networkResponse;
    })
    .catch((error) => {
      console.warn('[SW] Background fetch failed:', error);
      return cachedResponse || null;
    });

  // Return cached response immediately if available
  return cachedResponse || fetchPromise;
}

// =============================================================================
// VIDEO METADATA CACHING
// =============================================================================

async function cacheVideoMetadata(videoData) {
  try {
    const db = await openDatabase();
    const tx = db.transaction('video-metadata', 'readwrite');
    const store = tx.objectStore('video-metadata');

    const videos = Array.isArray(videoData) ? videoData : [videoData];

    for (const video of videos) {
      await store.put({
        ...video,
        cachedAt: Date.now(),
      });
    }

    console.log(`[SW] Cached ${videos.length} video metadata entries`);
  } catch (error) {
    console.error('[SW] Failed to cache video metadata:', error);
  }
}

async function getOfflineVideoMetadata(bandId) {
  try {
    const db = await openDatabase();
    const tx = db.transaction('video-metadata', 'readonly');
    const store = tx.objectStore('video-metadata');

    if (bandId) {
      const index = store.index('bandId');
      return new Promise((resolve) => {
        const request = index.getAll(bandId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
      });
    }

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error('[SW] Failed to get offline video metadata:', error);
    return [];
  }
}

async function cleanOldVideoMetadata() {
  try {
    const db = await openDatabase();
    const tx = db.transaction('video-metadata', 'readwrite');
    const store = tx.objectStore('video-metadata');
    const index = store.index('cachedAt');

    const expirationTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    const range = IDBKeyRange.upperBound(expirationTime);

    return new Promise((resolve) => {
      const cursorRequest = index.openCursor(range);
      let deletedCount = 0;

      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`[SW] Cleaned ${deletedCount} old video metadata entries`);
          resolve(deletedCount);
        }
      };
    });
  } catch (error) {
    console.error('[SW] Failed to clean old video metadata:', error);
    return 0;
  }
}

// =============================================================================
// OFFLINE BANDS CACHING
// =============================================================================

async function cacheBandsForOffline(bandsData) {
  try {
    const db = await openDatabase();
    const tx = db.transaction('bands-cache', 'readwrite');
    const store = tx.objectStore('bands-cache');

    // Clear existing and add new
    await store.clear();

    const bands = bandsData.data || bandsData.bands || bandsData;
    if (Array.isArray(bands)) {
      for (const band of bands) {
        await store.put({ ...band, id: band.id || band.slug });
      }
      console.log(`[SW] Cached ${bands.length} bands for offline access`);
    }
  } catch (error) {
    console.error('[SW] Failed to cache bands:', error);
  }
}

async function getOfflineBands() {
  try {
    const db = await openDatabase();
    const tx = db.transaction('bands-cache', 'readonly');
    const store = tx.objectStore('bands-cache');

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error('[SW] Failed to get offline bands:', error);
    return [];
  }
}

// =============================================================================
// INSTALL EVENT
// =============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    Promise.all([
      // Pre-cache static assets
      caches.open(CACHE_NAMES.static).then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(PRECACHE_ASSETS).catch((error) => {
          console.warn('[SW] Failed to cache some static assets:', error);
          return Promise.resolve();
        });
      }),
      // Initialize IndexedDB
      openDatabase(),
    ])
  );

  // Activate immediately
  self.skipWaiting();
});

// =============================================================================
// ACTIVATE EVENT
// =============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        const validCacheNames = Object.values(CACHE_NAMES);
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith(CACHE_PREFIX) && !validCacheNames.includes(name))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Clean expired cache entries
      cleanExpiredCache(),
      // Clean old video metadata
      cleanOldVideoMetadata(),
      // Pre-fetch bands for offline access
      fetch('/api/v1/bands?limit=100')
        .then((response) => response.json())
        .then((data) => cacheBandsForOffline(data))
        .catch(() => console.log('[SW] Could not pre-fetch bands')),
    ])
  );

  // Take control of all clients immediately
  self.clients.claim();
});

// =============================================================================
// FETCH EVENT
// =============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests (handle separately for background sync)
  if (request.method !== 'GET') {
    event.respondWith(handleNonGetRequest(request));
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.startsWith('http')) {
    return;
  }

  // Skip WebSocket and HMR connections
  if (url.includes('_next/webpack-hmr') || url.includes('sockjs')) {
    return;
  }

  // Skip Next.js image optimization
  if (url.includes('/_next/image')) {
    return;
  }

  // Route to appropriate caching strategy
  if (matchesPattern(url, PATTERNS.fonts)) {
    event.respondWith(
      cacheFirst(request, CACHE_NAMES.fonts, CACHE_EXPIRATION.fonts)
    );
  } else if (matchesPattern(url, PATTERNS.static)) {
    event.respondWith(
      cacheFirst(request, CACHE_NAMES.static, CACHE_EXPIRATION.static)
    );
  } else if (matchesPattern(url, PATTERNS.images)) {
    event.respondWith(
      cacheFirst(request, CACHE_NAMES.images, CACHE_EXPIRATION.images)
        .then(async (response) => {
          // Enforce cache size limit in background
          enforceCacheSizeLimit(CACHE_NAMES.images, CACHE_LIMITS.images);
          trimCache(CACHE_NAMES.images, MAX_ENTRIES.images);
          return response;
        })
    );
  } else if (matchesPattern(url, PATTERNS.videoMeta)) {
    event.respondWith(handleVideoMetaRequest(request));
  } else if (matchesPattern(url, PATTERNS.api)) {
    event.respondWith(handleApiRequest(request));
  } else if (matchesPattern(url, PATTERNS.pages) || request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
  } else {
    event.respondWith(
      staleWhileRevalidate(request, CACHE_NAMES.static, CACHE_EXPIRATION.static)
    );
  }
});

async function handleNonGetRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Store failed request for background sync
    const body = await request.clone().text();
    await addToSyncQueue({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    });

    // Register for background sync
    if ('sync' in self.registration) {
      await self.registration.sync.register('sync-failed-requests');
    }

    return new Response(
      JSON.stringify({
        error: 'Request queued for background sync',
        offline: true,
        queued: true,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleVideoMetaRequest(request) {
  try {
    const response = await networkFirst(
      request,
      CACHE_NAMES.videos,
      CACHE_EXPIRATION.videos
    );

    // Cache video metadata in IndexedDB for offline access
    if (response.ok) {
      const clonedResponse = response.clone();
      clonedResponse.json().then((data) => {
        if (data.data) {
          cacheVideoMetadata(data.data);
        } else if (Array.isArray(data)) {
          cacheVideoMetadata(data);
        }
      }).catch(() => {});
    }

    return response;
  } catch (error) {
    // Try to serve from IndexedDB
    const offlineVideos = await getOfflineVideoMetadata();
    if (offlineVideos.length > 0) {
      return new Response(
        JSON.stringify({ data: offlineVideos, offline: true }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'You are offline', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleApiRequest(request) {
  try {
    const response = await networkFirst(
      request,
      CACHE_NAMES.api,
      CACHE_EXPIRATION.api
    );

    // Cache bands data for offline access
    if (request.url.includes('/bands') && response.ok) {
      const clonedResponse = response.clone();
      clonedResponse.json().then((data) => {
        cacheBandsForOffline(data);
      }).catch(() => {});
    }

    // Enforce cache limits in background
    enforceCacheSizeLimit(CACHE_NAMES.api, CACHE_LIMITS.api);
    trimCache(CACHE_NAMES.api, MAX_ENTRIES.api);

    return response;
  } catch (error) {
    // Try to return cached API response
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // For bands endpoint, return offline data
    if (request.url.includes('/bands')) {
      const offlineBands = await getOfflineBands();
      if (offlineBands.length > 0) {
        return new Response(
          JSON.stringify({ data: offlineBands, offline: true }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'You are offline', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleNavigationRequest(request) {
  try {
    const response = await networkFirst(
      request,
      CACHE_NAMES.pages,
      CACHE_EXPIRATION.pages
    );

    // Enforce cache limits
    trimCache(CACHE_NAMES.pages, MAX_ENTRIES.pages);

    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline page
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) {
      return offlinePage;
    }

    // Generate dynamic offline page with cached bands
    return generateOfflinePage();
  }
}

async function generateOfflinePage() {
  const bands = await getOfflineBands();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - HBCU Band Hub</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .header {
      text-align: center;
      padding: 40px 20px;
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 2em; margin-bottom: 10px; }
    .header p { color: #888; }
    .offline-badge {
      display: inline-block;
      background: #dc2626;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.85em;
      margin-bottom: 20px;
    }
    .bands-section h2 {
      margin-bottom: 20px;
      font-size: 1.3em;
      color: #dc2626;
    }
    .bands-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .band-card {
      background: rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 16px;
      transition: transform 0.2s, background 0.2s;
    }
    .band-card:hover {
      background: rgba(255,255,255,0.12);
      transform: translateY(-2px);
    }
    .band-name { font-weight: 600; margin-bottom: 4px; }
    .band-school { font-size: 0.85em; color: #888; }
    .band-conference {
      display: inline-block;
      background: rgba(220,38,38,0.2);
      color: #dc2626;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      margin-top: 8px;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
    }
    .retry-btn {
      background: #dc2626;
      color: #fff;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1em;
      cursor: pointer;
      margin-top: 20px;
    }
    .retry-btn:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="offline-badge">You're Offline</span>
      <h1>HBCU Band Hub</h1>
      <p>Don't worry! You can still browse cached content.</p>
      <button class="retry-btn" onclick="window.location.reload()">
        Try Again
      </button>
    </div>

    <div class="bands-section">
      <h2>Cached Bands (${bands.length})</h2>
      ${bands.length > 0 ? `
        <div class="bands-grid">
          ${bands.map(band => `
            <div class="band-card">
              <div class="band-name">${band.name || band.bandName || 'Unknown Band'}</div>
              <div class="band-school">${band.schoolName || band.school || ''}</div>
              ${band.conference ? `<span class="band-conference">${band.conference}</span>` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <p>No cached bands available.</p>
          <p>Visit the bands page while online to cache them for offline access.</p>
        </div>
      `}
    </div>
  </div>

  <script>
    // Auto-refresh when back online
    window.addEventListener('online', () => {
      window.location.reload();
    });
  </script>
</body>
</html>
`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

// =============================================================================
// BACKGROUND SYNC
// =============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-failed-requests') {
    event.waitUntil(syncFailedRequests());
  }

  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  }

  if (event.tag === 'sync-watch-history') {
    event.waitUntil(syncWatchHistory());
  }
});

async function syncFailedRequests() {
  console.log('[SW] Syncing failed requests...');

  const failedRequests = await getFailedRequests();
  const MAX_RETRIES = 3;

  for (const requestData of failedRequests) {
    if (requestData.retryCount >= MAX_RETRIES) {
      console.log('[SW] Max retries reached, removing:', requestData.url);
      await removeFromSyncQueue(requestData.id);
      continue;
    }

    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body,
      });

      if (response.ok) {
        console.log('[SW] Successfully synced:', requestData.url);
        await removeFromSyncQueue(requestData.id);

        // Notify clients of successful sync
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_SUCCESS',
            url: requestData.url,
          });
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.log('[SW] Sync failed, will retry:', requestData.url, error);
      await updateRetryCount(requestData.id, requestData.retryCount + 1);
    }
  }
}

async function syncFavorites() {
  console.log('[SW] Syncing favorites...');
  // Favorites sync implementation would depend on the favorites storage mechanism
}

async function syncWatchHistory() {
  console.log('[SW] Syncing watch history...');
  // Watch history sync implementation
}

// =============================================================================
// PUSH NOTIFICATIONS
// =============================================================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'New Content Available',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || 'Check out the latest updates!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/',
      type: data.type || 'general',
      timestamp: Date.now(),
    },
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  // Add image if provided
  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'HBCU Band Hub', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  // Handle different actions
  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: targetUrl,
            data: notificationData,
          });
          return;
        }
      }

      // Open new window if none exists
      return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');

  // Track notification dismissal for analytics
  const notificationData = event.notification.data || {};
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'NOTIFICATION_DISMISSED',
        data: notificationData,
      });
    });
  });
});

// =============================================================================
// MESSAGE HANDLER
// =============================================================================

self.addEventListener('message', async (event) => {
  console.log('[SW] Message received:', event.data);

  const { type, payload } = typeof event.data === 'object' ? event.data : { type: event.data };

  switch (type) {
    case 'skipWaiting':
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'clearCache':
    case 'CLEAR_CACHE':
      await Promise.all(
        Object.values(CACHE_NAMES).map((name) => caches.delete(name))
      );
      console.log('[SW] All caches cleared');
      event.ports[0]?.postMessage({ success: true });
      break;

    case 'CACHE_URLS':
      if (payload?.urls) {
        const cache = await caches.open(CACHE_NAMES.static);
        await cache.addAll(payload.urls);
        console.log('[SW] URLs cached:', payload.urls);
      }
      break;

    case 'GET_CACHE_STATUS':
      const status = {};
      for (const [key, name] of Object.entries(CACHE_NAMES)) {
        status[key] = {
          size: await getCacheSize(name),
          limit: CACHE_LIMITS[key] || 'unlimited',
        };
      }
      event.ports[0]?.postMessage({ status });
      break;

    case 'CACHE_BANDS':
      if (payload?.bands) {
        await cacheBandsForOffline(payload.bands);
        event.ports[0]?.postMessage({ success: true });
      }
      break;

    case 'CACHE_VIDEO_METADATA':
      if (payload?.videos) {
        await cacheVideoMetadata(payload.videos);
        event.ports[0]?.postMessage({ success: true });
      }
      break;

    case 'GET_OFFLINE_BANDS':
      const bands = await getOfflineBands();
      event.ports[0]?.postMessage({ bands });
      break;

    case 'GET_OFFLINE_VIDEOS':
      const videos = await getOfflineVideoMetadata(payload?.bandId);
      event.ports[0]?.postMessage({ videos });
      break;

    case 'CLEANUP_CACHE':
      const cleanedCount = await cleanExpiredCache();
      await cleanOldVideoMetadata();
      for (const [key, name] of Object.entries(CACHE_NAMES)) {
        if (MAX_ENTRIES[key]) {
          await trimCache(name, MAX_ENTRIES[key]);
        }
        if (CACHE_LIMITS[key]) {
          await enforceCacheSizeLimit(name, CACHE_LIMITS[key]);
        }
      }
      event.ports[0]?.postMessage({ cleanedCount });
      break;

    case 'REGISTER_SYNC':
      if ('sync' in self.registration && payload?.tag) {
        await self.registration.sync.register(payload.tag);
        event.ports[0]?.postMessage({ success: true });
      }
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// =============================================================================
// PERIODIC BACKGROUND SYNC (if supported)
// =============================================================================

self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);

  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }

  if (event.tag === 'cache-cleanup') {
    event.waitUntil(performCacheCleanup());
  }
});

async function syncContent() {
  console.log('[SW] Syncing content in background...');

  try {
    // Refresh bands cache
    const bandsResponse = await fetch('/api/v1/bands?limit=100');
    if (bandsResponse.ok) {
      const data = await bandsResponse.json();
      await cacheBandsForOffline(data);
    }

    // Refresh trending videos
    const trendingResponse = await fetch('/api/v1/videos/trending');
    if (trendingResponse.ok) {
      const data = await trendingResponse.json();
      await cacheVideoMetadata(data);
    }

    console.log('[SW] Content sync completed');
  } catch (error) {
    console.error('[SW] Content sync failed:', error);
  }
}

async function performCacheCleanup() {
  console.log('[SW] Performing scheduled cache cleanup...');

  await cleanExpiredCache();
  await cleanOldVideoMetadata();

  for (const [key, name] of Object.entries(CACHE_NAMES)) {
    if (MAX_ENTRIES[key]) {
      await trimCache(name, MAX_ENTRIES[key]);
    }
    if (CACHE_LIMITS[key]) {
      await enforceCacheSizeLimit(name, CACHE_LIMITS[key]);
    }
  }

  console.log('[SW] Cache cleanup completed');
}

console.log('[SW] Service worker loaded');
