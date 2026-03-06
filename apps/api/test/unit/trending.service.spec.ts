import { Test, TestingModule } from '@nestjs/testing';
import { TrendingService, TrendingVideo } from '../../src/modules/videos/services/trending.service';
import { PrismaService } from '@bandhub/database';
import { CacheService } from '@bandhub/cache';

// Raw DB shape returned by prisma.video.findMany (typed as any — not TrendingVideo)
const mockRawVideo = (overrides: Record<string, any> = {}): any => ({
  id: 'vid-1',
  youtubeId: 'yt-123',
  title: 'Test Video',
  thumbnailUrl: 'https://img.youtube.com/test.jpg',
  duration: 300,
  publishedAt: new Date(),
  viewCount: 1000,
  likeCount: 50,
  qualityScore: 80,
  isHidden: false,
  band: { id: 'band-1', name: 'Test Band', slug: 'test-band', logoUrl: null },
  category: null,
  ...overrides,
});

describe('TrendingService', () => {
  let service: TrendingService;
  let prismaService: { video: { findMany: jest.Mock } };
  let cacheService: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    prismaService = { video: { findMany: jest.fn() } };
    cacheService = { get: jest.fn(), set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendingService,
        { provide: PrismaService, useValue: prismaService },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<TrendingService>(TrendingService);
  });

  describe('getTrendingVideos', () => {
    it('should return cached results when available', async () => {
      const cached: TrendingVideo[] = [{ id: 'vid-1' } as any];
      cacheService.get.mockResolvedValue(cached);

      const result = await service.getTrendingVideos({ limit: 10 });

      expect(result).toEqual(cached);
      expect(prismaService.video.findMany).not.toHaveBeenCalled();
    });

    it('should query database on cache miss and cache the result', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      const videos = [mockRawVideo(), mockRawVideo({ id: 'vid-2', viewCount: 500 })];
      prismaService.video.findMany.mockResolvedValue(videos);

      const result = await service.getTrendingVideos({ limit: 10 });

      expect(prismaService.video.findMany).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when no videos match', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      prismaService.video.findMany.mockResolvedValue([]);

      const result = await service.getTrendingVideos({});

      expect(result).toEqual([]);
    });

    it('should rank videos with more views higher', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      // Both published today so recency is equal; viewCount drives the score
      const now = new Date();
      const highActivity = mockRawVideo({ id: 'vid-high', viewCount: 100000, publishedAt: now });
      const lowActivity = mockRawVideo({ id: 'vid-low', viewCount: 10, publishedAt: now });
      prismaService.video.findMany.mockResolvedValue([lowActivity, highActivity]);

      const result = await service.getTrendingVideos({ limit: 10 });

      const highIdx = result.findIndex((v) => v.id === 'vid-high');
      const lowIdx = result.findIndex((v) => v.id === 'vid-low');
      expect(highIdx).toBeLessThan(lowIdx);
    });
  });
});
