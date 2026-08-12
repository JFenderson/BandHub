# Shared-Queue Processor Dispatch Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the BullMQ multi-worker race on `video-processing`, `video-sync`, and `maintenance` queues by collapsing each queue's multiple `@Processor` classes into a single dispatcher per queue.

**Architecture:** Each of the 12 existing processor classes becomes a plain `@Injectable()` handler (business logic untouched, just stripped of `@Processor`/`WorkerHost`/`@OnWorkerEvent`). Three new dispatcher classes — one per queue — are the *only* `@Processor` for their queue, and route each job to the correct handler via `switch (job.name)`.

**Tech Stack:** NestJS 11, `@nestjs/bullmq`, BullMQ, TypeScript, Jest (new to `apps/worker`).

## Global Constraints

- Every handler's business logic (method bodies, private helpers, constructor dependencies) must be preserved exactly — this is a routing fix, not a rewrite.
- No changes to job scheduling call sites (`sync.scheduler.ts`, `apps/api/src/modules/admin/admin.service.ts`, `queue.service.ts`) — job names/payloads are unchanged.
- Any `job.name` with no matching case in a dispatcher must log a warning and return `undefined` — never throw, never fall through to a wrong handler.
- Design reference: `docs/superpowers/specs/2026-08-11-queue-processor-dispatch-fix-design.md`.

---

### Task 1: Add Jest test infrastructure to `apps/worker`

**Files:**
- Modify: `apps/worker/package.json`

**Interfaces:**
- Produces: a working `npm test --workspace=apps/worker` command that later tasks' `*.spec.ts` files will run under.

- [ ] **Step 1: Add Jest devDependencies and config to `apps/worker/package.json`**

