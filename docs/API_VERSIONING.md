# API Versioning Guide

## Overview

BandHub API uses **URI-based versioning** to maintain backward compatibility while allowing the API to evolve. This guide explains how versioning works, how to use it, and best practices for managing API changes.

## Version Format

API versions follow the format: `/api/v{number}/{resource}`

**Examples:**
- `/api/v1/bands`
- `/api/v1/videos`
- `/api/v2/bands` (future version)

## Current Status

- **Current Version:** v1
- **Status:** Stable
- **Default Version:** v1 (configured in `apps/api/src/main.ts`)

## Backward Compatibility Policy

We maintain **6 months of backward compatibility** for deprecated API versions:

| Phase | Duration | Status | Headers | Description |
|-------|----------|--------|---------|-------------|
| **Current** | Ongoing | Stable | None | Current production version |
| **Warning** | 3 months | Deprecated | `Deprecation`, `X-API-Deprecation-Warning` | Version is deprecated but fully functional |
| **Sunset** | 3 months | Sunset | `Deprecation`, `Sunset`, `X-API-Replacement-Version` | Version will be removed soon |
| **Removed** | N/A | Gone | HTTP 410 | Version no longer available |

### Timeline Example

```
v1 Release          v2 Release          v1 Warning          v1 Sunset           v1 Removed
    │                   │                   │                   │                   │
    │◄──────────────────┤◄────3 months─────┤◄────3 months─────┤                   │
    │                   │                   │                   │                   │
    │   Stable v1       │   v1 Deprecated   │   v1 Sunset      │   v1 Removed     │
    │                   │   v2 Stable       │   v2 Stable      │   v2 Stable      │
    └───────────────────┴───────────────────┴──────────────────┴──────────────────►
                                                                                  Time
```

## How Versioning Works

### Backend (NestJS)

#### 1. Configuration

Versioning is enabled in `apps/api/src/main.ts`:

```typescript
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});

app.setGlobalPrefix('api');
```

#### 2. Controller Versioning

All controllers use the `@Controller` decorator with version specification:

```typescript
@Controller({ path: 'bands', version: '1' })
export class BandsController {
  // All endpoints automatically use /api/v1/bands
}
```

#### 3. Multiple Versions

You can maintain multiple versions of the same endpoint:

```typescript
// v1 - Original implementation
@Controller({ path: 'bands', version: '1' })
export class BandsControllerV1 {
  @Get()
  findAll() {
    return this.bandsService.findAllV1();
  }
}

// v2 - New implementation with breaking changes
@Controller({ path: 'bands', version: '2' })
export class BandsControllerV2 {
  @Get()
  findAll() {
    return this.bandsService.findAllV2(); // Different response format
  }
}
```

#### 4. Per-Endpoint Versioning

You can also version individual endpoints:

```typescript
@Controller({ path: 'bands', version: '1' })
export class BandsController {
  // Available in v1
  @Get()
  findAll() {
    return this.bandsService.findAll();
  }

  // Available in v1 and v2
  @Get(':id')
  @Version(['1', '2'])
  findOne(@Param('id') id: string) {
    return this.bandsService.findOne(id);
  }

  // Only available in v2
  @Get('featured')
  @Version('2')
  getFeatured() {
    return this.bandsService.getFeatured();
  }
}
```

### Frontend (Next.js)

#### 1. API Client Configuration

The API client in `apps/web/src/lib/api-client.ts` is configured to use v1 by default:

```typescript
const getApiUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.API_URL || 'http://localhost:3001/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
};
```

#### 2. Version Switching

You can programmatically switch API versions:

```typescript
import { apiClient } from '@/lib/api-client';

// Switch to v2 for testing
apiClient.setApiVersion('v2');

// Check current version
console.log(apiClient.getApiVersion()); // 'v2'
```

#### 3. Deprecation Warning Handling

Handle deprecation warnings in your application:

```typescript
import { apiClient, DeprecationWarning } from '@/lib/api-client';

apiClient.setOnDeprecationWarning((warning: DeprecationWarning) => {
  // Show toast notification
  toast.warning(`API ${warning.currentVersion} is deprecated`, {
    description: warning.message,
    action: warning.replacementVersion ? {
      label: `Upgrade to ${warning.replacementVersion}`,
      onClick: () => {
        // Handle upgrade
      }
    } : undefined
  });

  // Log to monitoring service
  analytics.track('api_deprecation_warning', {
    version: warning.currentVersion,
    replacement: warning.replacementVersion,
    sunsetDate: warning.sunsetDate,
  });
});
```

## Deprecation Workflow

### 1. Planning a New Version

Before creating a breaking change:

1. **Document the change**: Update API documentation
2. **Set timeline**: Plan 6-month deprecation period
3. **Communicate**: Notify API consumers via:
   - Release notes
   - Email notifications
   - In-app messages
   - API response headers

