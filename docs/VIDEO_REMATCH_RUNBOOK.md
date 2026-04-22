# Video Re-Match Runbook

Two modes of operation — choose based on environment:

| Mode | When to use | Risk |
|---|---|---|
| **Scripts** (recommended for prod) | Prod or any time you want direct control | Safe — no queue, no worker dependency |
| **API endpoints** | Dev only | `dev-reset` is destructive |

---

## Overview

| Table | What happens |
|---|---|
| `youtube_videos` | Matching fields are written; rows are never deleted |
| `videos` | Upserted from matched YouTubeVideos (create or update) |
| `video_bands` | Rebuilt per video on re-promotion |

**Pipeline order:** Match → Promote → Categorize

---

## Running via Scripts (Prod-Safe)

Scripts connect directly to the database — no worker, no queue, no API server needed.

### Prerequisites

```bash
cd c:\Users\josep\source\BandHub   # repo root
# Confirm DATABASE_URL points to the right database
echo $env:DATABASE_URL
```

Set the env file for prod (adjust path to wherever your prod secrets live):

```powershell
# Option A: Doppler
doppler run --project bandhub --config prd -- npx tsx apps/api/scripts/core/match-videos.ts

# Option B: explicit env file
$env:DATABASE_URL = "postgresql://..."
npx tsx apps/api/scripts/core/match-videos.ts
```

### Step 0 — Link official band channels (one-time setup)

Populates `Band.youtubeChannelId` for bands that have official YouTube channels registered as ContentCreators (JSU Bands, Human Jukebox Media, FAMU Marching 100, etc.). Once set, Stage 0 channel ownership matching gives those videos 100% confidence automatically.

```powershell
# Dry run first — shows what would change
npx tsx --env-file=apps/api/.env apps/api/scripts/core/link-creator-channels.ts

# Save the links
npx tsx --env-file=apps/api/.env apps/api/scripts/core/link-creator-channels.ts --apply
```

Re-run anytime new official band channels are added to the creators seeder.

---

### Step 1 — Match unmatched videos

```powershell
npx tsx --env-file=apps/api/.env apps/api/scripts/core/match-videos.ts
```

Processes all YouTubeVideos where `bandId IS NULL AND aiExcluded = false`.  
Writes `noMatchReason` and `matchAttemptedAt` on every video.  
Prints progress every 500 videos. Typical run: ~20–40 min for 10k videos.

Optional flags:
```powershell
# Limit for testing
npx tsx --env-file=apps/api/.env apps/api/scripts/core/match-videos.ts --limit=1000

# Re-match ALL videos (including already-matched) — use after link-creator-channels to fix bad assignments
npx tsx --env-file=apps/api/.env apps/api/scripts/core/match-videos.ts --all
```

### Step 2 — Promote matched videos

```powershell
npx tsx --env-file=apps/api/.env apps/api/scripts/core/promote-videos.ts
```

Upserts all matched (bandId NOT NULL, isPromoted = false) YouTubeVideos into the `Video` table.  
Updates band assignment on existing Video rows after a rematch.  
Rebuilds `VideoBand` junction rows. Safe to re-run.

### Step 3 — Categorize promoted videos

```powershell
# Uncategorized only (default — fastest)
npx tsx --env-file=apps/api/.env apps/api/scripts/core/categorize-videos.ts

# Re-categorize ALL videos (use after a full rematch)
npx tsx --env-file=apps/api/.env apps/api/scripts/core/categorize-videos.ts --all
```

No AI quota used. Keyword pattern matching only. Processes in batches of 500.

---

## Running via API Endpoints (Dev Only)

> **WARNING:** `dev-reset` deletes the entire Video and VideoBand tables.  
> **Never run `dev-reset` against production.**

### Prerequisites

- API running: `pnpm dev:api` (port 3001)
- Worker running: `pnpm dev` or `pnpm dev:worker`
- Docker services running: `make start` (PostgreSQL, Redis)
- PowerShell terminal

---

## Step 1 — Get an Auth Token

```powershell
$response = Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"admin@bandhub.com","password":"SecurePass123!"}'

$TOKEN = $response.accessToken
echo $TOKEN
```

You should see a JWT token printed. If `$TOKEN` is empty, the login failed — check credentials.

---

## Step 2 — Run the Dev Reset

This clears the `Video` and `VideoBand` tables, resets `isPromoted` on all `YouTubeVideo` records, and enqueues a full re-match job in the worker queue.

```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/admin/videos/dev-reset" `
  -Headers @{ Authorization = "Bearer $TOKEN" } `
  -ContentType "application/json"
```

Expected response:
```
deletedVideos      : 36783
deletedVideoBands  : 0
resetYouTubeVideos : 51084
matchJobId         : dev-full-reset-rematch-<timestamp>
message            : Dev reset complete. Video and VideoBand tables cleared. Full re-match job enqueued.
```

