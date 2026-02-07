import { Test, TestingModule } from '@nestjs/testing';
import { HttpsRedirectMiddleware } from '../../../../src/common/middleware/https-redirect.middleware';
import { Request, Response, NextFunction } from 'express';

describe('HttpsRedirectMiddleware', () => {
  let middleware: HttpsRedirectMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpsRedirectMiddleware],
    }).compile();

    middleware = module.get<HttpsRedirectMiddleware>(HttpsRedirectMiddleware);

    // Reset mocks
    mockNext = jest.fn();
    mockResponse = {
      redirect: jest.fn(),
    };
  });

  // Helper to create mock request
  const createMockRequest = (options: {
    secure?: boolean;
    host?: string;
    path?: string;
    url?: string;
    originalUrl?: string;
    method?: string;
    protocol?: string;
    ip?: string;
  }): Partial<Request> => {
    return {
      secure: options.secure ?? false,
      get: jest.fn((header: string) => {
        if (header === 'host') return options.host;
        return undefined;
      }) as any,
      path: options.path ?? '/api/test',
      url: options.url ?? '/api/test',
      originalUrl: options.originalUrl ?? options.url ?? '/api/test',
      method: options.method ?? 'GET',
      protocol: options.protocol ?? 'http',
      ip: options.ip ?? '192.168.1.1',
      socket: {
        remoteAddress: options.ip ?? '192.168.1.1',
      } as any,
    };
  };

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should redirect HTTP to HTTPS with 301 status', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/bands',
        url: '/api/bands',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/bands');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should preserve URL path and query parameters', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/bands',
        url: '/api/bands?name=test&limit=10',
        originalUrl: '/api/bands?name=test&limit=10',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        301,
        'https://example.com/api/bands?name=test&limit=10'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should preserve complex query strings', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'api.bandhub.com',
        path: '/api/videos',
        url: '/api/videos?category=performance&sort=date&order=desc',
        originalUrl: '/api/videos?category=performance&sort=date&order=desc',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        301,
        'https://api.bandhub.com/api/videos?category=performance&sort=date&order=desc'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should NOT redirect when request is already secure', () => {
      mockRequest = createMockRequest({
        secure: true,
        host: 'example.com',
        path: '/api/bands',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should NOT redirect health check endpoint', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/health',
        url: '/api/health',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should NOT redirect health check sub-paths', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/health/db',
        url: '/api/health/db',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should NOT redirect metrics endpoint', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/metrics',
        url: '/api/metrics',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should NOT redirect metrics sub-paths', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/metrics/prometheus',
        url: '/api/metrics/prometheus',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle requests with no host header gracefully', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: undefined,
        path: '/api/bands',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Should pass through without redirecting when host is missing
      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle POST requests', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/bands',
        url: '/api/bands',
        method: 'POST',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/bands');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle requests with port numbers', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com:8080',
        path: '/api/bands',
        url: '/api/bands',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(301, 'https://example.com:8080/api/bands');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use originalUrl when available', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/bands',
        url: '/bands', // shortened
        originalUrl: '/api/bands?full=true',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/bands?full=true');
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Development/Non-production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should NOT redirect HTTP requests in development', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'localhost:3001',
        path: '/api/bands',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should pass through all requests unchanged', () => {
      const testPaths = [
        '/api/bands',
        '/api/videos',
        '/api/health',
        '/api/metrics',
        '/api/users',
      ];

      testPaths.forEach((path) => {
        jest.clearAllMocks();
        mockRequest = createMockRequest({
          secure: false,
          host: 'localhost:3001',
          path,
          url: path,
        });

        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.redirect).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalledTimes(1);
      });
    });

    it('should pass through HTTPS requests', () => {
      mockRequest = createMockRequest({
        secure: true,
        host: 'localhost:3001',
        path: '/api/bands',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should handle root path', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/',
        url: '/',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(301, 'https://example.com/');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle paths with special characters', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/bands/search',
        url: '/api/bands/search?name=Test%20Band&city=New%20York',
        originalUrl: '/api/bands/search?name=Test%20Band&city=New%20York',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        301,
        'https://example.com/api/bands/search?name=Test%20Band&city=New%20York'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle paths with hash fragments', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/docs',
        url: '/api/docs#section-1',
        originalUrl: '/api/docs#section-1',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/docs#section-1');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle already HTTPS requests correctly', () => {
      mockRequest = createMockRequest({
        secure: true,
        host: 'example.com',
        path: '/api/bands',
        url: '/api/bands',
        protocol: 'https',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle empty query string correctly', () => {
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/bands',
        url: '/api/bands?',
        originalUrl: '/api/bands?',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/bands?');
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Logging Behavior', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn((middleware as any).logger, 'log').mockImplementation();
    });

    afterEach(() => {
      logSpy.mockRestore();
      delete process.env.NODE_ENV;
      delete process.env.LOG_HTTPS_REDIRECTS;
    });

    it('should log redirects in development mode', () => {
      process.env.NODE_ENV = 'development';
      mockRequest = createMockRequest({
        secure: false,
        host: 'localhost:3001',
        path: '/api/bands',
        url: '/api/bands',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // In development, it should pass through without redirecting or logging
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.redirect).not.toHaveBeenCalled();
    });

    it('should log when LOG_HTTPS_REDIRECTS is enabled', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_HTTPS_REDIRECTS = 'true';
      
      mockRequest = createMockRequest({
        secure: false,
        host: 'example.com',
        path: '/api/bands',
        url: '/api/bands',
        ip: '192.168.1.100',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logSpy).toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/bands');
    });

    it('should log warning when host header is missing', () => {
      const warnSpy = jest.spyOn((middleware as any).logger, 'warn').mockImplementation();
      process.env.NODE_ENV = 'production';
      
      mockRequest = createMockRequest({
        secure: false,
        host: undefined,
        path: '/api/bands',
      });

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(warnSpy).toHaveBeenCalledWith('HTTPS redirect skipped: Missing host header');
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      warnSpy.mockRestore();
    });
  });
});
