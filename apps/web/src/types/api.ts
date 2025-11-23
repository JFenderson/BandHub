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