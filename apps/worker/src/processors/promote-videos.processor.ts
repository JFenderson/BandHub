import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QueueName,
  JobType,
  PromoteVideosJobData,
  LibrarianExtraction,
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
      const videosToPromote = await this.databaseService.youTubeVideo.findMany({
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
      }) as any[];

      // Also fetch participantBandIds for each video (not in include above)
      const participantMap = new Map<string, string[]>();
      if (videosToPromote.length > 0) {
        const ytIds = videosToPromote.map((v: any) => v.id);
        const ytVideosWithParticipants = await (this.databaseService.youTubeVideo.findMany as any)({
          where: { id: { in: ytIds } },
          select: { id: true, participantBandIds: true },
        }) as any[];
        for (const ytv of ytVideosWithParticipants) {
          participantMap.set(ytv.id, ytv.participantBandIds ?? []);
        }
      }
      
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
          // Determine category based on video content
          const categorySlug = await this.determineCategory(youtubeVideo);

          // Get category ID
          const category = categorySlug
            ? await this.databaseService.category.findUnique({
                where: { slug: categorySlug },
                select: { id: true },
              })
            : null;

          // Upsert to Video table — atomic, safe under concurrent workers
          const upsertResult = await this.databaseService.video.upsert({
            where: { youtubeId: youtubeVideo.youtubeId },
            create: {
              youtubeId: youtubeVideo.youtubeId,
              title: youtubeVideo.title,
              description: youtubeVideo.description || '',
              thumbnailUrl: youtubeVideo.thumbnailUrl,
              duration: youtubeVideo.duration,
              publishedAt: youtubeVideo.publishedAt,
              viewCount: youtubeVideo.viewCount,
              likeCount: youtubeVideo.likeCount,
              bandId: youtubeVideo.bandId || '',
              categoryId: category?.id,
              isHidden: false,
              qualityScore: youtubeVideo.qualityScore,
            },
            update: {
              viewCount: youtubeVideo.viewCount,
              likeCount: youtubeVideo.likeCount,
              // Only set category if not already manually assigned
              ...(category ? { categoryId: category.id } : {}),
            },
            select: { id: true },
          });

          // Create VideoBand junction entries for all participant bands
          const participantBandIds = participantMap.get(youtubeVideo.id) ?? [];
          if (participantBandIds.length > 0) {
            const videoBandData = participantBandIds.map((bandId: string) => ({
              videoId: upsertResult.id,
              bandId,
              role:
                bandId === youtubeVideo.bandId
                  ? ('PRIMARY' as const)
                  : bandId === youtubeVideo.opponentBandId
                  ? ('OPPONENT' as const)
                  : ('PARTICIPANT' as const),
            }));
            await (this.databaseService as any).videoBand.createMany({
              data: videoBandData,
              skipDuplicates: true,
            });
          }

          // Mark as promoted
          await this.databaseService.youTubeVideo.update({
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
    // Fast path: use AI extraction if available
    const aiData = video.aiExtraction as LibrarianExtraction | null;
    if (aiData?.videoCategory && aiData.videoCategory !== 'OTHER') {
      const slugMap: Record<string, string> = {
        FIFTH_QUARTER: '5th-quarter',
        STAND_BATTLE: 'stand-battle',
        FIELD_SHOW: 'field-show',
        HALFTIME: 'halftime',
        PREGAME: 'pregame',
        ENTRANCE: 'entrance',
        PARADE: 'parade',
        PRACTICE: 'practice',
        CONCERT_BAND: 'concert-band',
      };
      const slug = slugMap[aiData.videoCategory];
      if (slug) return slug;
    }

    const title = (video.title || '').toLowerCase();
    const description = (video.description || '').toLowerCase();
    const text = `${title} ${description}`;

    if (text.match(/\b(5th\s*quarter|fifth\s*quarter|post\s*game|after\s*the\s*game)\b/i)) {
      return '5th-quarter';
    }
    if (text.match(/\b(stand\s*battle|battle\s*of\s*(the\s*)?bands|band\s*battle|stands?\s*vs\.?)\b/i)) {
      return 'stand-battle';
    }
    if (text.match(/\b(field\s*show|marching\s*show|formation|drill\s*team)\b/i)) {
      return 'field-show';
    }
    if (text.match(/\b(halftime|half\s*time|half-time)\b/i)) {
      return 'halftime';
    }
    if (text.match(/\b(pregame|pre\s*game|before\s*the\s*game)\b/i)) {
      return 'pregame';
    }
    if (text.match(/\b(entrance|entering|arrival)\b/i)) {
      return 'entrance';
    }
    if (text.match(/\b(parade|homecoming\s*parade|mardi\s*gras)\b/i)) {
      return 'parade';
    }
    if (text.match(/\b(practice|rehearsal|sectional|band\s*camp|band\s*room)\b/i)) {
      return 'practice';
    }
    if (text.match(/\b(concert|symphonic|spring\s*show|indoor)\b/i)) {
      return 'concert-band';
    }

    return 'other';
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