### 2. Implementing a New Version

```typescript
// Step 1: Create new controller with v2
@Controller({ path: 'bands', version: '2' })
export class BandsControllerV2 {
  @Get()
  async findAll() {
    // New implementation with breaking changes
    return {
      data: await this.bandsService.findAll(),
      meta: {
        version: 'v2',
        totalCount: await this.bandsService.count(),
      }
    };
  }
}

// Step 2: Keep v1 running
@Controller({ path: 'bands', version: '1' })
export class BandsControllerV1 {
  @Get()
  async findAll() {
    // Original implementation (deprecated)
    return this.bandsService.findAll();
  }
}
```

### 3. Marking a Version as Deprecated

Update the deprecation middleware in `apps/api/src/common/middleware/version-deprecation.middleware.ts`:

```typescript
private readonly deprecatedVersions: Map<string, DeprecationInfo> = new Map([
  ['v1', {
    deprecationDate: new Date('2026-01-21'),
    sunsetDate: new Date('2026-07-21'),
    replacementVersion: 'v2',
    message: 'API v1 is deprecated. Please migrate to v2. See /api/docs for migration guide.'
  }]
]);
```

### 4. Monitoring Version Usage

Track version usage through metrics:

```typescript
// Backend: Metrics are automatically collected by the deprecation middleware
const versionStats = versionDeprecationMiddleware.getVersionStats();
console.log(versionStats); // { v1: 1234, v2: 5678 }

// Frontend: Track API version in analytics
analytics.track('api_request', {
  version: apiClient.getApiVersion(),
  endpoint: '/bands',
});
```

### 5. Removing Deprecated Versions

After sunset period:

1. **Final warning**: Send notifications 2 weeks before removal
2. **Remove controller**: Delete deprecated controller file
3. **Update documentation**: Remove deprecated version from docs
4. **Monitor errors**: Watch for 410 Gone errors
5. **Remove middleware entry**: Clean up deprecation tracking

## Migration Guide Template

When introducing a new version, provide a migration guide:

### Migrating from v1 to v2

#### Breaking Changes

1. **Response Format Change**
   - **v1**: Returns array directly
     ```json
     [
       { "id": "1", "name": "Band A" }
     ]
     ```
   - **v2**: Returns object with data and metadata
     ```json
     {
       "data": [{ "id": "1", "name": "Band A" }],
       "meta": { "totalCount": 1, "version": "v2" }
     }
     ```

2. **New Required Parameters**
   - **v1**: `GET /bands?featured=true`
   - **v2**: `GET /bands?filter[featured]=true`

3. **Renamed Fields**
   - `band.image` → `band.imageUrl`
   - `band.createdAt` → `band.created`

#### Migration Steps

1. **Update API Client**
   ```typescript
   // Change from v1 to v2
   apiClient.setApiVersion('v2');
   ```

2. **Update Response Handling**
   ```typescript
   // v1 code
   const bands = await apiClient.getBands();
   console.log(bands.length);

   // v2 code
   const response = await apiClient.getBands();
   console.log(response.data.length);
   console.log(response.meta.totalCount);
   ```

3. **Update Query Parameters**
   ```typescript
   // v1 code
   const bands = await apiClient.getBands({ featured: true });

   // v2 code
   const bands = await apiClient.getBands({ 
     filter: { featured: true } 
   });
   ```

4. **Update Field Names**
   ```typescript
   // v1 code
   const imageUrl = band.image;
   const created = band.createdAt;

   // v2 code
   const imageUrl = band.imageUrl;
   const created = band.created;
   ```

## Best Practices

### For API Developers

1. **Minimize Breaking Changes**
   - Add new fields instead of changing existing ones
   - Use optional parameters when possible
   - Maintain backward-compatible response formats

2. **Version Early**
   - Start with v1 from the beginning
   - Don't wait until you need to make breaking changes

3. **Clear Documentation**
   - Document all breaking changes
   - Provide migration guides
   - Keep changelog updated

4. **Graceful Deprecation**
   - Always maintain the 6-month timeline
   - Provide clear warning headers
   - Monitor version usage

5. **Testing**
   - Test all supported versions
   - Maintain separate test suites for each version
   - Automate version compatibility testing

### For API Consumers

1. **Stay Updated**
   - Monitor deprecation headers
   - Subscribe to API changelog
   - Test new versions in staging

2. **Handle Deprecation Warnings**
   - Implement deprecation warning handlers
   - Log warnings to monitoring
   - Plan migrations proactively

3. **Version Pinning**
   - Explicitly specify API version
   - Don't rely on default version
   - Document which version you're using

4. **Gradual Migration**
   - Test new version in development
   - Deploy to staging for validation
   - Roll out to production gradually

## Response Headers

### Deprecation Headers

When accessing a deprecated endpoint, the API returns these headers:

