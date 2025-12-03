# Secrets Rotation Procedures

This document provides step-by-step procedures for rotating secrets in the BandHub application.

## Table of Contents

1. [JWT Secret Rotation](#jwt-secret-rotation)
2. [API Key Rotation](#api-key-rotation)
3. [Database Credentials Rotation](#database-credentials-rotation)
4. [Third-Party API Keys Rotation](#third-party-api-keys-rotation)
5. [Emergency Rotation](#emergency-rotation)

---

## JWT Secret Rotation

### When to Rotate

- Every 30-90 days (configurable via `JWT_ROTATION_INTERVAL_DAYS`)
- Immediately if a secret may have been compromised
- When team members with access leave the organization

### Pre-Rotation Checklist

- [ ] Generate new secure secret
- [ ] Test rotation procedure in staging environment
- [ ] Prepare rollback plan
- [ ] Schedule during low-traffic period
- [ ] Notify team members

### Rotation Steps

#### Step 1: Generate New Secret

```bash
# Generate a cryptographically secure 32-byte hex secret
openssl rand -hex 32
```

#### Step 2: Update Environment Variables

```env
# Keep the current secret as previous for graceful rotation
JWT_PREVIOUS_SECRET=<current-jwt-secret>

# Set the new secret
JWT_SECRET=<new-secret-from-step-1>
```

#### Step 3: Deploy Changes

Deploy to all application instances. The application will:
- Sign new tokens with the new secret
- Accept tokens signed with both current and previous secrets

#### Step 4: Monitor

- Check application logs for JWT validation errors
- Monitor authentication success rates
- Verify new logins work correctly

#### Step 5: Remove Previous Secret

After 2x the token expiry period (e.g., 14 days for 7-day tokens):

```env
# Remove the previous secret
JWT_PREVIOUS_SECRET=

# Keep only the current secret
JWT_SECRET=<current-secret>
```

### Rollback Procedure

If issues occur:
1. Swap `JWT_SECRET` and `JWT_PREVIOUS_SECRET`
2. Deploy immediately
3. Investigate the issue

---

## API Key Rotation

### Scheduled Rotation

#### Step 1: Identify Keys to Rotate

```typescript
// Get keys expiring within 30 days
const expiringKeys = await apiKeyService.getExpiringKeys(30);
```

#### Step 2: Notify Key Owners

Send notifications to teams using the keys with:
- Current expiration date
- New key value (after rotation)
- Migration deadline

#### Step 3: Rotate the Key

```typescript
// Rotate with 7-day grace period
const result = await apiKeyService.rotateApiKey(keyId, 7);
console.log('New key:', result.key);
console.log('Grace period ends:', result.gracePeriodEnds);
```

#### Step 4: Update Consuming Services

Update all services using the old key to use the new key value.

#### Step 5: Verify and Cleanup

After the grace period:
1. Verify all services are using the new key
2. Monitor for any failed authentications
3. The old key is automatically invalidated

### Emergency API Key Rotation

For immediate key invalidation (suspected compromise):

```typescript
// Immediately revoke the key (no grace period)
await apiKeyService.revokeApiKey(keyId);

// Create a new key
const newKey = await apiKeyService.createApiKey({
  name: 'Replacement Key',
  description: 'Emergency replacement',
  expiresInDays: 90,
});
```

---

## Database Credentials Rotation

### Pre-Rotation Steps

1. Create new database user with same permissions
2. Test connection with new credentials
3. Plan for brief connection interruption

### Rotation Steps

#### Step 1: Create New Database User

```sql
-- Connect as superuser
CREATE USER bandhub_new WITH PASSWORD 'new-secure-password';
GRANT ALL PRIVILEGES ON DATABASE hbcu_band_hub TO bandhub_new;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bandhub_new;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bandhub_new;
```

#### Step 2: Update Environment

```env
DATABASE_URL="postgresql://bandhub_new:new-secure-password@localhost:5432/hbcu_band_hub"
```

#### Step 3: Deploy with Rolling Restart

Deploy changes with rolling restart to minimize downtime.

#### Step 4: Verify Connections

Monitor database connection logs and application health.

#### Step 5: Remove Old User

After confirming all connections use the new user:

```sql
-- Revoke privileges and drop old user
REVOKE ALL PRIVILEGES ON DATABASE hbcu_band_hub FROM bandhub_old;
DROP USER bandhub_old;
```

---

## Third-Party API Keys Rotation

### YouTube API Key Rotation

#### Step 1: Generate New Key

1. Go to Google Cloud Console
2. Navigate to APIs & Services > Credentials
3. Create a new API key
4. Apply same restrictions as existing key

#### Step 2: Update Environment

```env
YOUTUBE_API_KEY=<new-api-key>
```

#### Step 3: Deploy Changes

Deploy and verify YouTube sync functionality works.

#### Step 4: Delete Old Key

1. Return to Google Cloud Console
2. Delete the old API key

### Doppler Token Rotation

```bash
# Generate new service token
doppler configs tokens create production --name "bandhub-prod" --max-age 90d

# Update environment
export DOPPLER_TOKEN=<new-token>

# Deploy changes
# ...

# Revoke old token
doppler configs tokens revoke production <old-token-id>
```

---

## Emergency Rotation

### Indicators of Compromise

- Unexpected API key usage patterns
- Unauthorized data access in audit logs
- Reports of suspicious activity
- Leaked credentials in public repositories

### Emergency Response Steps

#### Step 1: Assess Impact

1. Identify which secrets may be compromised
2. Determine affected systems
3. Review audit logs for unauthorized access

#### Step 2: Immediate Actions

```typescript
// Revoke all potentially compromised API keys
const keys = await apiKeyService.listApiKeys();
for (const key of compromisedKeys) {
  await apiKeyService.revokeApiKey(key.id);
}

// Force logout all users if JWT secret is compromised
// This requires redeploying with new JWT_SECRET
```

#### Step 3: Rotate All Affected Secrets

1. Generate new secrets
2. Update all environments immediately
3. Deploy with zero-downtime if possible

#### Step 4: Notify Stakeholders

- Inform the security team
- Notify affected users if their data may be at risk
- Document the incident

#### Step 5: Post-Incident Review

1. Analyze how the compromise occurred
2. Update security procedures
3. Implement additional safeguards
4. Document lessons learned

---

## Rotation Schedule Template

| Secret Type | Rotation Frequency | Last Rotated | Next Rotation | Owner |
|-------------|-------------------|--------------|---------------|-------|
| JWT Secret | 90 days | 2024-01-01 | 2024-04-01 | Security Team |
| API Keys | 90 days | varies | varies | DevOps |
| DB Password | 180 days | 2024-01-01 | 2024-07-01 | DBA |
| YouTube API | As needed | 2024-01-01 | N/A | Backend Team |

---

## Automation

### Scheduled Rotation Checks

The system automatically:
- Checks for expiring API keys daily at 9 AM
- Sends warnings at 30, 14, 7, 3, and 1 day(s) before expiration
- Logs expiration events to audit logs

### Monitoring

Set up alerts for:
- API keys expiring within 7 days
- JWT keys approaching rotation date
- Failed authentication spikes
- Token reuse detection events
