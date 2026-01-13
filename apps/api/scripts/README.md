# BandHub Scripts

This directory contains various utility and maintenance scripts for managing the BandHub platform.

## 📁 Directory Structure

### `core/`
Scripts that have been **ported to the worker system** but are kept for reference, manual execution, or debugging.

- **`backfill-band-videos.ts`** - Pull videos from official band YouTube channels
  - Usage: `npx tsx apps/api/scripts/core/backfill-band-videos.ts [--dry-run] [--band-id <id>]`
  - **Note:** Automated via worker's `backfill-bands.processor.ts` (runs daily at 3 AM UTC)

- **`backfill-creator-videos.ts`** - Pull videos from content creator YouTube channels
  - Usage: `npx tsx apps/api/scripts/core/backfill-creator-videos.ts [--dry-run] [--creator-id <id>]`
  - **Note:** Automated via worker's `backfill-creators.processor.ts` (runs daily at 3 AM UTC)

- **`enhanced-match-videos.ts`** - Match unmatched videos to bands (HBCU + All-Star)
  - Usage: `npx tsx apps/api/scripts/core/enhanced-match-videos.ts [--dry-run] [--limit <n>]`
  - **Note:** Automated via worker's `match-videos.processor.ts` (runs daily at 4 AM UTC)

### `utilities/`
Debug and administrative tools for troubleshooting and maintenance.

- **`analyze-unmatched.ts`** - Analyze unmatched videos to improve matching algorithms
  - Usage: `npx tsx apps/api/scripts/utilities/analyze-unmatched.ts`
  - Generates report on why videos aren't matching

- **`reset-band-ids.ts`** - Reset bandId to null for re-matching
  - Usage: `npx tsx apps/api/scripts/utilities/reset-band-ids.ts`
  - Useful after updating matching logic or band configurations

- **`fix-bands.ts`** - Fix band data inconsistencies
  - Usage: `npx tsx apps/api/scripts/utilities/fix-bands.ts`

- **`extract-allstar-bands.ts`** - Discover and extract all-star bands from video data
  - Usage: `npx tsx apps/api/scripts/utilities/extract-allstar-bands.ts`
  - Generates `allstar-bands-report.json` for review

- **`create-api-key.ts`** - Create API keys for external integrations
  - Usage: `npx tsx apps/api/scripts/utilities/create-api-key.ts`

### `maintenance/`
One-time setup and recovery scripts.

- **`discover-missing-hbcus.ts`** - Find HBCU bands not yet in the database
  - Usage: `npx tsx apps/api/scripts/maintenance/discover-missing-hbcus.ts`

- **`recover-database.ts`** - Database recovery utilities
  - Usage: `npx tsx apps/api/scripts/maintenance/recover-database.ts`

- **`upload-band-logos.ts`** - Batch upload band logos
  - Usage: `npx tsx apps/api/scripts/maintenance/upload-band-logos.ts`

## 🤖 Automated Pipeline (Worker)

The following processes run automatically via the worker system:

### Daily Schedule (Production)
```
3:00 AM UTC → Backfill creators & bands (pulls ~200-400 new videos)
4:00 AM UTC → Match videos to bands (HBCU + All-Star)
5:00 AM UTC → Promote matched videos to production
6:00 AM UTC → Cleanup (remove duplicates, flag irrelevant)
```

### Weekly Schedule
```
Sunday 2:00 AM UTC → Full sync of all bands
```

### Hourly (9 AM - 11 PM UTC)
```
Every hour → Update video statistics (views, likes)
```

## 🎯 Common Workflows

### Adding New All-Star Bands (Summer Season)
1. Run discovery: `npx tsx apps/api/scripts/utilities/extract-allstar-bands.ts`
2. Review: `allstar-bands-report.json`
3. Update: `allstar-config.json` with new bands
4. Optional: Re-match old videos:
   ```bash
   npx tsx apps/api/scripts/utilities/reset-band-ids.ts
   # Wait for next daily matching cycle, or trigger manually via admin API
   ```