Read the current file, then apply this diff (add `"test": "jest"` to `scripts`, add three devDependencies, add a `"jest"` config block mirroring `apps/api/package.json`'s):

```json
{
  "name": "hbcu-band-hub-worker",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main.js",
    "dev": "nest start --watch",
    "test": "jest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.36.3",
        "@bandhub/database": "*",
    "@bandhub/cache": "*",
    "@hbcu-band-hub/shared-types": "*",
    "@nestjs/bullmq": "^11.0.4",
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.3",
    "@nestjs/core": "^11.1.18",
    "@nestjs/schedule": "^6.1.0",
    "@prisma/client": "^5.18.0",
    "bullmq": "^5.8.0",
    "dotenv": "^16.4.0",
    "googleapis": "^142.0.0",
    "ioredis": "^5.4.0",
    "opossum": "^7.0.0",
    "prom-client": "^14.0.1",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/node-cron": "^3.0.11",
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "tsx": "^4.7.0",
    "typescript": "^5.5.0"
  },
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `jest`, `ts-jest`, `@types/jest` added to `apps/worker/node_modules` (or hoisted root `node_modules`), lockfile updated.

- [ ] **Step 3: Verify the test command runs (no test files yet)**

Run: `npm test --workspace=apps/worker`
Expected: Jest starts, reports `No tests found` (exit code 1 is fine here — there are no `*.spec.ts` files yet; Task 2 adds the first one). Confirm there is no *configuration* error (e.g. "Cannot find module 'ts-jest'" or "Unknown option" would mean the config is wrong).

- [ ] **Step 4: Commit**

```bash
git add apps/worker/package.json package-lock.json
git commit -m "chore(worker): add jest test infrastructure"
```

---

### Task 2: Fix the `video-processing` queue race

**Files:**
- Modify: `apps/worker/src/processors/process-video.processor.ts`
- Modify: `apps/worker/src/processors/classify-videos.processor.ts`
- Modify: `apps/worker/src/processors/match-videos.processor.ts`
- Modify: `apps/worker/src/processors/promote-videos.processor.ts`
- Modify: `apps/worker/src/processors/rematch-videos.processor.ts`
- Create: `apps/worker/src/processors/video-processing-queue.processor.ts`
- Test: `apps/worker/src/processors/video-processing-queue.processor.spec.ts`
- Modify: `apps/worker/src/worker.module.ts`

**Interfaces:**
- Consumes: `JobType.PROCESS_VIDEO`, `JobType.CLASSIFY_VIDEOS`, `JobType.MATCH_VIDEOS`, `JobType.PROMOTE_VIDEOS`, `JobType.REMATCH_VIDEOS` string values from `@hbcu-band-hub/shared-types`.
- Produces: `ProcessVideoHandler`, `ClassifyVideosHandler`, `MatchVideosHandler`, `PromoteVideosHandler`, `RematchVideosHandler` — each `@Injectable()` with a single `handle(job): Promise<unknown>` method, same constructor signature as the original processor class. `VideoProcessingQueueProcessor` — the sole `@Processor(QueueName.VIDEO_PROCESSING)` for this queue.

- [ ] **Step 1: Convert `ProcessVideoProcessor` → `ProcessVideoHandler`**

Replace the full contents of `apps/worker/src/processors/process-video.processor.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessVideoJobData } from '@hbcu-band-hub/shared-types';
import { DatabaseService, VideoUpsertResult } from '../services/database.service';
import { BandLibrarianService } from '../services/band-librarian.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProcessVideoHandler {
  private readonly logger = new Logger(ProcessVideoHandler.name);

  constructor(
    private databaseService: DatabaseService,
    private bandLibrarian: BandLibrarianService,
    private configService: ConfigService,
  ) {}

  async handle(job: Job<ProcessVideoJobData>): Promise<VideoUpsertResult> {
    const { videoId, bandId, rawMetadata, isUpdate } = job.data;

    this.logger.debug(
      `Processing video ${videoId} for band ${bandId} (${isUpdate ? 'update' : 'new'})`
    );

    try {
      const result = await this.databaseService.upsertVideo(rawMetadata, bandId);

      // Get category name from the database result
      const categoryName = result.video.categoryId || 'unknown';

      this.logger.debug(
        `Video ${videoId}: ${result.isNew ? 'created' : 'updated'} with category ${categoryName}`
      );

      // Run Librarian classification (only if API key is configured)
      if (this.configService.get<string>('ANTHROPIC_API_KEY')) {
        try {
          const extraction = await this.bandLibrarian.classify({
            title: rawMetadata.snippet.title,
            description: rawMetadata.snippet.description ?? '',
            tags: rawMetadata.snippet.tags ?? [],
            channelTitle: rawMetadata.snippet.channelTitle,
          });

          await this.databaseService.youTubeVideo.update({
            where: { youtubeId: rawMetadata.id },
            data: {
              aiExtraction: extraction as any,
              aiProcessed: true,
              aiExcluded: !extraction.isHbcuBandContent,
            },
          });
        } catch (err) {
          this.logger.warn(`Librarian classification failed for ${rawMetadata.id}: ${err}`);
          // Non-fatal: video proceeds without AI classification
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to process video ${videoId}`, error);
      throw error;
    }
  }
}
```

- [ ] **Step 2: Convert `ClassifyVideosProcessor` → `ClassifyVideosHandler`**

In `apps/worker/src/processors/classify-videos.processor.ts`:
- Replace `import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';` with `import { Injectable } from '@nestjs/common';` (remove the duplicate `Logger` import line and merge `Logger` into the `@nestjs/common` import).
- Remove the `@Processor(QueueName.VIDEO_PROCESSING, { concurrency: 1 })` decorator and its now-unused `QueueName` import (keep `JobType, ClassifyVideosJobData` imported from `@hbcu-band-hub/shared-types`).
- Change `export class ClassifyVideosProcessor extends WorkerHost {` to `export class ClassifyVideosHandler {`.
- Change `private readonly logger = new Logger(ClassifyVideosProcessor.name);` to `private readonly logger = new Logger(ClassifyVideosHandler.name);`.
- Remove `super();` from the constructor body (constructor becomes just the parameter list, no body needed beyond the injected properties — an empty `{}` body).
- Rename `async process(job: Job<ClassifyVideosJobData>): Promise<ClassifyResult> {` to `async handle(job: Job<ClassifyVideosJobData>): Promise<ClassifyResult> {`.
- Remove the two `@OnWorkerEvent(...)` methods at the bottom of the class (`onCompleted`, `onFailed`) — this logging now lives once in the dispatcher.
- Add `@Injectable()` above the class declaration.

Resulting top of file:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JobType, ClassifyVideosJobData } from '@hbcu-band-hub/shared-types';
import { DatabaseService } from '../services/database.service';
import { BandLibrarianService } from '../services/band-librarian.service';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface ClassifyResult {
  totalProcessed: number;
  classified: number;
  excluded: number;
  errors: string[];
  duration: number;
}

@Injectable()
export class ClassifyVideosHandler {
  private readonly logger = new Logger(ClassifyVideosHandler.name);
  private readonly BATCH_SIZE = 20;
  private readonly SUB_BATCH_SIZE = 5; // Videos per Claude API call

  constructor(
    private databaseService: DatabaseService,
    private bandLibrarian: BandLibrarianService,
  ) {}

  async handle(job: Job<ClassifyVideosJobData>): Promise<ClassifyResult> {
```

The rest of the method body (from `const { triggeredBy, limit } = job.data;` through the closing of the method) is unchanged. The file ends after that closing brace — remove the trailing `@OnWorkerEvent` block and the final class-closing `}` moves up accordingly.

- [ ] **Step 3: Convert `MatchVideosProcessor` → `MatchVideosHandler`**

In `apps/worker/src/processors/match-videos.processor.ts`:
- Replace `import { Processor, WorkerHost } from '@nestjs/bullmq';` with nothing (delete the line — this file never imported `OnWorkerEvent`, and has no other use of `@nestjs/bullmq`).
- Add `import { Injectable } from '@nestjs/common';` merged into the existing `import { Logger } from '@nestjs/common';` line → `import { Injectable, Logger } from '@nestjs/common';`.
- Remove the `@Processor(QueueName.VIDEO_PROCESSING, { concurrency: 2 })` decorator.
- Change `export class MatchVideosProcessor extends WorkerHost {` to `export class MatchVideosHandler {`.
- Change `private readonly logger = new Logger(MatchVideosProcessor.name);` to `private readonly logger = new Logger(MatchVideosHandler.name);`.
- Remove `super();` from the constructor (empty body).
- Rename `async process(job: Job<MatchVideosJobData>): Promise<MatchingResult> {` to `async handle(job: Job<MatchVideosJobData>): Promise<MatchingResult> {`.
- Add `@Injectable()` above the class.
- Everything else (the three-stage matching cascade, `MIN_CONFIDENCE`, private helper methods) is unchanged.

- [ ] **Step 4: Convert `PromoteVideosProcessor` → `PromoteVideosHandler`**

In `apps/worker/src/processors/promote-videos.processor.ts`:
- Replace `import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';` with nothing (delete).
- Merge `Injectable` into the `@nestjs/common` import → `import { Injectable, Logger } from '@nestjs/common';`.
- Remove the `@Processor(QueueName.VIDEO_PROCESSING, { concurrency: 2 })` decorator (and the now-unused `QueueName` import — keep `JobType, PromoteVideosJobData, LibrarianExtraction`).
- Change `export class PromoteVideosProcessor extends WorkerHost {` to `export class PromoteVideosHandler {`.
- Change `private readonly logger = new Logger(PromoteVideosProcessor.name);` to `private readonly logger = new Logger(PromoteVideosHandler.name);`.
- Remove `super();`.
- Rename `async process(job: Job<PromoteVideosJobData>): Promise<PromoteResult> {` to `async handle(job: Job<PromoteVideosJobData>): Promise<PromoteResult> {`.
- Remove the trailing `@OnWorkerEvent('completed')`/`@OnWorkerEvent('failed')` methods.
- Add `@Injectable()` above the class.
- `determineCategory` and all promotion logic unchanged.

- [ ] **Step 5: Convert `RematchVideosProcessor` → `RematchVideosHandler`**

In `apps/worker/src/processors/rematch-videos.processor.ts`:
- Replace `import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';` with `import { InjectQueue } from '@nestjs/bullmq';` (keep `InjectQueue` — it's still needed for the constructor-injected `videoProcessingQueue`; drop `Processor`, `WorkerHost`, `OnWorkerEvent`).
- Merge `Injectable` into `@nestjs/common` import → `import { Injectable, Logger } from '@nestjs/common';`.
- Remove the duplicate second `import { InjectQueue } from '@nestjs/bullmq';` line further down (it's currently imported twice — once unused at top after this edit, once actually used before the class) — keep exactly one `InjectQueue` import.
- Remove the `@Processor(QueueName.VIDEO_PROCESSING, { concurrency: 1 })` decorator (keep `QueueName` imported — it's still used in the `@InjectQueue(QueueName.VIDEO_PROCESSING)` parameter decorator).
- Change `export class RematchVideosProcessor extends WorkerHost {` to `export class RematchVideosHandler {`.
- Change `private readonly logger = new Logger(RematchVideosProcessor.name);` to `private readonly logger = new Logger(RematchVideosHandler.name);`.
- Remove `super();`.
- Rename `async process(job: Job<RematchVideosJobData>): Promise<RematchResult> {` to `async handle(job: Job<RematchVideosJobData>): Promise<RematchResult> {`.
- Remove the trailing `@OnWorkerEvent('completed')`/`@OnWorkerEvent('failed')` methods.
- Add `@Injectable()` above the class.
- `buildWhereClause` and the reset/enqueue logic unchanged.

Resulting import block:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, JobType, RematchVideosJobData, MatchVideosJobData, JobPriority } from '@hbcu-band-hub/shared-types';
import { DatabaseService } from '../services/database.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
```

- [ ] **Step 6: Create the dispatcher**

Create `apps/worker/src/processors/video-processing-queue.processor.ts`:

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, JobType } from '@hbcu-band-hub/shared-types';
import { ProcessVideoHandler } from './process-video.processor';
import { ClassifyVideosHandler } from './classify-videos.processor';
import { MatchVideosHandler } from './match-videos.processor';
import { PromoteVideosHandler } from './promote-videos.processor';
import { RematchVideosHandler } from './rematch-videos.processor';

@Processor(QueueName.VIDEO_PROCESSING, {
  concurrency: 10,
})
export class VideoProcessingQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingQueueProcessor.name);

  constructor(
    private processVideoHandler: ProcessVideoHandler,
    private classifyVideosHandler: ClassifyVideosHandler,
    private matchVideosHandler: MatchVideosHandler,
    private promoteVideosHandler: PromoteVideosHandler,
    private rematchVideosHandler: RematchVideosHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JobType.PROCESS_VIDEO:
        return this.processVideoHandler.handle(job);
      case JobType.CLASSIFY_VIDEOS:
        return this.classifyVideosHandler.handle(job);
      case JobType.MATCH_VIDEOS:
        return this.matchVideosHandler.handle(job);
      case JobType.PROMOTE_VIDEOS:
        return this.promoteVideosHandler.handle(job);
      case JobType.REMATCH_VIDEOS:
        return this.rematchVideosHandler.handle(job);
      default:
        this.logger.warn(`No handler registered for job name "${job.name}" on video-processing queue`);
        return undefined;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} (${job.name}) completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed`, error.stack);
  }
}
```

- [ ] **Step 7: Write the dispatcher test**

Create `apps/worker/src/processors/video-processing-queue.processor.spec.ts`:

```typescript
import { Job } from 'bullmq';
import { JobType } from '@hbcu-band-hub/shared-types';
import { VideoProcessingQueueProcessor } from './video-processing-queue.processor';

describe('VideoProcessingQueueProcessor', () => {
  function buildProcessor() {
    const handlers = {
      processVideoHandler: { handle: jest.fn().mockResolvedValue('process-video-result') },
      classifyVideosHandler: { handle: jest.fn().mockResolvedValue('classify-videos-result') },
      matchVideosHandler: { handle: jest.fn().mockResolvedValue('match-videos-result') },
      promoteVideosHandler: { handle: jest.fn().mockResolvedValue('promote-videos-result') },
      rematchVideosHandler: { handle: jest.fn().mockResolvedValue('rematch-videos-result') },
    };
    const processor = new VideoProcessingQueueProcessor(
      handlers.processVideoHandler as any,
      handlers.classifyVideosHandler as any,
      handlers.matchVideosHandler as any,
      handlers.promoteVideosHandler as any,
      handlers.rematchVideosHandler as any,
    );
    return { processor, handlers };
  }

  function jobNamed(name: string): Job {
    return { id: 'job-1', name, data: {} } as unknown as Job;
  }

  it('routes a process-video job only to ProcessVideoHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.PROCESS_VIDEO);

    const result = await processor.process(job);

    expect(handlers.processVideoHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.classifyVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.matchVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.promoteVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.rematchVideosHandler.handle).not.toHaveBeenCalled();
    expect(result).toBe('process-video-result');
  });

  it('routes a match-videos job only to MatchVideosHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.MATCH_VIDEOS);

    await processor.process(job);

    expect(handlers.matchVideosHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.processVideoHandler.handle).not.toHaveBeenCalled();
  });

  it('routes a promote-videos job only to PromoteVideosHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.PROMOTE_VIDEOS);

    await processor.process(job);

    expect(handlers.promoteVideosHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.processVideoHandler.handle).not.toHaveBeenCalled();
  });

  it('logs a warning and calls no handler for an unknown job name', async () => {
    const { processor, handlers } = buildProcessor();
    const warnSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation(() => undefined);
    const job = jobNamed('some-unrelated-job');

    const result = await processor.process(job);

    expect(result).toBeUndefined();
    expect(handlers.processVideoHandler.handle).not.toHaveBeenCalled();
    expect(handlers.classifyVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.matchVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.promoteVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.rematchVideosHandler.handle).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('some-unrelated-job'),
    );
  });
});
```

- [ ] **Step 8: Run the test and verify it passes**

Run: `npm test --workspace=apps/worker -- video-processing-queue.processor.spec.ts`
Expected: 4 passing tests.

- [ ] **Step 9: Update `worker.module.ts` for this queue's classes**

In `apps/worker/src/worker.module.ts`:
- Replace the import line `import { ProcessVideoProcessor } from './processors/process-video.processor';` with `import { ProcessVideoHandler } from './processors/process-video.processor';`.
- Replace `import { MatchVideosProcessor } from './processors/match-videos.processor';` with `import { MatchVideosHandler } from './processors/match-videos.processor';`.
- Replace `import { PromoteVideosProcessor } from './processors/promote-videos.processor';` with `import { PromoteVideosHandler } from './processors/promote-videos.processor';`.
- Replace `import { ClassifyVideosProcessor } from './processors/classify-videos.processor';` with `import { ClassifyVideosHandler } from './processors/classify-videos.processor';`.
- Replace `import { RematchVideosProcessor } from './processors/rematch-videos.processor';` with `import { RematchVideosHandler } from './processors/rematch-videos.processor';`.
- Add a new import line: `import { VideoProcessingQueueProcessor } from './processors/video-processing-queue.processor';`.
- In the `providers` array, replace `ProcessVideoProcessor,`, `MatchVideosProcessor,`, `PromoteVideosProcessor,`, `ClassifyVideosProcessor,`, `RematchVideosProcessor,` with `ProcessVideoHandler,`, `MatchVideosHandler,`, `PromoteVideosHandler,`, `ClassifyVideosHandler,`, `RematchVideosHandler,`, and add `VideoProcessingQueueProcessor,` to the list (position doesn't matter — NestJS DI is not order-sensitive).

- [ ] **Step 10: Verify the worker builds**

Run: `npm run build --workspace=apps/worker`
Expected: `nest build` completes with no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add apps/worker/src/processors/process-video.processor.ts apps/worker/src/processors/classify-videos.processor.ts apps/worker/src/processors/match-videos.processor.ts apps/worker/src/processors/promote-videos.processor.ts apps/worker/src/processors/rematch-videos.processor.ts apps/worker/src/processors/video-processing-queue.processor.ts apps/worker/src/processors/video-processing-queue.processor.spec.ts apps/worker/src/worker.module.ts
git commit -m "fix(worker): dispatch video-processing queue jobs through a single processor"
```

---

### Task 3: Fix the `video-sync` queue race

**Files:**
- Modify: `apps/worker/src/processors/sync-band.processor.ts`
- Modify: `apps/worker/src/processors/sync-all-bands.processor.ts`
- Modify: `apps/worker/src/processors/backfill-creators.processor.ts`
- Modify: `apps/worker/src/processors/backfill-bands.processor.ts`
- Create: `apps/worker/src/processors/video-sync-queue.processor.ts`
- Test: `apps/worker/src/processors/video-sync-queue.processor.spec.ts`
- Modify: `apps/worker/src/worker.module.ts`

**Interfaces:**
- Consumes: `JobType.SYNC_BAND`, `JobType.SYNC_ALL_BANDS`, `JobType.BACKFILL_CREATORS`, `JobType.BACKFILL_BANDS`, `JobType.UPDATE_STATS` from `@hbcu-band-hub/shared-types`.
- Produces: `SyncBandHandler`, `SyncAllBandsHandler`, `BackfillCreatorsHandler`, `BackfillBandsHandler` — each `@Injectable()` with `handle(job): Promise<unknown>`. `VideoSyncQueueProcessor` — the sole `@Processor(QueueName.VIDEO_SYNC)`.

- [ ] **Step 1: Convert `SyncBandProcessor` → `SyncBandHandler`**

In `apps/worker/src/processors/sync-band.processor.ts`:
- Replace `import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';` with nothing (delete — this file has no other `@nestjs/bullmq` usage).
- Merge `Injectable` into the `@nestjs/common` import → `import { Injectable, Logger } from '@nestjs/common';`.
- Remove the `@Processor(QueueName.VIDEO_SYNC, { concurrency: 3 })` decorator (keep `QueueName` imported — unused after this but harmless; actually remove it from the import list since nothing else in the file references `QueueName` — check before removing: the file only uses `QueueName` in the decorator, so drop it from the `@hbcu-band-hub/shared-types` import).
- Change `export class SyncBandProcessor extends WorkerHost {` to `export class SyncBandHandler {`.
- Change `private readonly logger = new Logger(SyncBandProcessor.name);` to `private readonly logger = new Logger(SyncBandHandler.name);`.
- Remove `super();`.
- Rename `async process(job: Job<SyncBandJobData>): Promise<SyncJobResult> {` to `async handle(job: Job<SyncBandJobData>): Promise<SyncJobResult> {`.
- Remove the trailing `@OnWorkerEvent('completed')`/`@OnWorkerEvent('failed')` methods.
- Add `@Injectable()` above the class.
- All sync logic (`buildSearchQueries`, quota handling, etc.) unchanged.

- [ ] **Step 2: Convert `SyncAllBandsProcessor` → `SyncAllBandsHandler`**

In `apps/worker/src/processors/sync-all-bands.processor.ts`:
- Replace `import { Processor, WorkerHost } from '@nestjs/bullmq';` with nothing (delete — `InjectQueue` is imported separately and still needed).
- Merge `Injectable` into `@nestjs/common` import: add `import { Injectable, Logger } from '@nestjs/common';` (currently this file only imports `Logger` from `@nestjs/common` — add `Injectable`).
- Remove the `@Processor(QueueName.VIDEO_SYNC, { concurrency: 1 })` decorator (keep `QueueName` — still used in `@InjectQueue(QueueName.VIDEO_SYNC)`).
- Change `export class SyncAllBandsProcessor extends WorkerHost {` to `export class SyncAllBandsHandler {`.
- Change `private readonly logger = new Logger(SyncAllBandsProcessor.name);` to `private readonly logger = new Logger(SyncAllBandsHandler.name);`.
- Remove `super();`.
- Rename `async process(job: Job<SyncAllBandsJobData>) {` to `async handle(job: Job<SyncAllBandsJobData>) {`.
- **Delete the now-redundant guard** at the top of the method body:
  ```typescript
  // This processor handles the SYNC_ALL_BANDS job type
  // The base class routes based on job name, so we need to check
  if (job.name !== JobType.SYNC_ALL_BANDS) {
    return;  // Let other processors handle it
  }
  ```
  This guard was a workaround for the exact bug this plan fixes — the dispatcher now guarantees only `SYNC_ALL_BANDS` jobs ever reach this handler, so it's dead weight. (The `JobType` import stays — it's still used elsewhere in this file when building `SyncBandJobData`.)
- Add `@Injectable()` above the class.

- [ ] **Step 3: Convert `BackfillCreatorsProcessor` → `BackfillCreatorsHandler`**

In `apps/worker/src/processors/backfill-creators.processor.ts`:
- Replace `import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';` with nothing (delete).
- Merge `Injectable` into `@nestjs/common` import → `import { Injectable, Logger } from '@nestjs/common';`.
- Remove the `@Processor(QueueName.VIDEO_SYNC, { concurrency: 1 })` decorator and drop the now-unused `QueueName` from the `@hbcu-band-hub/shared-types` import (keep `JobType, BackfillCreatorsJobData`).
- Change `export class BackfillCreatorsProcessor extends WorkerHost {` to `export class BackfillCreatorsHandler {`.
- Change `private readonly logger = new Logger(BackfillCreatorsProcessor.name);` to `private readonly logger = new Logger(BackfillCreatorsHandler.name);`.
- Remove `super();`.
- Rename `async process(job: Job<BackfillCreatorsJobData>): Promise<BackfillResult> {` to `async handle(job: Job<BackfillCreatorsJobData>): Promise<BackfillResult> {`.
- Remove the trailing `@OnWorkerEvent('completed')`/`@OnWorkerEvent('failed')` methods.
- Add `@Injectable()` above the class.
- All backfill/quota logic unchanged.

- [ ] **Step 4: Convert `BackfillBandsProcessor` → `BackfillBandsHandler`**

In `apps/worker/src/processors/backfill-bands.processor.ts`:
- Replace `import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';` with nothing (delete).
- Merge `Injectable` into `@nestjs/common` import → `import { Injectable, Logger } from '@nestjs/common';`.
- Remove the `@Processor(QueueName.VIDEO_SYNC, { concurrency: 1 })` decorator and drop the now-unused `QueueName` from the `@hbcu-band-hub/shared-types` import (keep `JobType, BackfillBandsJobData`).
- Change `export class BackfillBandsProcessor extends WorkerHost {` to `export class BackfillBandsHandler {`.
- Change `private readonly logger = new Logger(BackfillBandsProcessor.name);` to `private readonly logger = new Logger(BackfillBandsHandler.name);`.
- Remove `super();`.
- Rename `async process(job: Job<BackfillBandsJobData>): Promise<BackfillResult> {` to `async handle(job: Job<BackfillBandsJobData>): Promise<BackfillResult> {`.
- Remove the trailing `@OnWorkerEvent('completed')`/`@OnWorkerEvent('failed')` methods.
- Add `@Injectable()` above the class.
- All backfill/quota logic unchanged.

- [ ] **Step 5: Create the dispatcher**

Create `apps/worker/src/processors/video-sync-queue.processor.ts`:

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, JobType } from '@hbcu-band-hub/shared-types';
import { SyncBandHandler } from './sync-band.processor';
import { SyncAllBandsHandler } from './sync-all-bands.processor';
import { BackfillCreatorsHandler } from './backfill-creators.processor';
import { BackfillBandsHandler } from './backfill-bands.processor';

@Processor(QueueName.VIDEO_SYNC, {
  concurrency: 3,
})
export class VideoSyncQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoSyncQueueProcessor.name);

  constructor(
    private syncBandHandler: SyncBandHandler,
    private syncAllBandsHandler: SyncAllBandsHandler,
    private backfillCreatorsHandler: BackfillCreatorsHandler,
    private backfillBandsHandler: BackfillBandsHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JobType.SYNC_BAND:
        return this.syncBandHandler.handle(job);
      case JobType.SYNC_ALL_BANDS:
        return this.syncAllBandsHandler.handle(job);
      case JobType.BACKFILL_CREATORS:
        return this.backfillCreatorsHandler.handle(job);
      case JobType.BACKFILL_BANDS:
        return this.backfillBandsHandler.handle(job);
      case JobType.UPDATE_STATS:
        this.logger.warn(
          `Job ${job.id} (update-stats) has no handler implementation yet — skipping`,
        );
        return undefined;
      default:
        this.logger.warn(`No handler registered for job name "${job.name}" on video-sync queue`);
        return undefined;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} (${job.name}) completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed`, error.stack);
  }
}
```

