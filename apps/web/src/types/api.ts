// ONLY import from @hbcu-band-hub/shared-types
import type {
  Band as SharedBand,
  Video as SharedVideo,
  VideoCategory,
  Event as SharedEvent,
  EventType,
  CreateEventDto,
  UpdateEventDto,
  EventFilterParams,
} from '@hbcu-band-hub/shared-types';

// Re-export from shared types
export type { EventType, CreateEventDto, UpdateEventDto };
export type EventFilters = EventFilterParams;

// Extend Event with frontend-specific properties
export type Event = SharedEvent;

// Remove the duplicate import from @hbcu-band-hub/shared
// Remove the conflicting re-export

// Content Creator type
export interface Creator {
  id: string;
  name: string;
  youtubeChannelId: string;
  channelUrl: string;
  description?: string | null;
  logoUrl?: string | null;
  thumbnailUrl?: string | null;
  subscriberCount: number;
  totalVideoCount: number;
  videosInOurDb: number;
  isVerified: boolean;
  isFeatured: boolean;
  qualityScore: number;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    videos?: number;
  };
}

// Extend the shared types with frontend-specific properties
export type Band = SharedBand & {
  _count?: {
    videos?: number;
  };
};

export type Video = SharedVideo & {
  band?: Band;
  opponentBand?: Band;
  creator?: {
    id: string;
    name: string;
    logoUrl?: string | null;
    thumbnailUrl?: string | null;
    isVerified?: boolean;
    isFeatured?: boolean;
    qualityScore?: number;
  };
};

// Re-export VideoCategory (no changes needed)
export type { VideoCategory };

// API Response wrappers
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

// Filter/Query types
export interface VideoFilters {
  bandId?: string;
  category?: VideoCategory;
  year?: number;
  search?: string;
  sortBy?: 'publishedAt' | 'viewCount' | 'title' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface BandFilters {
  search?: string;
  state?: string;
  page?: number;
  limit?: number;
}

// Admin video moderation types
export interface AdminVideoFilters {
  bandId?: string;
  categoryId?: string;
  opponentBandId?: string;
  eventYear?: number;
  eventName?: string;
  search?: string;
  hiddenStatus?: 'all' | 'visible' | 'hidden';
  categorizationStatus?: 'all' | 'categorized' | 'uncategorized';
  tags?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'publishedAt' | 'viewCount' | 'title' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface VideoDetail {
  id: string;
  youtubeId: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: Date | string;
  viewCount: number;
  likeCount: number;
  eventName?: string;
  eventYear?: number;
  tags: string[];
  isHidden: boolean;
  hideReason?: string;
  qualityScore: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  band: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  opponentBand?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
}

export interface BulkVideoUpdateRequest {
  videoIds: string[];
  action: 'categorize' | 'hide' | 'unhide' | 'delete' | 'update_metadata';
  categoryId?: string;
  hideReason?: string;
  opponentBandId?: string;
  eventName?: string;
  eventYear?: number;
  tags?: string;
  qualityScore?: number;
}

export interface BulkVideoUpdateResponse {
  successCount: number;
  failedCount: number;
  successfulIds: string[];
  failedIds: string[];
  errors?: { [videoId: string]: string };
}

// Creator filter types
export interface CreatorFilters {
  search?: string;
  isFeatured?: boolean;
  isVerified?: boolean;
  sortBy?: 'qualityScore' | 'videosInOurDb' | 'name' | 'subscriberCount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Admin Dashboard Types
export type SyncJobStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface DashboardStats {
  totalVideos: number;
  totalBands: number;
  videosThisWeek: number;
  pendingModeration: number;
  lastSyncStatus?: SyncJobStatus;
  lastSyncTime?: string;
}

export interface RecentVideo {
  id: string;
  title: string;
  bandName: string;
  thumbnailUrl: string;
  createdAt: string;
  isHidden: boolean;
}

export interface SyncJob {
  id: string;
  status: SyncJobStatus;
  videosFound: number;
  videosAdded: number;
  videosUpdated: number;
  createdAt: string;
  completedAt?: string;
  bandName?: string;
}

export interface RecentActivity {
  recentVideos: RecentVideo[];
  recentSyncJobs: SyncJob[];
}

export interface SyncStatus {
  isRunning: boolean;
  currentJob?: SyncJob;
  failedJobs: SyncJob[];
}

// ============ CATEGORY TYPES ============

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    videos?: number;
  };
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
}

// Dashboard chart types
export interface VideoTrend {
  date: string;
  count: number;
}

export interface CategoryDistribution {
  name: string;
  count: number;
  slug: string;
}

export interface TopBand {
  id: string;
  name: string;
  videoCount: number;
  schoolName: string;
}