### Debugging Low Match Rate
1. Analyze unmatched videos:
   ```bash
   npx tsx apps/api/scripts/utilities/analyze-unmatched.ts
   ```
2. Review output to identify patterns
3. Update `hbcu-bands.ts` keywords or `allstar-config.json` exclusions
4. Re-run matching manually to test:
   ```bash
   npx tsx apps/api/scripts/core/enhanced-match-videos.ts --dry-run --limit 100
   ```

### Manual Backfill (Emergency)
If automated backfill fails or quota is exceeded:
```bash
# Backfill specific band
npx tsx apps/api/scripts/core/backfill-band-videos.ts --band-id <band-id>

# Backfill specific creator
npx tsx apps/api/scripts/core/backfill-creator-videos.ts --creator-id <creator-id>
```

### Manual Override via Admin API
```bash
# Trigger backfill
POST /api/admin/sync/trigger
{
  "jobType": "BACKFILL_BANDS" | "BACKFILL_CREATORS" | "MATCH_VIDEOS" | "PROMOTE_VIDEOS"
}
```

## ⚠️ Important Notes

### YouTube API Quota Management
- Daily quota limit: 10,000 units (configurable via `YOUTUBE_QUOTA_LIMIT`)
- Backfill operations are quota-intensive (1-3 units per video)
- Scripts will automatically stop at 90% quota usage
- If quota exceeded, operations resume next day at midnight UTC

### When to Use Manual Scripts
- **Testing changes** to matching logic or configurations
- **Debugging** specific issues with individual bands/creators
- **Emergency recovery** if automated pipeline fails
- **One-time operations** like adding new bands or cleaning data

### Script Safety
- Always use `--dry-run` flag first to preview changes
- Manual scripts do NOT interfere with worker automation
- Database transactions ensure consistency
- Errors are logged but don't corrupt existing data

## 📊 Monitoring

### Worker Dashboard
- BullMQ Dashboard: `http://localhost:3000/admin/queues`
- View job status, progress, and errors

### Sync Job Status API
```bash
GET /api/admin/sync-jobs
```

### Database Queries
```sql
-- Check sync status
SELECT "bandId", "lastSyncAt", "syncStatus" FROM bands WHERE "isActive" = true;

-- Check unmatched videos
SELECT COUNT(*) FROM youtube_videos WHERE "bandId" IS NULL;

-- Check promotion status
SELECT COUNT(*) FROM youtube_videos WHERE "bandId" IS NOT NULL AND "isPromoted" = false;
```

## 🔧 Configuration Files

- **`allstar-config.json`** - All-Star bands and exclusion patterns
- **`apps/api/src/config/hbcu-bands.ts`** - HBCU band configurations and keywords
- **`.env`** - YouTube API key and quota limits

## 📝 Development

### Adding New Scripts
1. Place in appropriate directory (`core/`, `utilities/`, or `maintenance/`)
2. Update this README with usage instructions
3. Follow existing script patterns (error handling, logging, dry-run support)

### Testing Scripts
```bash
# Always test with dry-run first
npx tsx apps/api/scripts/core/script-name.ts --dry-run

# Test with limited data
npx tsx apps/api/scripts/core/script-name.ts --limit 10
```

## 🆘 Troubleshooting

### Script fails with "Cannot find module"
```bash
# Install dependencies
npm install
```

### "YouTube API quota exceeded"
- Wait until midnight UTC for quota reset
- Or use a different API key (not recommended for production)

### Database connection errors
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Verify network connectivity

### Script hangs or times out
- Check for rate limiting (YouTube API)
- Verify Redis is running (for worker jobs)
- Check database query performance

## 📚 Additional Documentation

- [Video Sync Automation](../../docs/VIDEO_SYNC_AUTOMATION.md) - Detailed pipeline documentation
- [Worker Architecture](../../apps/worker/README.md) - Worker system overview
- [API Documentation](../../apps/api/README.md) - API endpoints and usage
