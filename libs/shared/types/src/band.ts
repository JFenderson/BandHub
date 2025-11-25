export interface Band {
  id: string;
  slug: string;
  name: string;
  school: string;
  nickname?: string | null;
  city?: string | null;
  state?: string | null;
  conference?: string | null;
  division?: string | null;
  founded?: number | null;
  colors?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  foundedYear?: number | null;
  youtubeChannelId?: string | null;
  youtubePlaylistIds?: string[];
  lastSyncAt?: string | null;
  syncStatus?: string;
  isActive: boolean;
  isFeatured?: boolean;
  featuredOrder?: number | null;
  featuredSince?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    videos?: number;
  };
}

export interface CreateBandDto {
  name: string;
  school: string;
  nickname?: string;
  city?: string;
  state?: string;
  conference?: string;
  division?: string;
  founded?: number;
  colors?: string;
  website?: string;
  description?: string;
  foundedYear?: number;
  youtubeChannelId?: string;
  youtubePlaylistIds?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface UpdateBandDto {
  name?: string;
  school?: string;
  nickname?: string;
  city?: string;
  state?: string;
  conference?: string;
  division?: string;
  founded?: number;
  colors?: string;
  website?: string;
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  foundedYear?: number;
  youtubeChannelId?: string;
  youtubePlaylistIds?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface BandQueryParams {
  search?: string;
  state?: string;
  conference?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// Featured Band types
export interface FeaturedBandVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
  viewCount: number;
  publishedAt: string;
}

export interface FeaturedBandResponse {
  id: string;
  name: string;
  school: string;
  description: string | null;
  logoUrl: string | null;
  slug: string;
  schoolColors?: {
    primary: string;
    secondary: string;
  };
  videoCount: number;
  recentVideos: FeaturedBandVideo[];
  featuredOrder: number;
  featuredSince: string | null;
}

export interface FeaturedBandsResponse {
  bands: FeaturedBandResponse[];
}

export interface UpdateFeaturedOrderDto {
  bands: Array<{
    id: string;
    featuredOrder: number;
  }>;
}

export interface FeaturedBandRecommendation {
  band: Band;
  score: number;
  reasoning: string[];
  suggestedAction?: string;
}

export interface FeaturedRecommendationsResponse {
  recommendations: FeaturedBandRecommendation[];
}

export interface FeaturedBandAnalytics {
  bandId: string;
  bandName: string;
  totalClicks: number;
  clickThroughRate: number;
  averagePosition: number;
  daysFeatured: number;
}

export interface FeaturedBandAnalyticsResponse {
  analytics: FeaturedBandAnalytics[];
  totalFeaturedClicks: number;
  averageCTR: number;
  bestPerformingPosition: number;
}