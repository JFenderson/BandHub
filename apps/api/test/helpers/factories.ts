import { AdminRole, Prisma } from '@prisma/client';
import { SyncMode } from '@hbcu-band-hub/shared-types';

let counter = 0;
const next = () => ++counter;

export function buildBand(overrides: Partial<Prisma.BandCreateInput> = {}): Prisma.BandCreateInput {
  const id = next();
  return {
    name: overrides.name ?? `Test Band ${id}`,
    slug: overrides.slug ?? `test-band-${id}`,
    schoolName: overrides.schoolName ?? `School ${id}`,
    city: overrides.city ?? 'Cityville',
    state: overrides.state ?? 'State',
    conference: overrides.conference ?? 'SWAC',
    description: overrides.description ?? 'A marching band for testing.',
    foundedYear: overrides.foundedYear ?? 1900 + id,
    youtubeChannelId: overrides.youtubeChannelId ?? `channel-${id}`,
    youtubePlaylistIds: overrides.youtubePlaylistIds ?? [],
    isActive: overrides.isActive ?? true,
    isFeatured: overrides.isFeatured ?? false,
  };
}

export function buildVideo(overrides: Partial<Prisma.VideoCreateInput> = {}): Prisma.VideoCreateInput {
  const id = next();
  return {
    title: overrides.title ?? `Test Video ${id}`,
    description: overrides.description ?? 'A marching band video.',
    youtubeId: overrides.youtubeId ?? `youtube-${id}`,
    thumbnailUrl: overrides.thumbnailUrl ?? `https://example.com/${id}.jpg`,
    duration: overrides.duration ?? 120,
    publishedAt: overrides.publishedAt ?? new Date(),
    isHidden: overrides.isHidden ?? false,
    band: overrides.band ?? undefined as any,
    ...overrides,
  } as Prisma.VideoCreateInput;
}

export function buildAdminUser(overrides: Partial<Prisma.AdminUserCreateInput> = {}): Prisma.AdminUserCreateInput {
  const id = next();
  return {
    email: overrides.email ?? `user${id}@example.com`,
    name: overrides.name ?? `User ${id}`,
    passwordHash: overrides.passwordHash ?? `hash-${id}`,
    role: overrides.role ?? AdminRole.MODERATOR,
    ...overrides,
  };
}

export function buildSyncJob(overrides: Partial<{ bandId: string; mode: SyncMode }> = {}) {
  const id = next();
  return {
    bandId: overrides.bandId ?? `band-${id}`,
    mode: overrides.mode ?? SyncMode.FULL,
  };
}

