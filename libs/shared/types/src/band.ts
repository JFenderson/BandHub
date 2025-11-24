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