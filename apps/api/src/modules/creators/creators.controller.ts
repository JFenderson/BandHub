import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatorsService } from './creators.service';
import { CreatorQueryDto, CreateCreatorDto, UpdateCreatorDto } from './dto';
import { VideoQueryDto } from '../videos/dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '@hbcu-band-hub/prisma';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('Creators')
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get()
  @ApiOperation({ summary: 'List verified content creators' })
  async list(@Query() query: CreatorQueryDto) {
    return this.creatorsService.listCreators(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'List featured creators' })
  async featured() {
    return this.creatorsService.getFeaturedCreators();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single creator with stats' })
  async getCreator(@Param('id') id: string) {
    return this.creatorsService.getCreatorById(id);
  }

  @Get(':id/videos')
  @ApiOperation({ summary: 'Get videos for a creator' })
  async getVideos(@Param('id') id: string, @Query() query: VideoQueryDto) {
    return this.creatorsService.getCreatorVideos(id, query);
  }
}

@ApiTags('Admin Creators')
@Controller('admin/creators')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminCreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new content creator' })
  @ApiResponse({ status: 201, description: 'Creator created successfully' })
  async create(@Body() dto: CreateCreatorDto, @CurrentUser() _user: CurrentUserData) {
    return this.creatorsService.createCreator(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing creator' })
  async update(@Param('id') id: string, @Body() dto: UpdateCreatorDto, @CurrentUser() _user: CurrentUserData) {
    return this.creatorsService.updateCreator(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a creator' })
  async delete(@Param('id') id: string, @CurrentUser() _user: CurrentUserData) {
    return this.creatorsService.deleteCreator(id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger incremental creator sync' })
  async sync(@Param('id') id: string) {
    return this.creatorsService.syncCreator(id, false);
  }

  @Post(':id/full-sync')
  @ApiOperation({ summary: 'Trigger full creator sync' })
  async fullSync(@Param('id') id: string) {
    return this.creatorsService.syncCreator(id, true);
  }
}
