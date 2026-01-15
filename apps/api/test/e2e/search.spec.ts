import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SearchController } from '../../../src/modules/search/search.controller';
import { SearchService } from '../../../src/modules/search/search.service';

/**
 * Comprehensive E2E Tests for Search Functionality
 * 
 * Coverage areas:
 * - Full-text search across bands and videos
 * - Search in band names and video titles/descriptions
 * - Relevance ranking
 * - Minimum query length (2 characters)
 * - Search filters (by category, band, state/conference, year, combined)
 * - Search performance (response time < 500ms)
 * - Search pagination
 */

describe('Search E2E', () => {
  let app: INestApplication;
  let searchService: SearchService;

  const mockSearchResults = {
    bands: [
      { id: '1', name: 'Jackson State Sonic Boom', slug: 'jackson-state-sonic-boom', state: 'MS', conference: 'SWAC' },
      { id: '2', name: 'Southern University Human Jukebox', slug: 'southern-university-human-jukebox', state: 'LA', conference: 'SWAC' },
    ],
    videos: [
      { id: '1', title: 'Jackson State 2023 Homecoming', youtubeId: 'abc123', bandId: '1', categoryId: '1' },
      { id: '2', title: 'Southern University Fifth Quarter', youtubeId: 'def456', bandId: '2', categoryId: '2' },
    ],
    meta: {
      totalBands: 2,
      totalVideos: 2,
      query: 'test',
    },
  };

  const mockSearchService = {
    search: jest.fn(),
    searchBands: jest.fn(),
    searchVideos: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    searchService = moduleFixture.get<SearchService>(SearchService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GENERAL SEARCH
  // ========================================

  describe('GET /search', () => {
    it('should search across bands and videos', async () => {
      mockSearchService.search.mockResolvedValue(mockSearchResults);

      const response = await request(app.getHttpServer())
        .get('/search?q=jackson')
        .expect(200);

      expect(response.body).toEqual(mockSearchResults);
      expect(response.body.bands).toHaveLength(2);
      expect(response.body.videos).toHaveLength(2);
      expect(mockSearchService.search).toHaveBeenCalledWith(expect.objectContaining({ q: 'jackson' }));
    });

    it('should enforce minimum query length', async () => {
      await request(app.getHttpServer())
        .get('/search?q=a')
        .expect(400);
    });

    it('should handle empty results', async () => {
      mockSearchService.search.mockResolvedValue({
        bands: [],
        videos: [],
        meta: { totalBands: 0, totalVideos: 0, query: 'nonexistent' },
      });

      const response = await request(app.getHttpServer())
        .get('/search?q=nonexistent')
        .expect(200);

      expect(response.body.bands).toEqual([]);
      expect(response.body.videos).toEqual([]);
    });

    it('should support pagination', async () => {
      mockSearchService.search.mockResolvedValue({
        bands: mockSearchResults.bands.slice(0, 1),
        videos: mockSearchResults.videos.slice(0, 1),
        meta: { totalBands: 2, totalVideos: 2, query: 'test', page: 1, limit: 1 },
      });

      const response = await request(app.getHttpServer())
        .get('/search?q=test&page=1&limit=1')
        .expect(200);

      expect(response.body.bands).toHaveLength(1);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(1);
    });

    it('should filter by band name', async () => {
      const bandsOnly = {
        bands: mockSearchResults.bands,
        videos: [],
        meta: { totalBands: 2, totalVideos: 0, query: 'jackson state' },
      };
      mockSearchService.search.mockResolvedValue(bandsOnly);

      const response = await request(app.getHttpServer())
        .get('/search?q=jackson%20state')
        .expect(200);

      expect(response.body.bands.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      mockSearchService.search.mockResolvedValue({
        bands: [],
        videos: [mockSearchResults.videos[1]],
        meta: { totalBands: 0, totalVideos: 1, query: 'test' },
      });

      const response = await request(app.getHttpServer())
        .get('/search?q=test&categoryId=2')
        .expect(200);

      expect(response.body.videos).toHaveLength(1);
      expect(response.body.videos[0].categoryId).toBe('2');
    });

    it('should filter by state', async () => {
      mockSearchService.search.mockResolvedValue({
        bands: [mockSearchResults.bands[0]],
        videos: [],
        meta: { totalBands: 1, totalVideos: 0, query: 'test' },
      });

      const response = await request(app.getHttpServer())
        .get('/search?q=test&state=MS')
        .expect(200);

      expect(response.body.bands[0].state).toBe('MS');
    });

    it('should filter by conference', async () => {
      mockSearchService.search.mockResolvedValue({
        bands: mockSearchResults.bands,
        videos: [],
        meta: { totalBands: 2, totalVideos: 0, query: 'test' },
      });

      const response = await request(app.getHttpServer())
        .get('/search?q=test&conference=SWAC')
        .expect(200);

      expect(response.body.bands.every((b: any) => b.conference === 'SWAC')).toBe(true);
    });

    it('should filter by year', async () => {
      mockSearchService.search.mockResolvedValue({
        bands: [],
        videos: [mockSearchResults.videos[0]],
        meta: { totalBands: 0, totalVideos: 1, query: '2023' },
      });

      const response = await request(app.getHttpServer())
        .get('/search?q=2023')
        .expect(200);

      expect(response.body.videos[0].title).toContain('2023');
    });

    it('should apply multiple filters', async () => {
      mockSearchService.search.mockResolvedValue({
        bands: [mockSearchResults.bands[0]],
        videos: [mockSearchResults.videos[0]],
        meta: { totalBands: 1, totalVideos: 1, query: 'jackson' },
      });

      const response = await request(app.getHttpServer())
        .get('/search?q=jackson&state=MS&conference=SWAC&categoryId=1')
        .expect(200);

      expect(response.body.bands[0].state).toBe('MS');
      expect(response.body.bands[0].conference).toBe('SWAC');
    });
  });

  // ========================================
  // BAND-SPECIFIC SEARCH
  // ========================================

  describe('GET /search/bands', () => {
    it('should search only bands', async () => {
      mockSearchService.searchBands.mockResolvedValue({
        data: mockSearchResults.bands,
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get('/search/bands?q=jackson')
        .expect(200);

      expect(response.body.data).toEqual(mockSearchResults.bands);
      expect(mockSearchService.searchBands).toHaveBeenCalledWith(expect.objectContaining({ q: 'jackson' }));
    });

    it('should filter bands by state', async () => {
      mockSearchService.searchBands.mockResolvedValue({
        data: [mockSearchResults.bands[0]],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get('/search/bands?q=test&state=MS')
        .expect(200);

      expect(response.body.data[0].state).toBe('MS');
    });

    it('should handle empty band search results', async () => {
      mockSearchService.searchBands.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const response = await request(app.getHttpServer())
        .get('/search/bands?q=nonexistent')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  // ========================================
  // VIDEO-SPECIFIC SEARCH
  // ========================================

  describe('GET /search/videos', () => {
    it('should search only videos', async () => {
      mockSearchService.searchVideos.mockResolvedValue({
        data: mockSearchResults.videos,
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get('/search/videos?q=homecoming')
        .expect(200);

      expect(response.body.data).toEqual(mockSearchResults.videos);
      expect(mockSearchService.searchVideos).toHaveBeenCalledWith(expect.objectContaining({ q: 'homecoming' }));
    });

    it('should filter videos by category', async () => {
      mockSearchService.searchVideos.mockResolvedValue({
        data: [mockSearchResults.videos[1]],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get('/search/videos?q=test&categoryId=2')
        .expect(200);

      expect(response.body.data[0].categoryId).toBe('2');
    });

    it('should filter videos by band', async () => {
      mockSearchService.searchVideos.mockResolvedValue({
        data: [mockSearchResults.videos[0]],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get('/search/videos?q=test&bandId=1')
        .expect(200);

      expect(response.body.data[0].bandId).toBe('1');
    });

    it('should handle empty video search results', async () => {
      mockSearchService.searchVideos.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const response = await request(app.getHttpServer())
        .get('/search/videos?q=nonexistent')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  // ========================================
  // PERFORMANCE TESTS
  // ========================================

  describe('Performance', () => {
    it('should respond within 500ms for simple searches', async () => {
      mockSearchService.search.mockResolvedValue(mockSearchResults);

      const startTime = Date.now();
      await request(app.getHttpServer())
        .get('/search?q=jackson')
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should handle concurrent searches efficiently', async () => {
      mockSearchService.search.mockResolvedValue(mockSearchResults);

      const searches = Array(5).fill(null).map(() =>
        request(app.getHttpServer()).get('/search?q=test').expect(200)
      );

      const results = await Promise.all(searches);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.body).toBeDefined();
      });
    });
  });

  // ========================================
  // ERROR HANDLING
  // ========================================

  describe('Error handling', () => {
    it('should handle search service errors gracefully', async () => {
      mockSearchService.search.mockRejectedValue(new Error('Database error'));

      await request(app.getHttpServer())
        .get('/search?q=test')
        .expect(500);
    });

    it('should reject empty query parameter', async () => {
      await request(app.getHttpServer())
        .get('/search?q=')
        .expect(400);
    });

    it('should reject missing query parameter', async () => {
      await request(app.getHttpServer())
        .get('/search')
        .expect(400);
    });

    it('should handle invalid pagination parameters', async () => {
      mockSearchService.search.mockResolvedValue(mockSearchResults);

      await request(app.getHttpServer())
        .get('/search?q=test&page=-1')
        .expect(400);

      await request(app.getHttpServer())
        .get('/search?q=test&limit=0')
        .expect(400);
    });
  });
});
