import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import request from 'supertest';
import { VideosController } from '../../src/modules/videos/videos.controller';
import { VideosService } from '../../src/modules/videos/videos.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { AdminRole } from '@prisma/client';

/**
 * COMPREHENSIVE INTEGRATION TESTS FOR VIDEOSCONTROLLER
 * 
 * File: apps/api/test/integration/videos.controller.spec.ts
 * 
 * Testing Strategy:
 * - Real HTTP requests through NestJS TestingModule
 * - Real ValidationPipe for DTO validation
 * - Mocked AuthGuards for authentication/authorization
 * - Mocked VideosService for database isolation
 * 
 * Coverage:
 * ✅ GET /api/videos - Paginated list with complex filters (12 tests)
 * ✅ GET /api/videos/:id - Single video retrieval (2 tests)
 * ✅ PUT /api/videos/:id/hide - Hide video (MODERATOR+) (4 tests)
 * ✅ PUT /api/videos/:id/unhide - Unhide video (MODERATOR+) (4 tests)
 * ✅ PUT /api/videos/:id/category - Update category (MODERATOR+) (4 tests)
 * ✅ PUT /api/videos/:id/quality - Update quality (MODERATOR+) (4 tests)
 * ✅ DELETE /api/videos/:id - Delete video (SUPER_ADMIN) (4 tests)
 * ✅ Error handling and validation (3 tests)
 * ✅ Response format validation (2 tests)
 * 
 * Total: 39 comprehensive integration tests
 */

