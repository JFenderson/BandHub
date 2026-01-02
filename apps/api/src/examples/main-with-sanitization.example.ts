/**
 * Example: Integrating SanitizationPipe in main.ts
 * 
 * This shows how to register the SanitizationPipe globally.
 * The pipe will run BEFORE ValidationPipe, transforming dangerous input
 * into safe data before validation occurs.
 * 
 * Order of execution:
 * 1. SanitizationPipe - Cleans the input
 * 2. ValidationPipe - Validates the cleaned input
 * 3. Your controller - Receives clean, validated data
 * 
 * File: apps/api/src/main.ts
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../app.module';
import { SanitizationPipe } from '../common/pipes/sanitization.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-session-token',
      'cache-control',
      'x-requested-with',
      'accept',
      'origin',
    ],
    exposedHeaders: ['set-cookie'],
    maxAge: 3600,
  });

  // ========================================
  // IMPORTANT: Order matters!
  // ========================================
  
  // 1. FIRST: Apply sanitization pipe
  // This transforms potentially dangerous input into safe data
  app.useGlobalPipes(
    new SanitizationPipe({
      enableLogging: process.env.NODE_ENV === 'development', // Log in dev only
      recursive: true, // Sanitize nested objects
    }),
  );

  // 2. SECOND: Apply validation pipe
  // This validates the now-sanitized data
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
    .setDescription('API for managing HBCU marching band videos and profiles')
    .setVersion('1.0')
    .addTag('bands', 'Band profiles and management')
    .addTag('videos', 'Video library and filtering')
    .addTag('categories', 'Video categories')
    .addTag('search', 'Full-text search')
    .addTag('admin', 'Administrative actions')
    .addTag('auth', 'Authentication endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.API_PORT || 3001;
  await app.listen(port);

  console.log(`🚀 API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
  console.log(`🔒 Input sanitization enabled`);
}

bootstrap();