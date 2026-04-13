import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, ProcessVideoJobData } from '@hbcu-band-hub/shared-types';
import { DatabaseService, VideoUpsertResult } from '../services/database.service';
import { BandLibrarianService } from '../services/band-librarian.service';
import { ConfigService } from '@nestjs/config';

@Processor(QueueName.VIDEO_PROCESSING, {
  concurrency: 10,
})
export class ProcessVideoProcessor extends WorkerHost {
  private readonly logger = new Logger(ProcessVideoProcessor.name);

  constructor(
    private databaseService: DatabaseService,
    private bandLibrarian: BandLibrarianService,
    private configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ProcessVideoJobData>): Promise<VideoUpsertResult> {
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
