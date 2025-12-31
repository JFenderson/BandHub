jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));


import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { LoggingInterceptor } from '../../../../src/common/interceptors/logging.interceptor';

import type { Logger } from 'pino';

// Mock the entire observability package
jest.mock('@hbcu-band-hub/observability');

// Import after mocking 
import { createLogger, getCorrelationId } from '@hbcu-band-hub/observability';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockLogger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    
      (createLogger as jest.Mock).mockReturnValue(mockLogger);
  (getCorrelationId as jest.Mock).mockReturnValue('test-correlation-id');

    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  // Helper function to create mock ExecutionContext
  const createMockContext = (
    method: string = 'GET',
    path: string = '/api/videos',
    headers: any = {},
    user?: any,
  ): ExecutionContext => {
    const request = {
      method,
      url: `${path}?limit=10`,
      path,
      headers: {
        'user-agent': 'test-agent',
        ...headers,
      },
      query: { limit: '10' },
      user,
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };

    const response = {
      statusCode: 200,
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getType: () => 'http',
    } as any;
  };

  // Helper function to create mock CallHandler
  const createMockCallHandler = (result?: any, error?: any): CallHandler => ({
    handle: () => (error ? throwError(() => error) : of(result)),
  });

  describe('Basic Functionality', () => {
    it('should be defined', () => {
      expect(interceptor).toBeDefined();
    });

    it('should intercept HTTP requests', (done) => {
      const context = createMockContext();
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: (result) => {
          expect(result).toEqual({ data: 'test' });
          done();
        },
      });
    });

    it('should skip non-HTTP contexts', (done) => {
      const context = {
        getType: () => 'rpc',
      } as any;
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: (result) => {
          expect(result).toEqual({ data: 'test' });
          expect(mockLogger.info).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('Request ID and Correlation ID', () => {
    it('should generate request ID if not present', (done) => {
      const context = createMockContext();
      const next = createMockCallHandler({ data: 'test' });
      const request = context.switchToHttp().getRequest();

      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(request.id).toBeDefined();
          expect(typeof request.id).toBe('string');
          done();
        },
      });
    });

    it('should use existing request ID if present', (done) => {
      const context = createMockContext();
      const request = context.switchToHttp().getRequest();
      request.id = 'existing-id';
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(request.id).toBe('existing-id');
          done();
        },
      });
    });

    it('should use correlation ID from middleware', (done) => {
      const context = createMockContext();
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
         expect(getCorrelationId).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should set correlation ID and request ID headers', (done) => {
      const context = createMockContext();
      const response = context.switchToHttp().getResponse();
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(response.setHeader).toHaveBeenCalledWith(
            'X-Correlation-ID',
            expect.any(String),
          );
          expect(response.setHeader).toHaveBeenCalledWith(
            'X-Request-ID',
            expect.any(String),
          );
          done();
        },
      });
    });
  });

  describe('Request Logging', () => {
    it('should log incoming requests', (done) => {
      const context = createMockContext('POST', '/api/videos');
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(mockLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({
              method: 'POST',
              path: '/api/videos',
              level: 'info',
              context: 'REQUEST_START',
            }),
            expect.stringContaining('→ POST /api/videos'),
          );
          done();
        },
      });
    });

    it('should include query parameters in logs', (done) => {
      const context = createMockContext();
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(mockLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({
              query: { limit: '10' },
            }),
            expect.any(String),
          );
          done();
        },
      });
    });

    it('should exclude query parameters if empty', (done) => {
      const context = createMockContext();
      const request = context.switchToHttp().getRequest();
      request.query = {};
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const logCall = mockLogger.info.mock.calls[0][0];
          expect(logCall.query).toBeUndefined();
          done();
        },
      });
    });
  });

  describe('Response Logging', () => {
    it('should log successful responses', (done) => {
      const context = createMockContext();
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          // Should log both request start and request complete
          expect(mockLogger.info).toHaveBeenCalledTimes(2);
          expect(mockLogger.info).toHaveBeenLastCalledWith(
            expect.objectContaining({
              statusCode: 200,
              level: 'info',
              context: 'REQUEST_COMPLETE',
            }),
            expect.stringContaining('✓ GET /api/videos 200'),
          );
          done();
        },
      });
    });

    it('should include request duration', (done) => {
      const context = createMockContext();
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const responseLog = mockLogger.info.mock.calls[1][0];
          expect(responseLog.duration).toBeDefined();
          expect(typeof responseLog.duration).toBe('number');
          expect(responseLog.duration).toBeGreaterThanOrEqual(0);
          done();
        },
      });
    });
  });

  describe('Slow Query Detection', () => {
    it('should detect slow queries and log as warning', (done) => {
  const context = createMockContext();
  const next: CallHandler = {
    handle: () => {
      // Simulate slow response with delay operator
      return of({ data: 'test' }).pipe(
        delay(1100)
      );
    },
  };

      interceptor.intercept(context, next).subscribe({
        next: () => {
          // Find the warning log call for slow query
          const warningCalls = mockLogger.warn.mock.calls;
          expect(warningCalls.length).toBeGreaterThan(0);
          
          const slowQueryLog = warningCalls[warningCalls.length - 1][0];
          expect(slowQueryLog.performance).toEqual({
            slow: true,
            threshold: 1000,
          });
          expect(slowQueryLog.duration).toBeGreaterThan(1000);
          done();
        },
      });
    }, 10000); // Increase timeout for this test

    it('should not mark fast queries as slow', (done) => {
      const context = createMockContext();
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const responseLog = mockLogger.info.mock.calls[1][0];
          expect(responseLog.performance).toBeUndefined();
          done();
        },
      });
    });
  });

  describe('User Information', () => {
    it('should log authenticated user information', (done) => {
      const user = {
        userId: 'user-123',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN',
      };
      const context = createMockContext('GET', '/api/admin/users', {}, user);
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(mockLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({
              user: {
                userId: 'user-123',
                email: 'admin@example.com',
                role: 'SUPER_ADMIN',
              },
            }),
            expect.any(String),
          );
          done();
        },
      });
    });

    it('should handle unauthenticated requests', (done) => {
      const context = createMockContext();
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const requestLog = mockLogger.info.mock.calls[0][0];
          expect(requestLog.user).toBeUndefined();
          done();
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should log errors with full context', (done) => {
      const context = createMockContext();
      const error = new Error('Test error');
      (error as any).status = 500;
      const next = createMockCallHandler(null, error);

      interceptor.intercept(context, next).subscribe({
        error: (err) => {
       expect(mockLogger.error).toHaveBeenCalledWith(
  expect.objectContaining({
    level: 'error',
    statusCode: 500,
    context: 'REQUEST_ERROR',
    error: expect.objectContaining({
      message: 'Test error',
      name: 'Error',
      // Stack may or may not be present depending on NODE_ENV
    }),
  }),
  expect.stringContaining('✗ GET /api/videos 500'),
);
          expect(err).toBe(error);
          done();
        },
      });
    });

    it('should default to 500 status code for errors without status', (done) => {
      const context = createMockContext();
      const error = new Error('Unknown error');
      const next = createMockCallHandler(null, error);

      interceptor.intercept(context, next).subscribe({
        error: () => {
          const errorLog = mockLogger.error.mock.calls[0][0];
          expect(errorLog.statusCode).toBe(500);
          done();
        },
      });
    });
  });

  describe('Sensitive Header Filtering', () => {
    it('should redact authorization header', (done) => {
      const context = createMockContext('GET', '/api/videos', {
        authorization: 'Bearer secret-token',
      });
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const requestLog = mockLogger.info.mock.calls[0][0];
          expect(requestLog.headers.authorization).toBe('[REDACTED]');
          done();
        },
      });
    });

    it('should redact multiple sensitive headers', (done) => {
      const context = createMockContext('GET', '/api/videos', {
        authorization: 'Bearer token',
        cookie: 'session=abc123',
        'x-api-key': 'secret-key',
      });
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const requestLog = mockLogger.info.mock.calls[0][0];
          expect(requestLog.headers.authorization).toBe('[REDACTED]');
          expect(requestLog.headers.cookie).toBe('[REDACTED]');
          expect(requestLog.headers['x-api-key']).toBe('[REDACTED]');
          done();
        },
      });
    });

    it('should preserve non-sensitive headers', (done) => {
      const context = createMockContext('GET', '/api/videos', {
        'content-type': 'application/json',
        accept: 'application/json',
      });
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const requestLog = mockLogger.info.mock.calls[0][0];
          expect(requestLog.headers['content-type']).toBe('application/json');
          expect(requestLog.headers.accept).toBe('application/json');
          done();
        },
      });
    });
  });

  describe('Health Check Exclusion', () => {
    const healthPaths = [
      '/health',
      '/health/liveness',
      '/health/readiness',
      '/metrics',
      '/api/health',
      '/api/metrics',
    ];

    healthPaths.forEach((path) => {
      it(`should use debug logging for ${path}`, (done) => {
        const context = createMockContext('GET', path);
        const next = createMockCallHandler({ data: 'test' });

        interceptor.intercept(context, next).subscribe({
          next: () => {
            // Should not log at info level for health checks
            const infoCalls = mockLogger.info.mock.calls.filter((call: any[]) =>
              call[1].includes(path),
            );
            expect(infoCalls.length).toBe(0);

            // Should log at debug level instead
            expect(mockLogger.debug).toHaveBeenCalled();
            done();
          },
        });
      });
    });

    it('should use normal logging for non-health check endpoints', (done) => {
      const context = createMockContext('GET', '/api/videos');
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(mockLogger.info).toHaveBeenCalled();
          expect(mockLogger.debug).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('Client IP Extraction', () => {
    it('should extract IP from X-Forwarded-For header', (done) => {
      const context = createMockContext('GET', '/api/videos', {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      });
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const requestLog = mockLogger.info.mock.calls[0][0];
          expect(requestLog.ip).toBe('192.168.1.1');
          done();
        },
      });
    });

    it('should fall back to request.ip', (done) => {
      const context = createMockContext();
      const request = context.switchToHttp().getRequest();
      request.ip = '192.168.1.100';
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const requestLog = mockLogger.info.mock.calls[0][0];
          expect(requestLog.ip).toBe('192.168.1.100');
          done();
        },
      });
    });

    it('should use socket remote address as last resort', (done) => {
      const context = createMockContext();
      const request = context.switchToHttp().getRequest();
      request.ip = undefined;
      request.socket.remoteAddress = '192.168.1.200';
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const requestLog = mockLogger.info.mock.calls[0][0];
          expect(requestLog.ip).toBe('192.168.1.200');
          done();
        },
      });
    });
  });

  describe('Status Code Handling', () => {
    it('should log 4xx responses as warnings', (done) => {
      const context = createMockContext();
      const response = context.switchToHttp().getResponse();
      response.statusCode = 404;
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const warningLog = mockLogger.warn.mock.calls[0][0];
          expect(warningLog.statusCode).toBe(404);
          expect(warningLog.level).toBe('warn');
          done();
        },
      });
    });

    it('should log 5xx responses as errors', (done) => {
      const context = createMockContext();
      const response = context.switchToHttp().getResponse();
      response.statusCode = 500;
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const errorLog = mockLogger.error.mock.calls[0][0];
          expect(errorLog.statusCode).toBe(500);
          expect(errorLog.level).toBe('error');
          done();
        },
      });
    });

    it('should log 2xx responses as info', (done) => {
      const context = createMockContext();
      const response = context.switchToHttp().getResponse();
      response.statusCode = 201;
      const next = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, next).subscribe({
        next: () => {
          const infoLog = mockLogger.info.mock.calls[1][0];
          expect(infoLog.statusCode).toBe(201);
          expect(infoLog.level).toBe('info');
          done();
        },
      });
    });
  });
});