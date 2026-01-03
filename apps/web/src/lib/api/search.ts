import { 
  VideoSearchQuery, 
  SearchResponse, 
  AutocompleteResponse,
  PopularSearch,
  FilterMetadata,
  SavedSearchPreference 
} from '@/types/search';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Handles API errors and provides user-friendly messages
 */
class SearchAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'SearchAPIError';
  }
}

/**
 * Build query string from search parameters
 */
function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    
    if (Array.isArray(value)) {
      value.forEach(v => searchParams.append(key, String(v)));
    } else {
      searchParams.append(key, String(value));
    }
  });
  
  return searchParams.toString();
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new SearchAPIError(
        errorData.message || 'Search request failed',
        response.status,
        errorData
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof SearchAPIError) {
      throw error;
    }
    
    throw new SearchAPIError(
      'Network error occurred. Please check your connection.',
      undefined,
      error
    );
  }
}

/**
 * Search videos with filters and pagination
 */
export async function searchVideos(
  query: VideoSearchQuery,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const queryString = buildQueryString(query);
  
  return fetchAPI<SearchResponse>(
    `/search?${queryString}`,
    { signal }
  );
}

/**
 * Get autocomplete suggestions for search input
 */
export async function getAutocomplete(
  partial: string,
  type?: 'band' | 'event' | 'category' | 'all',
  signal?: AbortSignal
): Promise<AutocompleteResponse> {
  const params = { q: partial, type: type || 'all' };
  const queryString = buildQueryString(params);
  
  return fetchAPI<AutocompleteResponse>(
    `/search/autocomplete?${queryString}`,
    { signal }
  );
}

/**
 * Get popular/trending searches
 */
export async function getPopularSearches(
  limit: number = 10
): Promise<PopularSearch[]> {
  return fetchAPI<PopularSearch[]>(
    `/search/popular?limit=${limit}`
  );
}

/**
 * Get filter metadata (available options)
 */
export async function getFilterMetadata(): Promise<FilterMetadata> {
  return fetchAPI<FilterMetadata>('/search/filters/metadata');
}

/**
 * Get user's saved search preferences (requires auth)
 */
export async function getSavedPreferences(
  token: string
): Promise<SavedSearchPreference | null> {
  return fetchAPI<SavedSearchPreference | null>(
    '/search/preferences',
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
}

/**
 * Save user's search preferences (requires auth)
 */
export async function savePreferences(
  preferences: Omit<SavedSearchPreference, 'id' | 'userId' | 'updatedAt'>,
  token: string
): Promise<SavedSearchPreference> {
  return fetchAPI<SavedSearchPreference>(
    '/search/preferences',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(preferences),
    }
  );
}

/**
 * Track search for analytics (no auth required)
 */
export async function trackSearch(
  query: string,
  filters: VideoSearchQuery,
  resultCount: number
): Promise<void> {
  // Fire and forget - don't wait for response
  fetchAPI('/search/analytics', {
    method: 'POST',
    body: JSON.stringify({ query, filters, resultCount }),
  }).catch(() => {
    // Silently fail analytics tracking
  });
}

export { SearchAPIError };