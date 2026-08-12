# Shared-Queue Processor Race Condition — Design

## Problem

The BullMQ admin dashboard showed 61 failed jobs on the `video-processing` queue.
Investigation against the production Redis instance (via SSH) confirmed the root cause:

`apps/worker/src/worker.module.ts` registers 5 separate `@Processor(QueueName.VIDEO_PROCESSING)`
classes — `ProcessVideoProcessor`, `ClassifyVideosProcessor`, `MatchVideosProcessor`,
`PromoteVideosProcessor`, `RematchVideosProcessor`. In `@nestjs/bullmq`, each `@Processor`
decorator creates its own independent BullMQ `Worker`, and all of them listen on the *same*
underlying Redis queue. BullMQ does not route jobs by name to a specific worker — any of the
5 workers can lock and run *any* job on that queue, and none of these processors check
`job.name` before acting.

`ProcessVideoProcessor` (`concurrency: 10`) sometimes wins the race for a `match-videos` or
`promote-videos` job. It unconditionally destructures `job.data` as `ProcessVideoJobData` and
calls `databaseService.upsertVideo(rawMetadata, bandId)` — but `match-videos`/`promote-videos`
jobs carry no `rawMetadata`, so `metadata.id` throws
`Cannot read properties of undefined (reading 'id')`. This was confirmed directly against two
failed jobs pulled from prod Redis (`match-videos-2026-04-12`, `promote-videos-2026-04-12`):
both have `job.name` matching their real type but an identical stack trace rooted in
`ProcessVideoProcessor.process`.

The same multi-processor-per-queue pattern exists on two other queues:

- `VIDEO_SYNC`: `SyncBandProcessor`, `SyncAllBandsProcessor`, `BackfillBandsProcessor`,
  `BackfillCreatorsProcessor`. The hourly `update-stats` job (`sync.scheduler.ts`) has no
  processor at all for it today — it's silently grabbed and mishandled by whichever of the 4
  workers is free.
- `MAINTENANCE`: `CleanupProcessor`, `NotificationProcessor`, `BackfillCategoriesProcessor`.
  `CleanupProcessor` already has an internal `switch (job.name)` for
  `'cleanup-old-videos'`/`'cleanup-hidden-videos'`, but the actual scheduled job name is
  `'cleanup-videos'` (`JobType.CLEANUP_VIDEOS`) — the daily cleanup cron has never actually
  cleaned anything, independent of the race. This is a separate, pre-existing bug and is
  explicitly out of scope here; its current no-op behavior is preserved unchanged.

`NotificationProcessor` and `ClassifyVideosProcessor` are never triggered by any `.add()` call
anywhere in the codebase today (dead code) — carried over unchanged for forward compatibility.

## Goals

- Eliminate the race: exactly one BullMQ `Worker` per queue.
- Preserve all existing business logic byte-for-byte — this is a routing fix, not a rewrite.
- Any job name with no registered handler logs a warning and returns cleanly instead of
  crashing or being silently mishandled by the wrong handler.
- Cover all three shared queues (`video-processing`, `video-sync`, `maintenance`) in one pass,
  since they share the identical defect.

## Non-goals

- Fixing the separate `cleanup-videos` job-name mismatch bug (noted above, left as-is).
- Implementing real logic for `update-stats` (no working implementation exists to port —
  out of scope; gets an explicit "not implemented" stub instead).
- Any change to job scheduling call sites (`sync.scheduler.ts`, `admin.service.ts`,
  `queue.service.ts`) — queue names and job names/payloads are unchanged.
- Cleaning up the 61 stale failed jobs from before the fix (separate follow-up, not required
  to ship this fix).

## Design

### Handler classes (business logic, unchanged)

Each of the 12 existing processor classes becomes a plain `@Injectable()` handler:

- Drop `@Processor(...)`, `extends WorkerHost`, and the `@OnWorkerEvent` hooks (those move to
  the one dispatcher per queue).
- Rename the class from `XProcessor` to `XHandler`.
- Rename its `process(job)` method to `handle(job)`. Method body, private helpers, and
  constructor-injected dependencies are otherwise untouched.

Affected files (path unchanged, only the class/method renamed and decorators stripped):

