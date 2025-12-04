// Event type enum matching Prisma schema
export type EventType =
  | 'BAYOU_CLASSIC'
  | 'SWAC_CHAMPIONSHIP'
  | 'HOMECOMING'
  | 'BATTLE_OF_THE_BANDS'
  | 'FOOTBALL_GAME'
  | 'PARADE'
  | 'CONCERT'
  | 'COMPETITION'
  | 'EXHIBITION'
  | 'OTHER';

export interface Event {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  eventType: EventType;
  eventDate: string;
  endDate?: string | null;
  location?: string | null;
  venue?: string | null;
  city?: string | null;
  state?: string | null;
  year: number;
  isRecurring: boolean;
  isActive: boolean;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    eventVideos?: number;
    eventBands?: number;
  };
}

export interface EventVideo {
  id: string;
  eventId: string;
  videoId: string;
  createdAt: string;
}

export interface EventBand {
  id: string;
  eventId: string;
  bandId: string;
  role?: string | null;
  createdAt: string;
}

export interface CreateEventDto {
  name: string;
  description?: string;
  eventType: EventType;
  eventDate: string;
  endDate?: string;
  location?: string;
  venue?: string;
  city?: string;
  state?: string;
  year: number;
  isRecurring?: boolean;
  imageUrl?: string;
}

export interface UpdateEventDto {
  name?: string;
  description?: string;
  eventType?: EventType;
  eventDate?: string;
  endDate?: string;
  location?: string;
  venue?: string;
  city?: string;
  state?: string;
  year?: number;
  isRecurring?: boolean;
  isActive?: boolean;
  imageUrl?: string;
}

export interface EventFilterParams {
  eventType?: EventType;
  year?: number;
  state?: string;
  search?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'eventDate' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
