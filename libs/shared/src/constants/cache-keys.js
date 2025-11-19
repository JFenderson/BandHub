"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_TTL = exports.CACHE_KEYS = void 0;
exports.CACHE_KEYS = {
    // Band cache keys
    BAND_LIST: 'bands:list',
    BAND_BY_SLUG: (slug) => `bands:slug:${slug}`,
    BAND_BY_ID: (id) => `bands:id:${id}`,
    // Video cache keys
    VIDEO_LIST: 'videos:list',
    VIDEO_BY_ID: (id) => `videos:id:${id}`,
    VIDEO_POPULAR: 'videos:popular',
    VIDEO_RECENT: 'videos:recent',
    // Category cache keys
    CATEGORY_LIST: 'categories:list',
    // Search cache
    SEARCH_RESULTS: (query) => `search:${query}`,
};
exports.CACHE_TTL = {
    SHORT: 60, // 1 minute
    MEDIUM: 300, // 5 minutes
    LONG: 3600, // 1 hour
    DAY: 86400, // 24 hours
};
