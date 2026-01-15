import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VideosService } from '../../src/modules/videos/videos.service';
import { VideosRepository } from '../../src/modules/videos/videos.repository';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../src/database/database.service';
import { buildVideo, createMockPagination } from '../helpers/factories';
import { CreateVideoDto, UpdateVideoDto, VideoQueryDto } from '../../src/modules/videos/dto';
import type { PaginatedResponse } from '@hbcu-band-hub/shared-types';

/**
 * Comprehensive Unit Tests for VideosService
 * 
 * Tests all service methods with proper mocking of:
 * - VideosRepository (database layer)
 * - CacheService (Redis caching)
 * - ConfigService (configuration)
 * - DatabaseService (Prisma)
 * 
 * Coverage areas:
 * - CRUD operations (create, read, update, delete)
 * - Caching behavior (cache hits, misses, invalidation)
 * - Video associations (bands, categories, opponent bands)
 * - Advanced filtering (category, year, event, tags)
 * - Full-text search functionality
 * - Error handling (not found, duplicates, database errors)
 * - Admin operations (hide/unhide, quality scoring)
 * - Stats aggregation
 */

type PartialVideo = ReturnType<typeof buildVideo>;

const createMocks = () => {
  const videosRepository = {
    findMany: jest.fn(),
    findById: jest.fn(),
    findByYoutubeId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findHidden: jest.fn(),
    getVideoStats: jest.fn(),
  };

  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        CACHE_TTL_VIDEOS: 300,
        CACHE_TTL_VIDEO_DETAILS: 600,
      };
      return config[key];
    }),
  };

  const prismaService = {
    video: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;

  const service = new VideosService(
    videosRepository as any,
    cacheService as any,
    configService as any,
    prismaService,
  );

  return { service, videosRepository, cacheService, configService, prismaService };
};

