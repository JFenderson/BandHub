# Security Guide

Comprehensive security documentation for the HBCU Band Hub platform.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Keys](#api-keys)
4. [Rate Limiting](#rate-limiting)
5. [Security Headers](#security-headers)
6. [Secrets Management](#secrets-management)
7. [Secrets Rotation](#secrets-rotation)
8. [Audit Logging](#audit-logging)
9. [Incident Response](#incident-response)
10. [Security Checklist](#security-checklist)

---

## Overview

### Security Stack

- **Authentication**: JWT with refresh token rotation
- **Authorization**: Role-based access control (RBAC)
- **Rate Limiting**: Redis-backed throttling with custom limits
- **Security Headers**: CSP, HSTS, X-Frame-Options
- **Secrets Management**: Multi-provider support (Doppler, AWS, Vault)
- **Audit Logging**: Comprehensive event tracking
- **API Key Management**: Rotation, expiration, analytics

### Security Principles

1. **Defense in Depth**: Multiple layers of security
2. **Least Privilege**: Minimal permissions by default
3. **Fail Secure**: Default to denying access
4. **Audit Everything**: Comprehensive logging
5. **Rotate Regularly**: Periodic secret rotation

---

## Authentication

### Password Security

- **Hashing**: bcrypt with work factor of 12
- **Minimum Length**: 8 characters (configurable)
- **Complexity**: Uppercase, lowercase, number required
- **Failed Attempts**: Account locked after 5 failures
- **Lockout Duration**: 15 minutes

### JWT Token Management

#### Access Tokens
- **Expiry**: 7 days (configurable via `JWT_ACCESS_EXPIRY`)
- **Storage**: HTTP-only cookies recommended
- **Algorithm**: HS256 (HMAC with SHA-256)

#### Refresh Tokens
- **Expiry**: 30 days (configurable via `JWT_REFRESH_EXPIRY`)
- **Rotation**: One-time use with automatic rotation
- **Reuse Detection**: Logs out all sessions on reuse

#### Token Rotation Strategy

```env
# Current signing key
JWT_SECRET=your-new-secret-here

# Previous key (for graceful rotation)
JWT_PREVIOUS_SECRET=your-old-secret-here

# Rotation interval
JWT_ROTATION_INTERVAL_DAYS=30
```

**How it works:**
1. New tokens signed with `JWT_SECRET`
2. Both current and previous secrets accepted for validation
3. 2x token expiry grace period (e.g., 14 days for 7-day tokens)
4. Remove `JWT_PREVIOUS_SECRET` after grace period

### Session Management

- **Max Sessions**: Unlimited by default (configurable per user)
- **Session Tracking**: All active sessions stored in database
- **Device Information**: IP, user agent, location tracked
- **Logout Options**: Single session or all sessions

---

## API Keys

### Creating API Keys

```typescript
const apiKey = await apiKeyService.createApiKey({
  name: 'Production Worker',
  description: 'API key for production worker service',
  expiresInDays: 90,
});

// Returns: bhub_live_[32 random hex characters]
```

### Key Rotation

#### Scheduled Rotation
```typescript
// Rotate with grace period
const result = await apiKeyService.rotateApiKey(keyId, 7);
console.log('New key:', result.key);
console.log('Grace period ends:', result.gracePeriodEnds);
```

During grace period:
- Both old and new keys work
- Update services to use new key
- Old key automatically expires after grace period

#### Emergency Rotation
```typescript
// Immediately revoke compromised key
await apiKeyService.revokeApiKey(keyId);

// Create replacement
const newKey = await apiKeyService.createApiKey({
  name: 'Emergency Replacement',
  expiresInDays: 90,
});
```

### API Key Analytics

#### Usage Tracking
- **Automatic**: Tracks every API request
- **Metrics**: Request count, endpoints, response times, errors
- **Aggregation**: Daily summaries
- **Retention**: 90 days

#### Analytics Dashboard

```http
GET /api/v1/admin/api-keys/:id/analytics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "totalRequests": 12500,
  "uniqueEndpoints": 15,
  "avgResponseTime": 145,
  "errorRate": 0.02,
  "requestsPerHour": 520,
  "topEndpoints": [
    { "endpoint": "/api/v1/bands", "count": 5000 },
    { "endpoint": "/api/v1/videos", "count": 4200 }
  ],
  "dailyBreakdown": [...]
}
```

#### Anomaly Detection

```http
GET /api/v1/admin/api-keys/:id/anomalies
```

Detects:
- Usage spikes (>2 standard deviations)
- Unusual endpoint access patterns
- Error rate increases

#### Quota Management

```typescript
// Set quota limits
await apiKeyService.updateApiKey(keyId, {
  dailyQuota: 10000,
  monthlyQuota: 300000,
});

// Automatic enforcement on each request
```

### Expiration Warnings

Automatic notifications sent at:
- 30 days before expiration
- 14 days before expiration
- 7 days before expiration
- 3 days before expiration
- 1 day before expiration

---

## Rate Limiting

### Global Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Default | 100 requests | 1 minute |
| Authentication | 5 requests | 15 minutes |
| Registration | 3 requests | 1 hour |
| Password Reset | 3 requests | 1 hour |
| Content Creation | 3 requests | 1 minute |
| Search | 20 requests | 1 minute |

### Custom Rate Limiting

#### Endpoint-Specific Limits

```typescript
@ThrottleEndpoint(3, 60 * 1000, (context) => {
  const req = context.request;
  const userId = req.user?.id || 'anonymous';
  const ip = req.realIp || req.ip;
  return `upload:${userId}:${ip}`;
})
@Post('upload')
async uploadFile() {
  // Only 3 uploads per minute per user
}
```

#### Admin Bypass

Super admins automatically bypass rate limits:

```typescript
// Configure bypass roles in rate-limit.config.ts
export const RATE_LIMIT_BYPASS_ROLES = ['SUPER_ADMIN'];
```

### Rate Limit Headers

All responses include:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706961600
```

### Monitoring

Prometheus metrics available:
- `rate_limit_exceeded_total` - Violations by endpoint
- `rate_limit_requests_total` - All rate limit checks

---

## Security Headers

### Headers Applied

#### Content Security Policy (CSP)

**Development:**
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
```

**Production:**
```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' https://i.ytimg.com https://img.youtube.com https://yt3.ggpht.com;
frame-src 'self' https://www.youtube.com https://youtube.com;
connect-src 'self' https://api.hbcubandhub.com;
upgrade-insecure-requests;
```

#### HTTP Strict Transport Security (HSTS)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- **Max-Age**: 1 year
- **Include Subdomains**: Yes
- **Preload**: Production only

#### Other Headers

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Permitted-Cross-Domain-Policies: none
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
```

### CSP Violation Reporting

```http
POST /api/v1/csp-report
Content-Type: application/csp-report

{
  "csp-report": {
    "blocked-uri": "https://evil.com/script.js",
    "violated-directive": "script-src",
    "document-uri": "https://hbcubandhub.com"
  }
}
```

All violations are logged for security monitoring.

---

## Secrets Management

### Supported Providers

| Provider | Use Case | Configuration |
|----------|----------|---------------|
| Environment Variables | Local development | `.env` file |
| Doppler | Recommended | `DOPPLER_TOKEN` |
| AWS Secrets Manager | AWS deployments | IAM role or credentials |
| HashiCorp Vault | Enterprise | `VAULT_ADDR`, `VAULT_TOKEN` |

### Configuration

```env
# Select provider
SECRETS_PROVIDER=doppler  # env | doppler | aws | vault

# Caching (reduces API calls)
SECRETS_CACHE_TTL=300000  # 5 minutes
SECRETS_CACHE_ENABLED=true
```

### Provider Setup

#### Doppler
```env
DOPPLER_TOKEN=dp.st.xxxx
DOPPLER_PROJECT=bandhub
DOPPLER_CONFIG=production
```

#### AWS Secrets Manager
```env
AWS_REGION=us-east-1
AWS_SECRETS_PREFIX=bandhub/prod
# Credentials via IAM role or:
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

#### HashiCorp Vault
```env
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=hvs.xxx
VAULT_MOUNT_PATH=secret
VAULT_SECRET_PATH=bandhub
```

---

## Secrets Rotation

### JWT Secret Rotation

**When to rotate:**
- Every 30-90 days
- Immediately if compromised
- When team members with access leave

**Rotation Steps:**

1. **Generate new secret:**
   ```bash
   openssl rand -hex 32
   ```

2. **Update environment:**
   ```env
   JWT_PREVIOUS_SECRET=<current-jwt-secret>
   JWT_SECRET=<new-secret>
   ```

3. **Deploy changes** - Both secrets accepted during grace period

4. **Wait 2x token expiry** (e.g., 14 days for 7-day tokens)

5. **Remove previous secret:**
   ```env
   JWT_SECRET=<current-secret>
   # Remove JWT_PREVIOUS_SECRET
   ```

### API Key Rotation

**Scheduled rotation:**

```typescript
// Get keys expiring within 30 days
const expiringKeys = await apiKeyService.getExpiringKeys(30);

// Rotate with 7-day grace period
const result = await apiKeyService.rotateApiKey(keyId, 7);
```

**Emergency rotation:**

```typescript
// Immediately revoke
await apiKeyService.revokeApiKey(keyId);

// Create replacement
const newKey = await apiKeyService.createApiKey({
  name: 'Replacement Key',
  expiresInDays: 90,
});
```

### Database Credentials Rotation

1. **Create new user:**
   ```sql
   CREATE USER bandhub_new WITH PASSWORD 'new-password';
   GRANT ALL PRIVILEGES ON DATABASE hbcu_band_hub TO bandhub_new;
   ```

2. **Update environment:**
   ```env
   DATABASE_URL="postgresql://bandhub_new:new-password@localhost:5432/hbcu_band_hub"
   ```

3. **Deploy with rolling restart**

4. **Verify connections**

5. **Remove old user:**
   ```sql
   DROP USER bandhub_old;
   ```

### Third-Party API Keys

#### YouTube API Key
1. Generate new key in Google Cloud Console
2. Apply same restrictions as existing key
3. Update `YOUTUBE_API_KEY` environment variable
4. Deploy and verify
5. Delete old key

#### Doppler Token
```bash
# Generate new token
doppler configs tokens create production --name "bandhub-prod" --max-age 90d

# Update and deploy
export DOPPLER_TOKEN=<new-token>

# Revoke old token
doppler configs tokens revoke production <old-token-id>
```

### Rotation Schedule

| Secret Type | Frequency | Owner |
|-------------|-----------|-------|
| JWT Secret | 90 days | Security Team |
| API Keys | 90 days | DevOps |
| DB Password | 180 days | DBA |
| YouTube API | As needed | Backend Team |

---

## Audit Logging

### Logged Events

| Event | Severity | Retention |
|-------|----------|-----------|
| `login_success` | info | 30 days |
| `login_failed` | warning | 90 days |
| `account_locked` | error | 180 days |
| `token_reuse_detected` | critical | 365 days |
| `api_key_created` | info | 30 days |
| `api_key_rotated` | info | 30 days |
| `api_key_revoked` | warning | 90 days |
| `unauthorized_access_attempt` | warning | 90 days |

### Querying Logs

```typescript
const logs = await securityAuditService.query({
  action: 'login_failed',
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
  limit: 100,
});
```

### Exporting Logs

```typescript
const jsonExport = await securityAuditService.exportToJson({
  severity: 'critical',
  startDate: thirtyDaysAgo,
});
```

---

## Incident Response

### Token Reuse Detection

When token reuse is detected:
1. All user sessions terminated immediately
2. Critical audit log created
3. User must re-authenticate
4. Security team notified

### Emergency Procedures

#### Revoke All Sessions
```typescript
await authService.logoutAll(userId);
```

#### Revoke All API Keys
```typescript
const keys = await apiKeyService.listApiKeys();
for (const key of keys) {
  await apiKeyService.revokeApiKey(key.id);
}
```

#### Emergency JWT Rotation
1. Generate new JWT secret
2. Update `JWT_SECRET` immediately
3. Deploy to all environments
4. All existing tokens invalidated
5. Users must re-authenticate

### Incident Response Workflow

1. **Assess Impact**
   - Identify compromised secrets
   - Determine affected systems
   - Review audit logs

2. **Immediate Actions**
   - Revoke compromised credentials
   - Force logout affected users
   - Block malicious IPs

3. **Rotate Secrets**
   - Generate new secrets
   - Update all environments
   - Deploy immediately

4. **Notify Stakeholders**
   - Inform security team
   - Notify affected users
   - Document incident

5. **Post-Incident Review**
   - Analyze root cause
   - Update procedures
   - Implement safeguards
   - Document lessons learned

---

## Security Checklist

### Before Deployment

- [ ] All secrets properly configured
- [ ] `DEBUG=false` in production
- [ ] `SECURE_COOKIES=true` in production
- [ ] `NODE_ENV=production`
- [ ] JWT secret at least 32 characters
- [ ] Different secrets per environment
- [ ] CORS origins properly configured
- [ ] Rate limiting enabled
- [ ] SSL/TLS configured
- [ ] Security headers enabled
- [ ] CSP properly configured

### Regular Maintenance

- [ ] Review audit logs weekly
- [ ] Rotate JWT secret every 90 days
- [ ] Rotate API keys before expiration
- [ ] Review and revoke unused API keys
- [ ] Update dependencies for security patches
- [ ] Review access patterns for anomalies
- [ ] Test backup/restore procedures
- [ ] Verify security headers in production

### Monthly Tasks

- [ ] Review rate limit effectiveness
- [ ] Analyze API key usage patterns
- [ ] Check for CSP violations
- [ ] Review failed authentication attempts
- [ ] Audit user permissions
- [ ] Test incident response procedures

---

## Best Practices

1. **Never commit secrets to source control**
2. **Use different secrets for each environment**
3. **Enable secret caching to reduce provider API calls**
4. **Use the fallback mechanism for local development**
5. **Rotate all secrets regularly**
6. **Monitor audit logs for suspicious activity**
7. **Implement defense in depth**
8. **Follow the principle of least privilege**
9. **Test security measures regularly**
10. **Keep dependencies updated**

---

## Contact

For security concerns or to report vulnerabilities:
- **Email**: security@hbcubandhub.com
- **Emergency**: Create incident in #security-incidents Slack channel
