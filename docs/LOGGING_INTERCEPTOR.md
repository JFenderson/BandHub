# Logging Interceptor Integration Guide

This guide explains how to integrate the comprehensive logging interceptor into the HBCU Band Hub API.

## Overview

The `LoggingInterceptor` provides:
- **Request/Response Correlation**: UUID-based request IDs for tracing
- **Performance Monitoring**: Automatic detection of slow queries (>1000ms)
- **User Activity Auditing**: Captures authenticated user information from JWT
- **Structured Logging**: JSON format for production environments
- **Error Tracking**: Full error details with stack traces
- **Distributed Tracing**: Correlation IDs for microservices
- **Security**: Sensitive header filtering
- **Optimization**: Health check exclusion from verbose logging

## Integration Options

### Option 1: Global Registration (Recommended)

Register the interceptor globally in `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
// ... other imports

@Module({
  imports: [
    // ... your existing imports
  ],
  providers: [
    // ... your existing providers
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
```

### Option 2: Replace Existing RequestObserverInterceptor

If you want to replace the existing `RequestObserverInterceptor` in `ObservabilityModule`:

**File: `apps/api/src/observability/observability.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor, // Changed from RequestObserverInterceptor
    },
  ],
})
export class ObservabilityModule {}
```

### Option 3: Controller-Level Usage

For specific controllers only:

```typescript
import { Controller, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

@Controller('videos')
@UseInterceptors(LoggingInterceptor)
export class VideosController {
  // ... controller methods
}
```

### Option 4: Method-Level Usage

For specific endpoints:

```typescript
import { Get, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

@Get()
@UseInterceptors(LoggingInterceptor)
async findAll() {
  // ... method implementation
}
```

## Features in Detail

### 1. Request ID Generation

Every request automatically receives a unique UUID:

```
X-Request-ID: 123e4567-e89b-12d3-a456-426614174000
X-Correlation-ID: 987fcdeb-51a2-43d7-b891-234567890abc
```

These headers are added to responses for client-side tracing.

### 2. Slow Query Detection

Requests taking longer than 1000ms are logged as warnings:

```json
{
  "timestamp": "2024-12-30T10:30:45.123Z",
  "level": "warn",
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "correlationId": "987fcdeb-51a2-43d7-b891-234567890abc",
  "method": "GET",
  "url": "/api/videos?limit=100",
  "path": "/api/videos",
  "statusCode": 200,
  "duration": 1523,
  "performance": {
    "slow": true,
    "threshold": 1000
  },
  "context": "REQUEST_COMPLETE"
}
```

### 3. User Activity Auditing

Authenticated requests automatically log user information:

```json
{
  "timestamp": "2024-12-30T10:30:45.123Z",
  "level": "info",
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "user": {
    "userId": "user_abc123",
    "email": "admin@example.com",
    "role": "SUPER_ADMIN"
  },
  "method": "POST",
  "path": "/api/videos/123/hide",
  "statusCode": 200,
  "duration": 145
}
```

### 4. Error Tracking

Errors are logged with full context:

```json
{
  "timestamp": "2024-12-30T10:30:45.123Z",
  "level": "error",
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "method": "GET",
  "path": "/api/videos/nonexistent",
  "statusCode": 404,
  "duration": 23,
  "error": {
    "message": "Video not found",
    "name": "NotFoundException",
    "stack": "Error: Video not found\n    at ..." // Only in development
  },
  "context": "REQUEST_ERROR"
}
```

### 5. Health Check Exclusion

Health check endpoints are logged at debug level only, reducing noise:

```typescript
// These paths are excluded from verbose logging:
/health
/health/liveness
/health/readiness
/metrics
/api/health
/api/metrics
```

### 6. Sensitive Header Filtering

Security-sensitive headers are automatically redacted:

```json
{
  "headers": {
    "user-agent": "Mozilla/5.0...",
    "accept": "application/json",
    "authorization": "[REDACTED]",
    "cookie": "[REDACTED]",
    "x-api-key": "[REDACTED]"
  }
}
```

## Configuration

### Environment Variables

The interceptor respects these environment variables:

- `NODE_ENV`: Controls stack trace inclusion (production hides them)
- `LOG_LEVEL`: Set via observability package (default: 'info')

### Customization

To modify the slow query threshold:

```typescript
// In apps/api/src/common/interceptors/logging.interceptor.ts
private readonly SLOW_QUERY_THRESHOLD = 2000; // Change from 1000ms to 2000ms
```

To add more excluded paths:

```typescript
private readonly EXCLUDED_PATHS = [
  '/health',
  '/metrics',
  '/api/health',
  '/api/metrics',
  '/api/internal', // Add custom path
];
```

To modify sensitive headers list:

```typescript
private readonly SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-custom-secret', // Add custom header
];
```

## Log Examples

### Successful Request
```
✓ GET /api/bands 200 45ms
```

### Slow Request
```
⚠ SLOW GET /api/videos?limit=1000 200 1523ms (threshold: 1000ms)
```

### Failed Request
```
✗ GET /api/videos/invalid 404 23ms - Video not found
```

### Health Check (Debug)
```
✓ GET /health 200 2ms
```

## Integration with External Logging Services

The interceptor uses Pino logger from `@hbcu-band-hub/observability`, which can be configured to send logs to external services:

### Datadog Integration

```bash
npm install pino-datadog
```

```typescript
// In libs/observability/src/logger.ts
import pinoDatabog from 'pino-datadog';

export const createLogger = (service: string) => {
  const logger = pino({
    // ... existing options
  });
  
  if (process.env.DATADOG_API_KEY) {
    logger.pipe(pinoDatadog({
      apiKey: process.env.DATADOG_API_KEY,
      service: 'hbcu-band-hub-api',
    }));
  }
  
  return logger;
};
```

### Logtail Integration

```bash
npm install @logtail/pino
```

```typescript
import { LogtailTransport } from '@logtail/pino';

const logtail = new LogtailTransport(process.env.LOGTAIL_TOKEN);

export const createLogger = (service: string) => 
  pino({
    // ... existing options
  }, logtail);
```

## Testing

The interceptor can be tested using NestJS testing utilities:

```typescript
import { Test } from '@nestjs/testing';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });
});
```

## Monitoring and Analytics

### Query Performance Dashboard

Use the logged duration data to create dashboards:

```sql
-- Example: Average response times by endpoint
SELECT 
  path,
  AVG(duration) as avg_duration,
  MAX(duration) as max_duration,
  COUNT(*) as request_count
FROM logs
WHERE context = 'REQUEST_COMPLETE'
GROUP BY path
ORDER BY avg_duration DESC;
```

### User Activity Analytics

Track user actions:

```sql
-- Example: Most active users
SELECT 
  user->>'userId' as user_id,
  user->>'email' as email,
  COUNT(*) as action_count
FROM logs
WHERE user IS NOT NULL
GROUP BY user_id, email
ORDER BY action_count DESC
LIMIT 10;
```

### Error Rate Monitoring

Monitor application health:

```sql
-- Example: Error rate by endpoint
SELECT 
  path,
  COUNT(*) FILTER (WHERE level = 'error') * 100.0 / COUNT(*) as error_rate
FROM logs
WHERE context IN ('REQUEST_COMPLETE', 'REQUEST_ERROR')
GROUP BY path
HAVING COUNT(*) > 100 -- Only for endpoints with sufficient traffic
ORDER BY error_rate DESC;
```

## Best Practices

1. **Always use correlation IDs** when making external API calls to maintain trace continuity
2. **Monitor slow queries** regularly and optimize endpoints exceeding the threshold
3. **Review error logs** daily to catch and fix issues proactively
4. **Set up alerts** for high error rates or slow endpoints
5. **Use structured logging** - avoid string interpolation, use log objects
6. **Redact sensitive data** - never log passwords, tokens, or PII
7. **Configure log levels** appropriately for each environment (debug in dev, info in production)

## Troubleshooting

### Logs Not Appearing

1. Check that the interceptor is properly registered
2. Verify Pino logger configuration in observability package
3. Ensure LOG_LEVEL environment variable is set correctly

### Performance Impact

The interceptor has minimal overhead (<1ms per request). If you notice performance issues:

1. Increase the slow query threshold
2. Add more paths to EXCLUDED_PATHS
3. Reduce log verbosity in production

### Duplicate Logs

If you see duplicate logs, you may have multiple interceptors registered:

1. Check app.module.ts for APP_INTERCEPTOR providers
2. Verify controller-level @UseInterceptors decorators
3. Review ObservabilityModule and MetricsModule for conflicts

## Migration from RequestObserverInterceptor

To migrate from the existing `RequestObserverInterceptor`:

1. Update `ObservabilityModule` to use `LoggingInterceptor`
2. Remove or comment out `MetricsInterceptor` registration if not needed
3. Update any code that depends on specific log formats
4. Test thoroughly in development before deploying to production

The new interceptor provides all features of the old one plus:
- Request IDs
- User auditing
- Slow query detection
- Sensitive header filtering
- Better error context