> **Note:** `deletedVideoBands` may be 0 if you already cleared the Video table — that's fine, the FK cascade handles it.

---

## Step 3 — Wait for Matching to Complete

The match job runs automatically in the worker after the reset. Check progress by polling the unmatched count:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/admin/videos/unmatched?page=1&limit=1" `
  -Headers @{ Authorization = "Bearer $TOKEN" } | Select-Object total
```

Keep running this every minute or two. When the `total` stops decreasing, matching is done.

You can also check via Prisma Studio — run `pnpm db:studio` and open `http://localhost:5555` to browse the `YouTubeVideo` table directly.

Typical results (~78% match rate):
```
total  | matched | unmatched
-------+---------+----------
 51084 |  40104  |   10980
```

---

## Step 4 — Promote Matched Videos

Once matching is complete, push all matched `YouTubeVideo` records into the `Video` table:

```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/admin/videos/promote" `
  -Headers @{ Authorization = "Bearer $TOKEN" } `
  -ContentType "application/json"
```

Expected response:
```
jobId   : promote-videos-admin-<timestamp>
message : Promote job queued. Matched YouTubeVideos will be upserted into the Video table.
```

The promote job runs in the background. Check progress in the worker logs, or use Prisma Studio (`pnpm db:studio`) to watch the `Video` table count climb.

Run promote a second time after matching fully completes to catch any stragglers.

---

## Step 5 — Review Unmatched Videos

After matching and promotion, review what didn't match and why:

```powershell
# Summary grouped by reason
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/admin/videos/unmatched?page=1&limit=1" `
  -Headers @{ Authorization = "Bearer $TOKEN" } | Select-Object -ExpandProperty summary
```

| Reason | Meaning |
|---|---|
| `no_alias_found` | No keyword from the band's alias list appeared in title/description/channel |
| `low_confidence` | An alias was found but scored below 50 — likely a short/ambiguous keyword |
| `ai_excluded` | Claude flagged the video as non-HBCU content (high school, drum corps, podcast, etc.) |
| *(empty)* | Match was attempted before the new tracking code was deployed — rerun to populate |

Browse specific unmatched videos:

```powershell
# Page through unmatched videos
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/admin/videos/unmatched?page=1&limit=100" `
  -Headers @{ Authorization = "Bearer $TOKEN" }
```

---

## Optional — Re-run Matching Only (No Reset)

If you want to re-match only specific subsets without wiping the Video table:

```powershell
# Re-match only videos that never got a band assigned
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/admin/videos/rematch" `
  -Headers @{ Authorization = "Bearer $TOKEN" } `
  -ContentType "application/json" `
  -Body '{"filter":"unmatched"}'

# Re-match alias-only matches (weakest signal, most likely to be wrong)
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/admin/videos/rematch" `
  -Headers @{ Authorization = "Bearer $TOKEN" } `
  -ContentType "application/json" `
  -Body '{"filter":"alias_only"}'

# Re-match everything below a confidence score
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/admin/videos/rematch" `
  -Headers @{ Authorization = "Bearer $TOKEN" } `
  -ContentType "application/json" `
  -Body '{"filter":"low_confidence","qualityScoreThreshold":70}'
```

---

## How the Matching Works

The worker runs a 3-stage cascade for each video:

1. **Channel Ownership** — If the video's YouTube channel is registered to a band, match immediately. Confidence: 100. Never overridden.

2. **AI (Claude Haiku)** — If the video has been through the AI classification job, use Claude's result. Requires confidence ≥ 50. Also handles battle detection, category, and event name extraction.

3. **Alias Matching** — Scans title, description, and channel title for band name keywords. Scores each match and picks the highest. Applies pep vs. marching band disambiguation when both bands from the same school score above 50. Requires score ≥ 50.

Videos that fail all three stages are logged with a `noMatchReason` and left with `bandId = null`. They are never promoted.

---

## Endpoints Reference

| Endpoint | Role Required | Purpose |
|---|---|---|
| `POST /api/v1/admin/videos/dev-reset` | SUPER_ADMIN | Nuclear reset — clears Video + VideoBand, triggers full rematch |
| `POST /api/v1/admin/videos/rematch` | ADMIN+ | Partial rematch by filter |
| `POST /api/v1/admin/videos/promote` | ADMIN+ | Push matched videos into Video table |
| `GET /api/v1/admin/videos/unmatched` | MODERATOR+ | Report of unmatched/excluded videos |
| `POST /api/v1/admin/videos/categorize` | ADMIN+ | Re-run category detection |
| `POST /api/v1/admin/videos/recategorize-other` | ADMIN+ | Re-categorize videos stuck in "Other" |
| `POST /api/v1/admin/videos/hide-excluded` | ADMIN+ | Hide promoted videos flagged by AI as non-HBCU |