| File | Old class | New class |
|---|---|---|
| `process-video.processor.ts` | `ProcessVideoProcessor` | `ProcessVideoHandler` |
| `classify-videos.processor.ts` | `ClassifyVideosProcessor` | `ClassifyVideosHandler` |
| `match-videos.processor.ts` | `MatchVideosProcessor` | `MatchVideosHandler` |
| `promote-videos.processor.ts` | `PromoteVideosProcessor` | `PromoteVideosHandler` |
| `rematch-videos.processor.ts` | `RematchVideosProcessor` | `RematchVideosHandler` |
| `sync-band.processor.ts` | `SyncBandProcessor` | `SyncBandHandler` |
| `sync-all-bands.processor.ts` | `SyncAllBandsProcessor` | `SyncAllBandsHandler` |
| `backfill-creators.processor.ts` | `BackfillCreatorsProcessor` | `BackfillCreatorsHandler` |
| `backfill-bands.processor.ts` | `BackfillBandsProcessor` | `BackfillBandsHandler` |
| `cleanup.processor.ts` | `CleanupProcessor` | `CleanupHandler` |
| `notification.processor.ts` | `NotificationProcessor` | `NotificationHandler` |
| `backfill-categories.processor.ts` | `BackfillCategoriesProcessor` | `BackfillCategoriesHandler` |

`SyncAllBandsHandler` additionally loses its now-redundant
`if (job.name !== JobType.SYNC_ALL_BANDS) return;` guard (lines 32–34 of the current file) —
the dispatcher now guarantees only matching jobs ever reach it.

### Dispatchers (new — one per queue, owns the single Worker)

Three new files, each a thin `@Processor(QueueName.X)` class `extends WorkerHost`, injecting
the relevant handler services and switching on `job.name`:

**`apps/worker/src/processors/video-processing-queue.processor.ts`**
```
JobType.PROCESS_VIDEO    → ProcessVideoHandler.handle(job)
JobType.CLASSIFY_VIDEOS  → ClassifyVideosHandler.handle(job)
JobType.MATCH_VIDEOS     → MatchVideosHandler.handle(job)
JobType.PROMOTE_VIDEOS   → PromoteVideosHandler.handle(job)
JobType.REMATCH_VIDEOS   → RematchVideosHandler.handle(job)
default                  → log warning, return
```

**`apps/worker/src/processors/video-sync-queue.processor.ts`**
```
JobType.SYNC_BAND          → SyncBandHandler.handle(job)
JobType.SYNC_ALL_BANDS     → SyncAllBandsHandler.handle(job)
JobType.BACKFILL_CREATORS  → BackfillCreatorsHandler.handle(job)
JobType.BACKFILL_BANDS     → BackfillBandsHandler.handle(job)
JobType.UPDATE_STATS       → log "not implemented", return
default                    → log warning, return
```

**`apps/worker/src/processors/maintenance-queue.processor.ts`**
```
JobType.CLEANUP_VIDEOS     → CleanupHandler.handle(job)
JobType.CATEGORIZE_VIDEOS  → BackfillCategoriesHandler.handle(job)
'NEW_VIDEO_NOTIFICATION'   → NotificationHandler.handle(job)
'WEEKLY_DIGEST'            → NotificationHandler.handle(job)
default                    → log warning, return
```

Each dispatcher carries the `@OnWorkerEvent('completed')`/`@OnWorkerEvent('failed')` logging
hooks (consolidated from the old per-processor duplicates) and the queue's original
`concurrency` option, taken from whichever existing processor specified the highest value for
that queue (e.g. `video-processing` keeps `concurrency: 10`, matching
`ProcessVideoProcessor`'s current setting, since that's the queue's busiest job type).

### Module wiring

`apps/worker/src/worker.module.ts`: the `providers` array drops the 12 processor imports and
adds the 12 renamed handler imports plus the 3 new dispatcher imports. No changes to
`BullModule.registerQueue(...)` — queue names, `defaultJobOptions`, etc. are untouched.

### Testing

- Unit tests for each of the 3 dispatchers: given a `Job` with a known `job.name`, assert the
  matching handler's `handle()` was called with that job (handlers mocked — no DB/Redis
  needed). Given an unknown `job.name`, assert no handler was called and a warning was logged.
- No behavior change expected in any handler's own logic — existing manual verification
  (dry-run scripts, admin panel triggers) continues to apply unchanged per handler.
- Manual, post-deploy: trigger one job of each type from the admin panel (or wait for the next
  scheduled run) and confirm in `docker logs` that the correct handler ran and the job
  completed — the specific check being that a `match-videos`/`promote-videos` job no longer
  produces the `ProcessVideoHandler`/`upsertVideo` stack trace.
