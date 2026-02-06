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
import { AddCollaboratorDto, PlaylistCollaboratorRole } from './dto/collaborator.dto';
import { CreateShareLinkDto } from './dto/share.dto';
import { randomBytes } from 'crypto';

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

    // Check if user is owner or has editor role
    const canEdit = await this.canEditPlaylist(playlistId, userId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to update this playlist');
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
    // Verify playlist exists and user can edit it
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

    const canEdit = await this.canEditPlaylist(playlistId, userId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to add videos to this playlist');
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
    // Verify playlist exists and user can edit it
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    const canEdit = await this.canEditPlaylist(playlistId, userId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to remove videos from this playlist');
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
    // Verify playlist exists and user can edit it
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        playlistVideos: true,
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    const canEdit = await this.canEditPlaylist(playlistId, userId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to reorder this playlist');
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

  /**
   * Helper: Check if user can edit playlist (owner or collaborator with EDITOR/OWNER role)
   */
  private async canEditPlaylist(playlistId: string, userId: string): Promise<boolean> {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        collaborators: {
          where: {
            userId,
            role: { in: [PlaylistCollaboratorRole.EDITOR, PlaylistCollaboratorRole.OWNER] },
          },
        },
      },
    });

    if (!playlist) return false;
    return playlist.userId === userId || playlist.collaborators.length > 0;
  }

  /**
   * Add collaborator to playlist
   */
  async addCollaborator(playlistId: string, userId: string, dto: AddCollaboratorDto) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException('Only the playlist owner can add collaborators');
    }

    if (dto.userId === userId) {
      throw new BadRequestException('Cannot add yourself as a collaborator');
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already a collaborator
    const existing = await this.prisma.playlistCollaborator.findUnique({
      where: {
        playlistId_userId: {
          playlistId,
          userId: dto.userId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a collaborator');
    }

    return this.prisma.playlistCollaborator.create({
      data: {
        playlistId,
        userId: dto.userId,
        role: dto.role || PlaylistCollaboratorRole.EDITOR,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  }

  /**
   * Remove collaborator from playlist
   */
  async removeCollaborator(playlistId: string, userId: string, collaboratorId: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException('Only the playlist owner can remove collaborators');
    }

    const result = await this.prisma.playlistCollaborator.deleteMany({
      where: {
        playlistId,
        userId: collaboratorId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Collaborator not found');
    }

    return { message: 'Collaborator removed successfully' };
  }

  /**
   * Get playlist collaborators
   */
  async getCollaborators(playlistId: string, requestingUserId?: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Only owner and collaborators can view the collaborators list
    if (!playlist.isPublic && playlist.userId !== requestingUserId) {
      const isCollaborator = playlist.collaborators.some(
        (c) => c.userId === requestingUserId,
      );
      if (!isCollaborator) {
        throw new ForbiddenException('Cannot view collaborators of private playlist');
      }
    }

    return playlist.collaborators;
  }

  /**
   * Generate share link for playlist
   */
  async generateShareLink(playlistId: string, userId: string, dto?: CreateShareLinkDto) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    const canEdit = await this.canEditPlaylist(playlistId, userId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to share this playlist');
    }

    // Generate unique token
    const token = randomBytes(16).toString('hex');

    // Create share link
    const share = await this.prisma.playlistShare.create({
      data: {
        playlistId,
        token,
        expiresAt: dto?.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    // Update playlist with share link
    await this.prisma.playlist.update({
      where: { id: playlistId },
      data: { shareLink: token },
    });

    return {
      shareLink: token,
      shareUrl: `/share/${token}`,
      expiresAt: share.expiresAt,
    };
  }

  /**
   * Get playlist by share token
   */
  async getPlaylistByShareToken(token: string) {
    const share = await this.prisma.playlistShare.findUnique({
      where: { token },
      include: {
        playlist: {
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
              select: { playlistVideos: true, followers: true },
            },
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundException('Share link not found');
    }

    if (share.revokedAt) {
      throw new ForbiddenException('This share link has been revoked');
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ForbiddenException('This share link has expired');
    }

    // Increment view count
    await this.prisma.playlistShare.update({
      where: { token },
      data: { views: { increment: 1 } },
    });

    return {
      ...share.playlist,
      videoCount: share.playlist._count.playlistVideos,
      followerCount: share.playlist._count.followers,
      videos: share.playlist.playlistVideos.map((pv) => ({
        ...pv.video,
        addedAt: pv.addedAt,
        position: pv.position,
      })),
    };
  }

  /**
   * Revoke share link
   */
  async revokeShareLink(playlistId: string, userId: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    const canEdit = await this.canEditPlaylist(playlistId, userId);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to revoke the share link');
    }

    if (!playlist.shareLink) {
      throw new BadRequestException('Playlist does not have a share link');
    }

    // Revoke the share
    await this.prisma.playlistShare.updateMany({
      where: {
        playlistId,
        token: playlist.shareLink,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Remove share link from playlist
    await this.prisma.playlist.update({
      where: { id: playlistId },
      data: { shareLink: null },
    });

    return { message: 'Share link revoked successfully' };
  }

  /**
   * Follow a public playlist
   */
  async followPlaylist(playlistId: string, userId: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (!playlist.isPublic) {
      throw new ForbiddenException('Cannot follow private playlists');
    }

    if (playlist.userId === userId) {
      throw new BadRequestException('Cannot follow your own playlist');
    }

    // Check if already following
    const existing = await this.prisma.playlistFollower.findUnique({
      where: {
        playlistId_userId: {
          playlistId,
          userId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Already following this playlist');
    }

    await this.prisma.playlistFollower.create({
      data: {
        playlistId,
        userId,
      },
    });

    return { message: 'Playlist followed successfully' };
  }

  /**
   * Unfollow a playlist
   */
  async unfollowPlaylist(playlistId: string, userId: string) {
    const result = await this.prisma.playlistFollower.deleteMany({
      where: {
        playlistId,
        userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Not following this playlist');
    }

    return { message: 'Playlist unfollowed successfully' };
  }

  /**
   * Get playlist followers
   */
  async getFollowers(playlistId: string, requestingUserId?: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        followers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Only owner can view followers list
    if (playlist.userId !== requestingUserId) {
      throw new ForbiddenException('Only the playlist owner can view followers');
    }

    return playlist.followers.map((f) => ({
      ...f.user,
      followedAt: f.followedAt,
    }));
  }

  /**
   * Get featured playlists
   */
  async getFeaturedPlaylists(query: GetPlaylistsQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [playlists, total] = await Promise.all([
      this.prisma.playlist.findMany({
        where: { isFeatured: true, isPublic: true },
        skip,
        take: limit,
        orderBy: { featuredAt: 'desc' },
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
            select: { playlistVideos: true, followers: true },
          },
        },
      }),
      this.prisma.playlist.count({ where: { isFeatured: true, isPublic: true } }),
    ]);

    return {
      data: playlists.map((p) => ({
        ...p,
        videoCount: p._count.playlistVideos,
        followerCount: p._count.followers,
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
   * Mark playlist as featured (Admin only - checked in controller)
   */
  async markAsFeatured(playlistId: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (!playlist.isPublic) {
      throw new BadRequestException('Only public playlists can be featured');
    }

    if (playlist.isFeatured) {
      throw new ConflictException('Playlist is already featured');
    }

    return this.prisma.playlist.update({
      where: { id: playlistId },
      data: {
        isFeatured: true,
        featuredAt: new Date(),
      },
    });
  }

  /**
   * Unmark playlist as featured (Admin only - checked in controller)
   */
  async unmarkAsFeatured(playlistId: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (!playlist.isFeatured) {
      throw new BadRequestException('Playlist is not featured');
    }

    return this.prisma.playlist.update({
      where: { id: playlistId },
      data: {
        isFeatured: false,
        featuredAt: null,
      },
    });
  }
}
