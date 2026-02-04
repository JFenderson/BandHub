# Video Sync Automation

## Overview

The BandHub platform automatically syncs, matches, and publishes HBCU marching band videos from YouTube. This document describes the automated pipeline, configuration, and monitoring capabilities.

## 📊 Current Performance

### Before Automation
- **Manual execution required** - No automation
- **Match rate:** 60% (30k/50k videos matched)
- **20k videos unmatched** - ~40% failure rate
- **No daily updates** - Videos delayed
- **Duplicate scripts** - Maintenance burden

### After Automation
- **Fully automated pipeline** - No manual intervention needed
- **Target match rate:** 85-90% (improved from 60%)
- **Daily updates** - New videos within 2-3 hours
- **Consolidated codebase** - Single source of truth
- **Enhanced matching** - Event detection, comparative studies, better aliases

## 🔄 Daily Automated Pipeline

The worker system runs a series of automated jobs every day:

### 3:00 AM UTC - Backfill
**Jobs:** `BACKFILL_BANDS` + `BACKFILL_CREATORS` (parallel)

Pulls videos from YouTube channels and stores them in the `YouTubeVideo` table:
- **67 official band channels** (HBCU bands with official YouTube presence)
- **43 content creator channels** (fan channels, commentators, etc.)
- **Expected yield:** 200-400 new videos per day

**Process:**
1. Fetch channel's upload playlist from YouTube API
2. Paginate through all videos (50 per request)
3. Enrich with metadata (duration, views, likes)
4. Skip videos already in database (check by `youtubeId`)
5. Store with `bandId = null` (for creators) or `bandId = <band>` (for official channels)

**Quota usage:** ~1-3 units per video

### 4:00 AM UTC - Matching
**Job:** `MATCH_VIDEOS`

Matches unmatched videos (`bandId = null`) to bands using enhanced algorithms:

**Matching Strategies:**

1. **Event-Based Matching**
   ```typescript
   // Detect events and match to all participating bands
   const eventParticipants = {
     'MEAC SWAC Challenge': ['Alcorn State', 'Jackson State', 'Southern', ...],
     'Bayou Classic': ['Southern University', 'Grambling State'],
     'Honda BOTB': /* lookup year-specific participants */,
   };
   ```

2. **Enhanced Nickname/Alias Detection**
   - Alcorn State: "Sounds Of Dyn-O-Mite", "Sounds of Dynamite", "SOD"
   - Southern: "Human Jukebox"
   - Grambling: "World Famed", "World Famed Tiger Marching Band"
   - Full keyword list in `hbcu-bands.ts`

3. **Battle Detection**
   - Identifies "vs", "versus", "battle", "BOTB" keywords
   - Sets both `bandId` AND `opponentBandId`
   - Enables battle-specific features in UI

4. **Comparative Study Support**
   - "Checkmate Comparative Study - MVSU, SU, GSU"
   - Detects multiple bands in title/description
   - Assigns primary `bandId` + stores others in metadata

5. **Exclusion Filtering**
   - High schools, middle schools (via `allstar-config.json`)
   - Podcasts, talk shows, generic content
   - Prevents false positives

6. **Quality Scoring**
   - Exact name match: 100 points
   - School name match: 80 points
   - Partial match: 60 points
   - Abbreviation match: 30 points
   - Stored in `qualityScore` field

**Matching Output:**
- Sets `bandId` for primary band
- Sets `opponentBandId` for battles
- Sets `qualityScore` based on confidence
- Flags exclusions (not stored)

### 5:00 AM UTC - Promotion
**Job:** `PROMOTE_VIDEOS`

Promotes matched videos from `YouTubeVideo` to `Video` table (user-facing):

**Process:**
1. Find videos where `bandId IS NOT NULL` and `isPromoted = false`
2. Copy to `Video` table with category assignment
3. Set `isPromoted = true` and `promotedAt = now()`
4. Skip if video already exists in `Video` table

**Category Assignment:**
- Battles/Competitions: "battles-competitions"
- Halftime Shows: "halftime-shows"
- Parades: "parades"
- Stand Tunes: "stand-tunes"
- Practices: "practices-rehearsals"
- Documentaries: "documentaries"
- Default: "performances"

### 6:00 AM UTC - Cleanup
**Job:** `CLEANUP_VIDEOS`

Removes duplicates and flags irrelevant content:
- Deduplicates by `youtubeId`
- Marks deleted/unavailable videos
- Archives low-quality matches

### Weekly: Sunday 2:00 AM UTC - Full Sync
**Job:** `SYNC_ALL_BANDS` (full mode)