- [ ] **Step 6: Write the dispatcher test**

Create `apps/worker/src/processors/video-sync-queue.processor.spec.ts`:

```typescript
import { Job } from 'bullmq';
import { JobType } from '@hbcu-band-hub/shared-types';
import { VideoSyncQueueProcessor } from './video-sync-queue.processor';

describe('VideoSyncQueueProcessor', () => {
  function buildProcessor() {
    const handlers = {
      syncBandHandler: { handle: jest.fn().mockResolvedValue('sync-band-result') },
      syncAllBandsHandler: { handle: jest.fn().mockResolvedValue('sync-all-bands-result') },
      backfillCreatorsHandler: { handle: jest.fn().mockResolvedValue('backfill-creators-result') },
      backfillBandsHandler: { handle: jest.fn().mockResolvedValue('backfill-bands-result') },
    };
    const processor = new VideoSyncQueueProcessor(
      handlers.syncBandHandler as any,
      handlers.syncAllBandsHandler as any,
      handlers.backfillCreatorsHandler as any,
      handlers.backfillBandsHandler as any,
    );
    return { processor, handlers };
  }

  function jobNamed(name: string): Job {
    return { id: 'job-1', name, data: {} } as unknown as Job;
  }

  it('routes a sync-band job only to SyncBandHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.SYNC_BAND);

    const result = await processor.process(job);

    expect(handlers.syncBandHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.syncAllBandsHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillCreatorsHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillBandsHandler.handle).not.toHaveBeenCalled();
    expect(result).toBe('sync-band-result');
  });

  it('routes a backfill-creators job only to BackfillCreatorsHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.BACKFILL_CREATORS);

    await processor.process(job);

    expect(handlers.backfillCreatorsHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.syncBandHandler.handle).not.toHaveBeenCalled();
  });

  it('logs and skips an update-stats job without calling any handler', async () => {
    const { processor, handlers } = buildProcessor();
    const warnSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation(() => undefined);
    const job = jobNamed(JobType.UPDATE_STATS);

    const result = await processor.process(job);

    expect(result).toBeUndefined();
    expect(handlers.syncBandHandler.handle).not.toHaveBeenCalled();
    expect(handlers.syncAllBandsHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillCreatorsHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillBandsHandler.handle).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('logs a warning and calls no handler for an unknown job name', async () => {
    const { processor, handlers } = buildProcessor();
    const warnSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation(() => undefined);
    const job = jobNamed('some-unrelated-job');

    const result = await processor.process(job);

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('some-unrelated-job'));
  });
});
```

