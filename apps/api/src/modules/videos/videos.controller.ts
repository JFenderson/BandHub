import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { CreateVideoDto, UpdateVideoDto, VideoQueryDto } from './dto';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  @ApiOperation({ summary: 'Get all videos with filtering and search' })
  @ApiResponse({ status: 200, description: 'Videos retrieved successfully' })
  @ApiQuery({ name: 'bandId', required: false, description: 'Filter by band ID' })
  @ApiQuery({ name: 'bandSlug', required: false, description: 'Filter by band slug' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category ID' })
  @ApiQuery({ name: 'categorySlug', required: false, description: 'Filter by category slug' })
  @ApiQuery({ name: 'opponentBandId', required: false, description: 'Filter by opponent band' })
  @ApiQuery({ name: 'eventYear', required: false, description: 'Filter by event year' })
  @ApiQuery({ name: 'eventName', required: false, description: 'Filter by event name' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in titles, descriptions, and tags' })
  @ApiQuery({ name: 'tags', required: false, description: 'Filter by tags (comma-separated)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['publishedAt', 'viewCount', 'title', 'createdAt'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20, max: 100)' })
  async findAll(@Query() query: VideoQueryDto) {
    return this.videosService.findAll(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search videos with advanced full-text search' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Search query too short' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query (minimum 2 characters)' })
  @ApiQuery({ name: 'bandId', required: false, description: 'Filter results by band ID' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter results by category ID' })
  @ApiQuery({ name: 'eventYear', required: false, description: 'Filter results by event year' })
  async search(
    @Query('q') query: string,
    @Query('bandId') bandId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('eventYear') eventYear?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const filters = {
      bandId,
      categoryId,
      eventYear,
      page,
      limit,
    };

    return this.videosService.search(query, filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get video statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats() {
    return this.videosService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a video by ID' })
  @ApiResponse({ status: 200, description: 'Video found' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  async findById(@Param('id') id: string) {
    return this.videosService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new video (typically used by sync jobs)' })
  @ApiResponse({ status: 201, description: 'Video created successfully' })
  @ApiResponse({ status: 400, description: 'Video already exists or invalid data' })
  async create(@Body() createVideoDto: CreateVideoDto) {
    return this.videosService.create(createVideoDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update video metadata' })
  @ApiResponse({ status: 200, description: 'Video updated successfully' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  async update(@Param('id') id: string, @Body() updateVideoDto: UpdateVideoDto) {
    return this.videosService.update(id, updateVideoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a video' })
  @ApiResponse({ status: 200, description: 'Video deleted successfully' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    return this.videosService.delete(id);
  }

  // Admin endpoints (will require authentication in the future)
  @Get('admin/hidden')
  @ApiOperation({ summary: 'Get all hidden videos (admin only)' })
  @ApiResponse({ status: 200, description: 'Hidden videos retrieved' })
  // @UseGuards(AdminGuard) // TODO: Add when auth is implemented
  async findHidden() {
    return this.videosService.findHidden();
  }

  @Put(':id/hide')
  @ApiOperation({ summary: 'Hide a video (admin only)' })
  @ApiResponse({ status: 200, description: 'Video hidden successfully' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  // @UseGuards(AdminGuard) // TODO: Add when auth is implemented
  async hideVideo(
    @Param('id') id: string,
    @Body('reason') reason: string = 'Hidden by admin',
  ) {
    return this.videosService.hideVideo(id, reason);
  }

  @Put(':id/unhide')
  @ApiOperation({ summary: 'Unhide a video (admin only)' })
  @ApiResponse({ status: 200, description: 'Video unhidden successfully' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  // @UseGuards(AdminGuard) // TODO: Add when auth is implemented
  async unhideVideo(@Param('id') id: string) {
    return this.videosService.unhideVideo(id);
  }

  @Put(':id/categorize')
  @ApiOperation({ summary: 'Set video category and metadata (admin only)' })
  @ApiResponse({ status: 200, description: 'Video categorized successfully' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  // @UseGuards(AdminGuard) // TODO: Add when auth is implemented
  async categorizeVideo(
    @Param('id') id: string,
    @Body() metadata: {
      categoryId?: string;
      opponentBandId?: string;
      eventName?: string;
      eventYear?: number;
      tags?: string[];
      qualityScore?: number;
    },
  ) {
    return this.videosService.update(id, metadata);
  }

  @Put(':id/quality')
  @ApiOperation({ summary: 'Update video quality score (admin only)' })
  @ApiResponse({ status: 200, description: 'Quality score updated' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  // @UseGuards(AdminGuard) // TODO: Add when auth is implemented
  async updateQuality(
    @Param('id') id: string,
    @Body('qualityScore') qualityScore: number,
  ) {
    return this.videosService.update(id, { qualityScore });
  }
}