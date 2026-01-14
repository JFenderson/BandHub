# Doppler Secrets Management Setup Guide

This guide will help you set up Doppler for managing environment variables and secrets in the HBCU Band Hub application.

## Table of Contents

- [What is Doppler?](#what-is-doppler)
- [Why Use Doppler?](#why-use-doppler)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Local Development Setup](#local-development-setup)
- [CI/CD Integration](#cicd-integration)
- [Production Deployment](#production-deployment)
- [Fallback Mechanism](#fallback-mechanism)
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
# Select project: hbcu-band-hub
# Select config: dev

# Run your development server with Doppler
doppler run -- npm run dev:api

# Or for the worker
doppler run -- npm run dev:worker

# Or run the entire stack
doppler run -- docker-compose up
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

1. **Create a Service Token in Doppler:**
   - Go to your project in Doppler
   - Navigate to Access → Service Tokens
   - Click "Generate"
   - Name it "GitHub Actions - Production"
   - Select config: `prd`
   - Copy the token (it won't be shown again!)

2. **Add Token to GitHub Secrets:**
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `DOPPLER_TOKEN_PRD`
   - Value: Paste the service token
   - Click "Add secret"

3. **Use in GitHub Actions Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Doppler CLI
        uses: dopplerhq/cli-action@v3
      
      - name: Build and Deploy
        env:
          DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN_PRD }}
        run: |
          doppler run -- npm run build
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
