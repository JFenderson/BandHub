# Video Date Display Feature

## Overview

This document explains how video dates are handled in BandHub, specifically the distinction between YouTube upload dates and database insertion dates.

## Date Fields

The `Video` model has two important date fields:

1. **`publishedAt`** (DateTime): The date when the video was originally uploaded to YouTube
2. **`createdAt`** (DateTime): The date when the video was added to the BandHub database

## Why Two Dates?

Videos on BandHub come from YouTube channels and can be added to our database at any time. A video from 2008 might be added to BandHub in 2024, so we need to track both:

- When the video was originally uploaded to YouTube (`publishedAt`)
- When it was added to our platform (`createdAt`)

## Default Behavior

**All public video listings default to sorting by `publishedAt` DESC** (newest YouTube uploads first).

This ensures that:
- Adding an old video (e.g., from 2008) doesn't make it appear at the top as a "new" video
- Users see videos in chronological order based on actual YouTube upload dates
- The video library reflects the actual timeline of band performances

## Recently Added Feature

Users who want to see newly-added content can use the "Recently Added" features:

### 1. Sort By Filter
In the video library (`/videos`), users can change the sort order to "Recently Added" which sorts by `createdAt` DESC.

### 2. Recently Added Section
The homepage includes a "Recently Added to BandHub" section showing videos sorted by `createdAt` DESC.

### 3. NEW Badge
Videos added to the database within the last 7 days display a green "NEW" badge on the video card.

## User Interface

### Public Video Listings

- **Default Sort**: YouTube upload date (`publishedAt` DESC)
- **Sort Options**:
  - Latest Uploads (publishedAt - default)
  - Recently Added (createdAt)
  - Most Viewed (viewCount)
  - Title (A-Z)

### Video Cards

- Display the YouTube upload date prominently
- Show a "NEW" badge for videos added within 7 days
- Category badge at top-left, NEW badge at top-right

### Admin Panel

The admin video detail modal shows **both dates** with clear labels:

```
YouTube Upload: January 14, 2026
Added to DB: January 14, 2026
```

This helps administrators understand:
- When the video was originally uploaded to YouTube
- When it was added to the BandHub database
- Whether a video is genuinely new or just new to the platform

## API Implementation

### Default Query Behavior

```typescript
// Video Query DTO Default
sortBy?: 'publishedAt' | 'viewCount' | 'title' | 'createdAt' = 'publishedAt';
sortOrder?: 'asc' | 'desc' = 'desc';
```

### Example API Calls

```bash
# Get latest YouTube uploads (default)
GET /api/videos?sortBy=publishedAt&sortOrder=desc

# Get recently added to BandHub
GET /api/videos?sortBy=createdAt&sortOrder=desc

# Get most viewed
GET /api/videos?sortBy=viewCount&sortOrder=desc
```

## Code Examples

### Frontend - Fetching Videos

```typescript
// Default: Sort by YouTube upload date
const { data: videos } = await apiClient.getVideos({
  sortBy: 'publishedAt',
  sortOrder: 'desc'
});

// Recently added to BandHub
const { data: recentlyAdded } = await apiClient.getVideos({
  sortBy: 'createdAt',
  sortOrder: 'desc'
});
```

### Backend - Repository

```typescript
// Repository handles sorting based on the sortBy parameter
async findMany(query: VideoQueryDto) {
  const {
    sortBy = 'publishedAt',  // Default to YouTube upload date
    sortOrder = 'desc',
    // ... other params
  } = query;

  const orderBy: Prisma.VideoOrderByWithRelationInput = {};
  orderBy[sortBy] = sortOrder;

  // ... rest of query
}
```

## Migration Notes

This feature was implemented to fix an issue where:

1. Old videos added to the database would appear as "new" when sorted by default
2. Users couldn't distinguish between newly uploaded YouTube videos and newly-added database records
3. The chronological ordering of actual YouTube content was confused with database insertion time

### Changes Made

1. ✅ Confirmed API defaults to `sortBy='publishedAt'`
2. ✅ Added "Recently Added" sort option in video filters
3. ✅ Added "Recently Added to BandHub" section on homepage
4. ✅ Updated admin modal to show both dates with clear labels
5. ✅ Added "NEW" badge for recently-added videos
6. ✅ Updated TypeScript types to support `createdAt` sorting

### Backward Compatibility

All changes are backward compatible:
- Existing API behavior unchanged (still defaults to `publishedAt`)
- No breaking changes to database schema
- All existing functionality preserved

## Testing Scenarios

To verify the implementation:

1. **Add an old video** (e.g., from 2008)
   - Should NOT appear at top of default video listing
   - Should appear at top of "Recently Added" listing
   - Should show "NEW" badge if added within 7 days

2. **Check video detail modal** (admin)
   - Should show both "YouTube Upload" and "Added to DB" dates
   - Dates should be clearly labeled

3. **Test sort options**
   - Latest Uploads: Shows newest YouTube uploads first
   - Recently Added: Shows newest database additions first
   - Both should work correctly with pagination

4. **Verify homepage sections**
   - "Recent Performances": Sorted by YouTube upload date
   - "Recently Added to BandHub": Sorted by database insertion date

## Future Enhancements

Potential improvements:

1. Add time-based filters (e.g., "Videos from last 30 days" by `publishedAt`)
2. Add notification system for new videos added to favorite bands
3. Track user activity to show "Unwatched new additions"
4. Add RSS feed for recently-added videos

## Related Files

- `apps/api/src/modules/videos/dto/video-query.dto.ts` - API query parameters
- `apps/api/src/modules/videos/videos.repository.ts` - Database queries
- `apps/web/src/components/videos/VideoFilters.tsx` - Filter UI
- `apps/web/src/components/videos/VideoCard.tsx` - Video card with badges
- `apps/web/src/components/admin/VideoDetailModal.tsx` - Admin date display
- `apps/web/src/app/page.tsx` - Homepage sections
- `packages/database/prisma/schema.prisma` - Video model definition

## References

- [Problem Statement](../README.md#video-date-display-issue)
- [Prisma Video Model](../packages/database/prisma/schema.prisma)
- [API Documentation](./API_EXAMPLES.md)
