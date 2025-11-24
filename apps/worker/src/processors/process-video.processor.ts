import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName, ProcessVideoJobData } from '@hbcu-band-hub/shared-types';
import { DatabaseService, VideoUpsertResult } from '../services/database.service';

@Processor(QueueName.VIDEO_PROCESSING, {
  concurrency: 10,
})
export class ProcessVideoProcessor extends WorkerHost {
  private readonly logger = new Logger(ProcessVideoProcessor.name);
  
  constructor(private databaseService: DatabaseService) {
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
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to process video ${videoId}`, error);
      throw error;
    }
  }
}