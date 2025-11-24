// ONLY import from @hbcu-band-hub/shared-types
import type {
  Band as SharedBand,
  Video as SharedVideo,
  VideoCategory
} from '@hbcu-band-hub/shared-types';

// Remove the duplicate import from @hbcu-band-hub/shared
// Remove the conflicting re-export

// Extend the shared types with frontend-specific properties
export type Band = SharedBand & {
  _count?: {
    videos?: number;
  };
};

export type Video = SharedVideo & {
  band?: Band;
  opponentBand?: Band;
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
  sortBy?: 'publishedAt' | 'viewCount' | 'title';
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