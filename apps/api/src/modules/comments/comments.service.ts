import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { AchievementTrackerService } from '../achievements/achievement-tracker.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AchievementTrackerService))
    private achievementTracker: AchievementTrackerService,
  ) {}

  /**
   * Create a new comment
   */
  async create(videoId: string, userId: string, dto: CreateCommentDto) {
    // Verify video exists
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // If parentId is provided, verify parent comment exists and belongs to same video
    if (dto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }

      if (parentComment.videoId !== videoId) {
        throw new BadRequestException('Parent comment does not belong to this video');
      }

      if (parentComment.isDeleted) {
        throw new BadRequestException('Cannot reply to deleted comment');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        videoId,
        userId,
        content: dto.content,
        parentId: dto.parentId,
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
        _count: {
          select: { 
            replies: {
              where: { isDeleted: false },
            },
          },
        },
      },
    });

    // Track achievement progress
    this.achievementTracker.trackCommentPosted(userId).catch(() => {});

    return {
      ...comment,
      replyCount: comment._count.replies,
    };
  }

  /**
   * Get comments for a video with pagination
   */
  async findByVideo(videoId: string, query: GetCommentsQueryDto) {
    const { page = 1, limit = 20, sortBy = 'newest' } = query;
    const skip = (page - 1) * limit;

    // Verify video exists
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Build orderBy based on sortBy parameter
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'popular') {
      orderBy = { likeCount: 'desc' };
    }

    const where = {
      videoId,
      parentId: null, // Only get top-level comments
      isDeleted: false,
    };

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
            select: { 
              replies: {
                where: { isDeleted: false },
              },
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      data: comments.map((c) => ({
        ...c,
        replyCount: c._count.replies,
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
   * Update a comment
   */
  async update(commentId: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.isDeleted) {
      throw new BadRequestException('Cannot update deleted comment');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only update your own comments');
    }

    const updatedComment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        isEdited: true,
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
        _count: {
          select: { 
            replies: {
              where: { isDeleted: false },
            },
          },
        },
      },
    });

    return {
      ...updatedComment,
      replyCount: updatedComment._count.replies,
    };
  }

  /**
   * Delete a comment (soft delete)
   */
  async remove(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.isDeleted) {
      throw new BadRequestException('Comment already deleted');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        isDeleted: true,
        content: '[deleted]',
      },
    });

    return { message: 'Comment deleted successfully' };
  }

  /**
   * Like or dislike a comment
   */
  async likeComment(commentId: string, userId: string, isLike: boolean) {
    // Verify comment exists
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.isDeleted) {
      throw new BadRequestException('Cannot like deleted comment');
    }

    // Check if user already liked/disliked this comment
    const existingLike = await this.prisma.commentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    });

    if (existingLike) {
      // If same action, return success for idempotency
      if (existingLike.isLike === isLike) {
        return { message: isLike ? 'Comment liked' : 'Comment disliked' };
      }

      // If different action, update the like/dislike
      await this.prisma.$transaction(async (tx) => {
        // Update the like record
        await tx.commentLike.update({
          where: {
            commentId_userId: {
              commentId,
              userId,
            },
          },
          data: { isLike },
        });

        // Update comment counts
        if (isLike) {
          // Changed from dislike to like
          const currentComment = await tx.comment.findUnique({
            where: { id: commentId },
            select: { dislikeCount: true },
          });
          await tx.comment.update({
            where: { id: commentId },
            data: {
              likeCount: { increment: 1 },
              dislikeCount: Math.max(0, (currentComment?.dislikeCount || 0) - 1),
            },
          });
        } else {
          // Changed from like to dislike
          const currentComment = await tx.comment.findUnique({
            where: { id: commentId },
            select: { likeCount: true },
          });
          await tx.comment.update({
            where: { id: commentId },
            data: {
              likeCount: Math.max(0, (currentComment?.likeCount || 0) - 1),
              dislikeCount: { increment: 1 },
            },
          });
        }
      });

      return { message: isLike ? 'Comment liked' : 'Comment disliked' };
    }

    // Create new like/dislike
    await this.prisma.$transaction(async (tx) => {
      await tx.commentLike.create({
        data: {
          commentId,
          userId,
          isLike,
        },
      });

      // Update comment counts
      if (isLike) {
        await tx.comment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } },
        });
      } else {
        await tx.comment.update({
          where: { id: commentId },
          data: { dislikeCount: { increment: 1 } },
        });
      }
    });

    return { message: isLike ? 'Comment liked' : 'Comment disliked' };
  }

  /**
   * Remove like/dislike from a comment
   */
  async unlikeComment(commentId: string, userId: string) {
    // Verify comment exists
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check if user has liked/disliked this comment
    const existingLike = await this.prisma.commentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    });

    if (!existingLike) {
      throw new BadRequestException('You have not liked/disliked this comment');
    }

    // Remove the like/dislike and update counts
    await this.prisma.$transaction(async (tx) => {
      await tx.commentLike.delete({
        where: {
          commentId_userId: {
            commentId,
            userId,
          },
        },
      });

      // Get current counts and update safely
      const currentComment = await tx.comment.findUnique({
        where: { id: commentId },
        select: { likeCount: true, dislikeCount: true },
      });

      if (existingLike.isLike) {
        await tx.comment.update({
          where: { id: commentId },
          data: { likeCount: Math.max(0, (currentComment?.likeCount || 0) - 1) },
        });
      } else {
        await tx.comment.update({
          where: { id: commentId },
          data: { dislikeCount: Math.max(0, (currentComment?.dislikeCount || 0) - 1) },
        });
      }
    });

    return { message: 'Like/dislike removed successfully' };
  }

  /**
   * Get replies to a comment
   */
  async getReplies(commentId: string, query: GetCommentsQueryDto) {
    const { page = 1, limit = 20, sortBy = 'newest' } = query;
    const skip = (page - 1) * limit;

    // Verify parent comment exists
    const parentComment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!parentComment) {
      throw new NotFoundException('Comment not found');
    }

    // Build orderBy based on sortBy parameter
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'popular') {
      orderBy = { likeCount: 'desc' };
    }

    const where = {
      parentId: commentId,
      isDeleted: false,
    };

    const [replies, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
            select: { 
              replies: {
                where: { isDeleted: false },
              },
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      data: replies.map((r) => ({
        ...r,
        replyCount: r._count.replies,
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
