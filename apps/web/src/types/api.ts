// Import shared types from your monorepo
import type { Band, Video, VideoCategory } from '@hbcu-band-hub/shared';
import type { Band as PrismaBand, Video as PrismaVideo } from '@hbcu-band-hub/shared';

// Re-export for convenience
export type { Band, Video, VideoCategory };

export interface Band extends PrismaBand {
  _count?: {
    videos?: number;
  };
}

export interface Video extends PrismaVideo {
  band?: Band;
  opponentBand?: Band;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
}

// VideoCategory enum (if not exported from shared)
export enum VideoCategory {
  FIFTH_QUARTER = 'FIFTH_QUARTER',
  FIELD_SHOW = 'FIELD_SHOW',
  STAND_BATTLE = 'STAND_BATTLE',
  PARADE = 'PARADE',
  PRACTICE = 'PRACTICE',
  CONCERT_BAND = 'CONCERT_BAND',
}

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
  categoryId?: string; // Changed from category to match backend
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