- [ ] **Step 7: Run the test and verify it passes**

Run: `npm test --workspace=apps/worker -- video-sync-queue.processor.spec.ts`
Expected: 4 passing tests.

- [ ] **Step 8: Update `worker.module.ts` for this queue's classes**

In `apps/worker/src/worker.module.ts`:
- Replace `import { SyncBandProcessor } from './processors/sync-band.processor';` with `import { SyncBandHandler } from './processors/sync-band.processor';`.
- Replace `import { SyncAllBandsProcessor } from './processors/sync-all-bands.processor';` with `import { SyncAllBandsHandler } from './processors/sync-all-bands.processor';`.
- Replace `import { BackfillCreatorsProcessor } from './processors/backfill-creators.processor';` with `import { BackfillCreatorsHandler } from './processors/backfill-creators.processor';`.
- Replace `import { BackfillBandsProcessor } from './processors/backfill-bands.processor';` with `import { BackfillBandsHandler } from './processors/backfill-bands.processor';`.
- Add: `import { VideoSyncQueueProcessor } from './processors/video-sync-queue.processor';`.
- In `providers`, replace `SyncBandProcessor,`, `SyncAllBandsProcessor,`, `BackfillCreatorsProcessor,`, `BackfillBandsProcessor,` with `SyncBandHandler,`, `SyncAllBandsHandler,`, `BackfillCreatorsHandler,`, `BackfillBandsHandler,`, and add `VideoSyncQueueProcessor,`.

