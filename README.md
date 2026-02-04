# HBCU Band Hub

A comprehensive platform for managing and showcasing HBCU marching band videos and profiles. Features automated video syncing from YouTube, intelligent matching algorithms, user accounts with social features, and a Progressive Web App experience.

## Quick Links

📚 **[Complete Documentation](docs/README.md)** - Full documentation in the `docs/` folder  
🚀 **[Setup Guide](docs/SETUP.md)** - Get started with local development  
🔌 **[API Reference](docs/API.md)** - Complete API documentation  
🏗️ **[Architecture](docs/ARCHITECTURE.md)** - Technical architecture and project structure  
🧪 **[Testing Guide](docs/TESTING.md)** - Testing documentation  

## Features

- **Automated Video Sync**: Daily pipeline syncs videos from 110+ YouTube channels
- **Intelligent Matching**: 85-90% match rate with event detection and battle recognition
- **Band Management**: HBCU band profiles with colors, logos, and rich metadata
- **Video Library**: 50k+ videos with filtering, sorting, and categorization
- **User Accounts**: Registration, favorites, playlists, reviews, and social features
- **Progressive Web App**: Installable with offline support
- **Admin Dashboard**: Content management, job monitoring, and analytics
- **Search**: Full-text search across bands and videos
- **JWT Authentication**: Secure authentication for admin and public users

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL 14+
- Redis 6+
- YouTube API key (for video syncing)
- PNPM package manager

## Quick Start

For detailed setup instructions, see **[docs/SETUP.md](docs/SETUP.md)**.

```bash
# 1. Clone and install
git clone https://github.com/JFenderson/BandHub.git
cd BandHub
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your database and API keys

# 3. Start infrastructure
docker compose up -d  # PostgreSQL + Redis

# 4. Set up database
pnpm db:migrate
pnpm db:seed

# 5. Start development servers
pnpm dev:api     # API at http://localhost:3001
pnpm dev:web     # Web at http://localhost:3000
pnpm dev:worker  # Background jobs
```

## Documentation

All comprehensive documentation is located in the **[docs/](docs/)** folder:

- **[SETUP.md](docs/SETUP.md)** - Installation, configuration, and deployment
- **[API.md](docs/API.md)** - Complete API reference with examples
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical architecture and project structure
- **[FEATURES.md](docs/FEATURES.md)** - Feature documentation (video sync, user accounts, PWA)
- **[SECURITY_NEW.md](docs/SECURITY_NEW.md)** - Security best practices and authentication
- **[TESTING.md](docs/TESTING.md)** - Unit, integration, and E2E testing
- **[MONITORING.md](docs/MONITORING.md)** - Observability, health checks, and alerting
- **[CACHING.md](docs/CACHING.md)** - Caching strategies and Redis usage

## API Endpoints

**Base URL:** `http://localhost:3001/api`  
**Swagger Documentation:** `http://localhost:3001/api/docs`  
**Note:** All endpoints are prefixed with `/api` (e.g., `/api/auth/login`)

---

### 🔐 Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Register a new admin user | ❌ No |
| `POST` | `/api/auth/login` | Login and get JWT token | ❌ No |
| `POST` | `/api/auth/logout` | Logout current session | ✅ Yes |
| `POST` | `/api/auth/logout-all` | Logout from all devices | ✅ Yes |
| `POST` | `/api/auth/refresh` | Refresh access token using refresh token | ❌ No |

---

### 🎺 Bands (`/api/bands`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/bands` | Get all bands with pagination | ❌ No |
| `GET` | `/api/bands/:id` | Get band by ID | ❌ No |
| `GET` | `/api/bands/slug/:slug` | Get band by slug | ❌ No |
| `POST` | `/api/bands` | Create a new band | ✅ Yes (MODERATOR) |
| `PUT` | `/api/bands/:id` | Update a band | ✅ Yes (MODERATOR) |
| `DELETE` | `/api/bands/:id` | Delete a band | ✅ Yes (SUPER_ADMIN) |

---

### 🎥 Videos (`/api/videos`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/videos` | Get all videos with filtering and pagination | ❌ No |
| `GET` | `/api/videos/:id` | Get video by ID | ❌ No |
| `PUT` | `/api/videos/:id/hide` | Hide a video from public view | ✅ Yes (MODERATOR) |
| `PUT` | `/api/videos/:id/unhide` | Unhide a video | ✅ Yes (MODERATOR) |
| `PUT` | `/api/videos/:id/category` | Update video category | ✅ Yes (MODERATOR) |
| `PUT` | `/api/videos/:id/quality` | Update video quality metadata | ✅ Yes (MODERATOR) |
| `DELETE` | `/api/videos/:id` | Delete a video permanently | ✅ Yes (SUPER_ADMIN) |

---

### 📂 Categories (`/api/categories`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/categories` | Get all categories | ❌ No |
| `GET` | `/api/categories/:id` | Get category by ID | ❌ No |
| `POST` | `/api/categories` | Create a new category | ✅ Yes (SUPER_ADMIN) |
| `PUT` | `/api/categories/:id` | Update a category | ✅ Yes (SUPER_ADMIN) |
| `DELETE` | `/api/categories/:id` | Delete a category | ✅ Yes (SUPER_ADMIN) |

---

### 🔑 API Keys (`/api/api-keys`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/api-keys` | Create a new API key | ✅ Yes (SUPER_ADMIN) |
| `GET` | `/api/api-keys` | List all API keys | ✅ Yes (MODERATOR) |
| `DELETE` | `/api/api-keys/:id/revoke` | Revoke an API key | ✅ Yes (SUPER_ADMIN) |
| `DELETE` | `/api/api-keys/:id` | Delete an API key permanently | ✅ Yes (SUPER_ADMIN) |

---

### 🏥 Health Check (`/api/health`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/health` | Check API, database, and cache health | ❌ No |
| `GET`& Services

- **API**: `http://localhost:3001`
- **Web**: `http://localhost:3000`
- **Swagger API Docs**: `http://localhost:3001/api/docs`

For complete API reference, see **[docs/API.md](docs/API.md)**.Technology Stack

- **Backend**: NestJS (TypeScript), Prisma ORM, PostgreSQL, Redis
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Worker**: BullMQ for background job processing
- **Testing**: Jest, React Testing Library, Playwright
- **Monitoring**: Sentry, Prometheus, Grafana
- **DevOps**: Docker, Kubernetes, GitHub Actions

For complete architecture details, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Scripts

```bash
# Development
pnpm dev           # Start all services
pnpm dev:api       # Start API only
pnpm dev:web       # Start web only
pnpm dev:worker    # Start worker only

# Database
pnpm db:migrate    # Run migrations
pnpm db:seed       # Seed database
pnpm db:studio     # Open Prisma Studio

# Testing
pnpm test          # Run all tests
pnpm test:cov      # Run tests with coverage
pnpm test:e2e      # Run E2E tests

# Build
pnpm build         # Build all apps
pnpm build:api     # Build API only
pnpm build:web     # Build web only

# Linting
pnpm lint          # Lint all code
pnpm format        # Format with Prettier
```Contributing

Contributions are welcome! Please:

1. Read the documentation in the [docs/](docs/) folder
2. Follow the existing code style
3. Write tests for new features
4. Ensure all tests pass and coverage remains above 80%
5. Submit a Pull Request with a clear description

## License

ISC

---

**For complete documentation**, see the **[docs/](docs/)** folder