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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BandsService } from './bands.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

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
}