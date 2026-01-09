import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bandhub/database';
import { VideosRepository } from '../videos/videos.repository';
import { SyncService } from '../sync/sync.service';
import { CreatorQueryDto, CreateCreatorDto, UpdateCreatorDto } from './dto';
import { VideoQueryDto } from '../videos/dto';

@Injectable()
export class CreatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly videosRepository: VideosRepository,
    private readonly syncService: SyncService,
  ) {}

  async listCreators(query: CreatorQueryDto) {
    const {
      search,
      isFeatured,
      isVerified = true,
      sortBy = 'qualityScore',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query;

    const where: any = {};

    if (isVerified !== undefined) {
      where.isVerified = isVerified;
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const skip = (page - 1) * limit;
    const [creators, total] = await Promise.all([
      this.prisma.contentCreator.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          _count: { select: { videos: true } },
        },
      }),
      this.prisma.contentCreator.count({ where }),
    ]);

    return {
      data: creators,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFeaturedCreators() {
    return this.listCreators({ isFeatured: true, isVerified: true, page: 1, limit: 50, sortBy: 'qualityScore', sortOrder: 'desc' });
  }

  async getCreatorById(id: string) {
    const creator = await this.prisma.contentCreator.findUnique({
      where: { id },
      include: {
        _count: { select: { videos: true } },
      },
    });

    if (!creator) {
      throw new NotFoundException(`Creator with ID ${id} not found`);
    }

    return creator;
  }

  async getCreatorVideos(creatorId: string, query: VideoQueryDto) {
    await this.ensureCreatorExists(creatorId);
    return this.videosRepository.findMany({ ...query, creatorId });
  }

  async createCreator(dto: CreateCreatorDto) {
    const existing = await this.prisma.contentCreator.findUnique({ where: { youtubeChannelId: dto.youtubeChannelId } });
    if (existing) {
      throw new BadRequestException('Creator with this YouTube channel already exists');
    }

    return this.prisma.contentCreator.create({ data: dto });
  }

  async updateCreator(id: string, dto: UpdateCreatorDto) {
    await this.ensureCreatorExists(id);
    return this.prisma.contentCreator.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCreator(id: string) {
    await this.ensureCreatorExists(id);
    await this.prisma.contentCreator.delete({ where: { id } });
    return { message: 'Creator deleted successfully' };
  }

  async syncCreator(id: string, fullSync = false) {
    await this.ensureCreatorExists(id);
    return this.syncService.syncCreatorChannel(id, fullSync ? { fullSync: true } : undefined);
  }

  private async ensureCreatorExists(id: string) {
    const creator = await this.prisma.contentCreator.findUnique({ where: { id } });
    if (!creator) {
      throw new NotFoundException(`Creator with ID ${id} not found`);
    }
    return creator;
  }
}
