# Features Documentation

Documentation for key features of the HBCU Band Hub platform.

## Table of Contents

1. [Video Sync Automation](#video-sync-automation)
2. [User Accounts](#user-accounts)
3. [Band Card Enhancements](#band-card-enhancements)
4. [Video Date Display](#video-date-display)
5. [Progressive Web App](#progressive-web-app)

---

## Video Sync Automation

Automated pipeline for syncing, matching, and publishing HBCU marching band videos from YouTube.

### Performance

**Before Automation:**
- Manual execution required
- 60% match rate (30k/50k videos)
- 20k videos unmatched (~40% failure)
- No daily updates

**After Automation:**
- Fully automated pipeline
- 85-90% match rate target
- Daily updates (new videos within 2-3 hours)
- Consolidated codebase

### Daily Pipeline

#### 3:00 AM UTC - Backfill
```
BACKFILL_BANDS + BACKFILL_CREATORS (parallel)
```

Pulls videos from YouTube:
- 67 official band channels
- 43 content creator channels
- Expected yield: 200-400 new videos per day

**Process:**
1. Fetch channel's upload playlist
2. Paginate through videos (50 per request)
3. Enrich with metadata
4. Skip existing videos
5. Store with `bandId = null` initially

#### 4:00 AM UTC - Matching
```
MATCH_VIDEOS
```

Matches unmatched videos using:

**1. Event-Based Matching**
```typescript
const eventParticipants = {
  'MEAC SWAC Challenge': ['Alcorn State', 'Jackson State', 'Southern', ...],
  'Bayou Classic': ['Southern University', 'Grambling State'],
  'Honda BOTB': /* year-specific participants */,
};
```

**2. Enhanced Nickname/Alias Detection**
- Alcorn State: "Sounds Of Dyn-O-Mite", "SOD"
- Southern: "Human Jukebox"
- Grambling: "World Famed"

**3. Battle Detection**
- Identifies "vs", "versus", "battle", "BOTB"
- Sets both `bandId` AND `opponentBandId`

**4. Comparative Study Support**
- "Checkmate Comparative Study - MVSU, SU, GSU"
- Detects multiple bands
- Assigns primary `bandId` + stores others

**5. Exclusion Filtering**
- High schools, middle schools
- Podcasts, talk shows
- Generic content

**6. Quality Scoring**
- Exact name match: 100 points
- School name match: 80 points
- Partial match: 60 points
- Abbreviation match: 30 points

#### 5:00 AM UTC - Promotion
```
PROMOTE_VIDEOS
```

Promotes matched videos from `YouTubeVideo` to `Video` table:
- Only promotes videos with `bandId` set
- Copies metadata and relationships
- Sets featured/trending flags

### Configuration

```env
# Worker Configuration
WORKER_CONCURRENCY="3"
MAX_YOUTUBE_CALLS_PER_MINUTE="60"
YOUTUBE_API_KEY="your_key"
YOUTUBE_QUOTA_LIMIT="10000"
```

### Monitoring

See [MONITORING.md](MONITORING.md#sync-job-monitoring-ui) for:
- Real-time job monitoring
- Stuck job detection
- Error tracking
- Queue management

---

## User Accounts

Public user registration, authentication, and profile management.

### Architecture

**Backend:** `apps/api/src/modules/users/`  
**Frontend:** `apps/web/src/app/` (register, login, profile, etc.)  
**Context:** `apps/web/src/contexts/UserContext.tsx`

### Database Models

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String
  avatar        String?
  bio           String?
  emailVerified Boolean   @default(false)
  preferences   Json      @default("{}")
  lastSeenAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### API Endpoints

**Public:**
- `POST /api/users/register` - Create account
- `POST /api/users/login` - Login
- `POST /api/users/forgot-password` - Request password reset
- `POST /api/users/reset-password` - Reset password
- `POST /api/users/verify-email` - Verify email

**Protected (requires authentication):**
- `GET /api/users/me` - Get profile
- `PATCH /api/users/me` - Update profile
- `DELETE /api/users/me` - Delete account
- `POST /api/users/logout` - Logout
- `POST /api/users/change-password` - Change password
- `GET /api/users/sessions` - List sessions

### Authentication Flow

**Registration:**
1. User submits form
2. Server validates and checks email
3. Password hashed (bcrypt, 12 rounds)
4. User created with `emailVerified: false`
5. Verification token generated (24h expiry)
6. Welcome email sent
7. Redirect to check email page

**Login:**
1. Submit credentials
2. Validate email and password
3. Generate JWT (15 min expiry)
4. Create session (7 or 30 days)
5. Return tokens
6. Redirect to profile

**Password Reset:**
1. Request reset with email
2. Generate reset token (1h expiry)
3. Send reset email
4. User enters new password
5. Update password, invalidate sessions
6. Send confirmation email

### User Preferences

```typescript
interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  defaultVideoSort: 'recent' | 'popular' | 'alphabetical';
  preferredCategories: string[];
  emailNotifications: {
    newContent: boolean;
    favorites: boolean;
    newsletter: boolean;
  };
  favoriteBands: string[];
}
```

### Security Features

**Password Requirements:**
- Minimum 8 characters
- Uppercase, lowercase, number required

**Token Security:**
- Passwords: bcrypt (12 rounds)
- Tokens: SHA-256 hashing
- Access tokens: 15 min expiry
- Session tokens: 7-30 days
- Verification tokens: 24 hours
- Reset tokens: 1 hour

**Rate Limiting:**
- Login: 5 attempts per 15 minutes
- Registration: 5 attempts per 15 minutes
- Password reset: 3 per 15 minutes

---

## Band Card Enhancements

Visual enhancements displaying band colors professionally.

### Design Elements

**1. Border Color**
- 2px solid border in primary color
- Gray fallback if no colors

**2. Background Gradient**
- Linear gradient (135deg) from primary to secondary
- Behind band logo
- Blue-to-cyan fallback

**3. Color Accent Bar**
- 1px horizontal gradient bar
- Bottom edge of logo area
- Primary to secondary color

**4. Nickname Text Color**
- Colored with primary color
- Blue fallback

### Visual Layout

```
┌─────────────────────────────────────┐
│  ╔═══════════════════════════════╗  │ ← Border (primary color)
│  ║                               ║  │
│  ║   [BAND LOGO]                 ║  │
│  ║   on gradient background      ║  │ ← Gradient (primary → secondary)
│  ║                               ║  │
│  ║███████████████████████████████║  │ ← Accent bar
│  ╚═══════════════════════════════╝  │
│                                     │
│  School Name                        │
│  Nickname                           │ ← Primary color text
│  City, State                        │
└─────────────────────────────────────┘
```

### Security Features

```tsx
// Color validation prevents CSS injection
const isValidHexColor = (color: string | undefined | null): boolean => {
  if (!color) return false;
  return /^#[0-9A-Fa-f]{6}$/.test(color);
};
```

### Example Bands

**Alabama A&M** (Maroon #660000 and White #FFFFFF)  
**Florida A&M** (Orange #F58025 and Green #00843D)  
**Jackson State** (Navy #002147 and White #FFFFFF)  
**Southern** (Blue #00263E and Gold #FFC72C)

### Accessibility

- Fallback colors when unavailable
- Text contrast maintained
- Graceful degradation
- No JavaScript calculations

---

## Video Date Display

Distinction between YouTube upload dates and database insertion dates.

### Date Fields

**`publishedAt`** - Original YouTube upload date  
**`createdAt`** - Added to BandHub database date

### Why Two Dates?

A video from 2008 added in 2024 needs both dates to avoid appearing as "new" content.

### Default Behavior

**All public listings default to `publishedAt` DESC** (newest YouTube uploads first).

This ensures:
- Old videos don't appear as new when added
- Chronological order based on actual upload dates
- Accurate timeline of band performances

### Recently Added Feature

**1. Sort By Filter**
- Video library: change to "Recently Added"
- Sorts by `createdAt` DESC

**2. Recently Added Section**
- Homepage section
- Shows videos by `createdAt` DESC

**3. NEW Badge**
- Green badge for videos added within 7 days
- Top-right corner of video card

### Sort Options

- **Latest Uploads** - `publishedAt` (default)
- **Recently Added** - `createdAt`
- **Most Viewed** - `viewCount`
- **Title** - alphabetical

### API Usage

```bash
# Get latest YouTube uploads (default)
GET /api/videos?sortBy=publishedAt&sortOrder=desc

# Get recently added to BandHub
GET /api/videos?sortBy=createdAt&sortOrder=desc

# Get most viewed
GET /api/videos?sortBy=viewCount&sortOrder=desc
```

---

## Progressive Web App

PWA functionality for installable app experience.

### Features

- **Installable** - Add to home screen (mobile/desktop)
- **Offline Support** - Cached content available offline
- **Push Notifications** - Web push support
- **App-like Experience** - Full-screen without browser UI

### Files

| File | Purpose |
|------|---------|
| `public/manifest.json` | PWA manifest with metadata |
| `public/sw.js` | Service worker with caching |
| `public/icons/` | App icons (various sizes) |
| `src/app/offline/page.tsx` | Offline fallback page |
| `src/components/pwa/AddToHomeScreen.tsx` | Install prompt |
| `src/components/pwa/PWAProvider.tsx` | PWA context |
| `src/hooks/useServiceWorker.ts` | Service worker hook |

### Caching Strategies

| Content | Strategy | Description |
|---------|----------|-------------|
| Static assets | Cache-first | Serve from cache, update in background |
| Images | Cache-first | Serve from cache, fallback to network |
| API calls | Network-first | Try network, fallback to cache |
| HTML pages | Network-first | Try network, fallback to offline page |

### Setup

**1. Generate Icons:**
```bash
cd apps/web
npm install sharp --save-dev
node scripts/generate-icons.js
```

Generates: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

**2. Customize Base Icon:**
Edit `public/icons/icon.svg`, then regenerate

**3. Add Screenshots (Optional):**
- `public/screenshots/home.png` (1280x720) - Desktop
- `public/screenshots/mobile.png` (750x1334) - Mobile

### Testing

**Development Mode:**
Service workers disabled. To test:
```bash
npm run build
npm start
```

**Chrome DevTools:**
1. Application tab → Manifest
2. Check Service Workers registration
3. View Cache Storage

**Offline Testing:**
1. Network tab → Check "Offline"
2. Navigate app
3. Visit `/offline`

**Lighthouse PWA Audit:**
1. DevTools → Lighthouse → PWA
2. Target: Installable + 100% optimized

**Mobile Testing:**

*Android (Chrome):*
- Wait 3 seconds for install prompt
- Or menu → "Add to Home Screen"

*iOS (Safari):*
- Share button → "Add to Home Screen"

### Configuration

**Manifest** (`public/manifest.json`):
```json
{
  "name": "HBCU Band Hub",
  "short_name": "Band Hub",
  "theme_color": "#dc2626",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

**Service Worker** (`public/sw.js`):
```javascript
const CACHE_NAME = 'hbcu-band-hub-v1';  // Increment to bust cache

const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
];
```

### Installation

**Desktop:**
- Chrome: Address bar → Install icon
- Edge: Address bar → App available
- Firefox: Address bar → Install

**Mobile:**
- Android: Banner prompt or browser menu
- iOS: Share → Add to Home Screen

### Offline Features

When offline:
- Cached pages load normally
- API calls fallback to cache
- Images from cache
- Offline page for uncached routes
- Toast notification shows online/offline status

---

## Additional Resources

- **API Documentation**: [API.md](API.md)
- **Monitoring**: [MONITORING.md](MONITORING.md)
- **Security**: [SECURITY_NEW.md](SECURITY_NEW.md)
- **Setup**: [SETUP.md](SETUP.md)
