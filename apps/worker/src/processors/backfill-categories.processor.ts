import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, JobType, CategorizeVideosJobData } from '@hbcu-band-hub/shared-types';
import { DatabaseService } from '../services/database.service';

interface CategorizeResult {
  totalVideos: number;
  categorized: number;
  skipped: number;
  errors: number;
  duration: number;
  breakdown: Record<string, number>;
}

/**
 * BackfillCategoriesProcessor
 *
 * Runs entirely against the database — no YouTube API quota consumed.
 * Iterates through videos with no category (or all videos when uncategorizedOnly=false),
 * applies pattern-based detection, and bulk-updates them by category.
 */
@Processor(QueueName.MAINTENANCE, { concurrency: 1 })
export class BackfillCategoriesProcessor extends WorkerHost {
  private readonly logger = new Logger(BackfillCategoriesProcessor.name);
  private readonly BATCH_SIZE = 500;

  constructor(private readonly databaseService: DatabaseService) {
    super();
  }

  async process(job: Job<CategorizeVideosJobData>): Promise<CategorizeResult> {
    const { uncategorizedOnly = true } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `Starting video categorization backfill (uncategorizedOnly=${uncategorizedOnly}, triggered by: ${job.data.triggeredBy})`,
    );

    // Refresh category cache so we pick up any recently added categories
    await this.databaseService.refreshCategoryCache();

    const result: CategorizeResult = {
      totalVideos: 0,
      categorized: 0,
      skipped: 0,
      errors: 0,
      duration: 0,
      breakdown: {},
    };

    // Count total for progress reporting
    const total = await this.databaseService.video.count({
      where: uncategorizedOnly ? { categoryId: null } : {},
    });
    result.totalVideos = total;

    this.logger.log(`Found ${total} videos to process`);

    if (total === 0) {
      result.duration = Date.now() - startTime;
      return result;
    }

    await job.updateProgress({ stage: 'processing', current: 0, total, message: `Processing ${total} videos` });

    // Cursor-based pagination so we don't skip videos as we update them
    let lastId: string | undefined;
    let processed = 0;

    while (true) {
      const videos = await this.databaseService.video.findMany({
        where: {
          ...(uncategorizedOnly ? { categoryId: null } : {}),
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        select: { id: true, title: true, description: true },
        orderBy: { id: 'asc' },
        take: this.BATCH_SIZE,
      });

      if (videos.length === 0) break;

      lastId = videos[videos.length - 1].id;

      // Group video IDs by detected category
      const categoryGroups = new Map<string, string[]>(); // categoryId -> videoIds
      const categoryNames = new Map<string, string>();    // categoryId -> slug (for breakdown)

      for (const video of videos) {
        try {
          const category = await this.databaseService.getCategoryForVideo(
            video.title,
            video.description || '',
          );

          if (category) {
            const ids = categoryGroups.get(category.id) ?? [];
            ids.push(video.id);
            categoryGroups.set(category.id, ids);
            categoryNames.set(category.id, category.slug);
          } else {
            result.skipped++;
          }
        } catch {
          result.errors++;
        }
      }

      // Bulk update each category group
      for (const [categoryId, videoIds] of categoryGroups) {
        await this.databaseService.video.updateMany({
          where: { id: { in: videoIds } },
          data: { categoryId },
        });

        const slug = categoryNames.get(categoryId) ?? categoryId;
        result.breakdown[slug] = (result.breakdown[slug] ?? 0) + videoIds.length;
        result.categorized += videoIds.length;
      }

      processed += videos.length;

      await job.updateProgress({
        stage: 'processing',
        current: processed,
        total,
        message: `Categorized ${result.categorized} of ${total} videos`,
      });

      this.logger.debug(
        `Batch complete — processed ${processed}/${total}, categorized so far: ${result.categorized}`,
      );

      // When uncategorizedOnly=true, cursor advances but the filtered set also shrinks,
      // so we re-query from lastId each iteration to avoid gaps.
      // When uncategorizedOnly=false, we walk all videos by ID regardless.
      if (uncategorizedOnly) {
        // Re-anchor: fetch next uncategorized batch after the last processed ID
        // (already handled by the WHERE + cursor above)
      }
    }

    result.duration = Date.now() - startTime;

    this.logger.log(
      `Categorization complete: ${result.categorized} categorized, ` +
        `${result.skipped} unmatched, ${result.errors} errors in ${result.duration}ms`,
    );
    this.logger.log(`Breakdown: ${JSON.stringify(result.breakdown)}`);

    return result;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }
}