- [ ] **Step 9: Verify the worker builds**

Run: `npm run build --workspace=apps/worker`
Expected: no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add apps/worker/src/processors/sync-band.processor.ts apps/worker/src/processors/sync-all-bands.processor.ts apps/worker/src/processors/backfill-creators.processor.ts apps/worker/src/processors/backfill-bands.processor.ts apps/worker/src/processors/video-sync-queue.processor.ts apps/worker/src/processors/video-sync-queue.processor.spec.ts apps/worker/src/worker.module.ts
git commit -m "fix(worker): dispatch video-sync queue jobs through a single processor"
```

---

### Task 4: Fix the `maintenance` queue race

**Files:**
- Modify: `apps/worker/src/processors/cleanup.processor.ts`
- Modify: `apps/worker/src/processors/notification.processor.ts`
- Modify: `apps/worker/src/processors/backfill-categories.processor.ts`
- Create: `apps/worker/src/processors/maintenance-queue.processor.ts`
- Test: `apps/worker/src/processors/maintenance-queue.processor.spec.ts`
- Modify: `apps/worker/src/worker.module.ts`

**Interfaces:**
- Consumes: `JobType.CLEANUP_VIDEOS`, `JobType.CATEGORIZE_VIDEOS` from `@hbcu-band-hub/shared-types`; the literal string job names `'NEW_VIDEO_NOTIFICATION'` and `'WEEKLY_DIGEST'` (these are not in the `JobType` enum — `NotificationProcessor` today dispatches on `job.data.type`, not `job.name`; no code in the repo currently schedules these, so this plan keeps the same literal names as `job.name` values for forward compatibility).
- Produces: `CleanupHandler`, `NotificationHandler`, `BackfillCategoriesHandler` — each `@Injectable()` with `handle(job): Promise<unknown>`. `MaintenanceQueueProcessor` — the sole `@Processor(QueueName.MAINTENANCE)`.

- [ ] **Step 1: Convert `CleanupProcessor` → `CleanupHandler`**

Replace the full contents of `apps/worker/src/processors/cleanup.processor.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@bandhub/database';