Comprehensive sync of all bands to catch missed videos:
- Ignores `lastSyncAt` timestamp
- Syncs all videos since 2005
- Useful for recovering from quota exhaustion or API errors

## 🎯 Adding New All-Star Bands (Summer Season)

Each summer, new all-star bands form. Follow this process to add them:

### 1. Run Discovery Script
```bash
npx tsx apps/api/scripts/utilities/extract-allstar-bands.ts
```

This analyzes unmatched videos and generates `allstar-bands-report.json` with:
- Potential new band names
- Channel information
- Video counts
- Sample titles

### 2. Review Report
Open `allstar-bands-report.json` and identify:
- ✅ Valid all-star bands (e.g., "Dallas Legion All-Star Band")
- ❌ High schools, middle schools (exclude)
- ❌ Fan channels, podcasts (exclude)

### 3. Update Configuration
Edit `allstar-config.json`:

```json
{
  "allStarBands": [
    {
      "name": "Dallas Legion All-Star Band",
      "aliases": ["DLASB", "The Legion", "Dallas Legion"],
      "region": "Dallas, TX"
    },
    // ... add new bands here
  ],
  "exclusionPatterns": {
    "highSchool": ["high school", "hs marching band", ...],
    "middleSchool": ["middle school", "ms band", ...],
    "podcasts": ["podcast", "reaction", "commentary", ...]
  }
}
```

### 4. (Optional) Re-match Old Videos
If you want to match videos uploaded before the configuration update:

```bash
# Reset bandId to null for all videos
npx tsx apps/api/scripts/utilities/reset-band-ids.ts

# Wait for next daily matching cycle at 4 AM UTC
# Or trigger manually via admin API:
POST /api/admin/sync/trigger
{
  "jobType": "MATCH_VIDEOS"
}
```

## 🔧 Manual Overrides

### Re-match All Videos
```bash
# Reset all video matches
npx tsx apps/api/scripts/utilities/reset-band-ids.ts

# Manually trigger matching
npx tsx apps/api/scripts/core/enhanced-match-videos.ts
```

### Debug Unmatched Videos
```bash
# Analyze why videos aren't matching
npx tsx apps/api/scripts/utilities/analyze-unmatched.ts
```

This generates a report showing:
- Common patterns in unmatched videos
- Potential new keywords to add
- Exclusion patterns that might be too broad

### One-time Backfill
```bash
# Backfill specific band
npx tsx apps/api/scripts/core/backfill-band-videos.ts --band-id <band-id>

# Backfill specific creator
npx tsx apps/api/scripts/core/backfill-creator-videos.ts --creator-id <creator-id>

# Or trigger via admin API:
POST /api/admin/sync/trigger
{
  "jobType": "BACKFILL_BANDS",
  "bandId": "<band-id>"  // optional
}
```

## 📈 Monitoring

### BullMQ Dashboard
Access the queue dashboard to monitor job progress:
```
http://localhost:3000/admin/queues
```

Features:
- View active, completed, and failed jobs
- Retry failed jobs
- Inspect job data and errors
- Monitor queue metrics

### Sync Job Status API
```bash
GET /api/admin/sync-jobs

# Response
{
  "jobs": [
    {
      "id": "...",
      "jobType": "BACKFILL_BANDS",
      "status": "COMPLETED",
      "videosFound": 423,
      "videosAdded": 156,
      "videosUpdated": 267,
      "errors": [],
      "startedAt": "2024-01-15T03:00:00Z",
      "completedAt": "2024-01-15T03:15:32Z"
    }
  ]
}
```

### Database Queries

**Check sync status:**
```sql
SELECT 
  "name",
  "lastSyncAt",
  "syncStatus",
  "youtubeChannelId"
FROM bands 
WHERE "isActive" = true 
ORDER BY "lastSyncAt" ASC NULLS FIRST;
```

**Check unmatched videos:**
```sql
SELECT COUNT(*) as unmatched
FROM youtube_videos 
WHERE "bandId" IS NULL;

-- Top 10 unmatched by views
SELECT "title", "channelTitle", "viewCount"
FROM youtube_videos 
WHERE "bandId" IS NULL
ORDER BY "viewCount" DESC
LIMIT 10;
```

**Check promotion backlog:**
```sql
SELECT COUNT(*) as ready_to_promote
FROM youtube_videos 
WHERE "bandId" IS NOT NULL 
  AND "isPromoted" = false;
```

**Match rate:**
```sql
SELECT 
  COUNT(*) as total_videos,
  COUNT("bandId") as matched_videos,
  ROUND(COUNT("bandId")::numeric / COUNT(*) * 100, 2) as match_rate_percent
FROM youtube_videos;
```

