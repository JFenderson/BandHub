import {
  Controller,
  Get,
  Req,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { BandsService } from '../services/bands.service';
import { FeaturedRecommendationsService } from '../services/featured-recommendations.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { diskStorage } from 'multer';
import { processUploadedImage } from '../../../common/utils/image-processing.util';
import { unlink } from 'fs/promises';
import { CreateBandDto, UpdateBandDto, BandQueryDto, UpdateFeaturedOrderDto } from '../dto';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitType } from '../../../common/interfaces/rate-limit.interface';

// Import AdminRole from generated Prisma client
import { AdminRole } from '@prisma/client';
import { ApiErrorDto } from '../../../common/dto/api-error.dto';

@ApiTags('Bands')
@Controller({ path: 'bands', version: '1' })
// Apply default public API rate limit to entire controller
@RateLimit({
  limit: 100,
  windowMs: 60 * 60 * 1000, // 1 hour
  type: RateLimitType.IP,
  message: 'Too many band requests. Please try again later.',
})
export class BandsController {
  constructor(
    private readonly bandsService: BandsService,
    private readonly featuredRecommendationsService: FeaturedRecommendationsService,
  ) {}

  // ========================================
  // PUBLIC ROUTES
  // ========================================

  @Get()
  @ApiOperation({ 
    summary: 'Get all bands', 
    description: 'Retrieve a paginated list of bands with optional filtering. Supports filtering by band type (HBCU or ALL_STAR).' 
  })
  @ApiResponse({ status: 200, description: 'Bands retrieved successfully' })
  @ApiResponse({ status: 429, description: 'Too many requests', type: ApiErrorDto })
  async findAll(@Query() query: BandQueryDto) {
    return this.bandsService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured bands for homepage carousel' })
  @ApiResponse({ status: 200, description: 'Featured bands retrieved successfully' })
  async getFeaturedBands() {
    return this.bandsService.getFeaturedBands();
  }

  @Get('all-stars')
  @ApiOperation({ 
    summary: 'Get all-star bands', 
    description: 'Retrieve all summer all-star marching bands. These are regional bands active during May-August.' 
  })
  @ApiResponse({ status: 200, description: 'All-star bands retrieved successfully' })
  async getAllStarBands() {
    return this.bandsService.getAllStarBands();
  }

  @Get('featured-recommendations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @RateLimit({
    limit: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    type: RateLimitType.USER,
    message: 'Admin rate limit exceeded.',
  })
  @ApiOperation({ summary: 'Get smart recommendations for bands to feature' })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved successfully' })
  async getFeaturedRecommendations() {
    const recommendations = await this.featuredRecommendationsService.getRecommendations();
    return { recommendations };
  }

