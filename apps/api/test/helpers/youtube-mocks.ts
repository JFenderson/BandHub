/**
 * YouTube API Mock Helpers
 * 
 * Provides mock responses for YouTube Data API v3
 * Used in unit and integration tests for YouTube sync functionality
 */

import { buildYouTubeVideo, buildYouTubeSearchResult } from './factories';

/**
 * Mock a successful YouTube search API response
 */
export function mockYouTubeSearchResponse(videoCount: number = 5, pageToken?: string) {
  const items = Array.from({ length: videoCount }, (_, i) =>
    buildYouTubeSearchResult({
      videoId: `video-${i + 1}`,
      title: `Test Video ${i + 1}`,
      channelId: 'test-channel-id',
    })
  );

  return {
    kind: 'youtube#searchListResponse',
    etag: 'test-etag',
    nextPageToken: pageToken ?? (videoCount >= 50 ? 'next-page-token' : undefined),
    regionCode: 'US',
    pageInfo: {
      totalResults: videoCount,
      resultsPerPage: videoCount,
    },
    items,
  };
}

/**
 * Mock a successful YouTube channel videos response
 */
export function mockYouTubeChannelResponse(videoCount: number = 10) {
  const items = Array.from({ length: videoCount }, (_, i) =>
    buildYouTubeSearchResult({
      videoId: `channel-video-${i + 1}`,
      title: `Channel Video ${i + 1}`,
    })
  );

  return {
    kind: 'youtube#searchListResponse',
    etag: 'test-etag',
    pageInfo: {
      totalResults: videoCount,
      resultsPerPage: videoCount,
    },
    items,
  };
}

/**
 * Mock a successful YouTube video details response
 */
export function mockYouTubeVideoDetailsResponse(videoIds: string[] = ['video-1']) {
  const items = videoIds.map((id, index) =>
    buildYouTubeVideo({
      id,
      title: `Video Details ${index + 1}`,
      viewCount: '1000',
      likeCount: '50',
    })
  );

  return {
    kind: 'youtube#videoListResponse',
    etag: 'test-etag',
    pageInfo: {
      totalResults: items.length,
      resultsPerPage: items.length,
    },
    items,
  };
}

/**
 * Mock a YouTube API quota exceeded error (403)
 */
export function mockYouTubeQuotaError() {
  return {
    error: {
      code: 403,
      message: 'The request cannot be completed because you have exceeded your quota.',
      errors: [
        {
          message: 'The request cannot be completed because you have exceeded your quota.',
          domain: 'youtube.quota',
          reason: 'quotaExceeded',
        },
      ],
    },
  };
}

/**
 * Mock a YouTube API rate limit error (429)
 */
export function mockYouTubeRateLimitError() {
  return {
    error: {
      code: 429,
      message: 'Too many requests. Please try again later.',
      errors: [
        {
          message: 'Too many requests',
          domain: 'usageLimits',
          reason: 'rateLimitExceeded',
        },
      ],
    },
  };
}

/**
 * Mock a YouTube API not found error (404)
 */
export function mockYouTubeNotFoundError() {
  return {
    error: {
      code: 404,
      message: 'The requested resource was not found.',
      errors: [
        {
          message: 'Video not found',
          domain: 'youtube.video',
          reason: 'videoNotFound',
        },
      ],
    },
  };
}

/**
 * Mock a YouTube API server error (500)
 */
export function mockYouTubeServerError() {
  return {
    error: {
      code: 500,
      message: 'Internal server error. Please try again later.',
      errors: [
        {
          message: 'Backend error',
          domain: 'global',
          reason: 'backendError',
        },
      ],
    },
  };
}

/**
 * Mock an invalid API key error (400)
 */
export function mockYouTubeInvalidApiKeyError() {
  return {
    error: {
      code: 400,
      message: 'API key not valid. Please pass a valid API key.',
      errors: [
        {
          message: 'Bad Request',
          domain: 'usageLimits',
          reason: 'keyInvalid',
        },
      ],
    },
  };
}

/**
 * Mock an empty YouTube search response (no results)
 */
export function mockYouTubeEmptyResponse() {
  return {
    kind: 'youtube#searchListResponse',
    etag: 'test-etag',
    pageInfo: {
      totalResults: 0,
      resultsPerPage: 0,
    },
    items: [],
  };
}

/**
 * Mock a YouTube response with pagination
 */
export function mockYouTubePaginatedResponse(page: number = 1, totalPages: number = 3) {
  const items = Array.from({ length: 50 }, (_, i) =>
    buildYouTubeSearchResult({
      videoId: `page-${page}-video-${i + 1}`,
      title: `Page ${page} Video ${i + 1}`,
    })
  );

  return {
    kind: 'youtube#searchListResponse',
    etag: 'test-etag',
    nextPageToken: page < totalPages ? `page-${page + 1}-token` : undefined,
    prevPageToken: page > 1 ? `page-${page - 1}-token` : undefined,
    pageInfo: {
      totalResults: totalPages * 50,
      resultsPerPage: 50,
    },
    items,
  };
}
