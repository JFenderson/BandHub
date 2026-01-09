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

async function bootstrap() {
  startTracing('api');
  initSentry('api');
const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.use(correlationIdMiddleware as never);
  app.use(createHttpLogger());


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
          'x-requested-with',
          'accept',
          'origin',
        ]
      : '*', // Allow all headers in development
    exposedHeaders: ['set-cookie'],
    maxAge: 3600, // Cache preflight for 1 hour
  });

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

  app.useStaticAssets(join(__dirname, '..', '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const document = SwaggerModule.createDocument(app, config);
// Set up Swagger UI
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keep user logged in across reloads
      displayRequestDuration: true,
      filter: true, // Enable search bar for tags
      syntaxHighlight: { theme: 'monokai' },
    },
    customSiteTitle: 'HBCU Band Hub API Docs',
  });

Sentry.setupExpressErrorHandler(app.getHttpAdapter().getInstance());
  
  const port = process.env.API_PORT || 3001;
  await app.listen(port);

  console.log(`🚀 API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
  // Enable NestJS shutdown hooks so providers can react to shutdown
  app.enableShutdownHooks();

  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, starting graceful shutdown...`);
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
