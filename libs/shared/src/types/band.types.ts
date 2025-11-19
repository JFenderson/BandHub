export interface Band {
  id: string;
  name: string;
  slug: string;
  schoolName: string;
  city: string;
  state: string;
  conference: string | null;
  logoUrl: string | null;
  youtubeChannelId: string | null;
  youtubePlaylistIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BandWithVideoCount extends Band {
  videoCount: number;
}

export interface BandWithVideos extends Band {
  videos: Video[];
}

// Avoid circular import - define minimal Video type here
interface Video {
  id: string;
  title: string;
  thumbnailUrl: string;
}

export interface CreateBandInput {
  name: string;
  schoolName: string;
  city: string;
  state: string;
  conference?: string;
  logoUrl?: string;
  youtubeChannelId?: string;
  youtubePlaylistIds?: string[];
}

export interface UpdateBandInput extends Partial<CreateBandInput> {
  isActive?: boolean;
}