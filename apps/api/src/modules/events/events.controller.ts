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
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';
import {
  CreateEventDto,
  UpdateEventDto,
  EventFilterDto,
  AddEventVideoDto,
  AddEventBandDto,
} from './dto/event.dto';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ========================================
  // PUBLIC ROUTES
  // ========================================

  @Get()
  @ApiOperation({ summary: 'Get all events with filtering' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  async findAll(@Query() filterDto: EventFilterDto) {
    return this.eventsService.getEvents(filterDto);
  }

  @Get('types')
  @ApiOperation({ summary: 'Get all event types' })
  @ApiResponse({ status: 200, description: 'Event types retrieved successfully' })
  getEventTypes() {
    return this.eventsService.getEventTypes();
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming events' })
  @ApiResponse({ status: 200, description: 'Upcoming events retrieved successfully' })
  async getUpcoming(@Query('limit') limit?: number) {
    return this.eventsService.getUpcomingEvents(limit ? parseInt(String(limit), 10) : 10);
  }

  @Get('year/:year')
  @ApiOperation({ summary: 'Get events by year' })
  @ApiResponse({ status: 200, description: 'Events for year retrieved successfully' })
  async getByYear(@Param('year') year: string) {
    return this.eventsService.getEventsByYear(parseInt(year, 10));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string) {
    return this.eventsService.getEventById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get event by slug' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.eventsService.getEventBySlug(slug);
  }

  @Get(':id/videos')
  @ApiOperation({ summary: 'Get videos associated with an event' })
  @ApiResponse({ status: 200, description: 'Event videos retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventVideos(@Param('id') id: string) {
    return this.eventsService.getEventVideos(id);
  }

  @Get(':id/bands')
  @ApiOperation({ summary: 'Get bands associated with an event' })
  @ApiResponse({ status: 200, description: 'Event bands retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventBands(@Param('id') id: string) {
    return this.eventsService.getEventBands(id);
  }

  // ========================================
  // ADMIN/MODERATOR ROUTES
  // ========================================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new event (Admin/Moderator only)' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Event with slug already exists' })
  async create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.createEvent(createEventDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an event (Admin/Moderator only)' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.updateEvent(id, updateEventDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an event (Admin only)' })
  @ApiResponse({ status: 204, description: 'Event deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async delete(@Param('id') id: string) {
    await this.eventsService.deleteEvent(id);
  }

  @Post(':id/videos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a video to an event' })
  @ApiResponse({ status: 201, description: 'Video added to event successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 409, description: 'Video already associated with event' })
  async addVideo(@Param('id') id: string, @Body() dto: AddEventVideoDto) {
    return this.eventsService.addVideoToEvent(id, dto.videoId);
  }

  @Delete(':id/videos/:videoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a video from an event' })
  @ApiResponse({ status: 200, description: 'Video removed from event successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Association not found' })
  async removeVideo(@Param('id') id: string, @Param('videoId') videoId: string) {
    return this.eventsService.removeVideoFromEvent(id, videoId);
  }

  @Post(':id/bands')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a band to an event' })
  @ApiResponse({ status: 201, description: 'Band added to event successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 409, description: 'Band already associated with event' })
  async addBand(@Param('id') id: string, @Body() dto: AddEventBandDto) {
    return this.eventsService.addBandToEvent(id, dto.bandId, dto.role);
  }

  @Delete(':id/bands/:bandId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a band from an event' })
  @ApiResponse({ status: 200, description: 'Band removed from event successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Association not found' })
  async removeBand(@Param('id') id: string, @Param('bandId') bandId: string) {
    return this.eventsService.removeBandFromEvent(id, bandId);
  }
}