export function createMockPagination<T>(items: T[], total: number, page = 1, limit = 10) {
  return {
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ========================================
// NEW FACTORIES
// ========================================

/**
 * Build a Category factory for testing
 */
export function buildCategory(overrides: Partial<Prisma.CategoryCreateInput> = {}): Prisma.CategoryCreateInput {
  const id = next();
  return {
    name: overrides.name ?? `Test Category ${id}`,
    slug: overrides.slug ?? `test-category-${id}`,
    description: overrides.description ?? `Description for category ${id}`,
    sortOrder: overrides.sortOrder ?? id,
    ...overrides,
  };
}

/**
 * Build a Video Query DTO for testing
 */
export function buildVideoQuery(overrides: Partial<any> = {}) {
  return {
    page: overrides.page ?? 1,
    limit: overrides.limit ?? 20,
    bandId: overrides.bandId,
    bandSlug: overrides.bandSlug,
    categoryId: overrides.categoryId,
    categorySlug: overrides.categorySlug,
    search: overrides.search,
    tags: overrides.tags,
    isHidden: overrides.isHidden ?? false,
    eventYear: overrides.eventYear,
    eventName: overrides.eventName,
    opponentBandId: overrides.opponentBandId,
    sortBy: overrides.sortBy ?? 'publishedAt',
    sortOrder: overrides.sortOrder ?? 'desc',
    ...overrides,
  };
}

/**
 * Build a Band Query DTO for testing
 */
export function buildBandQuery(overrides: Partial<any> = {}) {
  return {
    page: overrides.page ?? 1,
    limit: overrides.limit ?? 20,
    search: overrides.search,
    state: overrides.state,
    conference: overrides.conference,
    bandType: overrides.bandType,
    isActive: overrides.isActive ?? true,
    isFeatured: overrides.isFeatured,
    sortBy: overrides.sortBy ?? 'name',
    sortOrder: overrides.sortOrder ?? 'asc',
    ...overrides,
  };
}

/**
 * Build a YouTube Video API response for testing
 */
export function buildYouTubeVideo(overrides: Partial<any> = {}) {
  const id = next();
  return {
    kind: 'youtube#video',
    etag: `etag-${id}`,
    id: overrides.id ?? `youtube-video-${id}`,
    snippet: {
      publishedAt: overrides.publishedAt ?? new Date().toISOString(),
      channelId: overrides.channelId ?? `channel-${id}`,
      title: overrides.title ?? `YouTube Video Title ${id}`,
      description: overrides.description ?? `Description for video ${id}`,
      thumbnails: {
        default: { url: `https://i.ytimg.com/vi/video-${id}/default.jpg`, width: 120, height: 90 },
        medium: { url: `https://i.ytimg.com/vi/video-${id}/mqdefault.jpg`, width: 320, height: 180 },
        high: { url: `https://i.ytimg.com/vi/video-${id}/hqdefault.jpg`, width: 480, height: 360 },
      },
      channelTitle: overrides.channelTitle ?? `Channel ${id}`,
      tags: overrides.tags ?? ['band', 'marching'],
      categoryId: overrides.categoryId ?? '10',
    },
    contentDetails: {
      duration: overrides.duration ?? 'PT5M30S',
      dimension: '2d',
      definition: 'hd',
      caption: 'false',
    },
    statistics: {
      viewCount: overrides.viewCount ?? '1000',
      likeCount: overrides.likeCount ?? '50',
      commentCount: overrides.commentCount ?? '10',
    },
    ...overrides,
  };
}

/**
 * Build a YouTube Search Result for testing
 */
export function buildYouTubeSearchResult(overrides: Partial<any> = {}) {
  const id = next();
  return {
    kind: 'youtube#searchResult',
    etag: `etag-${id}`,
    id: {
      kind: 'youtube#video',
      videoId: overrides.videoId ?? `search-video-${id}`,
    },
    snippet: {
      publishedAt: overrides.publishedAt ?? new Date().toISOString(),
      channelId: overrides.channelId ?? `channel-${id}`,
      title: overrides.title ?? `Search Result ${id}`,
      description: overrides.description ?? `Description ${id}`,
      thumbnails: {
        default: { url: `https://i.ytimg.com/vi/video-${id}/default.jpg` },
        medium: { url: `https://i.ytimg.com/vi/video-${id}/mqdefault.jpg` },
        high: { url: `https://i.ytimg.com/vi/video-${id}/hqdefault.jpg` },
      },
      channelTitle: overrides.channelTitle ?? `Channel ${id}`,
    },
    ...overrides,
  };
}

/**
 * Build a Sync Result for testing
 */
export function buildSyncResult(overrides: Partial<any> = {}) {
  return {
    bandId: overrides.bandId ?? 'band-1',
    mode: overrides.mode ?? SyncMode.FULL,
    status: overrides.status ?? 'completed',
    videosFound: overrides.videosFound ?? 10,
    videosAdded: overrides.videosAdded ?? 5,
    videosUpdated: overrides.videosUpdated ?? 3,
    videosSkipped: overrides.videosSkipped ?? 2,
    quotaUsed: overrides.quotaUsed ?? 100,
    errors: overrides.errors ?? [],
    startedAt: overrides.startedAt ?? new Date(),
    completedAt: overrides.completedAt ?? new Date(),
    ...overrides,
  };
}

/**
 * Build a Quota Status for testing
 */
export function buildQuotaStatus(overrides: Partial<any> = {}) {
  return {
    dailyLimit: overrides.dailyLimit ?? 10000,
    used: overrides.used ?? 2000,
    remaining: overrides.remaining ?? 8000,
    percentUsed: overrides.percentUsed ?? 20,
    resetAt: overrides.resetAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    isEmergencyMode: overrides.isEmergencyMode ?? false,
    ...overrides,
  };
}
