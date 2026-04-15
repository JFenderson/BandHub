import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { CacheService } from '@bandhub/cache';
import { QueueService } from './queue/queue.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import {
  correlationIdMiddleware,
  createHttpLogger,
  initSentry,
  startTracing,
} from '@hbcu-band-hub/observability';
import * as Sentry from '@sentry/node';
import { SanitizationPipe } from './common';
import { VersioningType } from '@nestjs/common';
import compression from 'compression';
import { MetricsService } from './metrics/metrics.service';
import { VersionDeprecationMiddleware } from './common/middleware/version-deprecation.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { HttpsRedirectMiddleware } from './common/middleware/https-redirect.middleware';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter as BullBoardExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';

async function bootstrap() {
  startTracing('api');
  initSentry('api');
const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Trust 1 proxy hop (Traefik) so req.secure and req.ip are set correctly
  // from X-Forwarded-Proto and X-Forwarded-For headers
  app.set('trust proxy', 1);

  // Get metrics service for compression stats
  const metricsService = app.get(MetricsService);

  // Configure compression middleware
  const isProduction = process.env.NODE_ENV === 'production';
  const compressionLevel = isProduction ? 9 : 6; // Max compression for prod, balanced for dev

  app.use(
    compression({
      level: compressionLevel,
      threshold: 1024, // 1kb minimum size to compress
      filter: (req, res) => {
        // Skip compression for health and metrics endpoints
        if (req.url?.startsWith('/api/health') || req.url?.startsWith('/api/v1/health') || req.url?.startsWith('/api/metrics') || req.url?.startsWith('/api/v1/metrics')) {
          return false;
        }
        // Use default filter for other requests (compresses JSON, text, etc.)
        return compression.filter(req, res);
      },
    }),
  );

  // Track compression stats in metrics
  app.use((req: any, res: any, next: any) => {
    const originalEnd = res.end;
    res.end = function (chunk: any, encoding?: any, callback?: any) {
      // Track compressed vs uncompressed responses
      const contentEncoding = res.getHeader('content-encoding');
      if (contentEncoding === 'gzip' || contentEncoding === 'deflate' || contentEncoding === 'br') {
        metricsService.compressedResponses.inc({ encoding: contentEncoding as string });
        const contentLength = res.getHeader('content-length');
        if (contentLength) {
          metricsService.compressedBytes.inc(parseInt(contentLength as string, 10));
        }
      }
      return originalEnd.call(this, chunk, encoding, callback);
    };
    next();
  });

  app.use(correlationIdMiddleware as never);
  app.use(createHttpLogger());

  // Apply security headers middleware
  const securityHeadersMiddleware = new SecurityHeadersMiddleware();
  app.use(securityHeadersMiddleware.use.bind(securityHeadersMiddleware));

  // Add version deprecation middleware
  const versionDeprecationMiddleware = new VersionDeprecationMiddleware();
  app.use(versionDeprecationMiddleware.use.bind(versionDeprecationMiddleware));

  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enable API Versioning (URI Versioning e.g., /api/v1/bands)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: process.env.NODE_ENV === 'production'
      ? [
          'Content-Type',
          'Authorization',
          'x-session-token',
          'cache-control',
          'pragma',
          'x-requested-with',
          'accept',
          'origin',
        ]
      : '*', // Allow all headers in development
    exposedHeaders: ['set-cookie'],
    maxAge: 3600, // Cache preflight for 1 hour
  });

  // Force HTTPS in production
  const httpsRedirectMiddleware = new HttpsRedirectMiddleware();
  app.use(httpsRedirectMiddleware.use.bind(httpsRedirectMiddleware));

app.useGlobalPipes(
  new SanitizationPipe({
    enableLogging: process.env.NODE_ENV === 'development',
    recursive: true,
  }),
);

  // Global validation pipe - validates all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error if extra properties sent
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert query params to correct types
      },
    }),
  );

  // Swagger API documentation
