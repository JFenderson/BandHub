/**
 * React hook for analytics tracking
 *
 * Provides convenient methods for tracking analytics events
 * with automatic user context and page tracking.
 */

import { useEffect, useCallback, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  analytics,
  getAnalytics,
  VideoPlayEvent,
  SearchEvent,
  VideoSource,
  UserProperties,
} from '@/lib/analytics';

interface UseAnalyticsOptions {
  /** Disable automatic page view tracking */
  disablePageTracking?: boolean;
}

/**
 * Main analytics hook
 */
export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousPathname = useRef<string | null>(null);

  // Track page views automatically
  useEffect(() => {
    if (options.disablePageTracking) return;
    if (!pathname) return;

    // Avoid duplicate tracking on initial render
    if (previousPathname.current === pathname) return;

    // Track exit from previous page
    if (previousPathname.current) {
      analytics.trackPageExit();
    }

    // Track new page view
    const params: Record<string, string> = {};
    if (searchParams) {
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    analytics.trackPageView({
      path: pathname,
      title: typeof document !== 'undefined' ? document.title : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      searchParams: Object.keys(params).length > 0 ? params : undefined,
    });

    previousPathname.current = pathname;
  }, [pathname, searchParams, options.disablePageTracking]);

  // Identify user
  const identify = useCallback((userId: string, properties?: Partial<UserProperties>) => {
    analytics.identify(userId, properties);
  }, []);

  // Update user properties
  const setUserProperties = useCallback((properties: Partial<UserProperties>) => {
    analytics.setUserProperties(properties);
  }, []);

  // Reset on logout
  const reset = useCallback(() => {
    analytics.reset();
  }, []);

  // Generic track
  const track = useCallback((event: string, properties?: Record<string, unknown>) => {
    getAnalytics()?.track(event, properties ?? {});
  }, []);

  return {
    identify,
    setUserProperties,
    reset,
    track,
    // Re-export all tracking methods for convenience
    trackVideoPlay: analytics.trackVideoPlay,
    trackVideoProgress: analytics.trackVideoProgress,
    trackVideoComplete: analytics.trackVideoComplete,
    trackVideoPause: analytics.trackVideoPause,
    trackSearch: analytics.trackSearch,
    trackSearchResultClick: analytics.trackSearchResultClick,
    trackAutocompleteClick: analytics.trackAutocompleteClick,
    trackFavorite: analytics.trackFavorite,
    trackUnfavorite: analytics.trackUnfavorite,
    trackShare: analytics.trackShare,
    trackFollow: analytics.trackFollow,
    trackUnfollow: analytics.trackUnfollow,
    trackPlaylistAdd: analytics.trackPlaylistAdd,
    trackPlaylistRemove: analytics.trackPlaylistRemove,
    trackPlaylistCreate: analytics.trackPlaylistCreate,
    trackWatchLaterAdd: analytics.trackWatchLaterAdd,
    trackWatchLaterRemove: analytics.trackWatchLaterRemove,
    trackPageView: analytics.trackPageView,
    trackPageExit: analytics.trackPageExit,
  };
}

/**
 * Hook for video analytics tracking
 */
export function useVideoAnalytics(
  videoId: string,
  bandId: string,
  options: {
    bandName?: string;
    category?: string;
    categoryId?: string;
    source: VideoSource;
    duration?: number;
  }
) {
  const playStartTime = useRef<number | null>(null);
  const lastProgressMilestone = useRef<number>(0);

  const trackPlay = useCallback(
    (isAutoplay: boolean = false) => {
      playStartTime.current = Date.now();
      lastProgressMilestone.current = 0;

      analytics.trackVideoPlay({
        videoId,
        bandId,
        bandName: options.bandName,
        category: options.category,
        categoryId: options.categoryId,
        source: options.source,
        duration: options.duration,
        isAutoplay,
      });
    },
    [videoId, bandId, options]
  );

  const trackProgress = useCallback(
    (currentTime: number, duration: number) => {
      const percentWatched = Math.round((currentTime / duration) * 100);
      const milestones = [25, 50, 75, 90];

      for (const milestone of milestones) {
        if (percentWatched >= milestone && lastProgressMilestone.current < milestone) {
          lastProgressMilestone.current = milestone;
          analytics.trackVideoProgress({
            videoId,
            bandId,
            bandName: options.bandName,
            category: options.category,
            categoryId: options.categoryId,
            source: options.source,
            duration,
            position: currentTime,
            percentWatched,
          });
          break;
        }
      }
    },
    [videoId, bandId, options]
  );

  const trackPause = useCallback(
    (currentTime: number, duration: number) => {
      const percentWatched = Math.round((currentTime / duration) * 100);
      analytics.trackVideoPause({
        videoId,
        bandId,
        position: currentTime,
        percentWatched,
        source: options.source,
      });
    },
    [videoId, bandId, options.source]
  );

  const trackComplete = useCallback(() => {
    analytics.trackVideoComplete({
      videoId,
      bandId,
      bandName: options.bandName,
      category: options.category,
      source: options.source,
      duration: options.duration,
    });
  }, [videoId, bandId, options]);

  return {
    trackPlay,
    trackProgress,
    trackPause,
    trackComplete,
  };
}

