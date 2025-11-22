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

export enum VideoCategory {
  FIFTH_QUARTER = 'FIFTH_QUARTER',
  FIELD_SHOW = 'FIELD_SHOW',
  STAND_BATTLE = 'STAND_BATTLE',
  PARADE = 'PARADE',
  PRACTICE = 'PRACTICE',
  CONCERT_BAND = 'CONCERT_BAND',
}

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