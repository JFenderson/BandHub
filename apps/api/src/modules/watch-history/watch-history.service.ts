import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import {
  TrackWatchDto,
  GetWatchHistoryQueryDto,
  WatchHistoryFilter,
  WatchHistorySortBy,
} from './dto';
import { AchievementTrackerService } from '../achievements/achievement-tracker.service';

@Injectable()
export class WatchHistoryService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AchievementTrackerService))
    private achievementTracker: AchievementTrackerService,
  ) {}

  async trackWatch(userId: string, dto: TrackWatchDto) {
    const { videoId, watchDuration, completed } = dto;

    // Verify video exists
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Check for existing watch history
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [existingToday, existingAny] = await Promise.all([
      this.prisma.watchHistory.findFirst({
        where: {
          userId,
          videoId,
          watchedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      this.prisma.watchHistory.findFirst({
        where: {
          userId,
          videoId,
        },
      }),
    ]);

    // First watch if no history exists at all
    const isFirstWatch = !existingAny;

    // Use transaction to update watch history and video view count
    const result = await this.prisma.$transaction(async (tx) => {
      let watchHistory;

      if (existingToday) {
        // Update existing entry for today
        watchHistory = await tx.watchHistory.update({
          where: { id: existingToday.id },
          data: {
            watchDuration,
            completed,
            watchedAt: new Date(), // Update timestamp to now
          },
          include: {
            video: {
              include: {
                band: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                  },
                },
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        });
      } else {
        // Create new watch history entry
        watchHistory = await tx.watchHistory.create({
          data: {
            userId,
            videoId,
            watchDuration,
            completed,
          },
          include: {
            video: {
              include: {
                band: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                  },
                },
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        });
      }

      // Increment view count if first time watching this video
      if (isFirstWatch) {
        await tx.video.update({
          where: { id: videoId },
          data: {
            viewCount: {
              increment: 1,
            },
          },
        });
      }

      return watchHistory;
    });

    // Track achievement progress (fire and forget)
    if (isFirstWatch) {
      Promise.all([
        this.achievementTracker.trackVideoWatched(userId),
        this.achievementTracker.trackWatchStreak(userId),
      ]).catch(() => {});
    }

    return result;
  }

  async getHistory(userId: string, query: GetWatchHistoryQueryDto) {
    const { page = 1, limit = 20, filter, sortBy } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { userId };
    switch (filter) {
      case WatchHistoryFilter.COMPLETED:
        where.completed = true;
        break;
      case WatchHistoryFilter.INCOMPLETE:
        where.completed = false;
        break;
    }

    // Build order by
    let orderBy: Record<string, unknown> = {};
    switch (sortBy) {
      case WatchHistorySortBy.OLDEST:
        orderBy = { watchedAt: 'asc' };
        break;
      case WatchHistorySortBy.MOST_VIEWED:
        orderBy = { video: { viewCount: 'desc' } };
        break;
      case WatchHistorySortBy.LONGEST_DURATION:
        orderBy = { watchDuration: 'desc' };
        break;
      case WatchHistorySortBy.RECENTLY_WATCHED:
      default:
        orderBy = { watchedAt: 'desc' };
    }

    const [history, total] = await Promise.all([
      this.prisma.watchHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          video: {
            include: {
              band: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logoUrl: true,
                },
              },
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.watchHistory.count({ where }),
    ]);

    return {
      data: history,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async clearHistory(userId: string, videoId?: string) {
    if (videoId) {
      // Clear specific video from history
      const result = await this.prisma.watchHistory.deleteMany({
        where: {
          userId,
          videoId,
        },
      });

      if (result.count === 0) {
        throw new NotFoundException('Video not found in watch history');
      }

      return { message: 'Video removed from watch history', count: result.count };
    } else {
      // Clear all history
      const result = await this.prisma.watchHistory.deleteMany({
        where: { userId },
      });

      return { message: 'Watch history cleared', count: result.count };
    }
  }

  async getRecentlyWatched(userId: string, limit: number = 10) {
    // Use a more efficient approach: get latest watch per video using raw SQL
    // This avoids the performance issues with distinct on large datasets
    const latestWatches = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT ON ("video_id") id
      FROM watch_history
      WHERE user_id = ${userId}
      ORDER BY "video_id", watched_at DESC
      LIMIT ${limit}
    `;

    if (latestWatches.length === 0) {
      return [];
    }

    // Fetch full watch history records with relations
    const history = await this.prisma.watchHistory.findMany({
      where: {
        id: {
          in: latestWatches.map(w => w.id),
        },
      },
      orderBy: { watchedAt: 'desc' },
      include: {
        video: {
          include: {
            band: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return history;
  }

  async getContinueWatching(userId: string, limit: number = 10) {
    // Use a more efficient approach: get latest incomplete watch per video using raw SQL
    const latestIncompleteWatches = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT ON ("video_id") id
      FROM watch_history
      WHERE user_id = ${userId} AND completed = false
      ORDER BY "video_id", watched_at DESC
      LIMIT ${limit}
    `;

    if (latestIncompleteWatches.length === 0) {
      return [];
    }

    // Fetch full watch history records with relations
    const incompleteVideos = await this.prisma.watchHistory.findMany({
      where: {
        id: {
          in: latestIncompleteWatches.map(w => w.id),
        },
      },
      orderBy: { watchedAt: 'desc' },
      include: {
        video: {
          include: {
            band: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return incompleteVideos;
  }

  async getWatchStats(userId: string) {
    const [totalWatchTime, uniqueVideosCount, completedVideos] = await Promise.all([
      // Total watch time in seconds
      this.prisma.watchHistory.aggregate({
        where: { userId },
        _sum: {
          watchDuration: true,
        },
      }),
      // Unique videos watched - more efficient count using raw SQL
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT video_id) as count
        FROM watch_history
        WHERE user_id = ${userId}
      `,
      // Videos completed
      this.prisma.watchHistory.count({
        where: {
          userId,
          completed: true,
        },
      }),
    ]);

    const videosWatched = Number(uniqueVideosCount[0]?.count || 0);

    return {
      totalWatchTimeSeconds: totalWatchTime._sum.watchDuration || 0,
      totalWatchTimeMinutes: Math.floor((totalWatchTime._sum.watchDuration || 0) / 60),
      totalWatchTimeHours: Math.floor((totalWatchTime._sum.watchDuration || 0) / 3600),
      videosWatched,
      videosCompleted: completedVideos,
    };
  }
}
