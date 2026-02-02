/**
 * Comprehensive Analytics Tracking System
 *
 * Privacy-compliant (GDPR/CCPA) analytics with support for multiple providers.
 * Supports: Segment, Mixpanel, Google Analytics, or custom backend.
 */

// ============ TYPES ============

export type AnalyticsProvider = 'segment' | 'mixpanel' | 'gtag' | 'custom' | 'none';

export interface AnalyticsConfig {
  provider: AnalyticsProvider;
  apiKey?: string;
  endpoint?: string;
  debug?: boolean;
  respectDoNotTrack?: boolean;
  cookieConsent?: boolean;
}

export interface UserProperties {
  userId?: string;
  signupDate?: string;
  favoriteCategories?: string[];
  watchCount?: number;
  favoriteBandsCount?: number;
  playlistsCount?: number;
  lastActiveAt?: string;
  accountType?: 'free' | 'premium' | 'admin';
  emailVerified?: boolean;
}

export interface VideoPlayEvent {
  videoId: string;
  bandId: string;
  bandName?: string;
  category?: string;
  categoryId?: string;
  source: VideoSource;
  duration?: number;
  position?: number;
  percentWatched?: number;
  quality?: string;
  isAutoplay?: boolean;
}

export type VideoSource =
  | 'homepage'
  | 'search'
  | 'band_page'
  | 'category_page'
  | 'playlist'
  | 'related_videos'
  | 'trending'
  | 'watch_history'
  | 'favorites'
  | 'share_link'
  | 'embed'
  | 'direct';

export interface SearchEvent {
  query: string;
  resultsCount: number;
  filters: SearchFilters;
  clickedResultPosition?: number;
  clickedVideoId?: string;
  searchTime?: number;
  hasResults: boolean;
  autocompleteUsed?: boolean;
  suggestionClicked?: string;
}

export interface SearchFilters {
  bandIds?: string[];
  categoryIds?: string[];
  years?: number[];
  conferences?: string[];
  states?: string[];
  sortBy?: string;
  sortOrder?: string;
}

export interface UserInteractionEvent {
  action: InteractionAction;
  targetType: 'video' | 'band' | 'playlist' | 'user';
  targetId: string;
  targetName?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export type InteractionAction =
  | 'favorite'
  | 'unfavorite'
  | 'share'
  | 'follow'
  | 'unfollow'
  | 'playlist_add'
  | 'playlist_remove'
  | 'playlist_create'
  | 'watch_later_add'
  | 'watch_later_remove'
  | 'comment'
  | 'like'
  | 'report';

export interface PageViewEvent {
  path: string;
  title?: string;
  referrer?: string;
  searchParams?: Record<string, string>;
}

export interface NavigationEvent extends PageViewEvent {
  timeOnPage?: number;
  scrollDepth?: number;
  maxScrollDepth?: number;
  interactionCount?: number;
  exitLink?: string;
}

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  timestamp: string;
  method: 'explicit' | 'implicit' | 'default';
}

// ============ PRIVACY UTILITIES ============

const CONSENT_STORAGE_KEY = 'analytics_consent';
const DNT_STORAGE_KEY = 'analytics_dnt_override';

/**
 * Check if user has Do Not Track enabled
 */
export function isDoNotTrackEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  const dntOverride = localStorage.getItem(DNT_STORAGE_KEY);
  if (dntOverride !== null) {
    return dntOverride === 'true';
  }

  return (
    navigator.doNotTrack === '1' ||
    (window as any).doNotTrack === '1' ||
    (navigator as any).msDoNotTrack === '1'
  );
}

/**
 * Get stored consent state
 */
export function getConsentState(): ConsentState | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Store consent state
 */
export function setConsentState(consent: Omit<ConsentState, 'timestamp'>): void {
  if (typeof window === 'undefined') return;

  const state: ConsentState = {
    ...consent,
    timestamp: new Date().toISOString(),
  };

  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));

  // Notify analytics instance of consent change
  if (analyticsInstance) {
    analyticsInstance.updateConsent(state);
  }
}

/**
 * Clear all analytics data (for GDPR right to erasure)
 */
