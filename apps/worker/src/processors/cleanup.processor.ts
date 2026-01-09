import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName } from '@hbcu-band-hub/shared-types';
import { PrismaService } from '@bandhub/database'; // Use shared package
@Processor(QueueName.MAINTENANCE)
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async process(job: Job): Promise<void> {
    this.logger.log(`Processing cleanup job ${ job.id }`);
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
