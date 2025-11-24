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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { BandsService } from './bands.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as sharp from 'sharp';
import { unlink } from 'fs/promises';
import { join } from 'path';

// Import AdminRole from generated Prisma client
import { AdminRole } from '@hbcu-band-hub/prisma';

@ApiTags('Bands')
@Controller('bands')
export class BandsController {
  constructor(private readonly bandsService: BandsService) {}

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

  @Get(':id')
  @ApiOperation({ summary: 'Get a band by ID' })
  @ApiResponse({ status: 200, description: 'Band retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async findOne(@Param('id') id: string) {
    return this.bandsService.findById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a band by slug' })
  @ApiResponse({ status: 200, description: 'Band retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.bandsService.findBySlug(slug);
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
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
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
      // Process image with sharp - resize to 300x300px and convert to WebP
      const processedPath = file.path;
      await sharp(file.path)
        .resize(300, 300, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 90 })
        .toFile(processedPath + '.tmp');

      // Replace original with processed
      await unlink(processedPath);
      await sharp(processedPath + '.tmp').toFile(processedPath);
      await unlink(processedPath + '.tmp');

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
  @Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
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
      // Process image with sharp - resize to 1600x900px and convert to WebP
      const processedPath = file.path;
      await sharp(file.path)
        .resize(1600, 900, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 90 })
        .toFile(processedPath + '.tmp');

      // Replace original with processed
      await unlink(processedPath);
      await sharp(processedPath + '.tmp').toFile(processedPath);
      await unlink(processedPath + '.tmp');

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
}