export function clearAnalyticsData(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(CONSENT_STORAGE_KEY);
  localStorage.removeItem(DNT_STORAGE_KEY);
  localStorage.removeItem('analytics_user_id');
  localStorage.removeItem('analytics_anonymous_id');

  // Clear provider-specific data
  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0].trim();
    if (name.startsWith('_ga') || name.startsWith('mp_') || name.startsWith('ajs_')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
}

// ============ ANALYTICS CORE ============

class Analytics {
  private config: AnalyticsConfig;
  private consent: ConsentState | null = null;
  private userId: string | null = null;
  private anonymousId: string;
  private userProperties: UserProperties = {};
  private sessionStartTime: number;
  private pageStartTime: number = 0;
  private maxScrollDepth: number = 0;
  private interactionCount: number = 0;
  private eventQueue: Array<{ event: string; properties: Record<string, unknown> }> = [];
  private isInitialized: boolean = false;

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.anonymousId = this.getOrCreateAnonymousId();
    this.sessionStartTime = Date.now();

    if (typeof window !== 'undefined') {
      this.consent = getConsentState();
      this.setupScrollTracking();
      this.setupVisibilityTracking();
    }
  }

  /**
   * Initialize the analytics provider
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!this.canTrack()) {
      this.log('Analytics disabled - no consent or DNT enabled');
      return;
    }

    switch (this.config.provider) {
      case 'segment':
        await this.initializeSegment();
        break;
      case 'mixpanel':
        await this.initializeMixpanel();
        break;
      case 'gtag':
        await this.initializeGtag();
        break;
      case 'custom':
        // Custom backend doesn't need initialization
        break;
      case 'none':
        this.log('Analytics provider set to none');
        break;
    }

    this.isInitialized = true;
    this.flushEventQueue();
  }

  /**
   * Check if tracking is allowed
   */
  private canTrack(): boolean {
    if (this.config.provider === 'none') return false;

    if (this.config.respectDoNotTrack && isDoNotTrackEnabled()) {
      return false;
    }

    if (this.config.cookieConsent && !this.consent?.analytics) {
      return false;
    }

    return true;
  }

  /**
   * Update consent state
   */
  updateConsent(consent: ConsentState): void {
    this.consent = consent;

    if (consent.analytics && !this.isInitialized) {
      this.initialize();
    } else if (!consent.analytics) {
      this.optOut();
    }
  }

  /**
   * Opt out of all tracking
   */
  optOut(): void {
    clearAnalyticsData();
    this.isInitialized = false;
    this.eventQueue = [];
  }

  // ============ PROVIDER INITIALIZATION ============

  private async initializeSegment(): Promise<void> {
    if (!this.config.apiKey) {
      console.warn('Segment API key not provided');
      return;
    }

    // Load Segment analytics.js
    const script = document.createElement('script');
    script.innerHTML = `
      !function(){var analytics=window.analytics=window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var key=analytics.methods[e];analytics[key]=analytics.factory(key)}analytics.load=function(key,e){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.src="https://cdn.segment.com/analytics.js/v1/" + key + "/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(t,n);analytics._loadOptions=e};analytics._writeKey="${this.config.apiKey}";analytics.SNIPPET_VERSION="4.15.3";
      analytics.load("${this.config.apiKey}");
      }}();
    `;
    document.head.appendChild(script);
  }

  private async initializeMixpanel(): Promise<void> {
    if (!this.config.apiKey) {
      console.warn('Mixpanel API key not provided');
      return;
    }

    // Load Mixpanel SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js';
    script.onload = () => {
      (window as any).mixpanel?.init(this.config.apiKey, {
        track_pageview: false, // We handle this ourselves
        persistence: 'localStorage',
        ignore_dnt: !this.config.respectDoNotTrack,
      });
    };
    document.head.appendChild(script);
  }

  private async initializeGtag(): Promise<void> {
    if (!this.config.apiKey) {
      console.warn('Google Analytics ID not provided');
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.apiKey}`;
    document.head.appendChild(script);

    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: unknown[]) {
      (window as any).dataLayer.push(args);
    }
    gtag('js', new Date());
    gtag('config', this.config.apiKey, {
      anonymize_ip: true,
      allow_google_signals: false,
    });
  }

  // ============ IDENTIFICATION ============

  /**
   * Identify a user
   */
  identify(userId: string, properties?: Partial<UserProperties>): void {
    this.userId = userId;

    if (properties) {
      this.userProperties = { ...this.userProperties, ...properties, userId };
    }

    if (!this.canTrack()) {
      this.log('identify', { userId, properties });
      return;
    }

    localStorage.setItem('analytics_user_id', userId);

    switch (this.config.provider) {
      case 'segment':
        (window as any).analytics?.identify(userId, this.userProperties);
        break;
      case 'mixpanel':
        (window as any).mixpanel?.identify(userId);
        (window as any).mixpanel?.people?.set(this.userProperties);
        break;
      case 'gtag':
        (window as any).gtag?.('config', this.config.apiKey, { user_id: userId });
        break;
      case 'custom':
        this.sendToCustomBackend('identify', { userId, properties: this.userProperties });
        break;
    }
  }

  /**
   * Update user properties
   */
  setUserProperties(properties: Partial<UserProperties>): void {
    this.userProperties = { ...this.userProperties, ...properties };

    if (!this.canTrack()) {
      this.log('setUserProperties', properties);
      return;
    }

    switch (this.config.provider) {
      case 'segment':
        (window as any).analytics?.identify(this.userId, properties);
        break;
      case 'mixpanel':
        (window as any).mixpanel?.people?.set(properties);
        break;
      case 'gtag':
        (window as any).gtag?.('set', 'user_properties', properties);
        break;
      case 'custom':
        this.sendToCustomBackend('user_properties', { userId: this.userId, properties });
        break;
    }
  }

  /**
   * Reset user identity (on logout)
   */
  reset(): void {
    this.userId = null;
    this.userProperties = {};
    this.anonymousId = this.generateAnonymousId();
    localStorage.removeItem('analytics_user_id');
    localStorage.setItem('analytics_anonymous_id', this.anonymousId);

    switch (this.config.provider) {
      case 'segment':
        (window as any).analytics?.reset();
        break;
      case 'mixpanel':
        (window as any).mixpanel?.reset();
        break;
    }
  }

  // ============ VIDEO TRACKING ============

  /**
   * Track video play event
   */
  trackVideoPlay(event: VideoPlayEvent): void {
    this.track('video_play', {
      video_id: event.videoId,
      band_id: event.bandId,
      band_name: event.bandName,
      category: event.category,
      category_id: event.categoryId,
      source: event.source,
      duration: event.duration,
      is_autoplay: event.isAutoplay ?? false,
    });
  }

  /**
   * Track video progress
   */
  trackVideoProgress(event: VideoPlayEvent): void {
    const milestone = this.getProgressMilestone(event.percentWatched ?? 0);
    if (milestone) {
      this.track('video_progress', {
        video_id: event.videoId,
        band_id: event.bandId,
        milestone,
        percent_watched: event.percentWatched,
        position: event.position,
        duration: event.duration,
      });
    }
  }

  /**
   * Track video completion
   */
  trackVideoComplete(event: VideoPlayEvent): void {
    this.track('video_complete', {
      video_id: event.videoId,
      band_id: event.bandId,
      band_name: event.bandName,
      category: event.category,
      duration: event.duration,
      source: event.source,
    });
  }

  /**
   * Track video pause
   */
  trackVideoPause(event: VideoPlayEvent): void {
    this.track('video_pause', {
      video_id: event.videoId,
      band_id: event.bandId,
      position: event.position,
      percent_watched: event.percentWatched,
    });
  }

  private getProgressMilestone(percent: number): number | null {
    const milestones = [25, 50, 75, 90];
    for (const milestone of milestones) {
      if (percent >= milestone && percent < milestone + 5) {
        return milestone;
      }
    }
    return null;
  }

  // ============ SEARCH TRACKING ============

  /**
   * Track search performed
   */
  trackSearch(event: SearchEvent): void {
    this.track('search', {
      query: event.query,
      results_count: event.resultsCount,
      has_results: event.hasResults,
      filters_applied: this.getActiveFilters(event.filters),
      filter_bands: event.filters.bandIds?.length ?? 0,
      filter_categories: event.filters.categoryIds?.length ?? 0,
      filter_years: event.filters.years?.length ?? 0,
      filter_conferences: event.filters.conferences?.length ?? 0,
      sort_by: event.filters.sortBy,
      sort_order: event.filters.sortOrder,
      search_time_ms: event.searchTime,
      autocomplete_used: event.autocompleteUsed ?? false,
    });
  }

  /**
   * Track search result click
   */
  trackSearchResultClick(event: SearchEvent): void {
    this.track('search_result_click', {
      query: event.query,
      results_count: event.resultsCount,
      clicked_position: event.clickedResultPosition,
      clicked_video_id: event.clickedVideoId,
      filters_applied: this.getActiveFilters(event.filters),
    });
  }

  /**
   * Track autocomplete suggestion click
   */
  trackAutocompleteClick(query: string, suggestion: string, suggestionType: string): void {
    this.track('autocomplete_click', {
      query,
      suggestion,
      suggestion_type: suggestionType,
    });
  }

  private getActiveFilters(filters: SearchFilters): string[] {
    const active: string[] = [];
    if (filters.bandIds?.length) active.push('bands');
    if (filters.categoryIds?.length) active.push('categories');
    if (filters.years?.length) active.push('years');
    if (filters.conferences?.length) active.push('conferences');
    if (filters.states?.length) active.push('states');
    if (filters.sortBy) active.push('sort');
    return active;
  }

  // ============ USER INTERACTION TRACKING ============

  /**
   * Track user interaction (favorite, share, follow, etc.)
   */
  trackInteraction(event: UserInteractionEvent): void {
    this.track(`${event.action}`, {
      target_type: event.targetType,
      target_id: event.targetId,
      target_name: event.targetName,
      source: event.source,
      ...event.metadata,
    });

    this.interactionCount++;
  }

  /**
   * Track favorite action
   */
  trackFavorite(videoId: string, bandId: string, source?: string): void {
    this.trackInteraction({
      action: 'favorite',
      targetType: 'video',
      targetId: videoId,
      source,
      metadata: { band_id: bandId },
    });
  }

  /**
   * Track unfavorite action
   */
  trackUnfavorite(videoId: string, bandId: string, source?: string): void {
    this.trackInteraction({
      action: 'unfavorite',
      targetType: 'video',
      targetId: videoId,
      source,
      metadata: { band_id: bandId },
    });
  }

  /**
   * Track share action
   */
  trackShare(
    targetType: 'video' | 'band' | 'playlist',
    targetId: string,
    shareMethod: 'copy_link' | 'twitter' | 'facebook' | 'email' | 'native',
    source?: string
  ): void {
    this.trackInteraction({
      action: 'share',
      targetType,
      targetId,
      source,
      metadata: { share_method: shareMethod },
    });
  }

  /**
   * Track follow action
   */
  trackFollow(bandId: string, bandName?: string, source?: string): void {
    this.trackInteraction({
      action: 'follow',
      targetType: 'band',
      targetId: bandId,
      targetName: bandName,
      source,
    });
  }

  /**
   * Track unfollow action
   */
  trackUnfollow(bandId: string, bandName?: string, source?: string): void {
    this.trackInteraction({
      action: 'unfollow',
      targetType: 'band',
      targetId: bandId,
      targetName: bandName,
      source,
    });
  }

  /**
   * Track playlist add
   */
  trackPlaylistAdd(playlistId: string, videoId: string, source?: string): void {
    this.trackInteraction({
      action: 'playlist_add',
      targetType: 'playlist',
      targetId: playlistId,
      source,
      metadata: { video_id: videoId },
    });
  }

  /**
   * Track playlist remove
   */
  trackPlaylistRemove(playlistId: string, videoId: string, source?: string): void {
    this.trackInteraction({
      action: 'playlist_remove',
      targetType: 'playlist',
      targetId: playlistId,
      source,
      metadata: { video_id: videoId },
    });
  }

  /**
   * Track playlist create
   */
  trackPlaylistCreate(playlistId: string, playlistName: string, isPublic: boolean): void {
    this.trackInteraction({
      action: 'playlist_create',
      targetType: 'playlist',
      targetId: playlistId,
      targetName: playlistName,
      metadata: { is_public: isPublic },
    });
  }

  /**
   * Track watch later add
   */
  trackWatchLaterAdd(videoId: string, bandId: string, source?: string): void {
    this.trackInteraction({
      action: 'watch_later_add',
      targetType: 'video',
      targetId: videoId,
      source,
      metadata: { band_id: bandId },
    });
  }

  /**
   * Track watch later remove
   */
  trackWatchLaterRemove(videoId: string, source?: string): void {
    this.trackInteraction({
      action: 'watch_later_remove',
      targetType: 'video',
      targetId: videoId,
      source,
    });
  }

  // ============ NAVIGATION TRACKING ============

  /**
   * Track page view
   */
  trackPageView(event: PageViewEvent): void {
    // Reset page-level metrics
    this.pageStartTime = Date.now();
    this.maxScrollDepth = 0;
    this.interactionCount = 0;

    this.track('page_view', {
      path: event.path,
      title: event.title,
      referrer: event.referrer,
      ...event.searchParams,
    });

    // Also call provider-specific page tracking
    switch (this.config.provider) {
      case 'segment':
        (window as any).analytics?.page(event.title, {
          path: event.path,
          referrer: event.referrer,
          ...event.searchParams,
        });
        break;
      case 'mixpanel':
        (window as any).mixpanel?.track_pageview({ page: event.path });
        break;
      case 'gtag':
        (window as any).gtag?.('event', 'page_view', {
          page_path: event.path,
          page_title: event.title,
        });
        break;
    }
  }

  /**
   * Track page exit (call before navigation)
   */
  trackPageExit(exitLink?: string): void {
    const timeOnPage = Date.now() - this.pageStartTime;

    this.track('page_exit', {
      time_on_page_ms: timeOnPage,
      time_on_page_seconds: Math.round(timeOnPage / 1000),
      max_scroll_depth: this.maxScrollDepth,
      interaction_count: this.interactionCount,
      exit_link: exitLink,
    });
  }

  /**
   * Track scroll depth
   */
  private setupScrollTracking(): void {
    if (typeof window === 'undefined') return;

    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          const scrollPosition = window.scrollY;
          const scrollPercent = scrollHeight > 0 ? Math.round((scrollPosition / scrollHeight) * 100) : 0;

          if (scrollPercent > this.maxScrollDepth) {
            this.maxScrollDepth = scrollPercent;
          }

          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /**
   * Track visibility changes
   */
  private setupVisibilityTracking(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.trackPageExit();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.trackPageExit();
    });
  }

  // ============ CORE TRACKING ============

  /**
   * Generic track method
   */
  track(eventName: string, properties: Record<string, unknown> = {}): void {
    const enrichedProperties = {
      ...properties,
      timestamp: new Date().toISOString(),
      anonymous_id: this.anonymousId,
      user_id: this.userId,
      session_duration_ms: Date.now() - this.sessionStartTime,
    };

    if (!this.canTrack()) {
      this.log(eventName, enrichedProperties);
      return;
    }

    if (!this.isInitialized && this.config.provider !== 'custom') {
      this.eventQueue.push({ event: eventName, properties: enrichedProperties });
      return;
    }

    switch (this.config.provider) {
      case 'segment':
        (window as any).analytics?.track(eventName, enrichedProperties);
        break;
      case 'mixpanel':
        (window as any).mixpanel?.track(eventName, enrichedProperties);
        break;
      case 'gtag':
        (window as any).gtag?.('event', eventName, enrichedProperties);
        break;
      case 'custom':
        this.sendToCustomBackend('track', { event: eventName, properties: enrichedProperties });
        break;
    }

    this.log(eventName, enrichedProperties);
  }

  /**
   * Send data to custom backend
   */
  private async sendToCustomBackend(type: string, data: Record<string, unknown>): Promise<void> {
    if (!this.config.endpoint) {
      console.warn('Custom analytics endpoint not configured');
      return;
    }

    try {
      // Use sendBeacon for page exit events
      if (type === 'track' && (data.event === 'page_exit' || typeof navigator.sendBeacon !== 'function')) {
        const blob = new Blob([JSON.stringify({ type, ...data })], { type: 'application/json' });
        navigator.sendBeacon(this.config.endpoint, blob);
        return;
      }

      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...data }),
        keepalive: true,
      });
    } catch (error) {
      // Silently fail analytics - don't impact user experience
      this.log('Failed to send analytics', error);
    }
  }

  /**
   * Flush queued events
   */
  private flushEventQueue(): void {
    while (this.eventQueue.length > 0) {
      const { event, properties } = this.eventQueue.shift()!;
      this.track(event, properties);
    }
  }

  // ============ UTILITIES ============

  private getOrCreateAnonymousId(): string {
    if (typeof window === 'undefined') return this.generateAnonymousId();

    const stored = localStorage.getItem('analytics_anonymous_id');
    if (stored) return stored;

    const id = this.generateAnonymousId();
    localStorage.setItem('analytics_anonymous_id', id);
    return id;
  }

  private generateAnonymousId(): string {
    return 'anon_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private log(event: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[Analytics] ${event}`, data);
    }
  }
}

