import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { Prisma } from '@prisma/client';
import {
  GetNotificationsQueryDto,
  NotificationFilter,
  CreateNotificationDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNotification(userId: string, dto: CreateNotificationDto) {
    // Check user preferences
    const preferences = await this.getOrCreatePreferences(userId);
    
    // If in-app notifications are disabled, don't create
    if (!preferences.inAppNotifications) {
      return null;
    }

    return this.prisma.notification.create({
      data: {
        userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        data: dto.data as Prisma.InputJsonValue,
      },
    });
  }

  async getNotifications(userId: string, query: GetNotificationsQueryDto) {
    const { page = 1, limit = 20, filter, type } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { userId };
    
    switch (filter) {
      case NotificationFilter.READ:
        where.read = true;
        break;
      case NotificationFilter.UNREAD:
        where.read = false;
        break;
    }

    if (type) {
      where.type = type;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: { read: true },
    });

    return { count: result.count };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notification deleted' };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  async getStats(userId: string) {
    const [total, unread] = await Promise.all([
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return { total, unread };
  }

  // ============ NOTIFICATION PREFERENCES ============

  async getOrCreatePreferences(userId: string) {
    let preferences = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    }

    return preferences;
  }

  async getPreferences(userId: string) {
    return this.getOrCreatePreferences(userId);
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    const existing = await this.getOrCreatePreferences(userId);

    return this.prisma.notificationPreference.update({
      where: { id: existing.id },
      data: {
        emailNewVideo: dto.emailNewVideo,
        emailUpcoming: dto.emailUpcoming,
        emailWeeklyDigest: dto.emailWeeklyDigest,
        inAppNotifications: dto.inAppNotifications,
      },
    });
  }

  // ============ BULK NOTIFICATION CREATION ============

  async createNewVideoNotifications(
    bandId: string,
    videoId: string,
    videoTitle: string,
    bandName: string,
  ) {
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
    }

    return { created: notifications.length };
  }

  async getUsersForEmailNotification(bandId: string, notificationType: 'emailNewVideo' | 'emailUpcoming' | 'emailWeeklyDigest') {
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

    return followers
      .filter(f => {
        const prefs = f.user.notificationPreferences;
        return prefs && prefs[notificationType];
      })
      .map(f => ({
        userId: f.userId,
        email: f.user.email,
        name: f.user.name,
      }));
  }
}
