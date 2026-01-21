import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SharingService } from './sharing.service';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import { CurrentUser, CurrentUserData } from '../users/decorators/current-user.decorator';
import { CreateShareDto, GetSharesQueryDto, ContentType } from './dto/sharing.dto';

@ApiTags('sharing')
@Controller({ path: 'sharing', version: '1' })
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Post('share')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Track a share event' })
  @ApiResponse({ status: 201, description: 'Share tracked successfully' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async trackShare(
    @CurrentUser() user: CurrentUserData | null,
    @Body() dto: CreateShareDto,
  ) {
    const userId = user?.userId || null;
    return this.sharingService.trackShare(userId, dto);
  }

  @Get(':contentType/:contentId')
  @ApiOperation({ summary: 'Get shares for content' })
  @ApiParam({ name: 'contentType', enum: ContentType })
  @ApiParam({ name: 'contentId', description: 'Content ID' })
  @ApiResponse({ status: 200, description: 'Shares retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async getShares(
    @Param('contentType') contentType: ContentType,
    @Param('contentId') contentId: string,
    @Query() query: GetSharesQueryDto,
  ) {
    return this.sharingService.getSharesByContent(contentType, contentId, query);
  }

  @Get(':contentType/:contentId/link')
  @ApiOperation({ summary: 'Generate shareable link for content' })
  @ApiParam({ name: 'contentType', enum: ContentType })
  @ApiParam({ name: 'contentId', description: 'Content ID' })
  @ApiResponse({ status: 200, description: 'Share link generated' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async getShareLink(
    @Param('contentType') contentType: ContentType,
    @Param('contentId') contentId: string,
  ) {
    const link = await this.sharingService.getShareLink(contentType, contentId);
    return { link };
  }

  @Get(':contentType/:contentId/stats')
  @ApiOperation({ summary: 'Get share statistics for content' })
  @ApiParam({ name: 'contentType', enum: ContentType })
  @ApiParam({ name: 'contentId', description: 'Content ID' })
  @ApiResponse({ status: 200, description: 'Share statistics retrieved' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async getShareStats(
    @Param('contentType') contentType: ContentType,
    @Param('contentId') contentId: string,
  ) {
    return this.sharingService.getShareStats(contentType, contentId);
  }
}
