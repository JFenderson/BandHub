# Analytics System Documentation

A comprehensive, privacy-compliant analytics tracking system for BandHub.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Configuration](#configuration)
- [Tracking Events](#tracking-events)
- [React Hooks](#react-hooks)
- [Privacy & Compliance](#privacy--compliance)
- [Dashboard Setup](#dashboard-setup)
- [API Reference](#api-reference)

---

## Overview

The analytics system provides:

- **Multi-provider support**: Segment, Mixpanel, Google Analytics, or custom backend
- **Video tracking**: Play, pause, progress milestones, completion
- **Search analytics**: Queries, filters, result clicks, autocomplete
- **User interactions**: Favorites, shares, follows, playlists, watch later
- **Navigation tracking**: Page views, time on page, scroll depth
- **User properties**: Profile data, preferences, engagement metrics
- **Privacy compliance**: GDPR/CCPA consent, Do Not Track support

---

## Setup

### 1. Environment Variables

Add to `.env.local`:

```env
# For Segment
NEXT_PUBLIC_ANALYTICS_PROVIDER=segment
NEXT_PUBLIC_ANALYTICS_KEY=your-segment-write-key

# For Mixpanel
NEXT_PUBLIC_ANALYTICS_PROVIDER=mixpanel
NEXT_PUBLIC_ANALYTICS_KEY=your-mixpanel-token

# For Google Analytics
NEXT_PUBLIC_ANALYTICS_PROVIDER=gtag
NEXT_PUBLIC_ANALYTICS_KEY=G-XXXXXXXXXX

# For Custom Backend
NEXT_PUBLIC_ANALYTICS_PROVIDER=custom
NEXT_PUBLIC_ANALYTICS_ENDPOINT=https://your-api.com/analytics
```

### 2. Add Analytics Provider

Wrap your app with the `AnalyticsProvider` in your root layout:

```tsx
// app/layout.tsx
import { AnalyticsProvider } from '@/components/analytics';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider
          provider="custom"
          endpoint={process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT}
          requireConsent={true}
          showConsentBanner={true}
          privacyPolicyUrl="/privacy"
          cookiePolicyUrl="/cookies"
          debug={process.env.NODE_ENV === 'development'}
        >
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
```

### 3. Identify Users on Login

```tsx
// In your auth context or login handler
import { analytics } from '@/lib/analytics';

async function handleLogin(user) {
  // ... login logic

  analytics.identify(user.id, {
    signupDate: user.createdAt,
    accountType: user.role,
    emailVerified: user.emailVerified,
  });
}

async function handleLogout() {
  // ... logout logic

  analytics.reset();
}
```

---

## Configuration

### AnalyticsProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `provider` | `'segment' \| 'mixpanel' \| 'gtag' \| 'custom' \| 'none'` | `'custom'` | Analytics provider |
| `apiKey` | `string` | - | API key for the provider |
| `endpoint` | `string` | - | Custom endpoint URL |
| `debug` | `boolean` | `false` | Enable console logging |
| `respectDoNotTrack` | `boolean` | `true` | Honor browser DNT setting |
| `requireConsent` | `boolean` | `true` | Require cookie consent |
| `showConsentBanner` | `boolean` | `true` | Show consent banner |
| `privacyPolicyUrl` | `string` | `'/privacy'` | Privacy policy link |
| `cookiePolicyUrl` | `string` | `'/cookies'` | Cookie policy link |

---

## Tracking Events

### Video Tracking

```tsx
import { analytics } from '@/lib/analytics';

// Track video play
analytics.trackVideoPlay({
  videoId: 'video-123',
  bandId: 'band-456',
  bandName: 'Southern University',
  category: 'Halftime Show',
  categoryId: 'cat-789',
  source: 'homepage',        // Where user came from
  duration: 480,             // Video duration in seconds
  isAutoplay: false,
});

// Track video progress (call periodically)
analytics.trackVideoProgress({
  videoId: 'video-123',
  bandId: 'band-456',
  position: 120,             // Current position in seconds
  percentWatched: 25,        // Will track 25%, 50%, 75%, 90%
  duration: 480,
});

// Track video pause
analytics.trackVideoPause({
  videoId: 'video-123',
  bandId: 'band-456',
  position: 120,
  percentWatched: 25,
});

// Track video completion
analytics.trackVideoComplete({
  videoId: 'video-123',
  bandId: 'band-456',
  bandName: 'Southern University',
  category: 'Halftime Show',
  source: 'homepage',
  duration: 480,
});
```

**Video Sources:**
- `homepage` - Home page recommendations
- `search` - Search results
- `band_page` - Band profile page
- `category_page` - Category listing
- `playlist` - User playlist
- `related_videos` - Related videos section
- `trending` - Trending section
- `watch_history` - Watch history
- `favorites` - Favorites list
- `share_link` - Shared link
- `embed` - Embedded player
- `direct` - Direct URL

### Search Tracking

```tsx
import { analytics } from '@/lib/analytics';

// Track search performed
analytics.trackSearch({
  query: 'grambling halftime',
  resultsCount: 42,
  hasResults: true,
  filters: {
    categoryIds: ['cat-123'],
    years: [2024, 2023],
    conferences: ['SWAC'],
    sortBy: 'relevance',
  },
  searchTime: 125,           // Search time in ms
  autocompleteUsed: true,
});

// Track search result click
analytics.trackSearchResultClick({
  query: 'grambling halftime',
  resultsCount: 42,
  hasResults: true,
  filters: { /* ... */ },
  clickedResultPosition: 3,  // 1-indexed position
  clickedVideoId: 'video-789',
});

// Track autocomplete suggestion click
analytics.trackAutocompleteClick(
  'gramb',                   // Partial query
  'Grambling State',         // Selected suggestion
  'band'                     // Suggestion type
);
```

### User Interactions

```tsx
import { analytics } from '@/lib/analytics';

// Favorites
analytics.trackFavorite('video-123', 'band-456', 'video_page');
analytics.trackUnfavorite('video-123', 'band-456', 'favorites_list');

// Following
analytics.trackFollow('band-456', 'Southern University', 'band_page');
analytics.trackUnfollow('band-456', 'Southern University', 'settings');

// Sharing
analytics.trackShare('video', 'video-123', 'copy_link', 'video_page');
analytics.trackShare('band', 'band-456', 'twitter', 'band_page');
// Methods: 'copy_link' | 'twitter' | 'facebook' | 'email' | 'native'

// Playlists
analytics.trackPlaylistCreate('playlist-123', 'My Favorites', true);
analytics.trackPlaylistAdd('playlist-123', 'video-456', 'video_page');
analytics.trackPlaylistRemove('playlist-123', 'video-456', 'playlist_page');

// Watch Later
analytics.trackWatchLaterAdd('video-123', 'band-456', 'video_page');
analytics.trackWatchLaterRemove('video-123', 'watch_later_list');
```

### Page Views

Page views are tracked automatically when using `useAnalytics()` hook, but you can also track manually:

```tsx
import { analytics } from '@/lib/analytics';

analytics.trackPageView({
  path: '/bands/southern-university',
  title: 'Southern University - BandHub',
  referrer: 'https://google.com',
  searchParams: { tab: 'videos' },
});

// Track page exit (called automatically on navigation/unload)
analytics.trackPageExit('/bands/grambling');
```

---

## React Hooks

### useAnalytics

Main hook with automatic page tracking:

```tsx
import { useAnalytics } from '@/hooks';

function MyComponent() {
  const {
    identify,
    setUserProperties,
    reset,
    track,
    trackVideoPlay,
    trackSearch,
    trackFavorite,
    // ... all tracking methods
  } = useAnalytics();

  // Automatic page views are tracked
  // Use methods as needed
}

// Disable automatic page tracking
function CustomPage() {
  const analytics = useAnalytics({ disablePageTracking: true });
}
```

### useVideoAnalytics

Specialized hook for video players:

```tsx
import { useVideoAnalytics } from '@/hooks';

function VideoPlayer({ video }) {
  const { trackPlay, trackProgress, trackPause, trackComplete } = useVideoAnalytics(
    video.id,
    video.bandId,
    {
      bandName: video.band.name,
      category: video.category?.name,
      categoryId: video.category?.id,
      source: 'video_page',
      duration: video.duration,
    }
  );

  const handlePlay = () => {
    trackPlay(false); // false = not autoplay
  };

  const handleTimeUpdate = (currentTime: number) => {
    trackProgress(currentTime, video.duration);
  };

  const handlePause = (currentTime: number) => {
    trackPause(currentTime, video.duration);
  };

  const handleEnded = () => {
    trackComplete();
  };

  return (
    <video
      onPlay={handlePlay}
      onTimeUpdate={(e) => handleTimeUpdate(e.currentTarget.currentTime)}
      onPause={(e) => handlePause(e.currentTarget.currentTime)}
      onEnded={handleEnded}
    />
  );
}
```

### useSearchAnalytics

Specialized hook for search:

```tsx
import { useSearchAnalytics } from '@/hooks';

function SearchPage() {
  const { trackSearch, trackResultClick, trackAutocomplete } = useSearchAnalytics();

  const handleSearch = async (query: string, filters: SearchFilters) => {
    const startTime = Date.now();
    const results = await searchVideos(query, filters);

    trackSearch(
      query,
      results.total,
      filters,
      Date.now() - startTime,
      false // autocompleteUsed
    );
  };

  const handleResultClick = (position: number, videoId: string) => {
    trackResultClick(position, videoId);
  };

  const handleSuggestionClick = (suggestion: string, type: string) => {
    trackAutocomplete(suggestion, type);
  };
}
```

### useInteractionAnalytics

Hook for user interactions:

```tsx
import { useInteractionAnalytics } from '@/hooks';

function VideoActions({ video }) {
  const {
    trackFavorite,
    trackUnfavorite,
    trackShare,
    trackWatchLaterAdd,
  } = useInteractionAnalytics();

  const handleFavorite = () => {
    // ... favorite logic
    trackFavorite(video.id, video.bandId, 'video_card');
  };

  const handleShare = (method: 'copy_link' | 'twitter') => {
    // ... share logic
    trackShare('video', video.id, method, 'video_card');
  };
}
```

---

## Privacy & Compliance

### Cookie Consent

The system includes a GDPR/CCPA compliant consent banner:

```tsx
import { CookieConsentBanner } from '@/components/analytics';

// Standalone usage (if not using AnalyticsProvider)
<CookieConsentBanner
  privacyPolicyUrl="/privacy"
  cookiePolicyUrl="/cookies"
  position="bottom"
  showDetailsDefault={false}
  onConsentChange={(consent) => {
    console.log('Consent updated:', consent);
  }}
/>
```

### Consent Management

```tsx
import {
  getConsentState,
  setConsentState,
  clearAnalyticsData,
  isDoNotTrackEnabled,
} from '@/lib/analytics';

// Check current consent
const consent = getConsentState();
// { analytics: true, marketing: false, functional: true, timestamp: '...', method: 'explicit' }

// Update consent programmatically
setConsentState({
  analytics: true,
  marketing: false,
  functional: true,
  method: 'explicit',
});

// Check Do Not Track
if (isDoNotTrackEnabled()) {
  console.log('User has DNT enabled');
}

// Clear all analytics data (GDPR right to erasure)
clearAnalyticsData();
```

### Privacy Settings Integration

Add to your settings page:

```tsx
import { getConsentState, setConsentState, clearAnalyticsData } from '@/lib/analytics';

function PrivacySettings() {
  const consent = getConsentState();

  const handleUpdateConsent = (analytics: boolean) => {
    setConsentState({
      ...consent,
      analytics,
      method: 'explicit',
    });
  };

  const handleDeleteData = () => {
    clearAnalyticsData();
    // Also call your backend to delete server-side data
  };

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={consent?.analytics ?? false}
          onChange={(e) => handleUpdateConsent(e.target.checked)}
        />
        Allow analytics tracking
      </label>
      <button onClick={handleDeleteData}>
        Delete my analytics data
      </button>
    </div>
  );
}
```

---

## Dashboard Setup

### Option 1: Segment + Amplitude/Mixpanel

1. Create a Segment account at [segment.com](https://segment.com)
2. Add your write key to `NEXT_PUBLIC_ANALYTICS_KEY`
3. Connect Amplitude, Mixpanel, or other destinations in Segment
4. Use the destination's dashboard for visualization

### Option 2: Mixpanel Direct

1. Create a Mixpanel account at [mixpanel.com](https://mixpanel.com)
2. Add your project token to `NEXT_PUBLIC_ANALYTICS_KEY`
3. Use Mixpanel's built-in dashboards and reports

### Option 3: Custom Backend

Create an API endpoint to receive analytics events:

```ts
// pages/api/analytics.ts or app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const data = await request.json();

  // Store in your database
  await db.analyticsEvents.create({
    data: {
      type: data.type,
      event: data.event,
      properties: data.properties,
      userId: data.properties?.user_id,
      anonymousId: data.properties?.anonymous_id,
      timestamp: new Date(data.properties?.timestamp),
    },
  });

  return NextResponse.json({ success: true });
}
```

Then build dashboards using:
- **Metabase** - Open source BI tool
- **Grafana** - Metrics visualization
- **Custom React dashboard** using Recharts (already in your dependencies)

### Recommended Dashboard Metrics

| Metric | Description | Event |
|--------|-------------|-------|
| Video Plays | Total video starts | `video_play` |
| Watch Time | Sum of video progress | `video_progress` |
| Completion Rate | % videos watched to end | `video_complete` / `video_play` |
| Search Volume | Total searches | `search` |
| Search CTR | Clicks / searches | `search_result_click` / `search` |
| Zero Results Rate | Searches with no results | `search` where `has_results=false` |
| Engagement Rate | Actions / active users | All interaction events |
| DAU/MAU | Daily/Monthly active users | `page_view` unique users |

---

## API Reference

### Types

```ts
type AnalyticsProvider = 'segment' | 'mixpanel' | 'gtag' | 'custom' | 'none';

type VideoSource =
  | 'homepage' | 'search' | 'band_page' | 'category_page'
  | 'playlist' | 'related_videos' | 'trending' | 'watch_history'
  | 'favorites' | 'share_link' | 'embed' | 'direct';

type InteractionAction =
  | 'favorite' | 'unfavorite' | 'share' | 'follow' | 'unfollow'
  | 'playlist_add' | 'playlist_remove' | 'playlist_create'
  | 'watch_later_add' | 'watch_later_remove' | 'comment' | 'like' | 'report';

interface UserProperties {
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

interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  timestamp: string;
  method: 'explicit' | 'implicit' | 'default';
}
```

### Event Schema

All events include these base properties:

```ts
{
  timestamp: string;        // ISO 8601 timestamp
  anonymous_id: string;     // Anonymous user identifier
  user_id: string | null;   // Authenticated user ID
  session_duration_ms: number;
}
```

See [analytics.ts](./analytics.ts) for complete type definitions.