const config = new DocumentBuilder()
    .setTitle('HBCU Band Hub API')
    .setDescription(
      `
# HBCU Band Hub API Documentation

Welcome to the comprehensive API reference for the HBCU Band Hub platform.

## 🔐 Authentication
This API uses **JWT (JSON Web Token)** for authentication.
1. Call \`/auth/login\` to retrieve an \`accessToken\`.
2. Send the token in the \`Authorization\` header: \`Bearer <your_token>\`.

## 🚀 Rate Limiting
Rate limits are applied based on IP address or User ID:
* **Public**: 100 requests / hour
* **Auth**: 5 attempts / 15 mins
* **Search**: 20 requests / min
* **Admin**: 1000 requests / hour

## 📦 Rate Limit Headers
The API includes standard rate limit headers in responses:
* \`X-RateLimit-Limit\`: The maximum number of requests allowed in the window.
* \`X-RateLimit-Remaining\`: The number of requests remaining in the current window.
* \`X-RateLimit-Reset\`: The time at which the current window resets.

## 🗜️ Response Compression
The API automatically compresses responses using gzip/deflate when:
* Response size exceeds 1KB threshold
* Client supports compression (sends \`Accept-Encoding\` header)
* Endpoint is not \`/api/health\` or \`/api/metrics\` (excluded for monitoring)

Compression levels:
* **Production**: Level 9 (maximum compression)
* **Development**: Level 6 (balanced speed/compression)

Supported content types: JSON, text, HTML, CSS, JavaScript, and other compressible formats.

## 📁 File Uploads
Endpoints accepting files use \`multipart/form-data\`. Ensure your client sets the correct Content-Type.
      `
    )
    .setVersion('1.0')
    .setContact('API Support', 'https://hbcubandhub.com/support', 'support@hbcubandhub.com')
    .setLicense('Proprietary', 'https://hbcubandhub.com/terms')
    .addServer('http://localhost:3001', 'Local Development')
    .addServer('https://api.staging.hbcubandhub.com', 'Staging Environment')
    .addServer('https://api.hbcubandhub.com', 'Production Environment')
    
    // Tags for logical grouping
    .addTag('Auth', 'User authentication, registration, and token management')
    .addTag('Bands', 'Band profiles, media, and featured status')
    .addTag('Videos', 'Video library, processing, and YouTube sync')
    .addTag('Search', 'Advanced search and filtering capabilities')
    .addTag('Admin', 'System administration and content moderation')
    .addTag('Webhooks', 'Incoming webhook handlers (Future Integration)')
    
    // Security Definition
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  // Serve static uploads
  // Use __dirname to reliably find the uploads folder relative to the compiled main.js
  // main.js compiles to apps/api/dist/main.js, so go up 1 level to apps/api, then uploads
  const uploadsPath = join(__dirname, '..', 'uploads');

  console.log('📁 Static uploads path:', uploadsPath);

  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
  });

  const document = SwaggerModule.createDocument(app, config);
  // Set up Swagger UI
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keep user logged in across reloads
      displayRequestDuration: true, // Show request duration
      filter: true, // Enable search bar for tags
      syntaxHighlight: { theme: 'monokai' }, // Syntax highlighting theme
      tryItOutEnabled: true, // Enable "Try it out" by default
      docExpansion: 'list', // How to display operations (none, list, full)
      defaultModelsExpandDepth: 2, // How deep to expand models
      defaultModelExpandDepth: 2, // Default depth for model expansion
      displayOperationId: false, // Hide operation IDs
      showExtensions: true, // Show vendor extensions
      showCommonExtensions: true, // Show common extensions
    },
    customSiteTitle: 'HBCU Band Hub API Docs',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .scheme-container { padding: 20px 0; }
    `,
    customfavIcon: '/favicon.ico',
  });

Sentry.setupExpressErrorHandler(app.getHttpAdapter().getInstance());

  // BullBoard — queue monitoring UI at /queues
  // Protected by BULL_BOARD_TOKEN env var (set in Doppler as BULL_BOARD_TOKEN)
  const bullBoardToken = process.env.BULL_BOARD_TOKEN;
  if (bullBoardToken) {
    const redisOpts = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    };
    const queues = ['video-sync', 'video-processing', 'maintenance'].map(
      (name) => new BullMQAdapter(new Queue(name, { connection: redisOpts })),
    );
    const serverAdapter = new BullBoardExpressAdapter();
    serverAdapter.setBasePath('/queues');
    createBullBoard({ queues, serverAdapter });

    // Token-based middleware — pass ?token=<BULL_BOARD_TOKEN> or Authorization: Bearer <token>
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use('/queues', (req: any, res: any, next: any) => {
      const queryToken = req.query?.token;
      const authHeader: string = req.headers?.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (queryToken === bullBoardToken || bearerToken === bullBoardToken) {
        return next();
      }
      res.status(401).json({ message: 'Unauthorized' });
    });
    expressApp.use('/queues', serverAdapter.getRouter());
    console.log('📊 BullBoard available at http://localhost:' + (process.env.API_PORT || 3001) + '/queues');
  } else {
    console.log('ℹ️  BullBoard disabled — set BULL_BOARD_TOKEN to enable');
  }

  const port = process.env.API_PORT || 3001;
  await app.listen(port);

  console.log('🚀 API running on http://localhost:' + port);
  console.log('📚 Swagger docs at http://localhost:' + port + '/api/docs');
  // Enable NestJS shutdown hooks so providers can react to shutdown
  app.enableShutdownHooks();

  const gracefulShutdown = async (signal: string) => {
    console.log('Received', signal + ', starting graceful shutdown...');
    try {
      const queueService = app.get(QueueService, { strict: false });
      if (queueService) {
        await queueService.pauseAllQueues();
      }

      // Give some time for in-flight requests to finish
      await new Promise((res) => setTimeout(res, 1000));

      await app.close();
      console.log('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('Error during graceful shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap();