describe('VideosService (comprehensive unit tests)', () => {
  let service: VideosService;
  let videosRepository: any;
  let cacheService: any;
  let configService: any;
  let prismaService: any;

  beforeEach(() => {
    const mocks = createMocks();
    service = mocks.service;
    videosRepository = mocks.videosRepository;
    cacheService = mocks.cacheService;
    configService = mocks.configService;
    prismaService = mocks.prismaService;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service instantiation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all dependencies injected', () => {
      expect(videosRepository).toBeDefined();
      expect(cacheService).toBeDefined();
      expect(configService).toBeDefined();
      expect(databaseService).toBeDefined();
    });
  });

  // ========================================
  // findAll() Tests
  // ========================================
  describe('findAll', () => {
    const query: VideoQueryDto = { page: 1, limit: 10 };

    it('should return cached results when cache hit occurs', async () => {
      const mockVideo = buildVideo();
      const mockResult: PaginatedResponse<PartialVideo> = createMockPagination([mockVideo], 1);
      
      cacheService.get.mockResolvedValue(mockResult);

      const result = await service.findAll(query);

      expect(result).toEqual(mockResult);
      expect(cacheService.get).toHaveBeenCalledWith(`videos:${JSON.stringify(query)}`);
      expect(videosRepository.findMany).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when cache miss occurs', async () => {
      const mockVideo = buildVideo();
      const mockResult: PaginatedResponse<PartialVideo> = createMockPagination([mockVideo], 1);
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockResolvedValue(mockResult);

      const result = await service.findAll(query);

      expect(result).toEqual(mockResult);
      expect(videosRepository.findMany).toHaveBeenCalledWith(query);
      expect(cacheService.set).toHaveBeenCalledWith(
        `videos:${JSON.stringify(query)}`,
        mockResult,
        300, // 5 minutes
      );
    });

    it('should create unique cache keys for different queries', async () => {
      const mockVideo = buildVideo();
      const mockResult: PaginatedResponse<PartialVideo> = createMockPagination([mockVideo], 1);
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockResolvedValue(mockResult);

      await service.findAll({ page: 1, limit: 10, bandId: 'band1' });
      await service.findAll({ page: 1, limit: 10, bandId: 'band2' });

      const calls = cacheService.set.mock.calls;
      expect(calls[0][0]).not.toBe(calls[1][0]);
    });

    it('should handle pagination correctly', async () => {
      const mockVideo = buildVideo();
      const mockResult: PaginatedResponse<PartialVideo> = createMockPagination([mockVideo], 1);
      const page2Query: VideoQueryDto = { page: 2, limit: 20 };
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockResolvedValue(mockResult);

      await service.findAll(page2Query);

      expect(videosRepository.findMany).toHaveBeenCalledWith(page2Query);
    });

    it('should filter by bandId', async () => {
      const mockVideo = buildVideo();
      const mockResult: PaginatedResponse<PartialVideo> = createMockPagination([mockVideo], 1);
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockResolvedValue(mockResult);

      await service.findAll({ page: 1, limit: 10, bandId: 'band-123' });

      expect(videosRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ bandId: 'band-123' })
      );
    });

    it('should filter by categoryId', async () => {
      const mockVideo = buildVideo();
      const mockResult: PaginatedResponse<PartialVideo> = createMockPagination([mockVideo], 1);
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockResolvedValue(mockResult);

      await service.findAll({ page: 1, limit: 10, categoryId: 'cat-123' });

      expect(videosRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 'cat-123' })
      );
    });

    it('should filter by eventYear', async () => {
      const mockVideo = buildVideo();
      const mockResult: PaginatedResponse<PartialVideo> = createMockPagination([mockVideo], 1);
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockResolvedValue(mockResult);

      await service.findAll({ page: 1, limit: 10, eventYear: 2023 });

      expect(videosRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ eventYear: 2023 })
      );
    });

    it('should return empty results when no videos match filters', async () => {
      const emptyResult: PaginatedResponse<PartialVideo> = createMockPagination([], 0);
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockResolvedValue(emptyResult);

      const result = await service.findAll({ page: 1, limit: 10, bandId: 'nonexistent' }) as PaginatedResponse<PartialVideo>;

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.findAll(query)).rejects.toThrow('Database error');
    });
  });

  // ========================================
  // findById() Tests
  // ========================================
  describe('findById', () => {
    const mockVideo: PartialVideo = buildVideo({ 
      title: 'Test Video',
      youtubeId: 'abc123'
    });

    it('should return cached video when cache hit occurs', async () => {
      cacheService.get.mockResolvedValue(mockVideo);

      const result = await service.findById('video-1');

      expect(result).toEqual(mockVideo);
      expect(cacheService.get).toHaveBeenCalledWith('video:video-1');
      expect(videosRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when cache miss occurs', async () => {
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findById.mockResolvedValue(mockVideo);

      const result = await service.findById('video-1');

      expect(result).toEqual(mockVideo);
      expect(videosRepository.findById).toHaveBeenCalledWith('video-1');
      expect(cacheService.set).toHaveBeenCalledWith('video:video-1', mockVideo, 600);
    });

    it('should throw NotFoundException when video does not exist', async () => {
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findById('nonexistent')).rejects.toThrow(
        'Video with ID nonexistent not found'
      );
    });

    it('should handle database errors', async () => {
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findById.mockRejectedValue(new Error('Database error'));

      await expect(service.findById('video-1')).rejects.toThrow('Database error');
    });
  });

  // ========================================
  // create() Tests
  // ========================================
  describe('create', () => {
    const createDto: CreateVideoDto = {
      youtubeId: 'abc123',
      title: 'Southern vs Jackson State 5th Quarter',
      description: 'Epic battle between the Human Jukebox and Sonic Boom',
      duration: 300,
      thumbnailUrl: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
      viewCount: 50000,
      likeCount: 2500,
      publishedAt: '2023-09-15T18:00:00Z',
      bandId: 'band-1',
      categoryId: 'cat-1',
      eventName: 'SWAC Championship',
      eventYear: 2023,
    };

    it('should successfully create a new video', async () => {
      const newVideo: PartialVideo = buildVideo(createDto);
      
      videosRepository.findByYoutubeId.mockResolvedValue(null);
      videosRepository.create.mockResolvedValue(newVideo);

      const result = await service.create(createDto);

      expect(result).toEqual(newVideo);
      expect(videosRepository.create).toHaveBeenCalled();
      expect(cacheService.delPattern).toHaveBeenCalledWith('videos:*');
    });

    it('should throw BadRequestException when YouTube ID already exists', async () => {
      const existingVideo: PartialVideo = buildVideo({ youtubeId: 'abc123' });
      
      videosRepository.findByYoutubeId.mockResolvedValue(existingVideo);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createDto)).rejects.toThrow(
        'Video with YouTube ID abc123 already exists'
      );
      expect(videosRepository.create).not.toHaveBeenCalled();
    });

    it('should create video with minimal required fields', async () => {
      const minimalDto: CreateVideoDto = {
        youtubeId: 'xyz789',
        title: 'Test Video',
        description: 'Description',
        duration: 120,
        thumbnailUrl: 'https://img.youtube.com/vi/xyz789/hqdefault.jpg',
        viewCount: 0,
        likeCount: 0,
        publishedAt: '2023-01-01T00:00:00Z',
        bandId: 'band-1',
      };
      const newVideo: PartialVideo = buildVideo(minimalDto);
      
      videosRepository.findByYoutubeId.mockResolvedValue(null);
      videosRepository.create.mockResolvedValue(newVideo);

      const result = await service.create(minimalDto);

      expect(result).toEqual(newVideo);
    });

    it('should create video with opponent band', async () => {
      const dtoWithOpponent: CreateVideoDto = {
        ...createDto,
        opponentBandId: 'band-2',
      };
      const newVideo: PartialVideo = buildVideo(dtoWithOpponent);
      
      videosRepository.findByYoutubeId.mockResolvedValue(null);
      videosRepository.create.mockResolvedValue(newVideo);

      await service.create(dtoWithOpponent);

      expect(videosRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          opponentBand: { connect: { id: 'band-2' } },
        })
      );
    });

    it('should create video with tags', async () => {
      const dtoWithTags: CreateVideoDto = {
        ...createDto,
        tags: ['5th quarter', 'field show', 'SWAC'],
      };
      const newVideo: PartialVideo = buildVideo(dtoWithTags);
      
      videosRepository.findByYoutubeId.mockResolvedValue(null);
      videosRepository.create.mockResolvedValue(newVideo);

      await service.create(dtoWithTags);

      expect(videosRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['5th quarter', 'field show', 'SWAC'],
        })
      );
    });

    it('should create video with quality score', async () => {
      const dtoWithQuality: CreateVideoDto = {
        ...createDto,
        qualityScore: 8,
      };
      const newVideo: PartialVideo = buildVideo(dtoWithQuality);
      
      videosRepository.findByYoutubeId.mockResolvedValue(null);
      videosRepository.create.mockResolvedValue(newVideo);

      await service.create(dtoWithQuality);

      expect(videosRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          qualityScore: 8,
        })
      );
    });

    it('should invalidate video list caches after creation', async () => {
      const newVideo: PartialVideo = buildVideo();
      
      videosRepository.findByYoutubeId.mockResolvedValue(null);
      videosRepository.create.mockResolvedValue(newVideo);

      await service.create(createDto);

      expect(cacheService.delPattern).toHaveBeenCalledWith('videos:*');
      expect(cacheService.delPattern).toHaveBeenCalledWith('videos:stats');
    });

    it('should handle database errors during creation', async () => {
      videosRepository.findByYoutubeId.mockResolvedValue(null);
      videosRepository.create.mockRejectedValue(new Error('Database constraint violation'));

      await expect(service.create(createDto)).rejects.toThrow('Database constraint violation');
    });

    it('should convert publishedAt string to Date', async () => {
      const newVideo: PartialVideo = buildVideo();
      
      videosRepository.findByYoutubeId.mockResolvedValue(null);
      videosRepository.create.mockResolvedValue(newVideo);

      await service.create(createDto);

      expect(videosRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          publishedAt: expect.any(Date),
        })
      );
    });
  });

  // ========================================
  // update() Tests
  // ========================================
  describe('update', () => {
    const existingVideo: PartialVideo = buildVideo({ 
      youtubeId: 'abc123',
      title: 'Old Title',
    });

    const updateDto: UpdateVideoDto = {
      categoryId: 'cat-2',
      eventYear: 2024,
      qualityScore: 9,
    };

    it('should successfully update a video', async () => {
      const updatedVideo: PartialVideo = { ...existingVideo, ...updateDto };
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(updatedVideo);

      const result = await service.update('video-1', updateDto);

      expect(result).toEqual(updatedVideo);
      expect(videosRepository.update).toHaveBeenCalledWith('video-1', updateDto);
    });

    it('should throw NotFoundException when video does not exist', async () => {
      videosRepository.findById.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(
        'Video with ID nonexistent not found'
      );
      expect(videosRepository.update).not.toHaveBeenCalled();
    });

    it('should update video category', async () => {
      const updatedVideo: PartialVideo = existingVideo;
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(updatedVideo);

      await service.update('video-1', { categoryId: 'cat-3' });

      expect(videosRepository.update).toHaveBeenCalledWith('video-1', {
        categoryId: 'cat-3',
      });
    });

    it('should update opponent band', async () => {
      const updatedVideo: PartialVideo = existingVideo;
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(updatedVideo);

      await service.update('video-1', { opponentBandId: 'band-5' });

      expect(videosRepository.update).toHaveBeenCalledWith('video-1', {
        opponentBandId: 'band-5',
      });
    });

    it('should update tags', async () => {
      const updatedVideo: PartialVideo = existingVideo;
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(updatedVideo);

      await service.update('video-1', { tags: ['updated', 'tags'] });

      expect(videosRepository.update).toHaveBeenCalledWith('video-1', {
        tags: ['updated', 'tags'],
      });
    });

    it('should invalidate all relevant caches after update', async () => {
      const updatedVideo: PartialVideo = existingVideo;
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(updatedVideo);

      await service.update('video-1', updateDto);

      expect(cacheService.delPattern).toHaveBeenCalledWith('videos:*');
      expect(cacheService.delPattern).toHaveBeenCalledWith('videos:stats');
      expect(cacheService.del).toHaveBeenCalledWith('video:video-1');
    });

    it('should handle partial updates', async () => {
      const partialUpdate: UpdateVideoDto = { eventName: 'Updated Event' };
      const updatedVideo: PartialVideo = { ...existingVideo, eventName: 'Updated Event' };
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(updatedVideo);

      const result = await service.update('video-1', partialUpdate);

      expect(result.eventName).toBe('Updated Event');
      expect(result.title).toBe(existingVideo.title);
    });

    it('should handle database errors during update', async () => {
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(service.update('video-1', updateDto)).rejects.toThrow('Database error');
    });
  });

  // ========================================
  // delete() Tests
  // ========================================
  describe('delete', () => {
    const existingVideo: PartialVideo = buildVideo({ youtubeId: 'abc123' });

    it('should successfully delete a video', async () => {
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.delete.mockResolvedValue(existingVideo);

      const result = await service.delete('video-1');

      expect(result).toEqual({ message: 'Video deleted successfully' });
      expect(videosRepository.delete).toHaveBeenCalledWith('video-1');
    });

    it('should throw NotFoundException when video does not exist', async () => {
      videosRepository.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.delete('nonexistent')).rejects.toThrow(
        'Video with ID nonexistent not found'
      );
      expect(videosRepository.delete).not.toHaveBeenCalled();
    });

    it('should invalidate all caches after deletion', async () => {
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.delete.mockResolvedValue(existingVideo);

      await service.delete('video-1');

      expect(cacheService.delPattern).toHaveBeenCalledWith('videos:*');
      expect(cacheService.delPattern).toHaveBeenCalledWith('videos:stats');
      expect(cacheService.del).toHaveBeenCalledWith('video:video-1');
    });

    it('should handle database errors during deletion', async () => {
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.delete.mockRejectedValue(new Error('Foreign key constraint'));

      await expect(service.delete('video-1')).rejects.toThrow('Foreign key constraint');
    });
  });

  // ========================================
  // search() Tests
  // ========================================
  describe('search', () => {
    it('should perform search with query string', async () => {
      const mockVideo = buildVideo({ title: 'Southern Band Performance' });
      const mockResult: PaginatedResponse<PartialVideo> = createMockPagination([mockVideo], 1);
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockResolvedValue(mockResult);

      const result = await service.search('Southern');

      expect(videosRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Southern',
        })
      );
      expect(result).toEqual(mockResult);
    });

    it('should search with additional filters', async () => {
      const mockVideo = buildVideo();
      const mockResult: PaginatedResponse<PartialVideo> = createMockPagination([mockVideo], 1);
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockResolvedValue(mockResult);

      await service.search('band', { bandId: 'band-1', eventYear: 2023 });

      expect(videosRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'band',
          bandId: 'band-1',
          eventYear: 2023,
        })
      );
    });

    it('should throw BadRequestException for queries less than 2 characters', async () => {
      await expect(service.search('a')).rejects.toThrow(BadRequestException);
      await expect(service.search('a')).rejects.toThrow(
        'Search query must be at least 2 characters long'
      );
    });

    it('should throw BadRequestException for empty queries', async () => {
      await expect(service.search('')).rejects.toThrow(BadRequestException);
      await expect(service.search('  ')).rejects.toThrow(BadRequestException);
    });

    it('should trim search query', async () => {
      const mockVideo = buildVideo();
      const mockResult: PaginatedResponse<PartialVideo> = createMockPagination([mockVideo], 1);
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findMany.mockResolvedValue(mockResult);

      await service.search('  Southern  ');

      expect(videosRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Southern',
        })
      );
    });
  });

  // ========================================
  // Admin Operations Tests
  // ========================================
  describe('hideVideo', () => {
    const existingVideo: PartialVideo = buildVideo({ isHidden: false });

    it('should hide a video with reason', async () => {
      const hiddenVideo: PartialVideo = { ...existingVideo, isHidden: true };
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(hiddenVideo);

      const result = await service.hideVideo('video-1', 'inappropriate content');

      expect(videosRepository.update).toHaveBeenCalledWith('video-1', {
        isHidden: true,
        hideReason: 'inappropriate content',
      });
      expect(result.isHidden).toBe(true);
    });

    it('should invalidate caches when hiding video', async () => {
      const hiddenVideo: PartialVideo = { ...existingVideo, isHidden: true };
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(hiddenVideo);

      await service.hideVideo('video-1', 'spam');

      expect(cacheService.delPattern).toHaveBeenCalled();
      expect(cacheService.del).toHaveBeenCalledWith('video:video-1');
    });
  });

  describe('unhideVideo', () => {
    const existingVideo: PartialVideo = buildVideo({ isHidden: true });

    it('should unhide a video', async () => {
      const visibleVideo: PartialVideo = { ...existingVideo, isHidden: false };
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(visibleVideo);

      const result = await service.unhideVideo('video-1');

      expect(videosRepository.update).toHaveBeenCalledWith('video-1', {
        isHidden: false,
        hideReason: null,
      });
      expect(result.isHidden).toBe(false);
    });

    it('should clear hide reason when unhiding', async () => {
      const visibleVideo: PartialVideo = { ...existingVideo, isHidden: false };
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(visibleVideo);

      await service.unhideVideo('video-1');

      expect(videosRepository.update).toHaveBeenCalledWith('video-1', 
        expect.objectContaining({
          hideReason: null,
        })
      );
    });
  });

  describe('findHidden', () => {
    it('should return all hidden videos', async () => {
      const hiddenVideos = [
        buildVideo({ isHidden: true }),
        buildVideo({ isHidden: true }),
      ];
      
      videosRepository.findHidden.mockResolvedValue(hiddenVideos);

      const result = await service.findHidden();

      expect(result).toEqual(hiddenVideos);
      expect(videosRepository.findHidden).toHaveBeenCalled();
    });

    it('should return empty array when no hidden videos', async () => {
      videosRepository.findHidden.mockResolvedValue([]);

      const result = await service.findHidden();

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // getStats() Tests
  // ========================================
  describe('getStats', () => {
    const mockStats = {
      total: 500,
      hidden: 15,
      visible: 485,
      byCategory: [
        { categoryId: 'cat-1', _count: 200 },
        { categoryId: 'cat-2', _count: 150 },
        { categoryId: 'cat-3', _count: 100 },
      ],
    };

    it('should return cached stats when available', async () => {
      cacheService.get.mockResolvedValue(mockStats);

      const result = await service.getStats();

      expect(result).toEqual(mockStats);
      expect(cacheService.get).toHaveBeenCalledWith('videos:stats');
      expect(videosRepository.getVideoStats).not.toHaveBeenCalled();
    });

    it('should fetch and cache stats when cache miss occurs', async () => {
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.getVideoStats.mockResolvedValue(mockStats);

      const result = await service.getStats();

      expect(result).toEqual(mockStats);
      expect(videosRepository.getVideoStats).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith('videos:stats', mockStats, 3600);
    });

    it('should handle database errors when fetching stats', async () => {
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.getVideoStats.mockRejectedValue(new Error('Database error'));

      await expect(service.getStats()).rejects.toThrow('Database error');
    });
  });

  // ========================================
  // Edge Cases Tests
  // ========================================
  describe('Edge cases', () => {
    it('should handle videos with very long titles', async () => {
      const longTitle = 'A'.repeat(500);
      const videoWithLongTitle: PartialVideo = buildVideo({ title: longTitle });
      
      videosRepository.findByYoutubeId.mockResolvedValue(null);
      videosRepository.create.mockResolvedValue(videoWithLongTitle);

      const createDto: CreateVideoDto = {
        youtubeId: 'xyz',
        title: longTitle,
        description: 'Description',
        duration: 120,
        thumbnailUrl: 'https://example.com/thumb.jpg',
        viewCount: 0,
        likeCount: 0,
        publishedAt: '2023-01-01T00:00:00Z',
        bandId: 'band-1',
      };

      const result = await service.create(createDto);

      expect(result.title).toHaveLength(500);
    });

    it('should handle videos with empty tags array', async () => {
      const videoWithEmptyTags: PartialVideo = buildVideo({ tags: [] });
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findById.mockResolvedValue(videoWithEmptyTags);

      const result = await service.findById('video-1') as PartialVideo;

      expect(result.tags).toEqual([]);
    });

    it('should handle videos with zero views and likes', async () => {
      const createDto: CreateVideoDto = {
        youtubeId: 'new-video',
        title: 'Brand New Video',
        description: 'Just uploaded',
        duration: 180,
        thumbnailUrl: 'https://example.com/thumb.jpg',
        viewCount: 0,
        likeCount: 0,
        publishedAt: '2023-12-01T00:00:00Z',
        bandId: 'band-1',
      };
      const newVideo: PartialVideo = buildVideo(createDto);
      
      videosRepository.findByYoutubeId.mockResolvedValue(null);
      videosRepository.create.mockResolvedValue(newVideo);

      const result = await service.create(createDto);

      expect(result.viewCount).toBe(0);
      expect(result.likeCount).toBe(0);
    });

    it('should handle concurrent updates to same video', async () => {
      const existingVideo: PartialVideo = buildVideo();
      const updatedVideo: PartialVideo = { ...existingVideo, eventYear: 2024 };
      
      videosRepository.findById.mockResolvedValue(existingVideo);
      videosRepository.update.mockResolvedValue(updatedVideo);

      // Simulate concurrent updates
      const results = await Promise.all([
        service.update('video-1', { eventYear: 2024 }),
        service.update('video-1', { eventName: 'Event 2' }),
        service.update('video-1', { qualityScore: 8 }),
      ]);

      expect(results).toHaveLength(3);
      expect(videosRepository.update).toHaveBeenCalledTimes(3);
    });

    it('should handle videos without optional fields', async () => {
      const minimalVideo: PartialVideo = buildVideo({
        eventName: undefined,
        eventYear: undefined,
        tags: undefined,
      });
      
      cacheService.get.mockResolvedValue(undefined);
      videosRepository.findById.mockResolvedValue(minimalVideo);

      const result = await service.findById('video-1');

      expect(result).toBeDefined();
    });
  });
});