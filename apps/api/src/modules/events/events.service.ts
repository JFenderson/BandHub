import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { Prisma, EventType } from '@prisma/client';
import { CreateEventDto, UpdateEventDto, EventFilterDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a URL-friendly slug from event name
   */
  private generateSlug(name: string, year: number): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `${baseSlug}-${year}`;
  }

  /**
   * Get all events with filtering and pagination
   */
  async getEvents(filterDto: EventFilterDto) {
    const {
      eventType,
      year,
      state,
      search,
      isActive,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'eventDate',
      sortOrder = 'desc',
    } = filterDto;

    const where: Prisma.EventWhereInput = {};

    if (eventType) {
      where.eventType = eventType;
    }

    if (year) {
      where.year = year;
    }

    if (state) {
      where.state = state;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (startDate) {
      where.eventDate = {
        ...(where.eventDate as Prisma.DateTimeFilter),
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      where.eventDate = {
        ...(where.eventDate as Prisma.DateTimeFilter),
        lte: new Date(endDate),
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { venue: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          _count: {
            select: {
              eventVideos: true,
              eventBands: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single event by ID with full details
   */
  async getEventById(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        eventVideos: true,
        eventBands: true,
        _count: {
          select: {
            eventVideos: true,
            eventBands: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  /**
   * Get a single event by slug
   */
  async getEventBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        eventVideos: true,
        eventBands: true,
        _count: {
          select: {
            eventVideos: true,
            eventBands: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with slug ${slug} not found`);
    }

    return event;
  }

  /**
   * Create a new event
   */
  async createEvent(data: CreateEventDto) {
    const slug = this.generateSlug(data.name, data.year);

    // Check if slug already exists
    const existingEvent = await this.prisma.event.findUnique({
      where: { slug },
    });

    if (existingEvent) {
      throw new ConflictException(`Event with slug "${slug}" already exists`);
    }

    return this.prisma.event.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        eventType: data.eventType,
        eventDate: new Date(data.eventDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        location: data.location,
        venue: data.venue,
        city: data.city,
        state: data.state,
        year: data.year,
        isRecurring: data.isRecurring ?? false,
        imageUrl: data.imageUrl,
      },
      include: {
        _count: {
          select: {
            eventVideos: true,
            eventBands: true,
          },
        },
      },
    });
  }

  /**
   * Update an existing event
   */
  async updateEvent(id: string, data: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    const updateData: Prisma.EventUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
      // Regenerate slug if name or year changed
      const year = data.year ?? event.year;
      updateData.slug = this.generateSlug(data.name, year);
    }

    if (data.description !== undefined) updateData.description = data.description;
    if (data.eventType !== undefined) updateData.eventType = data.eventType;
    if (data.eventDate !== undefined) updateData.eventDate = new Date(data.eventDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.venue !== undefined) updateData.venue = data.venue;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.year !== undefined) {
      updateData.year = data.year;
      // Regenerate slug if year changed
      updateData.slug = this.generateSlug(data.name ?? event.name, data.year);
    }
    if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;

    return this.prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            eventVideos: true,
            eventBands: true,
          },
        },
      },
    });
  }

  /**
   * Delete an event
   */
  async deleteEvent(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    await this.prisma.event.delete({
      where: { id },
    });

    return { message: 'Event deleted successfully' };
  }

  /**
   * Associate a video with an event
   */
  async addVideoToEvent(eventId: string, videoId: string) {
    // Verify event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Check if association already exists
    const existingAssociation = await this.prisma.eventVideo.findUnique({
      where: {
        eventId_videoId: {
          eventId,
          videoId,
        },
      },
    });

    if (existingAssociation) {
      throw new ConflictException('Video is already associated with this event');
    }

    return this.prisma.eventVideo.create({
      data: {
        eventId,
        videoId,
      },
    });
  }

  /**
   * Remove a video from an event
   */
  async removeVideoFromEvent(eventId: string, videoId: string) {
    const association = await this.prisma.eventVideo.findUnique({
      where: {
        eventId_videoId: {
          eventId,
          videoId,
        },
      },
    });

    if (!association) {
      throw new NotFoundException('Video is not associated with this event');
    }

    await this.prisma.eventVideo.delete({
      where: {
        eventId_videoId: {
          eventId,
          videoId,
        },
      },
    });

    return { message: 'Video removed from event successfully' };
  }

  /**
   * Get all videos associated with an event
   */
  async getEventVideos(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const eventVideos = await this.prisma.eventVideo.findMany({
      where: { eventId },
      select: {
        videoId: true,
        createdAt: true,
      },
    });

    // Get full video details
    const videoIds = eventVideos.map((ev) => ev.videoId);
    const videos = await this.prisma.video.findMany({
      where: { id: { in: videoIds } },
      include: {
        band: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        category: true,
      },
    });

    return videos;
  }

  /**
   * Associate a band with an event
   */
  async addBandToEvent(eventId: string, bandId: string, role?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const existingAssociation = await this.prisma.eventBand.findUnique({
      where: {
        eventId_bandId: {
          eventId,
          bandId,
        },
      },
    });

    if (existingAssociation) {
      throw new ConflictException('Band is already associated with this event');
    }

    return this.prisma.eventBand.create({
      data: {
        eventId,
        bandId,
        role,
      },
    });
  }

  /**
   * Remove a band from an event
   */
  async removeBandFromEvent(eventId: string, bandId: string) {
    const association = await this.prisma.eventBand.findUnique({
      where: {
        eventId_bandId: {
          eventId,
          bandId,
        },
      },
    });

    if (!association) {
      throw new NotFoundException('Band is not associated with this event');
    }

    await this.prisma.eventBand.delete({
      where: {
        eventId_bandId: {
          eventId,
          bandId,
        },
      },
    });

    return { message: 'Band removed from event successfully' };
  }

  /**
   * Get all bands associated with an event
   */
  async getEventBands(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const eventBands = await this.prisma.eventBand.findMany({
      where: { eventId },
      select: {
        bandId: true,
        role: true,
        createdAt: true,
      },
    });

    // Get full band details
    const bandIds = eventBands.map((eb) => eb.bandId);
    const bands = await this.prisma.band.findMany({
      where: { id: { in: bandIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        schoolName: true,
        city: true,
        state: true,
        logoUrl: true,
      },
    });

    // Merge with role information
    return bands.map((band) => {
      const eventBand = eventBands.find((eb) => eb.bandId === band.id);
      return {
        ...band,
        role: eventBand?.role,
      };
    });
  }

  /**
   * Get event types (for dropdown)
   */
  getEventTypes() {
    return Object.values(EventType);
  }

  /**
   * Get events by year for timeline view
   */
  async getEventsByYear(year: number) {
    return this.prisma.event.findMany({
      where: {
        year,
        isActive: true,
      },
      orderBy: { eventDate: 'asc' },
      include: {
        _count: {
          select: {
            eventVideos: true,
            eventBands: true,
          },
        },
      },
    });
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(limit: number = 10) {
    const now = new Date();
    return this.prisma.event.findMany({
      where: {
        eventDate: { gte: now },
        isActive: true,
      },
      orderBy: { eventDate: 'asc' },
      take: limit,
      include: {
        _count: {
          select: {
            eventVideos: true,
            eventBands: true,
          },
        },
      },
    });
  }
}
