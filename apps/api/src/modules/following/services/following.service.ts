import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { GetFollowersQueryDto } from '../dto';
import { AchievementTrackerService } from '../../achievements/achievement-tracker.service';

@Injectable()
export class FollowingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AchievementTrackerService))
    private achievementTracker: AchievementTrackerService,
  ) {}

  async followUser(followerId: string, followingId: string) {
    // Prevent self-follow
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Verify user to follow exists
    const userToFollow = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!userToFollow) {
      throw new NotFoundException('User not found');
    }

    // Check if already following
    const existingFollow = await this.prisma.userFollower.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      throw new ConflictException('You are already following this user');
    }

    // Create follow relationship
    const follow = await this.prisma.userFollower.create({
      data: {
        followerId,
        followingId,
      },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Track achievement progress
    this.achievementTracker.trackUserFollowed(followerId).catch(() => {});

    return follow;
  }

  async unfollowUser(followerId: string, followingId: string) {
    // Prevent self-unfollow
    if (followerId === followingId) {
      throw new BadRequestException('You cannot unfollow yourself');
    }

    // Find follow relationship
    const follow = await this.prisma.userFollower.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!follow) {
      throw new NotFoundException('You are not following this user');
    }

    // Delete follow relationship
    await this.prisma.userFollower.delete({
      where: { id: follow.id },
    });

    return { message: 'Successfully unfollowed user' };
  }

  async getFollowers(userId: string, query: GetFollowersQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get followers with pagination
    const [followers, total] = await Promise.all([
      this.prisma.userFollower.findMany({
        where: { followingId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.userFollower.count({
        where: { followingId: userId },
      }),
    ]);

    return {
      data: followers.map((f) => ({
        ...f.follower,
        followedAt: f.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFollowing(userId: string, query: GetFollowersQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get following with pagination
    const [following, total] = await Promise.all([
      this.prisma.userFollower.findMany({
        where: { followerId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.userFollower.count({
        where: { followerId: userId },
      }),
    ]);

    return {
      data: following.map((f) => ({
        ...f.following,
        followedAt: f.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async isFollowing(followerId: string, followingId: string) {
    const follow = await this.prisma.userFollower.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return { isFollowing: !!follow };
  }

  async getFollowCounts(userId: string) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get counts
    const [followersCount, followingCount] = await Promise.all([
      this.prisma.userFollower.count({
        where: { followingId: userId },
      }),
      this.prisma.userFollower.count({
        where: { followerId: userId },
      }),
    ]);

    return {
      followersCount,
      followingCount,
    };
  }
}