describe('VideosController (Integration)', () => {
  let app: INestApplication;
  let videosService: VideosService;

  // ========================================
  // MOCK DATA
  // ========================================

  const mockVideo = {
    id: 'video-1',
    youtubeId: 'abc123',
    title: 'JSU vs SU - 5th Quarter',
    description: 'Epic battle between JSU and SU',
    duration: 450,
    thumbnailUrl: 'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
    viewCount: 125000,
    likeCount: 5420,
    publishedAt: new Date('2024-01-15'),
    bandId: 'band-1',
    categoryId: 'cat-1',
    opponentBandId: 'band-2',
    eventName: 'SWAC Championship',
    eventYear: 2024,
    tags: ['5th quarter', 'swac', 'championship'],
    qualityScore: 8,
    isHidden: false,
    hideReason: null,
    createdAt: new Date('2024-01-16'),
    updatedAt: new Date('2024-01-16'),
    creatorId: 'creator-1',
    band: {
      id: 'band-1',
      name: 'Sonic Boom of the South',
      slug: 'sonic-boom-of-the-south',
    },
    category: {
      id: 'cat-1',
      name: '5th Quarter',
      slug: 'fifth-quarter',
    },
  };

  const mockPaginatedResponse = {
    data: [mockVideo],
    meta: {
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };

  // ========================================
  // SERVICE MOCKS
  // ========================================

  const mockVideosService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    hideVideo: jest.fn(),
    unhideVideo: jest.fn(),
    bulkUpdateCategory: jest.fn(),
    syncFromYouTube: jest.fn(),
  };

  // ========================================
  // TEST SETUP
  // ========================================

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [VideosController],
      providers: [
        {
          provide: VideosService,
          useValue: mockVideosService,
        },
      ],
    })
      // Override JwtAuthGuard to simulate authentication
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          
          if (request.headers.authorization) {
            request.user = {
              userId: 'admin-1',
              email: 'admin@example.com',
              role: request.headers['x-user-role'] || AdminRole.MODERATOR,
            };
            return true;
          }
          
          return false;
        },
      })
      // Override RolesGuard to simulate authorization
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          
          if (!request.user) {
            return true; // Pass through - JwtAuthGuard will reject
          }
          
          const requiredRoles = Reflect.getMetadata('roles', context.getHandler());
          
          if (!requiredRoles || requiredRoles.length === 0) {
            return true;
          }
          
          const userRole = request.user.role || request.headers['x-user-role'];
          return requiredRoles.includes(userRole);
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Set global API prefix
    app.setGlobalPrefix('api');

    await app.init();

    videosService = moduleFixture.get<VideosService>(VideosService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // PUBLIC ROUTES - GET /api/videos
  // ========================================

  describe('GET /api/videos', () => {
    it('should return paginated list of videos with default pagination', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      const response = await request(app.getHttpServer())
        .get('/api/videos')
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'video-1',
            title: 'JSU vs SU - 5th Quarter',
          }),
        ]),
        meta: {
          total: 1,
          page: 1,
          limit: 20,
        },
      });

      expect(mockVideosService.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: 'publishedAt',
        sortOrder: 'desc',
        includeHidden: false,
      });
    });

    it('should apply custom pagination parameters', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?page=2&limit=10')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        sortBy: 'publishedAt',
        sortOrder: 'desc',
        includeHidden: false,
      });
    });

    it('should filter by band ID', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?bandId=band-1')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          bandId: 'band-1',
        })
      );
    });

    it('should filter by band slug', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?bandSlug=sonic-boom-of-the-south')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          bandSlug: 'sonic-boom-of-the-south',
        })
      );
    });

    it('should filter by category ID', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?categoryId=cat-1')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 'cat-1',
        })
      );
    });

    it('should filter by category slug', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?categorySlug=fifth-quarter')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          categorySlug: 'fifth-quarter',
        })
      );
    });

    it('should filter by content creator', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?creatorId=creator-1')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          creatorId: 'creator-1',
        })
      );
    });

    it('should filter by event year', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?eventYear=2024')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          eventYear: 2024,
        })
      );
    });

    it('should search videos by title and description', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?search=5th+quarter')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '5th quarter',
        })
      );
    });

    it('should apply multiple filters simultaneously', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?bandId=band-1&categoryId=cat-1&eventYear=2024&search=swac')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          bandId: 'band-1',
          categoryId: 'cat-1',
          eventYear: 2024,
          search: 'swac',
        })
      );
    });

    it('should sort by different fields', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?sortBy=viewCount&sortOrder=desc')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'viewCount',
          sortOrder: 'desc',
        })
      );
    });

    it('should enforce maximum limit of 100', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/videos?limit=150')
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  // ========================================
  // PUBLIC ROUTES - GET /api/videos/:id
  // ========================================

  describe('GET /api/videos/:id', () => {
    it('should return video by ID with band and category info', async () => {
      mockVideosService.findById.mockResolvedValue(mockVideo);

      const response = await request(app.getHttpServer())
        .get('/api/videos/video-1')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'video-1',
        title: 'JSU vs SU - 5th Quarter',
        youtubeId: 'abc123',
      });
      expect(mockVideosService.findById).toHaveBeenCalledWith('video-1');
    });

    it('should return 404 for non-existent video', async () => {
      mockVideosService.findById.mockRejectedValue(
        new NotFoundException('Video with ID non-existent not found')
      );

      const response = await request(app.getHttpServer())
        .get('/api/videos/non-existent')
        .expect(404);

      expect(response.body.statusCode).toBe(404);
      expect(response.body.message).toContain('Video with ID non-existent not found');
    });
  });

  // ========================================
  // MODERATOR ROUTES - PUT /api/videos/:id/hide
  // ========================================

  describe('PUT /api/videos/:id/hide', () => {
    it('should hide video with MODERATOR role', async () => {
      const hiddenVideo = { ...mockVideo, isHidden: true, hideReason: 'Off-topic content' };
      mockVideosService.hideVideo.mockResolvedValue(hiddenVideo);

      const response = await request(app.getHttpServer())
        .put('/api/videos/video-1/hide')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.MODERATOR)
        .send({ reason: 'Off-topic content' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'video-1',
        isHidden: true,
        hideReason: 'Off-topic content',
      });
      expect(mockVideosService.hideVideo).toHaveBeenCalledWith('video-1', 'Off-topic content');
    });

    it('should hide video with default reason if not provided', async () => {
      const hiddenVideo = { ...mockVideo, isHidden: true, hideReason: 'Hidden by moderator' };
      mockVideosService.hideVideo.mockResolvedValue(hiddenVideo);

      await request(app.getHttpServer())
        .put('/api/videos/video-1/hide')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.MODERATOR)
        .send({})
        .expect(200);

      expect(mockVideosService.hideVideo).toHaveBeenCalledWith('video-1', 'Hidden by moderator');
    });

    it('should allow SUPER_ADMIN to hide video', async () => {
      const hiddenVideo = { ...mockVideo, isHidden: true };
      mockVideosService.hideVideo.mockResolvedValue(hiddenVideo);

      await request(app.getHttpServer())
        .put('/api/videos/video-1/hide')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.SUPER_ADMIN)
        .send({ reason: 'Admin decision' })
        .expect(200);

      expect(mockVideosService.hideVideo).toHaveBeenCalled();
    });

    it('should return 403 without authentication (RolesGuard blocks first)', async () => {
      await request(app.getHttpServer())
        .put('/api/videos/video-1/hide')
        .send({ reason: 'Test' })
        .expect(403);

      expect(mockVideosService.hideVideo).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // MODERATOR ROUTES - PUT /api/videos/:id/unhide
  // ========================================

  describe('PUT /api/videos/:id/unhide', () => {
    it('should unhide video with MODERATOR role', async () => {
      const unhiddenVideo = { ...mockVideo, isHidden: false, hideReason: null };
      mockVideosService.unhideVideo.mockResolvedValue(unhiddenVideo);

      const response = await request(app.getHttpServer())
        .put('/api/videos/video-1/unhide')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.MODERATOR)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'video-1',
        isHidden: false,
      });
      expect(mockVideosService.unhideVideo).toHaveBeenCalledWith('video-1');
    });

    it('should allow SUPER_ADMIN to unhide video', async () => {
      const unhiddenVideo = { ...mockVideo, isHidden: false };
      mockVideosService.unhideVideo.mockResolvedValue(unhiddenVideo);

      await request(app.getHttpServer())
        .put('/api/videos/video-1/unhide')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.SUPER_ADMIN)
        .expect(200);

      expect(mockVideosService.unhideVideo).toHaveBeenCalled();
    });

    it('should return 404 for non-existent video', async () => {
      mockVideosService.unhideVideo.mockRejectedValue(
        new NotFoundException('Video not found')
      );

      const response = await request(app.getHttpServer())
        .put('/api/videos/non-existent/unhide')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.MODERATOR)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 403 without authentication', async () => {
      await request(app.getHttpServer())
        .put('/api/videos/video-1/unhide')
        .expect(403);

      expect(mockVideosService.unhideVideo).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // MODERATOR ROUTES - PUT /api/videos/:id/category
  // ========================================

  describe('PUT /api/videos/:id/category', () => {
    it('should update video category with MODERATOR role', async () => {
      const updatedVideo = { ...mockVideo, categoryId: 'cat-2' };
      mockVideosService.update.mockResolvedValue(updatedVideo);

      const response = await request(app.getHttpServer())
        .put('/api/videos/video-1/category')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.MODERATOR)
        .send({ categoryId: 'cat-2' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'video-1',
        categoryId: 'cat-2',
      });
      expect(mockVideosService.update).toHaveBeenCalledWith('video-1', { categoryId: 'cat-2' });
    });

    it('should allow SUPER_ADMIN to update category', async () => {
      const updatedVideo = { ...mockVideo, categoryId: 'cat-2' };
      mockVideosService.update.mockResolvedValue(updatedVideo);

      await request(app.getHttpServer())
        .put('/api/videos/video-1/category')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.SUPER_ADMIN)
        .send({ categoryId: 'cat-2' })
        .expect(200);

      expect(mockVideosService.update).toHaveBeenCalled();
    });

    it('should return 404 for non-existent category', async () => {
      mockVideosService.update.mockRejectedValue(
        new NotFoundException('Category not found')
      );

      const response = await request(app.getHttpServer())
        .put('/api/videos/video-1/category')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.MODERATOR)
        .send({ categoryId: 'non-existent' })
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 403 without authentication', async () => {
      await request(app.getHttpServer())
        .put('/api/videos/video-1/category')
        .send({ categoryId: 'cat-2' })
        .expect(403);

      expect(mockVideosService.update).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // MODERATOR ROUTES - PUT /api/videos/:id/quality
  // ========================================

  describe('PUT /api/videos/:id/quality', () => {
    it('should update video quality with MODERATOR role', async () => {
      const qualityData = {
        qualityScore: 9,
        tags: ['excellent', 'hd'],
      };
      const updatedVideo = { ...mockVideo, ...qualityData };
      mockVideosService.update.mockResolvedValue(updatedVideo);

      const response = await request(app.getHttpServer())
        .put('/api/videos/video-1/quality')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.MODERATOR)
        .send(qualityData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'video-1',
        qualityScore: 9,
      });
      expect(mockVideosService.update).toHaveBeenCalledWith('video-1', qualityData);
    });

    it('should allow SUPER_ADMIN to update quality', async () => {
      const qualityData = { qualityScore: 7 };
      const updatedVideo = { ...mockVideo, ...qualityData };
      mockVideosService.update.mockResolvedValue(updatedVideo);

      await request(app.getHttpServer())
        .put('/api/videos/video-1/quality')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.SUPER_ADMIN)
        .send(qualityData)
        .expect(200);

      expect(mockVideosService.update).toHaveBeenCalled();
    });

    it('should return 404 for non-existent video', async () => {
      mockVideosService.update.mockRejectedValue(
        new NotFoundException('Video not found')
      );

      const response = await request(app.getHttpServer())
        .put('/api/videos/non-existent/quality')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.MODERATOR)
        .send({ qualityScore: 8 })
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 403 without authentication', async () => {
      await request(app.getHttpServer())
        .put('/api/videos/video-1/quality')
        .send({ qualityScore: 8 })
        .expect(403);

      expect(mockVideosService.update).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // SUPER_ADMIN ROUTES - DELETE /api/videos/:id
  // ========================================

  describe('DELETE /api/videos/:id', () => {
    it('should delete video with SUPER_ADMIN role', async () => {
      mockVideosService.delete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/api/videos/video-1')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.SUPER_ADMIN)
        .expect(204);

      expect(mockVideosService.delete).toHaveBeenCalledWith('video-1');
    });

    it('should return 403 with MODERATOR role (insufficient permissions)', async () => {
      await request(app.getHttpServer())
        .delete('/api/videos/video-1')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.MODERATOR)
        .expect(403);

      expect(mockVideosService.delete).not.toHaveBeenCalled();
    });

    it('should return 403 with ADMIN role (insufficient permissions)', async () => {
      await request(app.getHttpServer())
        .delete('/api/videos/video-1')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.ADMIN)
        .expect(403);

      expect(mockVideosService.delete).not.toHaveBeenCalled();
    });

    it('should return 403 without authentication', async () => {
      await request(app.getHttpServer())
        .delete('/api/videos/video-1')
        .expect(403);

      expect(mockVideosService.delete).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // ERROR HANDLING & VALIDATION
  // ========================================

  describe('Error Handling', () => {
    it('should validate event year range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/videos?eventYear=1980')
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle service-level errors', async () => {
      mockVideosService.findAll.mockRejectedValue(
        new BadRequestException('Invalid filter combination')
      );

      const response = await request(app.getHttpServer())
        .get('/api/videos?bandId=invalid')
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('Invalid filter combination');
    });

    it('should transform query parameters to correct types', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      await request(app.getHttpServer())
        .get('/api/videos?page=2&limit=10&eventYear=2024&includeHidden=true')
        .expect(200);

      expect(mockVideosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2, // number
          limit: 10, // number
          eventYear: 2024, // number
          includeHidden: true, // boolean
        })
      );
    });
  });

  // ========================================
  // RESPONSE FORMAT VALIDATION
  // ========================================

  describe('Response Formats', () => {
    it('should return paginated list format with metadata', async () => {
      mockVideosService.findAll.mockResolvedValue(mockPaginatedResponse);

      const response = await request(app.getHttpServer())
        .get('/api/videos')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page');
      expect(response.body.meta).toHaveProperty('limit');
      expect(response.body.meta).toHaveProperty('totalPages');
      expect(response.body.meta).toHaveProperty('hasNextPage');
      expect(response.body.meta).toHaveProperty('hasPreviousPage');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 204 No Content for successful delete', async () => {
      mockVideosService.delete.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .delete('/api/videos/video-1')
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-role', AdminRole.SUPER_ADMIN)
        .expect(204);

      expect(response.body).toEqual({});
    });
  });
});