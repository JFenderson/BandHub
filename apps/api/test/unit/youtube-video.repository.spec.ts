import { YouTubeVideoRepository } from '../../src/youtube/youtube-video.repository';
import { SyncStatus } from '@prisma/client';

const mockPrisma = {
  youTubeVideo: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('YouTubeVideoRepository', () => {
  let repository: YouTubeVideoRepository;

  beforeEach(() => {
    // Create repository manually with mock
    repository = new YouTubeVideoRepository(mockPrisma as any);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('findMany', () => {
    it('should return paginated videos', async () => {
      const mockVideos = [
        {
          id: '1',
          youtubeId: 'abc123',
          title: 'Test Video',
          url: 'https://www.youtube.com/watch?v=abc123',
          thumbnailUrl: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
          publishedAt: new Date(),
          viewCount: 1000,
          likeCount: 100,
          duration: 300,
          channelId: 'channel1',
          syncStatus: SyncStatus.COMPLETED,
          isPromoted: false,
          qualityScore: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.youTubeVideo.findMany.mockResolvedValue(mockVideos);
      mockPrisma.youTubeVideo.count.mockResolvedValue(1);

      const result = await repository.findMany({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalled();
    });

    it('should filter by bandId', async () => {
      mockPrisma.youTubeVideo.findMany.mockResolvedValue([]);
      mockPrisma.youTubeVideo.count.mockResolvedValue(0);

      await repository.findMany({ bandId: 'band123' });

      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bandId: 'band123',
          }),
        }),
      );
    });

    it('should filter by creatorId', async () => {
      mockPrisma.youTubeVideo.findMany.mockResolvedValue([]);
      mockPrisma.youTubeVideo.count.mockResolvedValue(0);

      await repository.findMany({ creatorId: 'creator123' });

      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            creatorId: 'creator123',
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.youTubeVideo.findMany.mockResolvedValue([]);
      mockPrisma.youTubeVideo.count.mockResolvedValue(0);

      const publishedAfter = new Date('2023-01-01');
      const publishedBefore = new Date('2023-12-31');

      await repository.findMany({ publishedAfter, publishedBefore });

      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publishedAt: {
              gte: publishedAfter,
              lte: publishedBefore,
            },
          }),
        }),
      );
    });

    it('should search by title and description', async () => {
      mockPrisma.youTubeVideo.findMany.mockResolvedValue([]);
      mockPrisma.youTubeVideo.count.mockResolvedValue(0);

      await repository.findMany({ search: 'marching band' });

      expect(mockPrisma.youTubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                title: { contains: 'marching band', mode: 'insensitive' },
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return a video by ID', async () => {
      const mockVideo = {
        id: '1',
        youtubeId: 'abc123',
        title: 'Test Video',
      };

      mockPrisma.youTubeVideo.findUnique.mockResolvedValue(mockVideo);

      const result = await repository.findById('1');

      expect(result).toEqual(mockVideo);
      expect(mockPrisma.youTubeVideo.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
        }),
      );
    });

    it('should return null for non-existent video', async () => {
      mockPrisma.youTubeVideo.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByYoutubeId', () => {
    it('should return a video by YouTube ID', async () => {
      const mockVideo = {
        id: '1',
        youtubeId: 'abc123',
        title: 'Test Video',
      };

      mockPrisma.youTubeVideo.findUnique.mockResolvedValue(mockVideo);

      const result = await repository.findByYoutubeId('abc123');

      expect(result).toEqual(mockVideo);
      expect(mockPrisma.youTubeVideo.findUnique).toHaveBeenCalledWith({
        where: { youtubeId: 'abc123' },
      });
    });
  });

  describe('create', () => {
    it('should create a new video', async () => {
      const videoData = {
        youtubeId: 'abc123',
        title: 'New Video',
        description: 'Description',
        thumbnailUrl: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
        url: 'https://www.youtube.com/watch?v=abc123',
        publishedAt: new Date(),
        channelId: 'channel1',
        channelTitle: 'Channel Name',
        bandId: 'band123',
      };

      mockPrisma.youTubeVideo.create.mockResolvedValue({
        id: '1',
        ...videoData,
        duration: 0,
        viewCount: 0,
        likeCount: 0,
        syncStatus: SyncStatus.COMPLETED,
      });

      const result = await repository.create(videoData);

      expect(result.id).toBe('1');
      expect(mockPrisma.youTubeVideo.create).toHaveBeenCalled();
    });
  });

  describe('upsert', () => {
    it('should create video if not exists', async () => {
      const videoData = {
        youtubeId: 'abc123',
        title: 'New Video',
        description: 'Description',
        thumbnailUrl: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
        url: 'https://www.youtube.com/watch?v=abc123',
        publishedAt: new Date(),
        channelId: 'channel1',
        channelTitle: 'Channel Name',
      };

      mockPrisma.youTubeVideo.upsert.mockResolvedValue({
        id: '1',
        ...videoData,
        duration: 0,
        viewCount: 0,
        likeCount: 0,
        syncStatus: SyncStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repository.upsert(videoData);

      expect(result.id).toBe('1');
      expect(mockPrisma.youTubeVideo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { youtubeId: 'abc123' },
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return video statistics', async () => {
      mockPrisma.youTubeVideo.count.mockResolvedValue(100);
      mockPrisma.youTubeVideo.groupBy.mockResolvedValue([
        { syncStatus: SyncStatus.COMPLETED, _count: 90 },
        { syncStatus: SyncStatus.PENDING, _count: 10 },
      ]);

      const result = await repository.getStats();

      expect(result.total).toBe(100);
      expect(mockPrisma.youTubeVideo.count).toHaveBeenCalled();
      expect(mockPrisma.youTubeVideo.groupBy).toHaveBeenCalled();
    });
  });

  describe('getLatestVideoDate', () => {
    it('should return the latest video date for a channel', async () => {
      const latestDate = new Date('2024-01-15');
      mockPrisma.youTubeVideo.findFirst.mockResolvedValue({ publishedAt: latestDate });

      const result = await repository.getLatestVideoDate('channel1');

      expect(result).toEqual(latestDate);
      expect(mockPrisma.youTubeVideo.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { channelId: 'channel1' },
          orderBy: { publishedAt: 'desc' },
        }),
      );
    });

    it('should return null if no videos exist', async () => {
      mockPrisma.youTubeVideo.findFirst.mockResolvedValue(null);

      const result = await repository.getLatestVideoDate('channel1');

      expect(result).toBeNull();
    });
  });

  describe('countByChannel', () => {
    it('should return video count for a channel', async () => {
      mockPrisma.youTubeVideo.count.mockResolvedValue(50);

      const result = await repository.countByChannel('channel1');

      expect(result).toBe(50);
      expect(mockPrisma.youTubeVideo.count).toHaveBeenCalledWith({
        where: { channelId: 'channel1' },
      });
    });
  });
});
