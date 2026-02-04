# Architecture & Implementation Guide

Technical architecture, project structure, and implementation history for HBCU Band Hub.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Module Overview](#module-overview)
5. [Implementation History](#implementation-history)
6. [Database Schema](#database-schema)
7. [Technology Stack](#technology-stack)

---

## Project Overview

HBCU Band Hub is a comprehensive platform for managing and showcasing HBCU marching band videos and profiles. The platform automatically syncs videos from YouTube, matches them to bands, and provides a rich browsing experience.

### Core Features

- **Band Management** - Create and manage HBCU marching band profiles with colors, logos, and metadata
- **Video Library** - Organize and filter band performance videos with smart categorization
- **Automated Sync** - Daily automated pipeline syncs videos from 110+ YouTube channels
- **Video Matching** - Intelligent matching algorithms with 85-90% accuracy
- **User Accounts** - Public user registration with favorites, playlists, and social features
- **Search** - Full-text search across bands and videos
- **Admin Panel** - Administrative tools for content management and monitoring
- **Progressive Web App** - Installable PWA with offline support
- **JWT Authentication** - Secure authentication for admin and user accounts

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │   Pages    │  │  Components │  │  Server Components   │ │
│  │  (App Dir) │  │   (Client)  │  │    (RSC/Actions)     │ │
│  └────────────┘  └─────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend API (NestJS)                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐│
│  │   Modules  │  │   Guards   │  │    Interceptors        ││
│  │ (REST API) │  │   (Auth)   │  │  (Logging, Metrics)    ││
│  └────────────┘  └────────────┘  └────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        ┌───────────┐  ┌──────────┐  ┌──────────┐
        │ PostgreSQL│  │  Redis   │  │  Sentry  │
        │ (Database)│  │ (Cache)  │  │ (Errors) │
        └───────────┘  └──────────┘  └──────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Worker (BullMQ)                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐│
│  │ Schedulers │  │ Processors │  │     YouTube API        ││
│  │  (Cron)    │  │  (Jobs)    │  │   (Video Sync)         ││
│  └────────────┘  └────────────┘  └────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────┐
        │   Monitoring (Prometheus/Grafana)    │
        └──────────────────────────────────────┘
```

### Request Flow

**Public Video Browsing:**
```
User → Next.js → API → PostgreSQL → Response
                   ↓
                Redis (Cache)
```

**Authenticated Actions:**
```
User → Next.js → API → JWT Validation → PostgreSQL
                         ↓
                    Role Check (Guard)
```

**Video Sync Pipeline:**
```
Scheduler → Queue → Processor → YouTube API → PostgreSQL
              ↓                      ↓
            Redis              Video Matching
```

---

## Project Structure

```
BandHub/
├── apps/
│   ├── api/                    # NestJS Backend API
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   ├── migrations/     # Database migrations
│   │   │   └── seed-data/      # Seed data (bands, categories)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/       # JWT authentication
│   │   │   │   ├── bands/      # Band management
│   │   │   │   ├── videos/     # Video management
│   │   │   │   ├── categories/ # Video categories
│   │   │   │   ├── users/      # User accounts
│   │   │   │   ├── playlists/  # User playlists
│   │   │   │   ├── favorites/  # User favorites
│   │   │   │   ├── reviews/    # User reviews
│   │   │   │   ├── api-keys/   # API key management
│   │   │   │   └── admin/      # Admin dashboard
│   │   │   ├── cache/          # Redis cache module
│   │   │   ├── queue/          # BullMQ queue module
│   │   │   ├── database/       # Database module
│   │   │   ├── health/         # Health checks
│   │   │   ├── metrics/        # Prometheus metrics
│   │   │   ├── observability/  # Sentry integration
│   │   │   ├── search/         # Search module
│   │   │   ├── youtube/        # YouTube API integration
│   │   │   ├── common/         # Guards, interceptors, pipes
│   │   │   └── main.ts         # Application entry point
│   │   ├── scripts/            # Utility scripts
│   │   └── test/               # Unit and integration tests
│   │
│   ├── web/                    # Next.js Frontend
│   │   ├── public/
│   │   │   ├── icons/          # PWA icons
│   │   │   ├── manifest.json   # PWA manifest
│   │   │   └── sw.js           # Service worker
│   │   ├── src/
│   │   │   ├── app/            # Next.js App Router
│   │   │   │   ├── (public)/   # Public routes
│   │   │   │   ├── (auth)/     # Auth routes (login, register)
│   │   │   │   ├── admin/      # Admin dashboard
│   │   │   │   ├── profile/    # User profile
│   │   │   │   └── api/        # API routes (server actions)
│   │   │   ├── components/
│   │   │   │   ├── bands/      # Band components
│   │   │   │   ├── videos/     # Video components
│   │   │   │   ├── layout/     # Layout components
│   │   │   │   ├── admin/      # Admin components
│   │   │   │   ├── ui/         # Reusable UI components
│   │   │   │   ├── images/     # Optimized image components
│   │   │   │   └── pwa/        # PWA components
│   │   │   ├── contexts/       # React contexts
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── lib/            # Client libraries (API client)
│   │   │   ├── providers/      # React providers
│   │   │   ├── types/          # TypeScript types
│   │   │   └── utils/          # Utility functions
│   │   ├── e2e/                # Playwright E2E tests
│   │   ├── scripts/            # Build scripts
│   │   └── middleware.ts       # Next.js middleware
│   │
│   └── worker/                 # BullMQ Background Worker
│       ├── src/
│       │   ├── processors/     # Job processors
│       │   │   ├── backfill.processor.ts
│       │   │   ├── match.processor.ts
│       │   │   └── promote.processor.ts
│       │   ├── scheduler/      # Job schedulers
│       │   ├── services/       # Worker services
│       │   ├── queues/         # Queue definitions
│       │   ├── metrics/        # Worker metrics
│       │   └── main.ts         # Worker entry point
│       └── test/               # Worker tests
│
├── packages/
│   ├── database/               # Shared Prisma client
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Shared schema
│   │   └── src/
│   │       └── index.ts        # Prisma client export
│   └── cache/                  # Shared cache utilities
│       └── src/
│           └── index.ts        # Cache utilities
│
├── libs/
│   ├── shared/                 # Shared types & utilities
│   │   └── src/
│   │       ├── types/          # Shared TypeScript types
│   │       └── utils/          # Shared utility functions
│   └── observability/          # Shared observability
│       └── src/
│           └── sentry.ts       # Sentry configuration
│
├── scripts/                    # Root-level scripts
│   ├── find-duplicate-bands.ts # Diagnostic script
│   ├── merge-duplicate-bands.ts# Merge duplicates
│   ├── restore-band-colors.ts  # Restore band colors
│   ├── update-band-logos.ts    # Update logos
│   ├── check-slugs.ts          # Check slug uniqueness
│   └── README.md               # Scripts documentation
│
├── docs/                       # Consolidated documentation
│   ├── README.md               # Documentation index
│   ├── SETUP.md                # Setup guide
│   ├── API.md                  # API documentation
│   ├── MONITORING.md           # Monitoring guide
│   ├── CACHING.md              # Caching guide
│   ├── SECURITY_NEW.md         # Security guide
│   ├── TESTING.md              # Testing guide
│   ├── FEATURES.md             # Feature documentation
│   ├── ARCHITECTURE.md         # This file
│   └── archive/                # Archived documentation
│
├── config/                     # Configuration files
│   └── monitoring/             # Monitoring configs
│       ├── prometheus.yml
│       ├── alerting-rules.yml
│       └── grafana/
│
├── docker-compose.yml          # Docker Compose for local dev
├── docker-compose.prod.yml     # Production Docker Compose
├── docker-compose.test.yml     # Test environment
├── package.json                # Root package.json (workspace)
├── pnpm-workspace.yaml         # PNPM workspace config
├── turbo.json                  # Turborepo config
└── tsconfig.json               # Root TypeScript config
```

---

## Module Overview

### Backend Modules (apps/api/src/modules)

#### Authentication (`auth/`)
- JWT token generation and validation
- User registration and login
- Password hashing with bcrypt
- Role-based access control (SUPER_ADMIN, MODERATOR, VIEWER)
- Account lockout after failed attempts
- Session management

#### Bands (`bands/`)
- CRUD operations for band profiles
- Slug generation and uniqueness
- Color validation (hex format)
- Logo management
- Band metrics (views, shares, favorites)
- Related video queries

#### Videos (`videos/`)
- Video listing with filtering and pagination
- Category assignment
- Hide/unhide functionality
- Quality metadata management
- View tracking
- Sort by publishedAt, createdAt, viewCount, title

#### Categories (`categories/`)
- Video category management
- CRUD operations
- Category-based filtering

#### Users (`users/`)
- User profile management
- Email verification
- Password reset flow
- User preferences
- Last seen tracking

#### Playlists (`playlists/`)
- Create and manage user playlists
- Add/remove videos from playlists
- Public/private visibility
- Share functionality

#### Favorites (`favorites/`)
- User can favorite bands and videos
- Favorite count tracking
- User's favorites listing

#### Reviews (`reviews/`)
- User reviews for bands and videos
- Rating system (1-5 stars)
- Moderation tools

#### API Keys (`api-keys/`)
- Generate API keys for external integrations
- Key rotation
- Usage tracking
- Revoke keys

#### Admin (`admin/`)
- Dashboard statistics
- Content moderation
- User management
- Job monitoring UI

#### YouTube (`youtube/`)
- YouTube Data API v3 integration
- Video metadata fetching
- Channel playlist retrieval
- Quota management

#### Cache (`cache/`)
- Redis cache wrapper
- Tag-based invalidation
- Cache warming
- Stale-while-revalidate (SWR)

#### Queue (`queue/`)
- BullMQ queue management
- Job scheduling
- Job monitoring
- Queue metrics

#### Health (`health/`)
- Database health check
- Redis health check
- Overall system health

#### Metrics (`metrics/`)
- Prometheus metrics
- Custom counters and gauges
- HTTP request metrics
- Job metrics

### Frontend Structure (apps/web/src)

#### App Router (`app/`)
- **Public routes**: Homepage, bands, videos, about
- **Auth routes**: Login, register, forgot password, verify email
- **Protected routes**: Profile, playlists, favorites, settings
- **Admin routes**: Dashboard, moderation, analytics
- Server components for data fetching
- Client components for interactivity

#### Components (`components/`)
- **bands/**: BandCard, BandGrid, BandDetail, BandForm
- **videos/**: VideoCard, VideoGrid, VideoDetail, VideoPlayer, VideoFilters
- **layout/**: Header, Footer, Sidebar, Navigation
- **admin/**: AdminDashboard, JobMonitoring, VideoModeration, BandManagement
- **ui/**: Buttons, Modals, Forms, Skeletons, Loading states
- **images/**: BandLogo, VideoThumbnail, UserAvatar (optimized)
- **pwa/**: AddToHomeScreen, PWAProvider, InstallPrompt

#### Contexts (`contexts/`)
- **UserContext**: Current user state and authentication
- **ToastContext**: Toast notifications
- **ThemeContext**: Dark/light theme

#### Hooks (`hooks/`)
- **useAuth**: Authentication helpers
- **useApi**: API client wrapper
- **usePrefetch**: Route prefetching
- **useServiceWorker**: PWA service worker
- **useDebounce**: Debounced input

### Worker Structure (apps/worker/src)

#### Processors (`processors/`)
- **backfill.processor.ts**: Fetch videos from YouTube channels
- **match.processor.ts**: Match videos to bands using AI/heuristics
- **promote.processor.ts**: Promote matched videos to public Video table
- **cleanup.processor.ts**: Remove duplicates and expired content

#### Scheduler (`scheduler/`)
- **daily-jobs.scheduler.ts**: Schedule daily sync jobs (3-6 AM UTC)
- **weekly-jobs.scheduler.ts**: Schedule weekly maintenance

#### Services (`services/`)
- **youtube.service.ts**: YouTube API integration
- **matching.service.ts**: Video matching algorithms
- **notification.service.ts**: Send notifications

---

## Implementation History

### Band Colors & Duplicate Merging (January 2026)

**Problem**: Duplicate band entries with incomplete data, missing colors and logos.

**Solution**:
- Added `primaryColor` and `secondaryColor` fields to Band schema
- Created diagnostic script (`find-duplicate-bands.ts`) to identify duplicates
- Built intelligent merge script (`merge-duplicate-bands.ts`) with scoring algorithm
- Implemented color restoration from seed data
- Enhanced BandCard component with color accents

**Key Features**:
- Completeness scoring based on videos, logos, colors, metrics
- Transaction-based merging to preserve data integrity
- Reassigns all related records (videos, favorites, shares, reviews)
- Validates color values to prevent CSS injection
- Dry-run mode for safe testing

**Files**:
- `scripts/find-duplicate-bands.ts`
- `scripts/merge-duplicate-bands.ts`
- `scripts/restore-band-colors.ts`
- `apps/web/src/components/bands/BandCard.tsx`

**Results**:
- ✅ No duplicate bands
- ✅ All bands have colors and logos
- ✅ Visual enhancements with color accents
- ✅ Preserved all videos and user data

---

### Performance Optimization (January 2026)

**Problem**: Large bundle sizes and slow initial page load.

**Goals**:
- 30% bundle size reduction
- Improved loading performance
- Better Core Web Vitals

**Implementation**:

#### 1. Image Optimization
- Created optimized image components (BandLogo, VideoThumbnail, UserAvatar)
- Automatic WebP conversion
- Lazy loading with blur placeholders
- Responsive sizing

#### 2. Code Splitting
- Lazy loaded heavy components (admin modals, tables)
- Separated vendor chunks (React, Chart.js, date-fns)
- Created loading skeletons for better UX
- Split admin routes

#### 3. Bundle Optimization
- SWC minification enabled
- Max chunk size: 150KB
- Console removal in production
- Webpack bundle analyzer integration

#### 4. Route Optimization
- Strategic prefetching for common routes
- usePrefetchOnHover for interactive prefetching
- Server components for data fetching

**Files**:
- `apps/web/next.config.js`
- `apps/web/src/components/images/`
- `apps/web/src/components/ui/LoadingSkeletons.tsx`
- `apps/web/src/components/ui/PrefetchLinks.tsx`
- `apps/web/scripts/bundle-report.js`

**Results**:
- ✅ Reduced initial bundle size
- ✅ Improved lazy loading
- ✅ Better code splitting
- ✅ Enhanced image performance

---

### Video Date Display (December 2025)

**Problem**: Old videos added to database appeared as "new" content.

**Solution**:
- Distinguished between `publishedAt` (YouTube upload) and `createdAt` (DB insertion)
- Default sorting by `publishedAt` DESC (newest YouTube uploads first)
- Added "Recently Added" sort option (by `createdAt`)
- Added "NEW" badge for videos added within 7 days
- Created "Recently Added to BandHub" homepage section

**Files**:
- `apps/api/src/modules/videos/dto/video-query.dto.ts`
- `apps/api/src/modules/videos/videos.repository.ts`
- `apps/web/src/components/videos/VideoFilters.tsx`
- `apps/web/src/components/videos/VideoCard.tsx`
- `apps/web/src/app/page.tsx`

**Results**:
- ✅ Chronologically accurate video listings
- ✅ Clear distinction between upload and addition dates
- ✅ Users can filter by both dates

---

### Video Sync Automation (November 2025)

**Problem**: Manual video syncing, 40% unmatched rate, no daily updates.

**Solution**:
- Built automated daily pipeline (3-6 AM UTC)
- Enhanced matching algorithms (events, nicknames, battles, comparative studies)
- Three-stage process: backfill → match → promote
- Job monitoring UI in admin panel
- Quota management for YouTube API

**Key Improvements**:
- Target match rate: 85-90% (up from 60%)
- Daily updates: new videos within 2-3 hours
- Event-based matching for competitions
- Battle detection with opponent tracking
- Comparative study support for multi-band videos
- Exclusion filtering (high schools, podcasts)

**Files**:
- `apps/worker/src/processors/backfill.processor.ts`
- `apps/worker/src/processors/match.processor.ts`
- `apps/worker/src/processors/promote.processor.ts`
- `apps/worker/src/scheduler/daily-jobs.scheduler.ts`
- `apps/api/src/modules/admin/controllers/jobs.controller.ts`

**Results**:
- ✅ Fully automated pipeline
- ✅ Improved match accuracy
- ✅ Daily fresh content
- ✅ Real-time job monitoring

---

### User Accounts & Social Features (October 2025)

**Problem**: No public user accounts, only admin users.

**Solution**:
- Implemented public user registration
- Added favorites system (bands and videos)
- Created user playlists
- Built user profiles with bios and avatars
- Added reviews and ratings
- Social features (follow users, share content)

**Features**:
- Email verification flow
- Password reset with tokens
- User preferences (theme, notifications, favorite bands)
- Rate limiting on auth endpoints
- Session management (7-30 days)

**Files**:
- `apps/api/src/modules/users/`
- `apps/api/src/modules/favorites/`
- `apps/api/src/modules/playlists/`
- `apps/api/src/modules/reviews/`
- `apps/web/src/app/(auth)/`
- `apps/web/src/contexts/UserContext.tsx`

**Results**:
- ✅ Public user registration
- ✅ Social engagement features
- ✅ Personalized experience
- ✅ Community building

---

### Progressive Web App (September 2025)

**Problem**: No offline support, not installable.

**Solution**:
- Created PWA manifest with icons
- Implemented service worker with caching strategies
- Added install prompt component
- Offline fallback page
- Push notification support

**Caching Strategies**:
- Static assets: Cache-first
- Images: Cache-first with fallback
- API calls: Network-first with cache fallback
- HTML pages: Network-first with offline page

**Files**:
- `apps/web/public/manifest.json`
- `apps/web/public/sw.js`
- `apps/web/src/components/pwa/`
- `apps/web/src/hooks/useServiceWorker.ts`

**Results**:
- ✅ Installable app on mobile and desktop
- ✅ Offline support
- ✅ App-like experience
- ✅ Push notifications ready

---

## Database Schema

### Core Tables

**bands**
- Primary band information (name, slug, colors, logo)
- School metadata (city, state, conference)
- Metrics (views, shares, favorites)

**videos**
- Public-facing videos (promoted from YouTubeVideo)
- YouTube metadata (title, description, thumbnail)
- Band relationships (bandId, opponentBandId)
- Category, quality score, hidden status
- Dates (publishedAt, createdAt)

**youtube_videos**
- Raw YouTube video data (staging table)
- Matching status (bandId, isPromoted, promotedAt)
- Quality score from matching algorithm

**categories**
- Video categories (halftime-shows, battles-competitions, etc.)
- Name and slug

**users**
- User accounts (email, passwordHash, name)
- Profile (avatar, bio, preferences)
- Email verification status
- Last seen tracking

**favorites**
- User favorites for bands and videos
- Created timestamp

**playlists**
- User-created playlists
- Name, description, visibility
- Video associations

**reviews**
- User reviews for bands and videos
- Rating (1-5 stars)
- Comment text

**api_keys**
- API keys for external integrations
- Key hash, name, permissions
- Revoked status, last used

**sessions**
- User sessions
- Token hash, expiry
- Device information

### Relationships

```
Band ──┬─→ Videos (bandId)
       ├─→ Videos (opponentBandId)
       ├─→ YouTubeVideos (bandId)
       ├─→ Favorites
       └─→ Reviews

Video ─┬─→ Category
       ├─→ Favorites
       ├─→ Reviews
       └─→ PlaylistVideos

User ──┬─→ Favorites
       ├─→ Playlists
       ├─→ Reviews
       └─→ Sessions
```

---

## Technology Stack

### Backend
- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL 14+
- **Cache**: Redis
- **Queue**: BullMQ
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: class-validator, class-transformer
- **API Documentation**: Swagger (OpenAPI)

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: Tailwind CSS
- **Components**: React 18
- **State**: React Context + SWR
- **Forms**: React Hook Form
- **Testing**: Jest, React Testing Library, Playwright
- **PWA**: Workbox, next-pwa

### Worker
- **Framework**: NestJS
- **Queue**: BullMQ
- **Scheduler**: node-cron
- **YouTube API**: googleapis

### DevOps
- **Container**: Docker + Docker Compose
- **Orchestration**: Kubernetes (optional)
- **Monitoring**: Sentry, Prometheus, Grafana
- **CI/CD**: GitHub Actions
- **Secrets**: Doppler

### Development
- **Package Manager**: PNPM
- **Monorepo**: Turborepo
- **Linting**: ESLint
- **Formatting**: Prettier
- **Git Hooks**: Husky

---

## API Design Principles

### RESTful API
- Resource-based URLs (`/api/bands`, `/api/videos`)
- HTTP methods (GET, POST, PUT, DELETE)
- Proper status codes (200, 201, 400, 401, 404, 500)
- Paginated responses with meta

### Authentication
- JWT tokens in Authorization header
- Role-based access control (RBAC)
- API keys for external integrations

### Response Format
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Format
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

---

## Deployment Architecture

### Development
```
Local Machine
├── Docker Compose (PostgreSQL, Redis)
├── API (npm run dev:api)
├── Web (npm run dev:web)
└── Worker (npm run dev:worker)
```

### Production
```
Cloud Infrastructure
├── Kubernetes Cluster
│   ├── API Pods (3 replicas)
│   ├── Worker Pods (2 replicas)
│   └── Web Pods (3 replicas)
├── Managed PostgreSQL
├── Managed Redis
├── Monitoring Stack (Prometheus, Grafana)
└── Load Balancer (NGINX)
```

---

## Related Documentation

- **Setup Guide**: [SETUP.md](SETUP.md)
- **API Reference**: [API.md](API.md)
- **Monitoring**: [MONITORING.md](MONITORING.md)
- **Security**: [SECURITY_NEW.md](SECURITY_NEW.md)
- **Testing**: [TESTING.md](TESTING.md)
- **Features**: [FEATURES.md](FEATURES.md)
