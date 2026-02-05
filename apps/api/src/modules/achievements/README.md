# Gamification & Achievements System

A comprehensive gamification system for BandHub that rewards user engagement through achievements, points, levels, and leaderboards.

## Overview

The achievements system tracks user activity across the platform and rewards them with:
- **Achievements** - Unlockable badges for completing specific goals
- **Points** - Earned from unlocking achievements
- **Levels** - Progress through 10 levels based on total points
- **Perks** - Special benefits unlocked at higher levels
- **Leaderboards** - Compete with other users

## Database Models

### Achievement
Defines available achievements in the system.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier |
| `slug` | String | URL-friendly unique name |
| `name` | String | Display name |
| `description` | String | What the achievement is for |
| `icon` | String | Icon name (Lucide icons) |
| `category` | Enum | WATCHING, COLLECTING, COMMUNITY, SPECIAL |
| `rarity` | Enum | COMMON, UNCOMMON, RARE, EPIC, LEGENDARY |
| `points` | Int | Points awarded on unlock |
| `criteriaType` | String | Type of criteria to track |
| `criteriaValue` | Int | Target value to unlock |
| `isSecret` | Boolean | Hidden until unlocked |

### UserAchievement
Tracks user progress and unlocks.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | User ID |
| `achievementId` | String | Achievement ID |
| `progress` | Int | Current progress value |
| `unlockedAt` | DateTime | When unlocked (null if locked) |
| `notified` | Boolean | Whether notification was sent |

### UserPoints
Stores user's total points and level.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | User ID |
| `totalPoints` | Int | Accumulated points |
| `currentLevel` | Int | Current level (1-10) |
| `levelTitle` | String | Level title (e.g., "Expert") |

## Achievement Categories

### WATCHING
Video consumption achievements.

| Achievement | Criteria | Points | Rarity |
|------------|----------|--------|--------|
| First Steps | Watch 1 video | 5 | Common |
| Video Enthusiast | Watch 10 videos | 10 | Common |
| Dedicated Viewer | Watch 50 videos | 25 | Uncommon |
| Centurion | Watch 100 videos | 50 | Rare |
| Binge Watcher | Watch 250 videos | 100 | Epic |
| Marathon Master | Watch 500 videos | 250 | Legendary |
| Streak Starter | 3-day watch streak | 15 | Common |
| Week Warrior | 7-day watch streak | 30 | Uncommon |
| Month Maven | 30-day watch streak | 150 | Epic |

### COLLECTING
Favorites and playlist achievements.

| Achievement | Criteria | Points | Rarity |
|------------|----------|--------|--------|
| Fan Club Member | Favorite 1 band | 5 | Common |
| Band Collector | Favorite 5 bands | 15 | Common |
| Super Fan | Favorite 10 bands | 30 | Uncommon |
| Band Aficionado | Favorite 25 bands | 75 | Rare |
| Ultimate Collector | Favorite 50 bands | 200 | Legendary |
| Video Saver | Favorite 10 videos | 10 | Common |
| Curator | Favorite 50 videos | 40 | Uncommon |
| Archivist | Favorite 100 videos | 100 | Rare |
| Playlist Creator | Create 1 playlist | 10 | Common |
| Playlist Master | Create 10 playlists | 50 | Rare |

### COMMUNITY
Social engagement achievements.

| Achievement | Criteria | Points | Rarity |
|------------|----------|--------|--------|
| Voice Heard | Post 1 comment | 5 | Common |
| Conversationalist | Post 25 comments | 25 | Uncommon |
| Community Pillar | Post 100 comments | 75 | Rare |
| Critic | Write 1 review | 10 | Common |
| Reviewer | Write 10 reviews | 40 | Uncommon |
| Top Critic | Write 25 reviews | 100 | Rare |
| Social Butterfly | Follow 10 users | 15 | Common |
| Influencer | Follow 50 users | 35 | Uncommon |
| Sharer | Share content 10 times | 20 | Common |
| Ambassador | Share content 50 times | 75 | Rare |

### SPECIAL
Milestone and time-based achievements.

| Achievement | Criteria | Points | Rarity |
|------------|----------|--------|--------|
| Early Adopter | Joined before cutoff | 500 | Legendary |
| Veteran | 1 year membership | 100 | Rare |
| Loyal Fan | 2 year membership | 200 | Epic |
| Founding Member | First 1000 users | 1000 | Legendary |
| Completionist | Unlock 50 achievements | 500 | Legendary |

## Level System

| Level | Title | Min Points |
|-------|-------|------------|
| 1 | Rookie | 0 |
| 2 | Fan | 50 |
| 3 | Enthusiast | 150 |
| 4 | Dedicated | 350 |
| 5 | Expert | 600 |
| 6 | Master | 1000 |
| 7 | Elite | 1500 |
| 8 | Champion | 2500 |
| 9 | Legend | 4000 |
| 10 | Icon | 6000 |

## Perks by Level

| Level | Perks Unlocked |
|-------|----------------|
| 1 | Access to all features |
| 2 | Profile badge: Fan |
| 3 | Profile badge: Enthusiast, Custom profile colors |
| 4 | Profile badge: Dedicated, Early access to new features |
| 5 | Profile badge: Expert, Priority support |
| 6 | Profile badge: Master, Exclusive content access |
| 7 | Profile badge: Elite, Beta tester access |
| 8 | Profile badge: Champion, Featured profile eligibility |
| 9 | Profile badge: Legend, Direct feedback channel |
| 10 | Profile badge: Icon, All perks unlocked, Special recognition |

