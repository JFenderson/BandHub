import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { UserAuthGuard } from '../users/guards/user-auth.guard';
import { CurrentUser, CurrentUserData } from '../users/decorators/current-user.decorator';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { LikeCommentDto } from './dto/like-comment.dto';

@ApiTags('comments')
@Controller({ version: '1' })
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('videos/:videoId/comments')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a comment on a video' })
  @ApiParam({ name: 'videoId', description: 'Video ID' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async createComment(
    @Param('videoId') videoId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(videoId, user.userId, dto);
  }

  @Get('videos/:videoId/comments')
  @ApiOperation({ summary: 'Get comments for a video' })
  @ApiParam({ name: 'videoId', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'List of comments' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async getVideoComments(
    @Param('videoId') videoId: string,
    @Query() query: GetCommentsQueryDto,
  ) {
    return this.commentsService.findByVideo(videoId, query);
  }

  @Put('comments/:id')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your comment' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async updateComment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, user.userId, dto);
  }

  @Delete('comments/:id')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a comment (soft delete)' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your comment' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async deleteComment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.commentsService.remove(id, user.userId);
  }

  @Post('comments/:id/like')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like or dislike a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({ status: 201, description: 'Comment liked/disliked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async likeComment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: LikeCommentDto,
  ) {
    return this.commentsService.likeComment(id, user.userId, dto.isLike);
  }

  @Delete('comments/:id/like')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove like/dislike from a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Like/dislike removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async unlikeComment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.commentsService.unlikeComment(id, user.userId);
  }

  @Get('comments/:id/replies')
  @ApiOperation({ summary: 'Get replies to a comment' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'List of replies' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async getCommentReplies(
    @Param('id') id: string,
    @Query() query: GetCommentsQueryDto,
  ) {
    return this.commentsService.getReplies(id, query);
  }
}