## ⚙️ Configuration Files

### `allstar-config.json`
All-Star band definitions and exclusion patterns.

**Location:** `/allstar-config.json` (project root)

**Structure:**
```json
{
  "allStarBands": [
    {
      "name": "Atlanta All-Star Mass Band",
      "aliases": ["AAMB", "Georgia Mass Band", "GMB"],
      "region": "Atlanta, GA"
    }
  ],
  "exclusionPatterns": {
    "highSchool": ["high school", "hs marching band"],
    "middleSchool": ["middle school", "ms band"],
    "podcasts": ["podcast", "reaction"],
    "generic": ["compilation", "top 10"]
  },
  "specialEvents": [
    {
      "name": "Honda Battle of the Bands",
      "aliases": ["HBOB", "Honda BOTB"],
      "type": "HBCU_SHOWCASE"
    }
  ]
}
```

### `apps/api/src/config/hbcu-bands.ts`
HBCU band configurations with keywords for matching.

**Structure:**
```typescript
export const HBCU_BANDS: BandChannelConfig[] = [
  {
    name: "Southern University Human Jukebox",
    school: "Southern University",
    city: "Baton Rouge",
    state: "Louisiana",
    channelHandle: "@SouthernUniversityBand",
    keywords: [
      "southern university",
      "human jukebox",
      "swac",
      "baton rouge",
      "su",
      "jags"
    ]
  },
  // ... more bands
];
```

**When to update:**
- Adding new HBCU bands to database
- Improving match rate (add more keywords/aliases)
- Fixing false negatives (band videos not matching)

### Environment Variables
```bash
# YouTube API Configuration
YOUTUBE_API_KEY=your_api_key_here
YOUTUBE_QUOTA_LIMIT=10000  # Daily quota limit

# Worker Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/bandhub

# Sync Batch Sizes
YOUTUBE_SYNC_BATCH_SIZE=10
```

## 🚨 Troubleshooting

### Low Match Rate (<80%)

**Symptoms:** Many videos remain unmatched after daily sync.

**Solutions:**
1. Run analyze-unmatched script:
   ```bash
   npx tsx apps/api/scripts/utilities/analyze-unmatched.ts
   ```

2. Review common patterns and update keywords in `hbcu-bands.ts`

3. Check exclusion patterns - might be too broad

4. Test changes with dry-run:
   ```bash
   npx tsx apps/api/scripts/core/enhanced-match-videos.ts --dry-run --limit 100
   ```

### YouTube API Quota Exceeded

**Symptoms:** Jobs fail with "quotaExceeded" error.

**Solutions:**
1. Wait until midnight UTC for quota reset
2. Reduce `YOUTUBE_QUOTA_LIMIT` in `.env` to be more conservative
3. Prioritize most active bands/creators
4. Use incremental sync instead of full sync

### Videos Not Appearing on Site

**Symptoms:** Videos matched but not visible to users.

**Check:**
1. Promotion status:
   ```sql
   SELECT COUNT(*) FROM youtube_videos 
   WHERE "bandId" IS NOT NULL AND "isPromoted" = false;
   ```

2. Video visibility:
   ```sql
   SELECT COUNT(*) FROM videos WHERE "isVisible" = false;
   ```

3. Manually trigger promotion:
   ```bash
   POST /api/admin/sync/trigger
   {"jobType": "PROMOTE_VIDEOS"}
   ```

### Worker Not Running Jobs

**Symptoms:** Jobs stuck in queue, not processing.

**Check:**
1. Redis connection:
   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

2. Worker process:
   ```bash
   pm2 status worker
   # Or if running locally:
   npm run worker:dev
   ```

3. Queue health:
   ```
   GET /api/admin/queues/health
   ```

## 📊 Success Criteria

The automation is considered successful when:

- ✅ Worker processors run daily without manual intervention
- ✅ Video matching rate improves from 60% to 85-90%
- ✅ New videos appear on site within 2-3 hours of YouTube upload
- ✅ All-Star bands are automatically detected and matched
- ✅ Event-based videos (MEAC SWAC, Bayou Classic) are matched correctly
- ✅ Comparative study videos match all mentioned bands
- ✅ Duplicate scripts removed, remaining scripts organized
- ✅ Clear documentation for adding new All-Star bands each summer

## 📚 Additional Resources

- [Scripts README](../apps/api/scripts/README.md) - Script usage and workflows
- [Worker Architecture](../apps/worker/README.md) - Worker system overview
- [API Documentation](../apps/api/README.md) - API endpoints
- [Database Schema](../packages/database/prisma/schema.prisma) - Data models