## API Endpoints

### Public Endpoints

#### Get All Achievements
```
GET /v1/achievements
```
Query parameters:
- `page` (int): Page number (default: 1)
- `limit` (int): Items per page (default: 20, max: 100)
- `category` (enum): Filter by category
- `rarity` (enum): Filter by rarity
- `unlockedOnly` (boolean): Only show unlocked (requires auth)

#### Get Achievement by ID/Slug
```
GET /v1/achievements/:idOrSlug
```

#### Get Achievement Statistics
```
GET /v1/achievements/stats
```
Returns counts by category and rarity.

#### Get Leaderboard
```
GET /v1/achievements/leaderboard
```
Query parameters:
- `page` (int): Page number
- `limit` (int): Items per page
- `period` (string): 'all', 'month', or 'week'

#### Get Top Collectors
```
GET /v1/achievements/leaderboard/top-collectors?limit=10
```
Users with most rare/epic/legendary achievements.

#### Get Category Leaderboard
```
GET /v1/achievements/leaderboard/category/:category?limit=10
```

### Authenticated Endpoints

#### Get My Achievements
```
GET /v1/achievements/me/achievements
```

#### Get My Points & Level
```
GET /v1/achievements/me/points
```
Response:
```json
{
  "totalPoints": 450,
  "currentLevel": 4,
  "levelTitle": "Dedicated",
  "achievementsUnlocked": 15,
  "nextLevelPoints": 600,
  "progressToNextLevel": 75
}
```

#### Get My Badges (Profile Display)
```
GET /v1/achievements/me/badges
```
Response:
```json
{
  "recentAchievements": [...],
  "featuredAchievements": [...],
  "totalUnlocked": 15,
  "totalPoints": 450,
  "currentLevel": 4,
  "levelTitle": "Dedicated"
}
```

#### Get My Perks
```
GET /v1/achievements/me/perks
```
Response:
```json
{
  "level": 4,
  "levelTitle": "Dedicated",
  "unlockedPerks": [
    "Access to all features",
    "Profile badge: Fan",
    "Profile badge: Enthusiast",
    "Custom profile colors",
    "Profile badge: Dedicated",
    "Early access to new features"
  ],
  "nextPerks": [
    { "level": 5, "perk": "Profile badge: Expert" },
    { "level": 5, "perk": "Priority support" }
  ]
}
```

#### Get My Rank
```
GET /v1/achievements/me/rank
```

#### Recalculate My Achievements
```
POST /v1/achievements/me/recalculate
```
Useful for retroactively awarding achievements.

### User Profile Endpoints

#### Get User's Badges
```
GET /v1/achievements/user/:userId/badges
```

#### Get User's Points
```
GET /v1/achievements/user/:userId/points
```

## Integration

The achievement tracker is integrated into the following services:

| Service | Tracked Events |
|---------|----------------|
| WatchHistoryService | Videos watched, watch streaks |
| FavoritesService | Bands favorited, videos favorited |
| CommentsService | Comments posted |
| ReviewsService | Reviews posted |
| PlaylistsService | Playlists created |
| FollowingService | Users followed |
| SharingService | Content shared |

### Adding Achievement Tracking

To track achievements in a new service:

```typescript
import { AchievementTrackerService } from '../achievements/achievement-tracker.service';

@Injectable()
export class MyService {
  constructor(
    @Inject(forwardRef(() => AchievementTrackerService))
    private achievementTracker: AchievementTrackerService,
  ) {}

  async myAction(userId: string) {
    // ... perform action ...

    // Track achievement (fire and forget)
    this.achievementTracker.trackVideoWatched(userId).catch(() => {});
  }
}
```

## Seeding Achievements

To seed achievements into the database:

```typescript
// In a migration or seed script
const achievementsService = app.get(AchievementsService);
await achievementsService.seedAchievements();
```

Or call the endpoint (admin only):
```
POST /v1/admin/achievements/seed
```

## Notifications

When achievements are unlocked, notifications are automatically created:

- **ACHIEVEMENT_UNLOCKED** - When a new achievement is earned
- **LEVEL_UP** - When the user reaches a new level

These integrate with the existing notification system and respect user preferences.

## Criteria Types Reference

| Criteria Type | Description |
|--------------|-------------|
| `videos_watched` | Unique videos watched |
| `watch_streak_days` | Consecutive days watching |
| `bands_favorited` | Bands added to favorites |
| `videos_favorited` | Videos added to favorites |
| `comments_posted` | Comments posted (not deleted) |
| `reviews_posted` | Reviews written |
| `playlists_created` | Playlists created |
| `users_following` | Users being followed |
| `shares_count` | Content shares |
| `account_age_days` | Days since registration |
| `early_adopter` | Joined before cutoff date |
| `founding_member` | Among first 1000 users |
| `achievements_unlocked` | Total achievements unlocked |

## Configuration

### Early Adopter Cutoff
```typescript
// achievement-definitions.ts
export const EARLY_ADOPTER_CUTOFF = new Date('2025-12-31T23:59:59Z');
```

### Founding Member Limit
```typescript
export const FOUNDING_MEMBER_LIMIT = 1000;
```

## Best Practices

1. **Fire and forget** - Achievement tracking should not block the main action
2. **Catch errors** - Always catch and ignore tracking errors
3. **Use forwardRef** - To avoid circular dependency issues
4. **Track on success** - Only track after the action succeeds
5. **Batch where possible** - The tracker handles multiple achievement checks efficiently