  @Get('featured-analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @RateLimit({
    limit: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    type: RateLimitType.USER,
    message: 'Admin rate limit exceeded.',
  })
  @ApiOperation({ summary: 'Get featured bands analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getFeaturedAnalytics() {
    return this.bandsService.getFeaturedAnalytics();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a band by slug' })
  @ApiResponse({ status: 200, description: 'Band retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.bandsService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a band by ID' })
  @ApiResponse({ status: 200, description: 'Band retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async findOne(@Param('id') id: string) {
    return this.bandsService.findById(id);
  }

  // ========================================
  // MODERATOR ROUTES
  // ========================================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Create a new band', 
    description: 'Creates a new band profile (HBCU or ALL_STAR type). Restricted to Moderators and Super Admins.' 
  })
  @ApiResponse({ status: 201, description: 'Band created successfully', type: CreateBandDto })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorDto })
  @ApiResponse({ status: 403, description: 'Insufficient permissions', type: ApiErrorDto })
  async create(@Body() createBandDto: CreateBandDto, @CurrentUser() user: CurrentUserData) {
    return this.bandsService.create(createBandDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    limit: 500,
    windowMs: 60 * 60 * 1000, // 1 hour
    type: RateLimitType.USER,
    message: 'Admin write rate limit exceeded.',
  })
  @ApiOperation({ summary: 'Update a band' })
  @ApiResponse({ status: 200, description: 'Band updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async update(
    @Param('id') id: string,
    @Body() updateBandDto: UpdateBandDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.bandsService.update(id, updateBandDto);
  }

  // ========================================
  // SUPER_ADMIN ONLY ROUTES
  // ========================================

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({
    limit: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    type: RateLimitType.USER,
    message: 'Admin rate limit exceeded.',
  })
  @ApiOperation({ summary: 'Delete a band (SUPER_ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Band deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.bandsService.delete(id);
  }

  // ========================================
  // IMAGE UPLOAD ROUTES
  // ========================================

  @Post(':id/upload-logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: './uploads/logos',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `logo-${uniqueSuffix}.webp`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(
            new BadRequestException('Only image files (jpg, png, webp) are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
    }),
  )
  @RateLimit({
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    type: RateLimitType.USER,
    message: 'Too many logo uploads. Please try again later.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload band logo',
    description:
      'Uploads a band logo image. Image will be resized to 300x300px and converted to WebP format.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['logo'],
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPG, PNG, WebP). Max 5MB.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Logo uploaded successfully',
    schema: {
      example: {
        message: 'Logo uploaded successfully',
        logoUrl: '/uploads/logos/logo-123456.webp',
        band: { id: '123', name: 'Jackson State' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size', type: ApiErrorDto })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorDto })
  @ApiResponse({ status: 413, description: 'File too large', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Band not found' })
  @ApiResponse({ status: 429, description: 'Too many uploads' })
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Process image - resize to 300x300px and convert to WebP
      await processUploadedImage(file.path, {
        width: 300,
        height: 300,
        quality: 90,
      });

      // Update band with new logo URL
      const logoUrl = `/uploads/logos/${file.filename}`;
      const band = await this.bandsService.updateLogo(id, logoUrl);

      return {
        message: 'Logo uploaded successfully',
        logoUrl,
        band,
      };
    } catch (error) {
      // Clean up file on error
      try {
        await unlink(file.path);
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  @Post(':id/upload-banner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(
    FileInterceptor('banner', {
      storage: diskStorage({
        destination: './uploads/banners',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `banner-${uniqueSuffix}.webp`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(
            new BadRequestException('Only image files (jpg, png, webp) are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
    }),
  )
  @RateLimit({
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    type: RateLimitType.USER,
    message: 'Too many banner uploads. Please try again later.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload band banner' })
  @ApiResponse({ status: 200, description: 'Banner uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  @ApiResponse({ status: 429, description: 'Too many uploads' })
  async uploadBanner(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Process image - resize to 1600x900px and convert to WebP
      await processUploadedImage(file.path, {
        width: 1600,
        height: 900,
        quality: 90,
      });

      // Update band with new banner URL
      const bannerUrl = `/uploads/banners/${file.filename}`;
      const band = await this.bandsService.updateBanner(id, bannerUrl);

      return {
        message: 'Banner uploaded successfully',
        bannerUrl,
        band,
      };
    } catch (error) {
      // Clean up file on error
      try {
        await unlink(file.path);
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  @Post(':id/track-featured-click')
  @ApiOperation({ summary: 'Track click on featured band' })
  @ApiResponse({ status: 201, description: 'Click tracked successfully' })
  async trackFeaturedClick(@Param('id') id: string, @Body('sessionId') sessionId?: string) {
    return this.bandsService.trackFeaturedClick(id, sessionId);
  }

  // ========================================
  // ADMIN FEATURED BANDS ROUTES
  // ========================================

  @Patch(':id/featured')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @RateLimit({
    limit: 500,
    windowMs: 60 * 60 * 1000, // 1 hour
    type: RateLimitType.USER,
    message: 'Admin write rate limit exceeded.',
  })
  @ApiOperation({ summary: 'Toggle featured status for a band' })
  @ApiResponse({ status: 200, description: 'Featured status toggled successfully' })
  @ApiResponse({ status: 400, description: 'Max featured bands limit reached' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async toggleFeatured(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.bandsService.toggleFeatured(id);
  }

  @Patch('featured-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @RateLimit({
    limit: 500,
    windowMs: 60 * 60 * 1000, // 1 hour
    type: RateLimitType.USER,
    message: 'Admin write rate limit exceeded.',
  })
  @ApiOperation({ summary: 'Update featured bands order' })
  @ApiResponse({ status: 200, description: 'Featured order updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data' })
  async updateFeaturedOrder(
    @Body() data: UpdateFeaturedOrderDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.bandsService.updateFeaturedOrder({ bandIds: data.bands.map((b) => b.id) });
  }
}
