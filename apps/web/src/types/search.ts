// Core search types
export interface VideoSearchQuery {
  q?: string;
  bandIds?: string[];
  categoryIds?: string[];
  years?: number[];
  conferences?: string[];
  states?: string[];
  regions?: string[];
  eventName?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'relevance' | 'date' | 'views' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface VideoSearchResult {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  youtubeId: string;
  publishedAt: string;
  viewCount: number;
  duration: string;
  band: {
    id: string;
    name: string;
    nickname?: string;
    logoUrl?: string;
  };
  opponentBand?: {
    id: string;
    name: string;
    nickname?: string;
  };
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  event?: {
    name: string;
    date: string;
    location?: string;
  };
}

export interface SearchResponse {
  results: VideoSearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchTime: number; // milliseconds
  hasMore: boolean;
}

export interface AutocompleteResult {
  id: string;
  value: string;
  type: 'band' | 'event' | 'category' | 'location';
  metadata?: {
    logoUrl?: string;
    count?: number;
    state?: string;
  };
}

export interface AutocompleteResponse {
  suggestions: AutocompleteResult[];
  searchTime: number;
}

export interface PopularSearch {
  query: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  filters: VideoSearchQuery;
  timestamp: number;
  resultCount: number;
}

export interface SearchFilters {
  categories: string[];
  years: number[];
  conferences: string[];
  states: string[];
  regions: string[];
  dateRange: {
    from?: string;
    to?: string;
  };
}

// Filter options for dropdowns
export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterMetadata {
  categories: FilterOption[];
  conferences: FilterOption[];
  states: FilterOption[];
  regions: FilterOption[];
  years: number[];
}

// User preferences
export interface SavedSearchPreference {
  id: string;
  userId: string;
  defaultFilters: SearchFilters;
  defaultSort: {
    by: VideoSearchQuery['sortBy'];
    order: VideoSearchQuery['sortOrder'];
  };
  updatedAt: string;
}

// UI State
export interface SearchUIState {
  isSearching: boolean;
  showFilters: boolean;
  showHistory: boolean;
  activeFilterCount: number;
  error?: string;
}