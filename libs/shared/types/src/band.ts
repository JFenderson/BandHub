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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  isActive?: boolean;
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
  isActive?: boolean;
}

export interface BandQueryParams {
  search?: string;
  state?: string;
  conference?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}