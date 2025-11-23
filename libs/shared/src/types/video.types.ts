export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string;
  duration: number;
  publishedAt: Date;
  viewCount: number;
  likeCount: number;
  eventName: string | null;
  eventYear: number | null;
  tags: string[];
  isHidden: boolean;
  hideReason: string | null;
  qualityScore: number;
  bandId: string;
  opponentBandId: string | null;
  categoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type VideoCategory =
  | 'FIFTH_QUARTER'
  | 'ZERO_QUARTER'
  | 'FIELD_SHOW'
  | 'STAND_BATTLE'
  | 'PARADE'
  | 'PRACTICE'
  | 'CONCERT_BAND'
  | 'HALFTIME'
  | 'ENTRANCE'
  | 'PREGAME'
  | 'OTHER';


export interface VideoWithRelations extends Omit<Video, 'bandId' | 'opponentBandId' | 'categoryId'> {
  band: {
    id: string;
    name: string;
    slug: string;
  };
  opponentBand: {
    id: string;
    name: string;
    slug: string;
  } | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface VideoFilters {
  bandId?: string;
  bandSlug?: string;
  opponentBandId?: string;
  categoryId?: string;
  categorySlug?: string;
  eventYear?: number;
  eventName?: string;
  search?: string;
  isHidden?: boolean;
}

export interface VideoSortOptions {
  field: 'publishedAt' | 'viewCount' | 'title' | 'createdAt';
  direction: 'asc' | 'desc';
}

export interface UpdateVideoInput {
  categoryId?: string | null;
  opponentBandId?: string | null;
  eventName?: string | null;
  eventYear?: number | null;
  tags?: string[];
  isHidden?: boolean;
  hideReason?: string | null;
  qualityScore?: number;
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
  sortBy?: 'publishedAt' | 'viewCount' | 'likeCount' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}