@Injectable()
export class CleanupHandler {
  private readonly logger = new Logger(CleanupHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(job: Job): Promise<void> {
    this.logger.log(`Processing cleanup job ${job.id}`);
    try {
      switch (job.name) {
        case 'cleanup-old-videos':
          await this.cleanupOldVideos();
          break;
        case 'cleanup-hidden-videos':
          await this.cleanupHiddenVideos();
          break;
        default:
          this.logger.warn(`Unknown cleanup job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Cleanup job failed: ${error.message}`);
      throw error;
    }
  }

  private async cleanupOldVideos() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const result = await this.prisma.video.deleteMany({
      where: {
        publishedAt: { lt: sixMonthsAgo },
        viewCount: { lt: 100 },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old low-view videos`);
  }

  private async cleanupHiddenVideos() {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const result = await this.prisma.video.deleteMany({
      where: {
        isHidden: true,
        updatedAt: { lt: oneYearAgo },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old hidden videos`);
  }
}
```

Note: this preserves the existing (already-broken, out of scope) behavior — the daily `cleanup-videos` job still falls into the `default` branch and logs "Unknown cleanup job type" without deleting anything, exactly as it does today. Only the routing bug is fixed here.

- [ ] **Step 2: Convert `NotificationProcessor` → `NotificationHandler`**

In `apps/worker/src/processors/notification.processor.ts`:
- Replace `import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';` with nothing (delete).
- Merge `Injectable` into `@nestjs/common` import → `import { Injectable, Logger } from '@nestjs/common';`.
- Remove the `@Processor(QueueName.MAINTENANCE)` decorator and the now-unused `QueueName` import.
- **Export** the `NotificationJobData` type so the dispatcher can reference it: change `type NotificationJobData = ...` to `export type NotificationJobData = ...`.
- Change `export class NotificationProcessor extends WorkerHost {` to `export class NotificationHandler {`.
- Change `private readonly logger = new Logger(NotificationProcessor.name);` to `private readonly logger = new Logger(NotificationHandler.name);`.
- Remove `super();`.
- Rename `async process(job: Job<NotificationJobData>): Promise<void> {` to `async handle(job: Job<NotificationJobData>): Promise<void> {`.
- Remove the trailing `@OnWorkerEvent('completed')`/`@OnWorkerEvent('failed')` methods.
- Add `@Injectable()` above the class.
- `processNewVideoNotification` / `processWeeklyDigest` unchanged.

- [ ] **Step 3: Convert `BackfillCategoriesProcessor` → `BackfillCategoriesHandler`**

In `apps/worker/src/processors/backfill-categories.processor.ts`:
- Replace `import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';` with nothing (delete).
- Merge `Injectable` into `@nestjs/common` import → `import { Injectable, Logger } from '@nestjs/common';`.
- Remove the `@Processor(QueueName.MAINTENANCE, { concurrency: 1 })` decorator and drop the now-unused `QueueName` from the `@hbcu-band-hub/shared-types` import (keep `JobType, CategorizeVideosJobData`).
- Change `export class BackfillCategoriesProcessor extends WorkerHost {` to `export class BackfillCategoriesHandler {`.
- Change `private readonly logger = new Logger(BackfillCategoriesProcessor.name);` to `private readonly logger = new Logger(BackfillCategoriesHandler.name);`.
- Remove `super();`.
- Rename `async process(job: Job<CategorizeVideosJobData>): Promise<CategorizeResult> {` to `async handle(job: Job<CategorizeVideosJobData>): Promise<CategorizeResult> {`.
- Remove the trailing `@OnWorkerEvent('completed')`/`@OnWorkerEvent('failed')` methods.
- Add `@Injectable()` above the class.
- Categorization batching logic unchanged.

- [ ] **Step 4: Create the dispatcher**

Create `apps/worker/src/processors/maintenance-queue.processor.ts`:

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, JobType } from '@hbcu-band-hub/shared-types';
import { CleanupHandler } from './cleanup.processor';
import { NotificationHandler, NotificationJobData } from './notification.processor';
import { BackfillCategoriesHandler } from './backfill-categories.processor';

@Processor(QueueName.MAINTENANCE)
export class MaintenanceQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceQueueProcessor.name);

