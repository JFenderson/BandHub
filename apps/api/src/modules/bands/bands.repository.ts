import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import { BandQueryDto, CreateBandDto, UpdateBandDto } from './dto';
import { generateSlug } from '@hbcu-band-hub/shared';

@Injectable()
export class BandsRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(query: BandQueryDto) {
    const { 
      conference, 
      state, 
      isActive, 
      isFeatured, 
      search, 
      page = 1, 
      limit = 20, 
      sortBy = 'name', 
      sortOrder = 'asc' 
    } = query;

    const where: Prisma.BandWhereInput = {};

    if (conference) {
      where.conference = conference;
    }

    if (state) {
      where.state = state;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { schoolName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const orderBy: Prisma.BandOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    const [bands, total] = await Promise.all([
      this.prisma.band.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { videos: true },
          },
        },
      }),
      this.prisma.band.count({ where }),
    ]);

    return {
      data: bands.map((band) => ({
        ...band,
        videoCount: band._count.videos,
      })),
      total,
      page,
      limit,
    };
  }

  async findById(id: string) {
    return this.prisma.band.findUnique({
      where: { id },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.band.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });
  }

  async create(data: CreateBandDto) {
    const slug = generateSlug(data.name);
    
    return this.prisma.band.create({
      data: {
        name: data.name,
        slug,
        schoolName: data.schoolName,
        city: data.city,
        state: data.state,
        conference: data.conference,
        logoUrl: data.logoUrl,
        bannerUrl: data.bannerUrl,
        description: data.description,
        foundedYear: data.foundedYear,
        youtubeChannelId: data.youtubeChannelId,
        youtubePlaylistIds: data.youtubePlaylistIds ?? [],
      },
    });
  }

  async update(id: string, data: UpdateBandDto) {
    const updateData: Prisma.BandUpdateInput = {};

    // Only include fields that are provided
    if (data.name !== undefined) {
      updateData.name = data.name;
      updateData.slug = generateSlug(data.name);
    }
    if (data.schoolName !== undefined) updateData.schoolName = data.schoolName;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.conference !== undefined) updateData.conference = data.conference;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.foundedYear !== undefined) updateData.foundedYear = data.foundedYear;
    if (data.youtubeChannelId !== undefined) updateData.youtubeChannelId = data.youtubeChannelId;
    if (data.youtubePlaylistIds !== undefined) updateData.youtubePlaylistIds = data.youtubePlaylistIds;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;

    return this.prisma.band.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    return this.prisma.band.delete({
      where: { id },
    });
  }

  async findAllForSync() {
    return this.prisma.band.findMany({
      where: {
        isActive: true,
        OR: [
          { youtubeChannelId: { not: null } },
          { youtubePlaylistIds: { isEmpty: false } },
        ],
      },
      select: {
        id: true,
        name: true,
        youtubeChannelId: true,
        youtubePlaylistIds: true,
      },
    });
  }
}