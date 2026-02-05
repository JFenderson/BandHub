import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { GetPlaylistsQueryDto, AddVideoToPlaylistDto } from './dto/playlist-query.dto';
import { AchievementTrackerService } from '../achievements/achievement-tracker.service';

@Injectable()
export class PlaylistsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AchievementTrackerService))
    private achievementTracker: AchievementTrackerService,
  ) {}

  /**
   * Create a new playlist
   */
  async create(userId: string, createDto: CreatePlaylistDto) {
    const playlist = await this.prisma.playlist.create({
      data: {
        userId,
        name: createDto.name,
        description: createDto.description,
        coverImageUrl: createDto.coverImageUrl,
        isPublic: createDto.isPublic ?? true,
      },
      include: {
        _count: {
          select: { playlistVideos: true },
        },
      },
    });

    // Track achievement progress
    this.achievementTracker.trackPlaylistCreated(userId).catch(() => {});

    return {
      ...playlist,
      videoCount: playlist._count.playlistVideos,
    };
  }

  /**
   * Get user's playlists
   */
  async findUserPlaylists(userId: string, query: GetPlaylistsQueryDto) {
    const { page = 1, limit = 20, visibility = 'all' } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (visibility === 'public') {
      where.isPublic = true;
    } else if (visibility === 'private') {
      where.isPublic = false;
    }

    const [playlists, total] = await Promise.all([
      this.prisma.playlist.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { playlistVideos: true },
          },
        },
      }),
      this.prisma.playlist.count({ where }),
    ]);

    return {
      data: playlists.map((p) => ({
        ...p,
        videoCount: p._count.playlistVideos,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get playlist by ID
   */
  async findOne(playlistId: string, requestingUserId?: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        playlistVideos: {
          orderBy: { position: 'asc' },
          include: {
            video: {
              include: {
                band: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { playlistVideos: true },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Check if playlist is private and user doesn't own it
    if (!playlist.isPublic && playlist.userId !== requestingUserId) {
      throw new ForbiddenException('This playlist is private');
    }

    return {
      ...playlist,
      videoCount: playlist._count.playlistVideos,
      videos: playlist.playlistVideos.map((pv) => ({
        ...pv.video,
        addedAt: pv.addedAt,
        position: pv.position,
      })),
    };
  }

  /**
   * Update playlist
   */
  async update(playlistId: string, userId: string, updateDto: UpdatePlaylistDto) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException('You can only update your own playlists');
    }

    return this.prisma.playlist.update({
      where: { id: playlistId },
      data: updateDto,
      include: {
        _count: {
          select: { playlistVideos: true },
        },
      },
    });
  }

  /**
   * Delete playlist
   */
  async remove(playlistId: string, userId: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException('You can only delete your own playlists');
    }

    await this.prisma.playlist.delete({
      where: { id: playlistId },
    });

    return { message: 'Playlist deleted successfully' };
  }

  /**
   * Add video to playlist
   */
  async addVideo(
    playlistId: string,
    videoId: string,
    userId: string,
    dto?: AddVideoToPlaylistDto,
  ) {
    // Verify playlist exists and user owns it
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        playlistVideos: {
          orderBy: { position: 'desc' },
          take: 1,
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException('You can only add videos to your own playlists');
    }

    // Verify video exists
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Check if video is already in playlist
    const existing = await this.prisma.playlistVideo.findUnique({
      where: {
        playlistId_videoId: {
          playlistId,
          videoId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Video is already in this playlist');
    }

    // Determine position
    const position =
      dto?.position ??
      (playlist.playlistVideos.length > 0 ? playlist.playlistVideos[0].position + 1 : 0);

    // Add video to playlist
    const playlistVideo = await this.prisma.playlistVideo.create({
      data: {
        playlistId,
        videoId,
        position,
      },
      include: {
        video: true,
      },
    });

    return {
      message: 'Video added to playlist',
      playlistVideo,
    };
  }

  /**
   * Remove video from playlist
   */
  async removeVideo(playlistId: string, videoId: string, userId: string) {
    // Verify playlist exists and user owns it
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException('You can only remove videos from your own playlists');
    }

    // Remove video from playlist
    const result = await this.prisma.playlistVideo.deleteMany({
      where: {
        playlistId,
        videoId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Video not found in this playlist');
    }

    return { message: 'Video removed from playlist' };
  }

  /**
   * Reorder videos in playlist
   */
  async reorderVideos(playlistId: string, userId: string, videoIds: string[]) {
    // Verify playlist exists and user owns it
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        playlistVideos: true,
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException('You can only reorder your own playlists');
    }

    // Verify all videoIds are in the playlist
    const playlistVideoIds = new Set(playlist.playlistVideos.map((pv) => pv.videoId));
    for (const videoId of videoIds) {
      if (!playlistVideoIds.has(videoId)) {
        throw new BadRequestException(`Video ${videoId} is not in this playlist`);
      }
    }

    // Update positions
    await this.prisma.$transaction(
      videoIds.map((videoId, index) =>
        this.prisma.playlistVideo.updateMany({
          where: {
            playlistId,
            videoId,
          },
          data: {
            position: index,
          },
        }),
      ),
    );

    return { message: 'Playlist order updated' };
  }

  /**
   * Get public playlists (discover)
   */
  async findPublicPlaylists(query: GetPlaylistsQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [playlists, total] = await Promise.all([
      this.prisma.playlist.findMany({
        where: { isPublic: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
          _count: {
            select: { playlistVideos: true },
          },
        },
      }),
      this.prisma.playlist.count({ where: { isPublic: true } }),
    ]);

    return {
      data: playlists.map((p) => ({
        ...p,
        videoCount: p._count.playlistVideos,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
