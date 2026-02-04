# Doppler Emergency Rollback Procedures

This guide covers emergency procedures when Doppler is unavailable or causing issues.

## Scenario 1: Doppler API Outage

### Symptoms
- Application fails to start
- Error: "Failed to fetch secrets from Doppler"
- Doppler status page shows outage

### Immediate Actions

1. **Switch to environment variables:**
   ```bash
   # On your server
   export SECRETS_PROVIDER=env
   export DATABASE_URL="postgresql://..."
   export JWT_SECRET="..."
   export REDIS_PASSWORD="..."
   # ... other critical secrets
   
   # Restart application
   docker compose -f docker-compose.prod.yml restart api worker
   ```

2. **Or use emergency .env file:**
   ```bash
   # Restore from secure backup
   cp /secure/backup/.env.production .env
   
   # Update docker-compose to use .env file
   docker compose -f docker-compose.prod.yml up -d
   ```

### Long-term Fix
- Wait for Doppler service restoration
- Verify connectivity: `doppler secrets --config prd`
- Switch back: `export SECRETS_PROVIDER=doppler`
- Restart services

## Scenario 2: Invalid Doppler Token

### Symptoms
- 401 Unauthorized errors from Doppler API
- "Invalid token" in application logs

### Immediate Actions

1. **Verify token:**
   ```bash
   doppler secrets --config prd --project bandhub
   ```

2. **If expired, generate new token:**
   - Go to Doppler dashboard
   - Navigate to Access → Service Tokens
   - Generate new token for `prd` config
   - Update GitHub Secrets: `DOPPLER_TOKEN_PRD`
   - Update server environment: `export DOPPLER_TOKEN=<new-token>`

3. **Restart services:**
   ```bash
   docker compose -f docker-compose.prod.yml restart
   ```

## Scenario 3: Wrong Secrets in Doppler

### Symptoms
- Application connects to wrong database
- Authentication fails
- API keys rejected

### Immediate Actions

1. **Identify misconfigured secret:**
   ```bash
   doppler secrets --config prd
   ```

2. **Update immediately:**
   ```bash
   doppler secrets set DATABASE_URL="<correct-value>" --config prd
   ```

3. **For critical errors, use override:**
   ```bash
   # Override Doppler temporarily
   export SECRETS_PROVIDER=env
   export DATABASE_URL="<emergency-value>"
   docker compose restart api
   ```

## Scenario 4: Complete Doppler Failure

### Nuclear Option: Full Environment Variable Fallback

1. **Create emergency environment file:**
   ```bash
   cat > .env.emergency <<EOF
   NODE_ENV=production
   SECRETS_PROVIDER=env
   DATABASE_URL=postgresql://...
   JWT_SECRET=...
   JWT_PREVIOUS_SECRET=...
   REDIS_HOST=redis
   REDIS_PORT=6379
   REDIS_PASSWORD=...
   YOUTUBE_API_KEY=...
   API_PORT=3001
   WORKER_CONCURRENCY=3
   EOF
   ```

2. **Update docker-compose.prod.yml temporarily:**
   ```yaml
   api:
     env_file:
       - .env.emergency
     # Comment out Doppler dependency
     # depends_on:
     #   doppler:
     #     condition: service_healthy
   ```

3. **Deploy:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

## Prevention

### Maintain Emergency Access
- Keep encrypted backup of production `.env` in secure location
- Document location in team wiki
- Test restoration quarterly
- Update backup when secrets rotate

### Regular Drills
- Test Doppler failover monthly
- Verify emergency contacts are current
- Ensure team knows rollback procedures

### Monitoring
- Set up alerts for Doppler API errors
- Monitor secret fetch latency
- Track Doppler service status

## Recovery Checklist

After emergency is resolved:

- [ ] Verify all services running correctly
- [ ] Check application logs for errors
- [ ] Verify database connections
- [ ] Test API endpoints
- [ ] Confirm worker jobs processing
- [ ] Update incident log
- [ ] Schedule post-mortem
- [ ] Update procedures based on learnings

## Emergency Contacts

- **Doppler Support:** support@doppler.com
- **Team Lead:** [Add contact]
- **DevOps:** [Add contact]
- **On-call:** [Add contact]

## Additional Resources

- [Doppler Status Page](https://status.doppler.com/)
- [Doppler Documentation](https://docs.doppler.com/)
- Internal wiki: [Add link]