/**
 * Hook for search analytics tracking
 */
export function useSearchAnalytics() {
  const lastSearchQuery = useRef<string>('');
  const lastSearchResults = useRef<number>(0);
  const lastFilters = useRef<SearchEvent['filters']>({});

  const trackSearch = useCallback(
    (
      query: string,
      resultsCount: number,
      filters: SearchEvent['filters'],
      searchTime?: number,
      autocompleteUsed?: boolean
    ) => {
      lastSearchQuery.current = query;
      lastSearchResults.current = resultsCount;
      lastFilters.current = filters;

      analytics.trackSearch({
        query,
        resultsCount,
        filters,
        hasResults: resultsCount > 0,
        searchTime,
        autocompleteUsed,
      });
    },
    []
  );

  const trackResultClick = useCallback(
    (clickedPosition: number, clickedVideoId: string) => {
      analytics.trackSearchResultClick({
        query: lastSearchQuery.current,
        resultsCount: lastSearchResults.current,
        filters: lastFilters.current,
        hasResults: true,
        clickedResultPosition: clickedPosition,
        clickedVideoId,
      });
    },
    []
  );

  const trackAutocomplete = useCallback(
    (suggestion: string, suggestionType: string) => {
      analytics.trackAutocompleteClick(lastSearchQuery.current, suggestion, suggestionType);
    },
    []
  );

  return {
    trackSearch,
    trackResultClick,
    trackAutocomplete,
  };
}

/**
 * Hook for tracking user interactions
 */
export function useInteractionAnalytics() {
  return {
    // Favorites
    trackFavorite: useCallback(
      (videoId: string, bandId: string, source?: string) => {
        analytics.trackFavorite(videoId, bandId, source);
      },
      []
    ),
    trackUnfavorite: useCallback(
      (videoId: string, bandId: string, source?: string) => {
        analytics.trackUnfavorite(videoId, bandId, source);
      },
      []
    ),

    // Following
    trackFollow: useCallback(
      (bandId: string, bandName?: string, source?: string) => {
        analytics.trackFollow(bandId, bandName, source);
      },
      []
    ),
    trackUnfollow: useCallback(
      (bandId: string, bandName?: string, source?: string) => {
        analytics.trackUnfollow(bandId, bandName, source);
      },
      []
    ),

    // Sharing
    trackShare: useCallback(
      (
        targetType: 'video' | 'band' | 'playlist',
        targetId: string,
        shareMethod: 'copy_link' | 'twitter' | 'facebook' | 'email' | 'native',
        source?: string
      ) => {
        analytics.trackShare(targetType, targetId, shareMethod, source);
      },
      []
    ),

    // Playlists
    trackPlaylistAdd: useCallback(
      (playlistId: string, videoId: string, source?: string) => {
        analytics.trackPlaylistAdd(playlistId, videoId, source);
      },
      []
    ),
    trackPlaylistRemove: useCallback(
      (playlistId: string, videoId: string, source?: string) => {
        analytics.trackPlaylistRemove(playlistId, videoId, source);
      },
      []
    ),
    trackPlaylistCreate: useCallback(
      (playlistId: string, name: string, isPublic: boolean) => {
        analytics.trackPlaylistCreate(playlistId, name, isPublic);
      },
      []
    ),

    // Watch Later
    trackWatchLaterAdd: useCallback(
      (videoId: string, bandId: string, source?: string) => {
        analytics.trackWatchLaterAdd(videoId, bandId, source);
      },
      []
    ),
    trackWatchLaterRemove: useCallback(
      (videoId: string, source?: string) => {
        analytics.trackWatchLaterRemove(videoId, source);
      },
      []
    ),
  };
}

export default useAnalytics;