  constructor(
    private cleanupHandler: CleanupHandler,
    private notificationHandler: NotificationHandler,
    private backfillCategoriesHandler: BackfillCategoriesHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JobType.CLEANUP_VIDEOS:
        return this.cleanupHandler.handle(job);
      case JobType.CATEGORIZE_VIDEOS:
        return this.backfillCategoriesHandler.handle(job);
      case 'NEW_VIDEO_NOTIFICATION':
      case 'WEEKLY_DIGEST':
        return this.notificationHandler.handle(job as Job<NotificationJobData>);
      default:
        this.logger.warn(`No handler registered for job name "${job.name}" on maintenance queue`);
        return undefined;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} (${job.name}) completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed`, error.stack);
  }
}
```

- [ ] **Step 5: Write the dispatcher test**

Create `apps/worker/src/processors/maintenance-queue.processor.spec.ts`:

```typescript
import { Job } from 'bullmq';
import { JobType } from '@hbcu-band-hub/shared-types';
import { MaintenanceQueueProcessor } from './maintenance-queue.processor';

describe('MaintenanceQueueProcessor', () => {
  function buildProcessor() {
    const handlers = {
      cleanupHandler: { handle: jest.fn().mockResolvedValue(undefined) },
      notificationHandler: { handle: jest.fn().mockResolvedValue(undefined) },
      backfillCategoriesHandler: { handle: jest.fn().mockResolvedValue('categorize-result') },
    };
    const processor = new MaintenanceQueueProcessor(
      handlers.cleanupHandler as any,
      handlers.notificationHandler as any,
      handlers.backfillCategoriesHandler as any,
    );
    return { processor, handlers };
  }

  function jobNamed(name: string): Job {
    return { id: 'job-1', name, data: {} } as unknown as Job;
  }

  it('routes a cleanup-videos job only to CleanupHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.CLEANUP_VIDEOS);

    await processor.process(job);

    expect(handlers.cleanupHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.notificationHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillCategoriesHandler.handle).not.toHaveBeenCalled();
  });

  it('routes a categorize-videos job only to BackfillCategoriesHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.CATEGORIZE_VIDEOS);

    const result = await processor.process(job);

    expect(handlers.backfillCategoriesHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.cleanupHandler.handle).not.toHaveBeenCalled();
    expect(result).toBe('categorize-result');
  });

  it('routes both notification job names only to NotificationHandler', async () => {
    const { processor, handlers } = buildProcessor();

    await processor.process(jobNamed('NEW_VIDEO_NOTIFICATION'));
    await processor.process(jobNamed('WEEKLY_DIGEST'));

    expect(handlers.notificationHandler.handle).toHaveBeenCalledTimes(2);
    expect(handlers.cleanupHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillCategoriesHandler.handle).not.toHaveBeenCalled();
  });

  it('logs a warning and calls no handler for an unknown job name', async () => {
    const { processor, handlers } = buildProcessor();
    const warnSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation(() => undefined);
    const job = jobNamed('some-unrelated-job');

    const result = await processor.process(job);

    expect(result).toBeUndefined();
    expect(handlers.cleanupHandler.handle).not.toHaveBeenCalled();
    expect(handlers.notificationHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillCategoriesHandler.handle).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('some-unrelated-job'));
  });
});
```

- [ ] **Step 6: Run the test and verify it passes**

Run: `npm test --workspace=apps/worker -- maintenance-queue.processor.spec.ts`
Expected: 4 passing tests.

- [ ] **Step 7: Update `worker.module.ts` for this queue's classes**

In `apps/worker/src/worker.module.ts`:
- Replace `import { CleanupProcessor } from './processors/cleanup.processor';` with `import { CleanupHandler } from './processors/cleanup.processor';`.
- Replace `import { NotificationProcessor } from './processors/notification.processor';` with `import { NotificationHandler } from './processors/notification.processor';`.
- Replace `import { BackfillCategoriesProcessor } from './processors/backfill-categories.processor';` with `import { BackfillCategoriesHandler } from './processors/backfill-categories.processor';`.
- Add: `import { MaintenanceQueueProcessor } from './processors/maintenance-queue.processor';`.
- In `providers`, replace `CleanupProcessor,`, `NotificationProcessor,`, `BackfillCategoriesProcessor,` with `CleanupHandler,`, `NotificationHandler,`, `BackfillCategoriesHandler,`, and add `MaintenanceQueueProcessor,`.

- [ ] **Step 8: Verify the worker builds and the full test suite passes**

Run: `npm run build --workspace=apps/worker`
Expected: no TypeScript errors.

Run: `npm test --workspace=apps/worker`
Expected: all 12 tests across the 3 dispatcher spec files pass, no other test files exist yet to fail.

- [ ] **Step 9: Commit**

```bash
git add apps/worker/src/processors/cleanup.processor.ts apps/worker/src/processors/notification.processor.ts apps/worker/src/processors/backfill-categories.processor.ts apps/worker/src/processors/maintenance-queue.processor.ts apps/worker/src/processors/maintenance-queue.processor.spec.ts apps/worker/src/worker.module.ts
git commit -m "fix(worker): dispatch maintenance queue jobs through a single processor"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm no leftover references to the old class names**

Run: `grep -rn "ProcessVideoProcessor\|ClassifyVideosProcessor\|MatchVideosProcessor\|PromoteVideosProcessor\|RematchVideosProcessor\|SyncBandProcessor\|SyncAllBandsProcessor\|BackfillCreatorsProcessor\|BackfillBandsProcessor\|CleanupProcessor\|NotificationProcessor\|BackfillCategoriesProcessor" apps/worker/src`
Expected: no matches (every reference was renamed to its `*Handler` counterpart).

- [ ] **Step 2: Confirm exactly one `@Processor` per shared queue**

Run: `grep -rn "@Processor(QueueName" apps/worker/src/processors`
Expected: exactly 3 matches — `video-processing-queue.processor.ts` → `QueueName.VIDEO_PROCESSING`, `video-sync-queue.processor.ts` → `QueueName.VIDEO_SYNC`, `maintenance-queue.processor.ts` → `QueueName.MAINTENANCE`.

- [ ] **Step 3: Full worker test suite and build**

Run: `npm test --workspace=apps/worker && npm run build --workspace=apps/worker`
Expected: all tests pass, build succeeds.

- [ ] **Step 4: Report readiness for deploy**

This plan does not include deploying to the Hostinger production server or clearing the 61 stale failed jobs — confirm with the user before doing either, since both touch production.
