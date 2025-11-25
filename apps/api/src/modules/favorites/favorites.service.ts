import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@hbcu-band-hub/prisma';
import {
  AddFavoriteVideoDto,
  UpdateFavoriteVideoDto,
  GetFavoriteVideosQueryDto,
  FavoriteVideoSortBy,
} from './dto/favorite-video.dto';
import {
  UpdateFavoriteBandDto,
  GetFavoriteBandsQueryDto,
  FavoriteBandSortBy,
} from './dto/favorite-band.dto';
import {
  UpdateWatchLaterDto,
  GetWatchLaterQueryDto,
  WatchLaterFilter,
  WatchLaterSortBy,
} from './dto/watch-later.dto';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  // ============ FAVORITE VIDEOS ============

  async addFavoriteVideo(userId: string, videoId: string, dto?: AddFavoriteVideoDto) {
    // Check if video exists
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Check if already favorited
    const existing = await this.prisma.favoriteVideo.findUnique({
      where: {
        userId_videoId: { userId, videoId },
      },
    });

    if (existing) {
      throw new ConflictException('Video is already in favorites');
    }

    return this.prisma.favoriteVideo.create({
      data: {
        userId,
        videoId,
        notes: dto?.notes,
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

  async removeFavoriteVideo(userId: string, videoId: string) {
    const favorite = await this.prisma.favoriteVideo.findUnique({
      where: {
        userId_videoId: { userId, videoId },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Video is not in favorites');
    }

    await this.prisma.favoriteVideo.delete({
      where: { id: favorite.id },
    });

    return { message: 'Video removed from favorites' };
  }

  async updateFavoriteVideo(userId: string, videoId: string, dto: UpdateFavoriteVideoDto) {
    const favorite = await this.prisma.favoriteVideo.findUnique({
      where: {
        userId_videoId: { userId, videoId },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Video is not in favorites');
    }

    return this.prisma.favoriteVideo.update({
      where: { id: favorite.id },
      data: {
        notes: dto.notes,
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

  async getFavoriteVideos(userId: string, query: GetFavoriteVideosQueryDto) {
    const { page = 1, limit = 20, bandId, categoryId, sortBy } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { userId };
    if (bandId || categoryId) {
      where.video = {};
      if (bandId) (where.video as Record<string, unknown>).bandId = bandId;
      if (categoryId) (where.video as Record<string, unknown>).categoryId = categoryId;
    }

    // Build order by
    let orderBy: Record<string, unknown> = {};
    switch (sortBy) {
      case FavoriteVideoSortBy.OLDEST:
        orderBy = { createdAt: 'asc' };
        break;
      case FavoriteVideoSortBy.MOST_VIEWED:
        orderBy = { video: { viewCount: 'desc' } };
        break;
      case FavoriteVideoSortBy.RECENTLY_ADDED:
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [favorites, total] = await Promise.all([
      this.prisma.favoriteVideo.findMany({
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
      this.prisma.favoriteVideo.count({ where }),
    ]);

    return {
      data: favorites,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async isVideoFavorited(userId: string, videoId: string): Promise<boolean> {
    const favorite = await this.prisma.favoriteVideo.findUnique({
      where: {
        userId_videoId: { userId, videoId },
      },
    });
    return !!favorite;
  }

  // ============ FAVORITE BANDS (FOLLOWING) ============

  async followBand(userId: string, bandId: string) {
    // Check if band exists
    const band = await this.prisma.band.findUnique({
      where: { id: bandId },
    });

    if (!band) {
      throw new NotFoundException('Band not found');
    }

    // Check if already following
    const existing = await this.prisma.favoriteBand.findUnique({
      where: {
        userId_bandId: { userId, bandId },
      },
    });

    if (existing) {
      throw new ConflictException('Already following this band');
    }

    return this.prisma.favoriteBand.create({
      data: {
        userId,
        bandId,
      },
      include: {
        band: {
          select: {
            id: true,
            name: true,
            slug: true,
            schoolName: true,
            logoUrl: true,
            state: true,
            _count: {
              select: { videos: true },
            },
          },
        },
      },
    });
  }

  async unfollowBand(userId: string, bandId: string) {
    const favorite = await this.prisma.favoriteBand.findUnique({
      where: {
        userId_bandId: { userId, bandId },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Not following this band');
    }

    await this.prisma.favoriteBand.delete({
      where: { id: favorite.id },
    });

    return { message: 'Unfollowed band' };
  }

  async updateFavoriteBand(userId: string, bandId: string, dto: UpdateFavoriteBandDto) {
    const favorite = await this.prisma.favoriteBand.findUnique({
      where: {
        userId_bandId: { userId, bandId },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Not following this band');
    }

    return this.prisma.favoriteBand.update({
      where: { id: favorite.id },
      data: {
        notificationsEnabled: dto.notificationsEnabled,
      },
      include: {
        band: {
          select: {
            id: true,
            name: true,
            slug: true,
            schoolName: true,
            logoUrl: true,
            state: true,
            _count: {
              select: { videos: true },
            },
          },
        },
      },
    });
  }

  async getFollowedBands(userId: string, query: GetFavoriteBandsQueryDto) {
    const { page = 1, limit = 20, sortBy, search } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { userId };
    if (search) {
      where.band = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { schoolName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // Build order by
    let orderBy: Record<string, unknown> = {};
    switch (sortBy) {
      case FavoriteBandSortBy.NAME:
        orderBy = { band: { name: 'asc' } };
        break;
      case FavoriteBandSortBy.VIDEO_COUNT:
        orderBy = { band: { videos: { _count: 'desc' } } };
        break;
      case FavoriteBandSortBy.RECENTLY_FOLLOWED:
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [favorites, total] = await Promise.all([
      this.prisma.favoriteBand.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          band: {
            select: {
              id: true,
              name: true,
              slug: true,
              schoolName: true,
              logoUrl: true,
              state: true,
              _count: {
                select: { videos: true },
              },
              videos: {
                take: 1,
                orderBy: { publishedAt: 'desc' },
                where: { isHidden: false },
                select: {
                  id: true,
                  title: true,
                  thumbnailUrl: true,
                  publishedAt: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.favoriteBand.count({ where }),
    ]);

    // Transform to include latestVideo at top level
    const data = favorites.map(f => ({
      ...f,
      band: {
        ...f.band,
        latestVideo: f.band.videos[0] || null,
        videos: undefined,
      },
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async isBandFollowed(userId: string, bandId: string): Promise<boolean> {
    const favorite = await this.prisma.favoriteBand.findUnique({
      where: {
        userId_bandId: { userId, bandId },
      },
    });
    return !!favorite;
  }

  async getBandFollowerCount(bandId: string): Promise<number> {
    return this.prisma.favoriteBand.count({
      where: { bandId },
    });
  }

  // ============ WATCH LATER ============

  async addToWatchLater(userId: string, videoId: string) {
    // Check if video exists
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Check if already in watch later
    const existing = await this.prisma.watchLater.findUnique({
      where: {
        userId_videoId: { userId, videoId },
      },
    });

    if (existing) {
      throw new ConflictException('Video is already in watch later list');
    }

    return this.prisma.watchLater.create({
      data: {
        userId,
        videoId,
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
          },
        },
      },
    });
  }

  async removeFromWatchLater(userId: string, videoId: string) {
    const watchLater = await this.prisma.watchLater.findUnique({
      where: {
        userId_videoId: { userId, videoId },
      },
    });

    if (!watchLater) {
      throw new NotFoundException('Video is not in watch later list');
    }

    await this.prisma.watchLater.delete({
      where: { id: watchLater.id },
    });

    return { message: 'Video removed from watch later list' };
  }

  async updateWatchLater(userId: string, videoId: string, dto: UpdateWatchLaterDto) {
    const watchLater = await this.prisma.watchLater.findUnique({
      where: {
        userId_videoId: { userId, videoId },
      },
    });

    if (!watchLater) {
      throw new NotFoundException('Video is not in watch later list');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.watched !== undefined) {
      updateData.watched = dto.watched;
      updateData.watchedAt = dto.watched ? new Date() : null;
    }

    return this.prisma.watchLater.update({
      where: { id: watchLater.id },
      data: updateData,
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
          },
        },
      },
    });
  }

  async getWatchLaterList(userId: string, query: GetWatchLaterQueryDto) {
    const { page = 1, limit = 20, filter, sortBy } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { userId };
    switch (filter) {
      case WatchLaterFilter.WATCHED:
        where.watched = true;
        break;
      case WatchLaterFilter.UNWATCHED:
        where.watched = false;
        break;
    }

    // Build order by
    const orderBy: Record<string, string> = {};
    switch (sortBy) {
      case WatchLaterSortBy.OLDEST:
        orderBy.createdAt = 'asc';
        break;
      case WatchLaterSortBy.RECENTLY_ADDED:
      default:
        orderBy.createdAt = 'desc';
    }

    const [watchLaterList, total, stats] = await Promise.all([
      this.prisma.watchLater.findMany({
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
            },
          },
        },
      }),
      this.prisma.watchLater.count({ where }),
      this.getWatchLaterStats(userId),
    ]);

    return {
      data: watchLaterList,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    };
  }

  async getWatchLaterStats(userId: string) {
    const [total, watched] = await Promise.all([
      this.prisma.watchLater.count({ where: { userId } }),
      this.prisma.watchLater.count({ where: { userId, watched: true } }),
    ]);

    return {
      total,
      watched,
      unwatched: total - watched,
    };
  }

  async isInWatchLater(userId: string, videoId: string): Promise<boolean> {
    const watchLater = await this.prisma.watchLater.findUnique({
      where: {
        userId_videoId: { userId, videoId },
      },
    });
    return !!watchLater;
  }

  // ============ VIDEO STATUS CHECK ============

  async getVideoStatus(userId: string, videoId: string) {
    const [isFavorited, isInWatchLater] = await Promise.all([
      this.isVideoFavorited(userId, videoId),
      this.isInWatchLater(userId, videoId),
    ]);

    return {
      isFavorited,
      isInWatchLater,
    };
  }
}
