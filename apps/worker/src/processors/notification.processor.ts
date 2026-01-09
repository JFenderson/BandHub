import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName } from '@hbcu-band-hub/shared-types';
import { PrismaService } from '@bandhub/database';

interface NewVideoNotificationJobData {
  type: 'NEW_VIDEO_NOTIFICATION';
  videoId: string;
  bandId: string;
  videoTitle: string;
  bandName: string;
}

interface WeeklyDigestJobData {
  type: 'WEEKLY_DIGEST';
}

type NotificationJobData = NewVideoNotificationJobData | WeeklyDigestJobData;

@Processor(QueueName.MAINTENANCE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  
  constructor(
    private prisma: PrismaService,
  ) {
    super();
  }
  
  async process(job: Job<NotificationJobData>): Promise<void> {
    const { data } = job;
    
    this.logger.log(`Processing notification job: ${data.type}`);
    
    switch (data.type) {
      case 'NEW_VIDEO_NOTIFICATION':
        await this.processNewVideoNotification(data);
        break;
      case 'WEEKLY_DIGEST':
        await this.processWeeklyDigest();
        break;
      default:
        this.logger.warn(`Unknown notification job type: ${(data as { type: string }).type}`);
    }
  }
  
  private async processNewVideoNotification(data: NewVideoNotificationJobData): Promise<void> {
    const { videoId, bandId, videoTitle, bandName } = data;
    
    try {
      // Find all users following this band with notifications enabled
      const followers = await this.prisma.favoriteBand.findMany({
        where: {
          bandId,
          notificationsEnabled: true,
        },
        include: {
          user: {
            include: {
              notificationPreferences: true,
            },
          },
        },
      });
      
      this.logger.log(`Found ${followers.length} followers for band ${bandId}`);
      
      const notifications = [];
      
      for (const follower of followers) {
        // Check if user has in-app notifications enabled
        const prefs = follower.user.notificationPreferences;
        if (!prefs || prefs.inAppNotifications) {
          notifications.push({
            userId: follower.userId,
            type: 'NEW_VIDEO',
            title: `New video from ${bandName}`,
            message: videoTitle,
            data: { videoId, bandId },
          });
        }
      }
      
      if (notifications.length > 0) {
        await this.prisma.notification.createMany({
          data: notifications,
        });
        this.logger.log(`Created ${notifications.length} notifications for new video`);
      }
    } catch (error) {
      this.logger.error(`Failed to process new video notification`, error);
      throw error;
    }
  }
  
  private async processWeeklyDigest(): Promise<void> {
    try {
      // Get the date from 7 days ago
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Find all users who have weekly digest enabled
      const usersWithDigestEnabled = await this.prisma.notificationPreference.findMany({
        where: {
          emailWeeklyDigest: true,
        },
        include: {
          user: {
            include: {
              favoriteBands: {
                include: {
                  band: true,
                },
              },
            },
          },
        },
      });
      
      this.logger.log(`Found ${usersWithDigestEnabled.length} users with weekly digest enabled`);
      
      for (const userPref of usersWithDigestEnabled) {
        const followedBandIds = userPref.user.favoriteBands.map(fb => fb.bandId);
        
        if (followedBandIds.length === 0) {
          continue;
        }
        
        // Get new videos from followed bands in the last week
        const newVideos = await this.prisma.video.findMany({
          where: {
            bandId: { in: followedBandIds },
            createdAt: { gte: oneWeekAgo },
            isHidden: false,
          },
          include: {
            band: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Limit to 10 videos per digest
        });
        
        if (newVideos.length === 0) {
          continue;
        }
        
        // Create digest notification
        const bandNames = [...new Set(newVideos.map(v => v.band.name))];
        const message = newVideos.length === 1 
          ? `1 new video from ${bandNames[0]}`
          : `${newVideos.length} new videos from ${bandNames.slice(0, 3).join(', ')}${bandNames.length > 3 ? ` and ${bandNames.length - 3} more` : ''}`;
        
        await this.prisma.notification.create({
          data: {
            userId: userPref.userId,
            type: 'WEEKLY_DIGEST',
            title: 'Your weekly digest',
            message,
            data: { 
              videoCount: newVideos.length,
              videoIds: newVideos.slice(0, 5).map(v => v.id),
            },
          },
        });
        
        this.logger.log(`Created weekly digest notification for user ${userPref.userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process weekly digest`, error);
      throw error;
    }
  }
  
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Notification job ${job.id} completed`);
  }
  
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Notification job ${job.id} failed`, error.stack);
  }
}
