# Doppler Secrets Management Setup Guide

This guide will help you set up Doppler for managing environment variables and secrets in the HBCU Band Hub application.

## Table of Contents

- [What is Doppler?](#what-is-doppler)
- [Why Use Doppler?](#why-use-doppler)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Local Development Setup](#local-development-setup)
- [Team Onboarding](#team-onboarding)
- [CI/CD Integration](#cicd-integration)
- [Production Deployment](#production-deployment)
- [Production Deployment Checklist](#production-deployment-checklist)
- [Fallback Mechanism](#fallback-mechanism)
- [Verification & Testing](#verification--testing)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## What is Doppler?

Doppler is a universal secrets management platform that helps you manage environment variables and secrets across all your environments (development, staging, production). It provides:

- **Centralized secrets management** - One place for all your environment variables
- **Access control** - Role-based permissions for team members
- **Audit logs** - Track who accessed or modified secrets
- **Automatic syncing** - Keep your environments in sync
- **Secret rotation** - Easy rotation of API keys and credentials
- **Version history** - Rollback to previous configurations

## Why Use Doppler?

### Security Benefits
- ✅ **No secrets in version control** - Environment files never committed to git
- ✅ **Encrypted at rest and in transit** - Enterprise-grade encryption
- ✅ **Access control** - Fine-grained permissions per environment
- ✅ **Audit trail** - Complete history of all changes
- ✅ **Secret rotation** - Update secrets without redeploying

### Developer Benefits
- 🚀 **Easy onboarding** - New developers get access instantly
- 🔄 **Environment parity** - All developers use the same secrets
- 🎯 **Single source of truth** - No confusion about which .env file to use
- 📦 **Multiple environments** - Dev, staging, production all configured

## Prerequisites

**Before you start, ensure you have:**

- [ ] Doppler account (sign up at [https://doppler.com](https://doppler.com))
- [ ] Admin access to create projects (or ask your team lead for an invitation)
- [ ] Docker installed (if using Docker-based development)
- [ ] Node.js 18+ installed

**Quick Start Overview:**

```
┌─────────────────┐
│  Doppler Cloud  │  ← Centralized secrets storage
└────────┬────────┘
         │
    ┌────▼────┐
    │ API Key │  ← Authentication token
    └────┬────┘
         │
    ┌────▼────────────────┐
    │  Doppler CLI        │  ← Your local machine
    │  doppler run -- ... │
    └────┬────────────────┘
         │
    ┌────▼──────────┐
    │ Your App      │  ← Secrets injected as env vars
    │ (API/Worker)  │
    └───────────────┘
```

**Estimated Setup Time:** 5 minutes for first-time setup

1. **Doppler Account** - Sign up at [https://doppler.com](https://doppler.com)
2. **Doppler CLI** - Install the command-line tool
3. **Admin Access** - You'll need admin access to create projects

## Initial Setup

### Step 1: Create a Doppler Account

1. Go to [https://doppler.com](https://doppler.com)
2. Sign up for a free account (free tier includes up to 5 users)
3. Verify your email address
4. Create your organization (e.g., "HBCU Band Hub")

### Step 2: Install Doppler CLI

**macOS (via Homebrew):**
```bash
brew install dopplerhq/cli/doppler
```

**Linux:**
```bash
# Debian/Ubuntu
sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | sudo gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] https://packages.doppler.com/public/cli/deb/debian any-version main" | sudo tee /etc/apt/sources.list.d/doppler-cli.list
sudo apt-get update && sudo apt-get install doppler

# RedHat/CentOS/Fedora
sudo rpm --import 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key'
curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/config.rpm.txt' | sudo tee /etc/yum.repos.d/doppler-cli.repo
sudo yum update && sudo yum install doppler
```

**Windows (via Scoop):**
```powershell
scoop bucket add doppler https://github.com/DopplerHQ/scoop-doppler.git
scoop install doppler
```

**Verify Installation:**
```bash
doppler --version
```

### Step 3: Login to Doppler

```bash
doppler login
```

This will open your browser to authenticate. After successful login, your CLI is ready to use.

### Step 4: Create Project and Configs

1. **Create Project in Doppler Dashboard:**
   - Go to your Doppler dashboard
   - Click "Create Project"
   - Name it "hbcu-band-hub"
   - Click "Create Project"

2. **Doppler automatically creates three configs:**
   - `dev` - For local development
   - `stg` - For staging environment
   - `prd` - For production environment

### Step 5: Import Existing Environment Variables

**Import from .env.example:**
```bash
# Navigate to project root
cd /path/to/BandHub

# Setup Doppler for this directory
doppler setup

# Select your project and config when prompted
# Project: hbcu-band-hub
# Config: dev

# Import variables from .env.example
doppler secrets upload .env.example
```

**Manually Add Sensitive Secrets:**

For secrets that aren't in `.env.example` (like production credentials), add them via CLI or dashboard:

```bash
# Via CLI
doppler secrets set DATABASE_URL="postgresql://user:pass@host:5432/db"
doppler secrets set JWT_SECRET="your-secret-key-here"
doppler secrets set YOUTUBE_API_KEY="your-youtube-api-key"

# Or use the web dashboard:
# 1. Go to your project in Doppler
# 2. Select the config (dev/stg/prd)
# 3. Click "Add Secret"
# 4. Enter name and value
```

### Step 6: Configure Each Environment

Repeat the import process for staging and production:

```bash
# Switch to staging config
doppler setup --config stg

# Import and modify staging-specific values
doppler secrets upload .env.example
doppler secrets set NODE_ENV="staging"
doppler secrets set DATABASE_URL="staging-database-url"
doppler secrets set API_URL="https://api.staging.hbcubandhub.com"

# Switch to production config
doppler setup --config prd

# Import and modify production values
doppler secrets upload .env.example
doppler secrets set NODE_ENV="production"
doppler secrets set DATABASE_URL="production-database-url"
doppler secrets set API_URL="https://api.hbcubandhub.com"
doppler secrets set SECURE_COOKIES="true"
```

## Local Development Setup

### Option 1: Using Doppler CLI (Recommended)

Instead of creating a `.env` file, use Doppler to inject secrets:

```bash
# Navigate to project root
cd /path/to/BandHub

# Setup Doppler (one-time)
doppler setup
# Select project: bandhub (auto-selected from doppler.yaml)
# Select config: dev (auto-selected from doppler.yaml)

# Run your development server with Doppler
doppler run -- npm run dev:api

# Or for the worker
doppler run -- npm run dev:worker

# Or run the entire stack
doppler run -- docker compose up
```

**Verify Doppler is working:**
```bash
# Check that secrets are being injected
doppler run -- env | grep DATABASE_URL
doppler run -- env | grep JWT_SECRET

# Should show values from Doppler, not from .env files
```

### Troubleshooting Common CLI Issues

#### Issue: Command hangs or times out
**Cause:** Network connectivity issues or firewall blocking Doppler API  
**Solution:**
```bash
# Test connectivity
curl -I https://api.doppler.com

# If blocked, check your firewall/VPN settings
# Or use offline mode (see below)
```

#### Issue: "Project not found" error
**Cause:** Not authenticated or wrong project name  
**Solution:**
```bash
# Re-login
doppler login

# Verify authentication
doppler whoami

# Check available projects
doppler projects

# Setup with correct project
doppler setup --project bandhub --config dev
```

#### Issue: Secrets not updating
**Cause:** Doppler caching secrets locally  
**Solution:**
```bash
# Force refresh
doppler secrets download --no-file --format env

# Clear local cache
rm -rf ~/.doppler/cache

# Re-run your command
doppler run -- npm run dev:api
```

### Offline Development Workflow

When you don't have internet access or Doppler is down:

1. **Download secrets for offline use:**
   ```bash
   # Download to .env.local (one-time before going offline)
   doppler secrets download --no-file --format env > .env.local
   
   # ⚠️ Never commit .env.local!
   ```

2. **Use .env.local as fallback:**
   ```bash
   # App will automatically use .env.local when Doppler is unavailable
   npm run dev:api
   ```

3. **Or use doppler.yaml for offline mode:**
   ```bash
   # Doppler CLI can use cached secrets
   doppler run --fallback-readonly -- npm run dev:api
   ```

### Option 2: Using .env Files (Fallback)

If Doppler is unavailable or you prefer local `.env` files:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your local values
nano .env

# Run normally
npm run dev:api
```

**Note:** The application will automatically fall back to reading `.env` files if Doppler is not configured.

## Team Onboarding

### For New Developers

1. **Get Doppler Access:**
   - Ask team lead to invite you to the Doppler organization
   - You'll receive an email invitation
   - Create your Doppler account

2. **Install Doppler CLI:**
   ```bash
   # macOS
   brew install dopplerhq/tap/doppler
   
   # Windows
   scoop bucket add doppler https://github.com/DopplerHQ/scoop-doppler.git
   scoop install doppler
   
   # Linux
   sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
   curl -sLf --retry 3 --tlsv1.2 --proto "=https" 'https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key' | sudo apt-key add -
   echo "deb https://packages.doppler.com/public/cli/deb/debian any-version main" | sudo tee /etc/apt/sources.list.d/doppler-cli.list
   sudo apt-get update && sudo apt-get install doppler
   ```

3. **Login:**
   ```bash
   doppler login
   ```

4. **Setup Project:**
   ```bash
   cd /path/to/BandHub
   doppler setup
   # Project will auto-select to 'bandhub' from doppler.yaml
   # Choose config: dev
   ```

5. **Start Development:**
   ```bash
   # All secrets are automatically injected
   doppler run -- npm run dev
   
   # Or for Docker
   doppler run -- docker compose up
   ```

### For Developers Without Doppler Access

You can still develop locally using `.env` files:

1. **Copy example environment:**
   ```bash
   cp .env.example .env
   ```

2. **Request secrets from team lead:**
   - Ask for development values for: `DATABASE_URL`, `JWT_SECRET`, `YOUTUBE_API_KEY`
   - Never share production secrets via Slack/email

3. **Run normally:**
   ```bash
   npm run dev
   # or
   docker compose up
   ```

### Sharing Doppler Access with Team

To give team members access:

1. Go to your Doppler dashboard
2. Navigate to your project → Settings → Access
3. Click "Invite Member"
4. Enter their email address
5. Select their role (Developer, Admin, etc.)
6. Choose which configs they can access
7. Click "Send Invitation"

Team members can then:
```bash
doppler login
doppler setup
# Select project and config
doppler run -- npm run dev:api
```

## CI/CD Integration

### GitHub Actions Integration

1. **Create Service Tokens in Doppler:**
   - Go to your project in Doppler
   - Navigate to Access → Service Tokens
   - Create tokens for each environment:
     - "GitHub Actions - Staging" → Select config: `stg`
     - "GitHub Actions - Production" → Select config: `prd`
   - Copy each token (they won't be shown again!)

2. **Add Tokens to GitHub Secrets:**
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Add repository secrets:
     - Name: `DOPPLER_TOKEN_STG` → Value: staging token
     - Name: `DOPPLER_TOKEN_PRD` → Value: production token

3. **Use in GitHub Actions Workflows:**

**For PR builds and tests:**
```yaml
# .github/workflows/test.yml
name: Tests

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      # Use test environment variables (no Doppler needed)
      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          JWT_SECRET: test-secret-for-ci
          NODE_ENV: test
        run: npm test
```

**For staging deployments:**
```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [develop, staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Doppler CLI
        uses: dopplerhq/cli-action@v3
      
      - name: Deploy to Staging
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN_STG }}
        run: |
          doppler run -- ./scripts/deploy.sh staging
```

**For production deployments:**
```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Doppler CLI
        uses: dopplerhq/cli-action@v3
      
      - name: Verify Doppler Connection
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN_PRD }}
        run: |
          doppler secrets --config prd --project bandhub --silent
      
      - name: Deploy to Production
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN_PRD }}
        run: |
          doppler run -- ./scripts/deploy.sh production
```

### Docker Integration

See the updated `docker-compose.prod.yml` for Doppler sidecar pattern.

## Production Deployment

### Option 1: Doppler Sidecar (Recommended for Docker)

The Doppler sidecar automatically injects secrets into your containers. See `docker-compose.prod.yml` for configuration.

**How it works:**
1. Doppler sidecar container starts first
2. It fetches secrets from Doppler API
3. Writes secrets to a shared volume
4. Your application reads from the shared volume
5. Doppler watches for changes and updates automatically

### Option 2: Environment Variable Injection

```bash
# On your production server
doppler setup --config prd

# Run your application with Doppler
doppler run -- npm run start:prod

# Or with PM2
doppler run -- pm2 start ecosystem.config.js

# Or with Docker
doppler run -- docker-compose -f docker-compose.prod.yml up -d
```

### Option 3: Service Token (for Kubernetes)

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      initContainers:
      - name: doppler
        image: dopplerhq/cli:latest
        command:
          - doppler
          - secrets
          - download
          - --format=env
          - --config=prd
        env:
        - name: DOPPLER_TOKEN
          valueFrom:
            secretKeyRef:
              name: doppler-token
              key: token
        volumeMounts:
        - name: secrets
          mountPath: /secrets
      containers:
      - name: api
        image: your-api-image
        envFrom:
        - configMapRef:
            name: app-secrets
        volumeMounts:
        - name: secrets
          mountPath: /secrets
```

## Production Deployment Checklist

Before deploying to production with Doppler:

- [ ] Doppler service token for `prd` config created
- [ ] Token added to GitHub Secrets as `DOPPLER_TOKEN_PRD`
- [ ] All required secrets populated in Doppler `prd` config
- [ ] Secrets validated in staging environment first
- [ ] Team has documented rollback procedure
- [ ] Emergency contact list updated
- [ ] Monitoring/alerting configured for secret-related errors
- [ ] Database connection string tested
- [ ] JWT secrets are different from staging/dev
- [ ] Redis password configured (if applicable)
- [ ] All API keys have appropriate rate limits
- [ ] Backup `.env` file stored securely (encrypted) for emergency

## Fallback Mechanism

The application is designed to work with or without Doppler. The secrets manager service automatically:

1. **First**, tries to load secrets from Doppler (if `DOPPLER_TOKEN` is set)
2. **Second**, falls back to reading from `.env` files
3. **Third**, uses environment variables directly from the system

**Configuration in code:**
```typescript
// apps/api/src/modules/secrets-manager/secrets.service.ts
async loadSecrets(): Promise<Record<string, string>> {
  // Try Doppler first
  if (process.env.DOPPLER_TOKEN) {
    try {
      return await this.loadFromDoppler();
    } catch (error) {
      this.logger.warn('Doppler unavailable, falling back to env files');
    }
  }
  
  // Fall back to .env files
  return this.loadFromEnvFiles();
}
```

## Verification & Testing

### Step 1: Verify Doppler Configuration

```bash
# Check Doppler is installed and logged in
doppler --version
doppler whoami

# Verify project setup
doppler setup --get

# List available secrets (should not show values)
doppler secrets --config dev
```

### Step 2: Test Local Development

```bash
# Test API with Doppler
doppler run -- npm run dev:api

# Check if secrets are loaded
doppler run -- env | grep DATABASE_URL
doppler run -- env | grep JWT_SECRET
```

### Step 3: Test Docker Integration

```bash
# Test development docker-compose
doppler run -- docker compose up -d

# Check API health
curl http://localhost:3001/api/health

# View logs
docker compose logs api
```

### Step 4: Test Secret Rotation

```bash
# Test JWT rotation in development
./scripts/rotate-secrets.sh dev JWT_SECRET

# Verify JWT_PREVIOUS_SECRET was set
doppler secrets get JWT_PREVIOUS_SECRET --config dev

# Restart API and verify no errors
doppler run -- docker compose restart api
docker compose logs api
```

### Common Issues

#### Issue: "DOPPLER_TOKEN not configured"
**Solution:** Run `doppler login` and `doppler setup`

#### Issue: "Failed to fetch secrets from Doppler"
**Solution:** Check your internet connection and verify token:
```bash
doppler secrets --config dev
```

#### Issue: "Project not found"
**Solution:** Verify project name:
```bash
doppler setup --project bandhub
```

#### Issue: Secrets not being injected
**Solution:** Ensure you're using `doppler run --`:
```bash
# Wrong
npm run dev

# Correct
doppler run -- npm run dev
```

## Best Practices

### 1. Never Commit Secrets
- ✅ Use Doppler or `.env` files (gitignored)
- ❌ Never commit `.env.*` files except `.env.example`
- ❌ Never hardcode secrets in code

### 2. Use Environment-Specific Configs
- `dev` - Local development, non-sensitive data
- `stg` - Staging environment, close to production
- `prd` - Production, real secrets

### 3. Rotate Secrets Regularly
```bash
# Update a secret in Doppler
doppler secrets set JWT_SECRET="new-secret-key"

# Your running applications will pick up the change automatically
# (if using Doppler sidecar or periodic refresh)
```

### 4. Use Service Tokens for CI/CD
- Create separate service tokens for each environment
- Use scoped tokens (read-only when possible)
- Rotate tokens periodically

### 5. Monitor Access
- Review audit logs regularly in Doppler dashboard
- Set up alerts for secret access/changes
- Remove access for departing team members immediately

### 6. Document Required Secrets
Keep `.env.example` up to date:
```bash
# Generate .env.example from current secrets (with values removed)
doppler secrets download --format=env-no-values > .env.example
```

## Troubleshooting

### Issue: "doppler: command not found"
**Solution:** Reinstall Doppler CLI following Step 2 above.

### Issue: "Project or config not found"
**Solution:** Run `doppler setup` in your project directory and select the correct project/config.

### Issue: "Authentication failed"
**Solution:** Run `doppler login` to re-authenticate.

### Issue: Application not picking up Doppler secrets
**Solution:**
1. Verify Doppler is configured: `doppler configure`
2. Check you're running with: `doppler run -- <command>`
3. Verify secrets are set: `doppler secrets`
4. Check logs for fallback messages

### Issue: Secrets not syncing in production
**Solution:**
1. Verify service token is valid: `doppler configs tokens list`
2. Check token has correct permissions
3. Verify Doppler sidecar is running: `docker-compose ps doppler`
4. Check sidecar logs: `docker-compose logs doppler`

### Issue: Rate limiting errors
**Solution:** Doppler has API rate limits. If using polling, increase the interval:
```bash
# Default is 10 seconds, increase to 60 seconds
doppler run --watch --watch-interval=60 -- npm start
```

## Support and Resources

- **Doppler Documentation:** https://docs.doppler.com
- **Doppler CLI Reference:** https://docs.doppler.com/docs/cli
- **Doppler Support:** support@doppler.com
- **Community Slack:** https://doppler.com/community

## Quick Reference Commands

```bash
# Login
doppler login

# Setup project
doppler setup

# View current config
doppler configure

# List all secrets
doppler secrets

# Get specific secret
doppler secrets get DATABASE_URL

# Set secret
doppler secrets set KEY="value"

# Delete secret
doppler secrets delete KEY

# Download secrets as .env file
doppler secrets download --format=env > .env

# Run command with secrets
doppler run -- npm start

# Run with automatic secret refresh
doppler run --watch -- npm start

# Switch config
doppler setup --config stg

# View audit logs
doppler activity

# List service tokens
doppler configs tokens list
```

---

**Security Note:** Remember to never commit Doppler service tokens or any `.env.*` files to version control. Always use the Doppler CLI or service tokens for accessing secrets in production environments.
