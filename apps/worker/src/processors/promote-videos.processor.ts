import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { 
  QueueName, 
  JobType, 
  PromoteVideosJobData,
} from '@hbcu-band-hub/shared-types';
import { DatabaseService } from '../services/database.service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

interface PromoteResult {
  totalProcessed: number;
  promoted: number;
  skipped: number;
  errors: string[];
  duration: number;
}

@Processor(QueueName.VIDEO_PROCESSING, {
  concurrency: 2,
})
export class PromoteVideosProcessor extends WorkerHost {
  private readonly logger = new Logger(PromoteVideosProcessor.name);
  
  constructor(
    private databaseService: DatabaseService,
  ) {
    super();
  }
  
  async process(job: Job<PromoteVideosJobData>): Promise<PromoteResult> {
    const { triggeredBy, limit } = job.data;
    const startTime = Date.now();
    
    this.logger.log(`Starting video promotion (triggered by: ${triggeredBy})`);
    
    const result: PromoteResult = {
      totalProcessed: 0,
      promoted: 0,
      skipped: 0,
      errors: [],
      duration: 0,
    };
    
    try {
      // Find YouTubeVideo records where bandId IS NOT NULL and isPromoted = false
      this.logger.log('Fetching videos ready for promotion...');
      const videosToPromote = await this.databaseService.prisma.youTubeVideo.findMany({
        where: {
          bandId: { not: null },
          isPromoted: false,
        },
        include: {
          band: {
            select: {
              id: true,
              name: true,
            },
          },
          opponentBand: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: limit,
        orderBy: { publishedAt: 'desc' },
      });
      
      this.logger.log(`Found ${videosToPromote.length} videos ready for promotion`);
      
      if (videosToPromote.length === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }
      
      await job.updateProgress({
        stage: 'promoting',
        current: 0,
        total: videosToPromote.length,
        message: `Promoting ${videosToPromote.length} videos`,
      });
      
      // Process each video
      for (const [index, youtubeVideo] of videosToPromote.entries()) {
        result.totalProcessed++;
        
        try {
          // Check if Video with same youtubeId already exists
          const existingVideo = await this.databaseService.prisma.video.findFirst({
            where: { youtubeId: youtubeVideo.youtubeId },
          });
          
          if (existingVideo) {
            // Skip if already exists in Video table
            result.skipped++;
            
            // Mark as promoted anyway to avoid reprocessing
            await this.databaseService.prisma.youTubeVideo.update({
              where: { id: youtubeVideo.id },
              data: {
                isPromoted: true,
                promotedAt: new Date(),
              },
            });
            continue;
          }
          
          // Determine category based on video content
          const categorySlug = await this.determineCategory(youtubeVideo);
          
          // Get category ID
          const category = categorySlug 
            ? await this.databaseService.prisma.category.findUnique({
                where: { slug: categorySlug },
                select: { id: true },
              })
            : null;
          
          // Copy to Video table (user-facing content)
          await this.databaseService.prisma.video.create({
            data: {
              youtubeId: youtubeVideo.youtubeId,
              title: youtubeVideo.title,
              description: youtubeVideo.description || '',
              thumbnailUrl: youtubeVideo.thumbnailUrl,
              url: youtubeVideo.url,
              duration: youtubeVideo.duration,
              publishedAt: youtubeVideo.publishedAt,
              viewCount: youtubeVideo.viewCount,
              likeCount: youtubeVideo.likeCount,
              bandId: youtubeVideo.bandId!,
              categoryId: category?.id,
              isVisible: true,
              isFeatured: false,
            },
          });
          
          // Mark as promoted
          await this.databaseService.prisma.youTubeVideo.update({
            where: { id: youtubeVideo.id },
            data: {
              isPromoted: true,
              promotedAt: new Date(),
            },
          });
          
          result.promoted++;
          
        } catch (error) {
          result.errors.push(`Error promoting ${youtubeVideo.youtubeId}: ${getErrorMessage(error)}`);
          this.logger.error(`Error promoting video ${youtubeVideo.youtubeId}`, error);
        }
        
        if ((index + 1) % 50 === 0) {
          await job.updateProgress({
            stage: 'promoting',
            current: index + 1,
            total: videosToPromote.length,
            message: `Promoted ${index + 1}/${videosToPromote.length} videos`,
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Video promotion failed', error);
      result.errors.push(getErrorMessage(error));
      throw error;
    }
    
    result.duration = Date.now() - startTime;
    
    this.logger.log(
      `Completed video promotion: ${result.totalProcessed} processed, ` +
      `${result.promoted} promoted, ${result.skipped} skipped`
    );
    
    return result;
  }
  
  /**
   * Determine the best category for a video based on its content
   */
  private async determineCategory(video: any): Promise<string | null> {
    const title = (video.title || '').toLowerCase();
    const description = (video.description || '').toLowerCase();
    const text = `${title} ${description}`;
    
    // Battle/Competition
    if (text.match(/\b(vs|versus|battle|botb|showdown|face\s*off)\b/i)) {
      return 'battles-competitions';
    }
    
    // Halftime show
    if (text.match(/\b(halftime|half\s*time|half-time)\b/i)) {
      return 'halftime-shows';
    }
    
    // Parade
    if (text.match(/\b(parade|mardi\s*gras|homecoming\s*parade)\b/i)) {
      return 'parades';
    }
    
    // Stand tunes
    if (text.match(/\b(stand\s*tune|stands|in\s*the\s*stands|5th\s*quarter|fifth\s*quarter)\b/i)) {
      return 'stand-tunes';
    }
    
    // Practice/Rehearsal
    if (text.match(/\b(practice|rehearsal|sectional|camp|clinic)\b/i)) {
      return 'practices-rehearsals';
    }
    
    // Documentary/Behind the scenes
    if (text.match(/\b(documentary|behind\s*the\s*scenes|interview|story|history)\b/i)) {
      return 'documentaries';
    }
    
    // Default to performances
    return 'performances';
  }
  
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }
  
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed`, error.stack);
  }
}