// ============ SINGLETON INSTANCE ============

let analyticsInstance: Analytics | null = null;

/**
 * Initialize analytics with configuration
 */
export function initializeAnalytics(config: AnalyticsConfig): Analytics {
  if (analyticsInstance) {
    return analyticsInstance;
  }

  analyticsInstance = new Analytics(config);
  analyticsInstance.initialize();
  return analyticsInstance;
}

/**
 * Get the analytics instance
 */
export function getAnalytics(): Analytics | null {
  return analyticsInstance;
}

// ============ CONVENIENCE EXPORTS ============

export const analytics = {
  init: initializeAnalytics,
  get: getAnalytics,

  // Video tracking
  trackVideoPlay: (event: VideoPlayEvent) => analyticsInstance?.trackVideoPlay(event),
  trackVideoProgress: (event: VideoPlayEvent) => analyticsInstance?.trackVideoProgress(event),
  trackVideoComplete: (event: VideoPlayEvent) => analyticsInstance?.trackVideoComplete(event),
  trackVideoPause: (event: VideoPlayEvent) => analyticsInstance?.trackVideoPause(event),

  // Search tracking
  trackSearch: (event: SearchEvent) => analyticsInstance?.trackSearch(event),
  trackSearchResultClick: (event: SearchEvent) => analyticsInstance?.trackSearchResultClick(event),
  trackAutocompleteClick: (query: string, suggestion: string, type: string) =>
    analyticsInstance?.trackAutocompleteClick(query, suggestion, type),

  // User interactions
  trackFavorite: (videoId: string, bandId: string, source?: string) =>
    analyticsInstance?.trackFavorite(videoId, bandId, source),
  trackUnfavorite: (videoId: string, bandId: string, source?: string) =>
    analyticsInstance?.trackUnfavorite(videoId, bandId, source),
  trackShare: (type: 'video' | 'band' | 'playlist', id: string, method: 'copy_link' | 'twitter' | 'facebook' | 'email' | 'native', source?: string) =>
    analyticsInstance?.trackShare(type, id, method, source),
  trackFollow: (bandId: string, bandName?: string, source?: string) =>
    analyticsInstance?.trackFollow(bandId, bandName, source),
  trackUnfollow: (bandId: string, bandName?: string, source?: string) =>
    analyticsInstance?.trackUnfollow(bandId, bandName, source),
  trackPlaylistAdd: (playlistId: string, videoId: string, source?: string) =>
    analyticsInstance?.trackPlaylistAdd(playlistId, videoId, source),
  trackPlaylistRemove: (playlistId: string, videoId: string, source?: string) =>
    analyticsInstance?.trackPlaylistRemove(playlistId, videoId, source),
  trackPlaylistCreate: (playlistId: string, name: string, isPublic: boolean) =>
    analyticsInstance?.trackPlaylistCreate(playlistId, name, isPublic),
  trackWatchLaterAdd: (videoId: string, bandId: string, source?: string) =>
    analyticsInstance?.trackWatchLaterAdd(videoId, bandId, source),
  trackWatchLaterRemove: (videoId: string, source?: string) =>
    analyticsInstance?.trackWatchLaterRemove(videoId, source),

  // Navigation
  trackPageView: (event: PageViewEvent) => analyticsInstance?.trackPageView(event),
  trackPageExit: (exitLink?: string) => analyticsInstance?.trackPageExit(exitLink),

  // User management
  identify: (userId: string, properties?: Partial<UserProperties>) =>
    analyticsInstance?.identify(userId, properties),
  setUserProperties: (properties: Partial<UserProperties>) =>
    analyticsInstance?.setUserProperties(properties),
  reset: () => analyticsInstance?.reset(),

  // Privacy
  consent: {
    get: getConsentState,
    set: setConsentState,
    clear: clearAnalyticsData,
  },
  isDoNotTrackEnabled,
};

export default analytics;