```
Deprecation: version="v1"; date="2026-01-21T00:00:00Z"
Sunset: Wed, 21 Jul 2026 00:00:00 GMT
X-API-Deprecation-Warning: API v1 is deprecated. Please migrate to v2.
X-API-Replacement-Version: v2
Link: </api/docs>; rel="deprecation"; type="text/html"
```

### Header Descriptions

| Header | Description | Example |
|--------|-------------|---------|
| `Deprecation` | RFC 8594 standard deprecation header | `version="v1"; date="2026-01-21T00:00:00Z"` |
| `Sunset` | RFC 8594 sunset date when endpoint will be removed | `Wed, 21 Jul 2026 00:00:00 GMT` |
| `X-API-Deprecation-Warning` | Human-readable deprecation message | `API v1 is deprecated` |
| `X-API-Replacement-Version` | Version to migrate to | `v2` |
| `Link` | Link to migration documentation | `</api/docs>; rel="deprecation"` |

## Environment Configuration

### Development

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
API_URL=http://localhost:3001/api/v1
```

### Staging

```env
# .env.staging
NEXT_PUBLIC_API_URL=https://api.staging.hbcubandhub.com/api/v1
API_URL=https://api.staging.hbcubandhub.com/api/v1
```

### Production

```env
# .env.production
NEXT_PUBLIC_API_URL=https://api.hbcubandhub.com/api/v1
API_URL=https://api.hbcubandhub.com/api/v1
```

## Testing Different Versions

### Backend Tests

```typescript
describe('BandsController v1', () => {
  it('should return bands array directly', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/bands')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('BandsController v2', () => {
  it('should return bands with metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/bands')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta');
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

### Frontend Tests

```typescript
describe('API Client Version Handling', () => {
  it('should use default v1', () => {
    expect(apiClient.getApiVersion()).toBe('v1');
  });

  it('should switch to v2', () => {
    apiClient.setApiVersion('v2');
    expect(apiClient.getApiVersion()).toBe('v2');
  });

  it('should handle deprecation warnings', async () => {
    const warningHandler = jest.fn();
    apiClient.setOnDeprecationWarning(warningHandler);

    // Mock fetch to return deprecation headers
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
      clone: () => ({
        text: async () => JSON.stringify({ data: [] })
      }),
      headers: {
        get: (key) => {
          if (key === 'Deprecation') return 'version="v1"';
          if (key === 'Sunset') return 'Wed, 21 Jul 2026 00:00:00 GMT';
          if (key === 'X-API-Deprecation-Warning') return 'Deprecated';
          return null;
        }
      }
    });

    await apiClient.getBands();
    expect(warningHandler).toHaveBeenCalled();
  });
});
```

## Monitoring and Analytics

### Metrics to Track

1. **Version Usage**
   - Requests per version
   - Unique clients per version
   - Geographic distribution

2. **Deprecation Warnings**
   - Warning frequency
   - Clients still using deprecated versions
   - Time to migration completion

3. **Error Rates**
   - 410 Gone errors after sunset
   - Version-specific error rates
   - Failed migration attempts

### Grafana Dashboard Queries

```promql
# Requests by API version
sum(rate(http_requests_total{path=~"/api/v.*"}[5m])) by (version)

# Deprecated version usage
sum(rate(http_requests_total{path=~"/api/v1/.*"}[5m]))

# Clients still using deprecated versions
count(count by (client_id) (http_requests_total{path=~"/api/v1/.*"}))
```

## Troubleshooting

### Issue: Clients receiving 410 Gone

**Cause:** Accessing removed API version after sunset date

**Solution:**
1. Check deprecation timeline
2. Migrate to current version
3. Update API client configuration

### Issue: Inconsistent behavior across versions

**Cause:** Shared code between versions

**Solution:**
1. Separate controllers for each version
2. Version-specific service methods
3. Integration tests for each version

### Issue: Missing deprecation warnings

**Cause:** Middleware not configured or headers not checked

**Solution:**
1. Verify middleware is active in `main.ts`
2. Check frontend warning handler
3. Inspect network requests in DevTools

## Resources

- [Swagger API Docs](http://localhost:3001/api/docs) - Interactive API documentation
- [NestJS Versioning](https://docs.nestjs.com/techniques/versioning) - Official NestJS versioning guide
- [RFC 8594 - Sunset Header](https://datatracker.ietf.org/doc/html/rfc8594) - HTTP Sunset header specification
- [Semantic Versioning](https://semver.org/) - Versioning best practices

## Support

For questions or issues:
- **Email:** support@hbcubandhub.com
- **Slack:** #api-support
- **GitHub Issues:** https://github.com/your-org/bandhub/issues

---

**Last Updated:** January 21, 2026  
**Version:** 1.0  
**Maintained by:** BandHub Engineering Team
