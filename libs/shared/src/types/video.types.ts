export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string;
  duration: number; // seconds
  publishedAt: Date;
  viewCount: number;
  bandId: string;
  opponentBandId: string | null;
  categoryId: string | null;
  eventName: string | null;
  eventYear: number | null;
  tags: string[];
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoWithRelations extends Video {
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