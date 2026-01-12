# Video Recommendations Component

## Overview

The `VideoRecommendations` component is an intelligent video recommendation system for the HBCU Band Hub platform. It provides personalized video recommendations based on multiple algorithms and user preferences.

## Location

- **Component**: `apps/web/src/components/discovery/VideoRecommendations.tsx`
- **Test Page**: `apps/web/src/app/recommendations/page.tsx`

## Features

### Recommendation Algorithms

1. **Content-based filtering** - Recommends videos based on:
   - Similar bands to those watched
   - Same categories as viewing history
   - Related events and competitions

2. **Collaborative filtering** - Recommends videos based on:
   - Users with similar viewing patterns
   - Users with similar band preferences

3. **Trending and popularity-based** - Shows:
   - Currently trending videos
   - Most viewed performances
   - Trending score calculation

4. **Seasonal and event-based recommendations**:
   - Homecoming season (September-October)
   - Battle of the Bands season (November)
   - Holiday performances (December)
   - MLK Day events (January)
   - Black History Month (February)
   - Spring concert season (April-May)

5. **Geographic proximity recommendations**:
   - Performances near user's location
   - Regional bands and events

6. **Historical performance recommendations**:
   - Classic performances from past years
   - Most viewed legacy content

### UI Components

#### Video Display
- Horizontal scrollable recommendation sections
- Video thumbnail with duration overlay
- Trending badges for popular videos
- Band name and video title
- View count display
- Event and location metadata
- Responsive card design with hover effects

#### Recommendation Sections
- "Because you watched..." personalized sections
- "Discover new bands" section for band discovery
- "Classic performances" section for historical content
- "Trending Now" section
- "Performances Near You" section (if location available)
- Seasonal section (dynamic title based on season)

#### Interactive Features
- **Like/dislike feedback buttons** on each video card
  - Like button (thumbs up)
  - Dislike/Not interested button (thumbs down)
  - Visual feedback when selected
  - Preference tracking

- **Recommendation explanation tooltips**
  - Info icon next to section titles
  - Hover to show explanation
  - Describes why videos are recommended

- **"See more" expandable sections**
  - Initially show 4 videos in horizontal scroll
  - Click "See more" to expand to grid view
  - Show all videos in 4-column grid
  - Toggle back to collapsed view

## Usage

### Basic Usage

```tsx
import { VideoRecommendations } from '@/components/discovery/VideoRecommendations';

export default function Page() {
  return <VideoRecommendations />;
}
```

### With User Context

```tsx
import { VideoRecommendations } from '@/components/discovery/VideoRecommendations';

export default function Page() {
  return (
    <VideoRecommendations 
      userId="user-123"
      userLocation={{ city: 'Atlanta', state: 'GA' }}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | `string` | No | User ID for personalization |
| `userLocation` | `{ city: string; state: string }` | No | User's location for geographic recommendations |

## TypeScript Types

### Video
```typescript
interface Video {
  id: string;
  title: string;
  bandName: string;
  bandId: string;
  thumbnailUrl: string;
  duration: number; // in seconds
  viewCount: number;
  uploadDate: string;
  category: string;
  eventName?: string;
  location?: string;
  tags: string[];
  trendingScore?: number;
}
```

### RecommendationSection
```typescript
interface RecommendationSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  videos: Video[];
  explanation: string;
  type: 'personalized' | 'trending' | 'discover' | 'seasonal' | 'geographic' | 'historical';
}
```

### UserPreferences
```typescript
interface UserPreferences {
  watchedVideos: string[];
  likedVideos: string[];
  dislikedVideos: string[];
  favoriteBands: string[];
  preferredCategories: string[];
}
```

## Mock Data

The component includes a mock data generator for development and testing. It creates realistic video data with:
- 12 HBCU marching bands
- 7 video categories (5th Quarter, Field Show, Stand Battle, Parade, Halftime, Practice, Battle of the Bands)
- 10 event types (Honda Battle of the Bands, Homecoming, Magic City Classic, etc.)
- Random view counts, trending scores, and upload dates

## API Integration

The component includes comments indicating where API calls should replace mock data:

### Video Catalog
```typescript
// TODO: In production, replace with:
// GET /api/videos
const videos = generateMockVideos(100);
```

### User Preferences
```typescript
// TODO: In production, replace with:
// GET /api/users/${userId}/preferences
const mockPreferences = { /* ... */ };
```

### Preference Updates
```typescript
// TODO: In production, replace with:
// POST /api/users/${userId}/preferences/like
// POST /api/users/${userId}/preferences/dislike
```

## Dependencies

- `react` - React hooks (useState, useEffect)
- `next/image` - Next.js optimized image component
- `next/link` - Next.js link component
- `lucide-react` - Icon library
- `tailwindcss` - Styling

## Behavior

1. **On Load**:
   - Display loading spinner
   - Fetch video catalog and user preferences (currently mock data)
   - Generate recommendation sections based on algorithms
   - Filter out disliked videos
   - Hide empty sections

2. **User Interactions**:
   - Like/dislike buttons update preferences immediately
   - Section expansion/collapse toggles between horizontal scroll and grid view
   - Tooltip displays on hover over info icons
   - Links navigate to video and band pages

3. **Responsive Design**:
   - Mobile: Single column video cards
   - Tablet: 2-column grid when expanded
   - Desktop: 3-4 column grid when expanded
   - Horizontal scroll on all screen sizes when collapsed

## Testing

To test the component:

1. Navigate to `/recommendations` in the browser
2. Verify all recommendation sections appear
3. Test like/dislike buttons (should toggle visual state)
4. Test "See more" button (should expand to grid view)
5. Hover over info icons (should show tooltips)
6. Verify loading and empty states work correctly

## Future Enhancements

- Integration with real API endpoints
- A/B testing for recommendation algorithms
- Machine learning model integration
- User feedback analytics
- Performance optimizations for large catalogs
- Infinite scroll for expanded sections
- Recommendation quality metrics
- Personalized section ordering based on user engagement
