# Security Best Practices Guide

This document outlines security best practices for the BandHub application.

## Table of Contents

1. [Authentication](#authentication)
2. [JWT Token Management](#jwt-token-management)
3. [API Key Management](#api-key-management)
4. [Secrets Management](#secrets-management)
5. [Environment Configuration](#environment-configuration)
6. [Audit Logging](#audit-logging)
7. [Incident Response](#incident-response)

---

## Authentication

### Password Security

- Passwords are hashed using bcrypt with a work factor of 12
- Minimum password length should be enforced (recommended: 12 characters)
- Failed login attempts are tracked and accounts are locked after 5 failed attempts
- Account lockout duration: 15 minutes

### Session Management

- Access tokens expire after 7 days (configurable via `JWT_ACCESS_EXPIRY`)
- Refresh tokens expire after 30 days (configurable via `JWT_REFRESH_EXPIRY`)
- Tokens are stored in httpOnly cookies for security
- Token refresh implements rotation to detect reuse attacks

### Best Practices

1. Always use HTTPS in production
2. Enable `SECURE_COOKIES=true` in production
3. Implement CORS properly to restrict origins
4. Use rate limiting to prevent brute force attacks

---

## JWT Token Management

### Key Rotation Strategy

BandHub implements a multi-key JWT strategy with graceful key rollover:

1. **Active Key**: Current key used for signing new tokens
2. **Previous Key**: Previous key still accepted for validation (rotation grace period)

### Rotation Process

1. Generate a new JWT secret
2. Set the current secret as `JWT_PREVIOUS_SECRET`
3. Set the new secret as `JWT_SECRET`
4. Deploy the changes
5. After the rotation grace period (typically 2x token expiry), remove `JWT_PREVIOUS_SECRET`

### Configuration

```env
# Current signing key
JWT_SECRET=your-new-secret-here

# Previous key (for rotation)
JWT_PREVIOUS_SECRET=your-old-secret-here

# Rotation interval in days
JWT_ROTATION_INTERVAL_DAYS=30
```

### Generating Secure Secrets

```bash
# Generate a secure 32-byte hex secret
openssl rand -hex 32
```

---

## API Key Management

### Creating API Keys

API keys can be created with optional expiration dates:

```typescript
// Create an API key that expires in 90 days
const apiKey = await apiKeyService.createApiKey({
  name: 'Production Worker',
  description: 'API key for production worker service',
  expiresInDays: 90,
});
```

### Key Rotation

1. **Warning Notifications**: The system sends warnings at 30, 14, 7, 3, and 1 day(s) before expiration
2. **Rotation Process**:
   - Call the rotate endpoint with the key ID
   - System generates a new key value
   - Old key is immediately replaced
   - No grace period by default (configure if needed)

### Best Practices

1. Use descriptive names for API keys
2. Set reasonable expiration dates (90 days recommended)
3. Rotate keys regularly, even before expiration
4. Monitor key usage statistics
5. Revoke unused keys promptly

### API Key Format

```
bhub_live_[32 random hex characters]
```

---

## Secrets Management

### Supported Providers

1. **Environment Variables** (default): For local development
2. **Doppler**: Recommended for ease of use
3. **AWS Secrets Manager**: For AWS-based deployments
4. **HashiCorp Vault**: For enterprise deployments

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

### Best Practices

1. Never commit secrets to source control
2. Use different secrets for each environment
3. Enable secret caching to reduce provider API calls
4. Use the fallback mechanism for local development
5. Regularly rotate all secrets

---

## Environment Configuration

### Required Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Yes |
| `NODE_ENV` | Environment name | Yes |
| `REDIS_HOST` | Redis server host | No (defaults to localhost) |

### Environment-Specific Settings

#### Development
```env
NODE_ENV=development
DEBUG=true
SECURE_COOKIES=false
LOG_LEVEL=debug
```

#### Staging
```env
NODE_ENV=staging
DEBUG=false
SECURE_COOKIES=true
LOG_LEVEL=info
```

#### Production
```env
NODE_ENV=production
DEBUG=false
SECURE_COOKIES=true
LOG_LEVEL=warn
```

### Validation

The application validates environment variables at startup:
- Schema validation using class-validator
- Security checks for production environment
- Clear error messages for missing/invalid variables

---

## Audit Logging

### Logged Events

| Event | Severity | Description |
|-------|----------|-------------|
| `login_success` | info | Successful authentication |
| `login_failed` | warning | Failed login attempt |
| `account_locked` | error | Account locked due to failed attempts |
| `token_reuse_detected` | critical | Potential token theft detected |
| `api_key_created` | info | New API key created |
| `api_key_rotated` | info | API key rotated |
| `api_key_revoked` | warning | API key revoked |
| `unauthorized_access_attempt` | warning | Access denied |

### Retention Policy

| Severity | Retention |
|----------|-----------|
| info | 30 days |
| warning | 90 days |
| error | 180 days |
| critical | 365 days |

### Querying Audit Logs

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

If token reuse is detected:
1. All user sessions are immediately terminated
2. Critical audit log is created
3. User must re-authenticate

### Responding to Security Events

1. **Failed Login Spike**: Check for brute force attack, review IP addresses
2. **Token Reuse**: Investigate potential credential theft
3. **Unauthorized Access**: Review logs, identify attacker patterns
4. **API Key Expiration**: Rotate keys before expiration warnings

### Emergency Procedures

#### Revoking All Sessions

```typescript
await authService.logoutAll(userId);
```

#### Revoking All API Keys

```typescript
const keys = await apiKeyService.listApiKeys();
for (const key of keys) {
  await apiKeyService.revokeApiKey(key.id);
}
```

#### Emergency JWT Rotation

1. Generate new JWT secret
2. Update `JWT_SECRET` in all environments
3. Deploy immediately
4. All existing tokens become invalid
5. Users must re-authenticate

---

## Security Checklist

### Before Deployment

- [ ] All secrets are properly configured
- [ ] `DEBUG=false` in production
- [ ] `SECURE_COOKIES=true` in production
- [ ] JWT secret is at least 32 characters
- [ ] Different secrets for each environment
- [ ] CORS origins properly configured
- [ ] Rate limiting enabled
- [ ] SSL/TLS configured

### Regular Maintenance

- [ ] Review audit logs weekly
- [ ] Rotate API keys before expiration
- [ ] Review and revoke unused API keys
- [ ] Update dependencies for security patches
- [ ] Review access patterns for anomalies

---

## Contact

For security concerns, contact the security team at security@hbcubandhub.com.
