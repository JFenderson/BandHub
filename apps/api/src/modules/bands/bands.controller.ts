import {
  Controller,
  Get,
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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { BandsService } from './bands.service';
import { FeaturedRecommendationsService } from './featured-recommendations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { diskStorage } from 'multer';
import { processUploadedImage } from '../../common/utils/image-processing.util';
import { unlink } from 'fs/promises';
import { UpdateFeaturedOrderDto } from './dto';

// Import AdminRole from generated Prisma client
import { AdminRole } from '@prisma/client';

@ApiTags('Bands')
@Controller('bands')
export class BandsController {
  constructor(
    private readonly bandsService: BandsService,
    private readonly featuredRecommendationsService: FeaturedRecommendationsService,
  ) {}

  // ========================================
  // PUBLIC ROUTES
  // ========================================

  @Get()
  @ApiOperation({ summary: 'Get all bands with pagination' })
  @ApiResponse({ status: 200, description: 'Bands retrieved successfully' })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ) {
    return this.bandsService.findAll({
      page: Number(page),
      limit: Number(limit),
      search,
    });
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured bands for homepage carousel' })
  @ApiResponse({ status: 200, description: 'Featured bands retrieved successfully' })
  async getFeaturedBands() {
    return this.bandsService.getFeaturedBands();
  }

    @Get('featured-recommendations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
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
  @ApiOperation({ summary: 'Create a new band' })
  @ApiResponse({ status: 201, description: 'Band created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(
    @Body() createBandDto: any,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.bandsService.create(createBandDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a band' })
  @ApiResponse({ status: 200, description: 'Band updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async update(
    @Param('id') id: string,
    @Body() updateBandDto: any,
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
  @ApiOperation({ summary: 'Delete a band (SUPER_ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Band deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
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
          return cb(new BadRequestException('Only image files (jpg, png, webp) are allowed'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload band logo' })
  @ApiResponse({ status: 200, description: 'Logo uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Band not found' })
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
          return cb(new BadRequestException('Only image files (jpg, png, webp) are allowed'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload band banner' })
  @ApiResponse({ status: 200, description: 'Banner uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Band not found' })
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
  async trackFeaturedClick(
    @Param('id') id: string,
    @Body('sessionId') sessionId?: string,
  ) {
    return this.bandsService.trackFeaturedClick(id, sessionId);
  }

  // ========================================
  // ADMIN FEATURED BANDS ROUTES
  // ========================================

  @Patch(':id/featured')
  @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(AdminRole.ADMIN, AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
    @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Toggle featured status for a band' })
  @ApiResponse({ status: 200, description: 'Featured status toggled successfully' })
  @ApiResponse({ status: 400, description: 'Max featured bands limit reached' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async toggleFeatured(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.bandsService.toggleFeatured(id);
  }

  @Patch('featured-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
 @Roles(AdminRole.ADMIN, AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update featured bands order' })
  @ApiResponse({ status: 200, description: 'Featured order updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data' })
  async updateFeaturedOrder(
    @Body() data: UpdateFeaturedOrderDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.bandsService.updateFeaturedOrder(data);
  }


}