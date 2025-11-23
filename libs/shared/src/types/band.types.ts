// These types mirror the Prisma schema but are independent
// This keeps the frontend decoupled from Prisma

export type SyncStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface Band {
  id: string;
  name: string;
  slug: string;
  schoolName: string;
  city: string;
  state: string;
  conference: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  founded: number | null;
  foundedYear: number | null;
  youtubeChannelId: string | null;
  youtubePlaylistIds: string[];
  lastSyncAt: Date | null;
  syncStatus: SyncStatus;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BandWithVideoCount extends Band {
  videoCount: number;
}

export interface BandWithVideos extends Band {
  videos: {
    id: string;
    title: string;
    thumbnailUrl: string;
    duration: number;
    publishedAt: Date;
    viewCount: number;
  }[];
}

export interface CreateBandInput {
  name: string;
  schoolName: string;
  city: string;
  state: string;
  conference?: string;
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  founded?: number;
  foundedYear?: number;
  youtubeChannelId?: string;
  youtubePlaylistIds?: string[];
}

export interface UpdateBandInput extends Partial<CreateBandInput> {
  isActive?: boolean;
  isFeatured?: boolean;
}