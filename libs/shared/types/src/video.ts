
export * from './video-categories';

// Video category type that matches Prisma enum
export type VideoCategory =
  | 'FIFTH_QUARTER'
  | 'FIELD_SHOW'
  | 'STAND_BATTLE'
  | 'PARADE'
  | 'PRACTICE'
  | 'CONCERT_BAND'
  | 'HALFTIME'
  | 'ENTRANCE'
  | 'PREGAME'
  | 'OTHER';

export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  publishedAt: string;
  duration?: number | null;
  viewCount?: number | null;
  likeCount?: number | null;
  category?: VideoCategory | null;
  eventName?: string | null;
  year?: number | null;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  
  band?: {
    id: string;
    name: string;
    school: string;
  };
  opponentBand?: {
    id: string;
    name: string;
    school: string;
  };
  creator?: {
    id: string;
    name: string;
    logoUrl?: string | null;
    thumbnailUrl?: string | null;
    isVerified?: boolean;
    isFeatured?: boolean;
  };
}

export interface CreateVideoDto {
  youtubeId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  publishedAt: string;
  duration?: string;
  viewCount?: number;
  likeCount?: number;
  bandId?: string;
  opponentBandId?: string;
  category?: VideoCategory;
  eventName?: string;
  year?: number;
}

export interface UpdateVideoDto {
  title?: string;
  description?: string;
  category?: VideoCategory;
  eventName?: string;
  year?: number;
  bandId?: string;
  opponentBandId?: string;
  isHidden?: boolean;
}

export interface VideoQueryParams {
  search?: string;
  bandId?: string;
  opponentBandId?: string;
  category?: VideoCategory;
  year?: number;
  eventName?: string;
  isHidden?: boolean;
  sortBy?: 'publishedAt' | 'viewCount' | 'likeCount' | 'title' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}