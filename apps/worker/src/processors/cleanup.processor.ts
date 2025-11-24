import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, CleanupVideosJobData } from '@hbcu-band-hub/shared-types';
import { DatabaseService } from '../services/database.service';
import { PrismaService } from '@hbcu-band-hub/prisma';

@Processor(QueueName.MAINTENANCE, {
  concurrency: 1,  // Run maintenance jobs one at a time
})
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);
  
  constructor(
    private databaseService: DatabaseService,
    private prisma: PrismaService,
  ) {
    super();
  }
  
  async process(job: Job<CleanupVideosJobData>) {
    const { scope, dryRun = false } = job.data;
    
    this.logger.log(`Starting cleanup (scope: ${scope}, dryRun: ${dryRun})`);
    
    const results = {
      duplicatesRemoved: 0,
      irrelevantHidden: 0,
      deletedRemoved: 0,
    };
    
    try {
      if (scope === 'duplicates' || scope === 'all') {
        results.duplicatesRemoved = await this.databaseService.removeDuplicates(dryRun);
        this.logger.log(`${dryRun ? 'Would remove' : 'Removed'} ${results.duplicatesRemoved} duplicates`);
      }
      
      if (scope === 'irrelevant' || scope === 'all') {
        // Hide videos with low relevance scores that aren't already hidden
        const irrelevant = await this.prisma.video.updateMany({
          where: {
            qualityScore: { lt: 30 },
            isHidden: false,
          },
          data: {
            isHidden: true,
          },
        });
        results.irrelevantHidden = irrelevant.count;
        this.logger.log(`${dryRun ? 'Would hide' : 'Hid'} ${results.irrelevantHidden} irrelevant videos`);
      }
      
      if (scope === 'deleted' || scope === 'all') {
        // Remove videos that no longer exist on YouTube
        // This would require checking each video, so we do it in batches
        results.deletedRemoved = await this.removeDeletedVideos(dryRun);
        this.logger.log(`${dryRun ? 'Would remove' : 'Removed'} ${results.deletedRemoved} deleted videos`);
      }
      
      await job.updateProgress({
        stage: 'complete',
        current: 100,
        total: 100,
        message: `Cleanup complete: ${JSON.stringify(results)}`,
      });
      
      return results;
      
    } catch (error) {
      this.logger.error('Cleanup failed', error);
      throw error;
    }
  }
  
  /**
   * Check for videos that have been deleted from YouTube
   * This is expensive so we do it in small batches
   */
  private async removeDeletedVideos(dryRun: boolean): Promise<number> {
    // In a real implementation, this would:
    // 1. Fetch videos in batches
    // 2. Check YouTube API to see if they still exist
    // 3. Remove or mark as deleted
    
    // For now, we'll mark videos that haven't been updated in a long time
    // as potentially deleted
    const threshold = new Date();
    threshold.setMonth(threshold.getMonth() - 6);  // 6 months
    
    if (dryRun) {
      const count = await this.prisma.video.count({
        where: {
          updatedAt: { lt: threshold },
          isHidden: false,
        },
      });
      return count;
    }
    
    const result = await this.prisma.video.updateMany({
      where: {
        updatedAt: { lt: threshold },
        isHidden: false,
      },
      data: {
        isHidden: true,
      },
    });
    
    return result.count;
  }
}