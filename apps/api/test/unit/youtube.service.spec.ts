import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { YoutubeService } from '../../src/youtube/youtube.service';
import { DatabaseService } from '../../src/database/database.service';

// Mock the googleapis module
jest.mock('googleapis', () => ({
  google: {
    youtube: jest.fn().mockReturnValue({
      channels: {
        list: jest.fn(),
      },
      playlistItems: {
        list: jest.fn(),
      },
      videos: {
        list: jest.fn(),
      },
      search: {
        list: jest.fn(),
      },
    }),
  },
}));

describe('YoutubeService', () => {
  let service: YoutubeService;
  let configService: ConfigService;

  const mockDatabase = {
    band: {
      findUnique: jest.fn(),
    },
    youTubeVideo: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoutubeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'YOUTUBE_API_KEY') return 'test-api-key';
              if (key === 'YOUTUBE_QUOTA_LIMIT') return 10000;
              return null;
            }),
          },
        },
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
      ],
    }).compile();

    service = module.get<YoutubeService>(YoutubeService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should return true when API key is configured', () => {
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('parseDuration', () => {
    it('should parse ISO 8601 duration correctly', () => {
      // Access private method through reflection
      const parseDuration = (service as any).parseDuration.bind(service);

      expect(parseDuration('PT1H30M45S')).toBe(5445); // 1 hour + 30 min + 45 sec
      expect(parseDuration('PT5M30S')).toBe(330); // 5 min + 30 sec
      expect(parseDuration('PT45S')).toBe(45); // 45 sec
      expect(parseDuration('PT2H')).toBe(7200); // 2 hours
      expect(parseDuration('')).toBe(0); // Empty string
      expect(parseDuration('invalid')).toBe(0); // Invalid format
    });
  });

  describe('getVideoDetails', () => {
    it('should return video details with duration and view count', async () => {
      // Mock the YouTube API response
      const mockYoutube = (service as any).youtube;
      mockYoutube.videos.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'test-video-id',
              contentDetails: {
                duration: 'PT5M30S',
              },
              statistics: {
                viewCount: '1000',
                likeCount: '100',
              },
            },
          ],
        },
      });

      const result = await service.getVideoDetails('test-video-id');

      expect(result).toEqual({
        duration: 330,
        viewCount: '1000',
        likeCount: '100',
      });
    });

    it('should return null when video not found', async () => {
      const mockYoutube = (service as any).youtube;
      mockYoutube.videos.list = jest.fn().mockResolvedValue({
        data: {
          items: [],
        },
      });

      const result = await service.getVideoDetails('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUploadsPlaylistId', () => {
    it('should return uploads playlist ID from channel', async () => {
      const mockYoutube = (service as any).youtube;
      mockYoutube.channels.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'channel-id',
              contentDetails: {
                relatedPlaylists: {
                  uploads: 'UU_uploads_playlist_id',
                },
              },
            },
          ],
        },
      });

      const result = await service.getUploadsPlaylistId('channel-id');

      expect(result).toBe('UU_uploads_playlist_id');
    });

    it('should return null when channel not found', async () => {
      const mockYoutube = (service as any).youtube;
      mockYoutube.channels.list = jest.fn().mockResolvedValue({
        data: {
          items: [],
        },
      });

      const result = await service.getUploadsPlaylistId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('fetchAllChannelVideos', () => {
    it('should fetch all videos from a channel with pagination', async () => {
      const mockYoutube = (service as any).youtube;
      
      // Mock channel list to return uploads playlist ID
      mockYoutube.channels.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              contentDetails: {
                relatedPlaylists: {
                  uploads: 'UU_uploads',
                },
              },
            },
          ],
        },
      });

      // Mock playlist items with two pages
      mockYoutube.playlistItems.list = jest.fn()
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                snippet: {
                  resourceId: { videoId: 'video1' },
                  title: 'Video 1',
                  description: 'Description 1',
                  publishedAt: '2024-01-01T00:00:00Z',
                  channelId: 'channel1',
                  channelTitle: 'Channel 1',
                  thumbnails: { high: { url: 'http://thumb1.jpg' } },
                },
                contentDetails: {
                  videoPublishedAt: '2024-01-01T00:00:00Z',
                },
              },
            ],
            nextPageToken: 'page2',
            pageInfo: { totalResults: 2 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                snippet: {
                  resourceId: { videoId: 'video2' },
                  title: 'Video 2',
                  description: 'Description 2',
                  publishedAt: '2024-01-02T00:00:00Z',
                  channelId: 'channel1',
                  channelTitle: 'Channel 1',
                  thumbnails: { high: { url: 'http://thumb2.jpg' } },
                },
              },
            ],
            pageInfo: { totalResults: 2 },
          },
        });

      // Mock video details
      mockYoutube.videos.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'video1',
              contentDetails: { duration: 'PT5M' },
              statistics: { viewCount: '100', likeCount: '10' },
            },
            {
              id: 'video2',
              contentDetails: { duration: 'PT10M' },
              statistics: { viewCount: '200', likeCount: '20' },
            },
          ],
        },
      });

      const result = await service.fetchAllChannelVideos('channel1');

      expect(result.videos).toHaveLength(2);
      expect(result.videos[0].youtubeId).toBe('video1');
      expect(result.videos[1].youtubeId).toBe('video2');
      expect(result.totalFetched).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should filter videos by publishedAfter date', async () => {
      const mockYoutube = (service as any).youtube;
      
      mockYoutube.channels.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              contentDetails: {
                relatedPlaylists: {
                  uploads: 'UU_uploads',
                },
              },
            },
          ],
        },
      });

      mockYoutube.playlistItems.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              snippet: {
                resourceId: { videoId: 'old-video' },
                title: 'Old Video',
                publishedAt: '2020-01-01T00:00:00Z',
                channelId: 'channel1',
                thumbnails: { default: { url: 'http://thumb.jpg' } },
              },
            },
            {
              snippet: {
                resourceId: { videoId: 'new-video' },
                title: 'New Video',
                publishedAt: '2024-01-01T00:00:00Z',
                channelId: 'channel1',
                thumbnails: { default: { url: 'http://thumb.jpg' } },
              },
            },
          ],
          pageInfo: { totalResults: 2 },
        },
      });

      mockYoutube.videos.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'new-video',
              contentDetails: { duration: 'PT5M' },
              statistics: { viewCount: '100', likeCount: '10' },
            },
          ],
        },
      });

      const result = await service.fetchAllChannelVideos('channel1', {
        publishedAfter: new Date('2023-01-01'),
      });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0].youtubeId).toBe('new-video');
    });

    it('should respect maxVideos limit', async () => {
      const mockYoutube = (service as any).youtube;
      
      mockYoutube.channels.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              contentDetails: {
                relatedPlaylists: {
                  uploads: 'UU_uploads',
                },
              },
            },
          ],
        },
      });

      mockYoutube.playlistItems.list = jest.fn().mockResolvedValue({
        data: {
          items: Array.from({ length: 10 }, (_, i) => ({
            snippet: {
              resourceId: { videoId: `video${i}` },
              title: `Video ${i}`,
              publishedAt: '2024-01-01T00:00:00Z',
              channelId: 'channel1',
              thumbnails: { default: { url: 'http://thumb.jpg' } },
            },
          })),
          pageInfo: { totalResults: 10 },
        },
      });

      mockYoutube.videos.list = jest.fn().mockResolvedValue({
        data: {
          items: Array.from({ length: 5 }, (_, i) => ({
            id: `video${i}`,
            contentDetails: { duration: 'PT5M' },
            statistics: { viewCount: '100', likeCount: '10' },
          })),
        },
      });

      const result = await service.fetchAllChannelVideos('channel1', {
        maxVideos: 5,
      });

      expect(result.videos.length).toBeLessThanOrEqual(5);
    });

    it('should handle API errors gracefully', async () => {
      const mockYoutube = (service as any).youtube;
      
      mockYoutube.channels.list = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await service.fetchAllChannelVideos('channel1');

      expect(result.videos).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      // Error can be either the API error or the "Could not find uploads playlist" message
      expect(result.errors[0]).toMatch(/API Error|Could not find uploads playlist/);
    });
  });

  describe('fetchAllChannelVideos with publishedAfter', () => {
    it('should fetch videos with publishedAfter option', async () => {
      const mockYoutube = (service as any).youtube;
      
      mockYoutube.channels.list = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              contentDetails: {
                relatedPlaylists: {
                  uploads: 'UU_uploads',
                },
              },
            },
          ],
        },
      });

      mockYoutube.playlistItems.list = jest.fn().mockResolvedValue({
        data: {
          items: [],
          pageInfo: { totalResults: 0 },
        },
      });

      const publishedAfter = new Date('2024-01-01');
      const result = await service.fetchAllChannelVideos('channel1', {
        publishedAfter,
        maxVideos: 50,
      });

      expect(result).toBeDefined();
      expect(result.videos).toBeDefined();
    });
  });
});
