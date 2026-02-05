// Define enums locally to avoid dependency on Prisma client generation
// These must match the enums defined in schema.prisma
export enum AchievementCategory {
  WATCHING = 'WATCHING',
  COLLECTING = 'COLLECTING',
  COMMUNITY = 'COMMUNITY',
  SPECIAL = 'SPECIAL',
}

export enum AchievementRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

export interface AchievementDefinition {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  points: number;
  criteriaType: string;
  criteriaValue: number;
  isSecret?: boolean;
  sortOrder?: number;
}

/**
 * Achievement Criteria Types:
 * - videos_watched: Total unique videos watched
 * - watch_time_minutes: Total watch time in minutes
 * - bands_favorited: Number of bands favorited
 * - videos_favorited: Number of videos favorited
 * - comments_posted: Number of comments posted
 * - reviews_posted: Number of reviews posted
 * - playlists_created: Number of playlists created
 * - users_following: Number of users following
 * - shares_count: Number of content shares
 * - account_age_days: Days since account creation
 * - early_adopter: Special - joined before cutoff date
 * - watch_streak_days: Consecutive days watching videos
 */

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ============ WATCHING ACHIEVEMENTS ============
  {
    slug: 'first-watch',
    name: 'First Steps',
    description: 'Watch your first video',
    icon: 'play-circle',
    category: AchievementCategory.WATCHING,
    rarity: AchievementRarity.COMMON,
    points: 5,
    criteriaType: 'videos_watched',
    criteriaValue: 1,
    sortOrder: 1,
  },
  {
    slug: 'video-enthusiast',
    name: 'Video Enthusiast',
    description: 'Watch 10 videos',
    icon: 'video',
    category: AchievementCategory.WATCHING,
    rarity: AchievementRarity.COMMON,
    points: 10,
    criteriaType: 'videos_watched',
    criteriaValue: 10,
    sortOrder: 2,
  },
  {
    slug: 'dedicated-viewer',
    name: 'Dedicated Viewer',
    description: 'Watch 50 videos',
    icon: 'tv',
    category: AchievementCategory.WATCHING,
    rarity: AchievementRarity.UNCOMMON,
    points: 25,
    criteriaType: 'videos_watched',
    criteriaValue: 50,
    sortOrder: 3,
  },
  {
    slug: 'centurion',
    name: 'Centurion',
    description: 'Watch 100 videos',
    icon: 'award',
    category: AchievementCategory.WATCHING,
    rarity: AchievementRarity.RARE,
    points: 50,
    criteriaType: 'videos_watched',
    criteriaValue: 100,
    sortOrder: 4,
  },
  {
    slug: 'binge-watcher',
    name: 'Binge Watcher',
    description: 'Watch 250 videos',
    icon: 'film',
    category: AchievementCategory.WATCHING,
    rarity: AchievementRarity.EPIC,
    points: 100,
    criteriaType: 'videos_watched',
    criteriaValue: 250,
    sortOrder: 5,
  },
  {
    slug: 'marathon-master',
    name: 'Marathon Master',
    description: 'Watch 500 videos',
    icon: 'trophy',
    category: AchievementCategory.WATCHING,
    rarity: AchievementRarity.LEGENDARY,
    points: 250,
    criteriaType: 'videos_watched',
    criteriaValue: 500,
    sortOrder: 6,
  },
  {
    slug: 'streak-starter',
    name: 'Streak Starter',
    description: 'Watch videos 3 days in a row',
    icon: 'flame',
    category: AchievementCategory.WATCHING,
    rarity: AchievementRarity.COMMON,
    points: 15,
    criteriaType: 'watch_streak_days',
    criteriaValue: 3,
    sortOrder: 7,
  },
  {
    slug: 'week-warrior',
    name: 'Week Warrior',
    description: 'Watch videos 7 days in a row',
    icon: 'calendar',
    category: AchievementCategory.WATCHING,
    rarity: AchievementRarity.UNCOMMON,
    points: 30,
    criteriaType: 'watch_streak_days',
    criteriaValue: 7,
    sortOrder: 8,
  },
  {
    slug: 'month-maven',
    name: 'Month Maven',
    description: 'Watch videos 30 days in a row',
    icon: 'calendar-check',
    category: AchievementCategory.WATCHING,
    rarity: AchievementRarity.EPIC,
    points: 150,
    criteriaType: 'watch_streak_days',
    criteriaValue: 30,
    sortOrder: 9,
  },

  // ============ COLLECTING ACHIEVEMENTS ============
  {
    slug: 'first-favorite-band',
    name: 'Fan Club Member',
    description: 'Favorite your first band',
    icon: 'heart',
    category: AchievementCategory.COLLECTING,
    rarity: AchievementRarity.COMMON,
    points: 5,
    criteriaType: 'bands_favorited',
    criteriaValue: 1,
    sortOrder: 20,
  },
  {
    slug: 'band-collector',
    name: 'Band Collector',
    description: 'Favorite 5 bands',
    icon: 'music',
    category: AchievementCategory.COLLECTING,
    rarity: AchievementRarity.COMMON,
    points: 15,
    criteriaType: 'bands_favorited',
    criteriaValue: 5,
    sortOrder: 21,
  },
  {
    slug: 'super-fan',
    name: 'Super Fan',
    description: 'Favorite 10 bands',
    icon: 'star',
    category: AchievementCategory.COLLECTING,
    rarity: AchievementRarity.UNCOMMON,
    points: 30,
    criteriaType: 'bands_favorited',
    criteriaValue: 10,
    sortOrder: 22,
  },
  {
    slug: 'band-aficionado',
    name: 'Band Aficionado',
    description: 'Favorite 25 bands',
    icon: 'crown',
    category: AchievementCategory.COLLECTING,
    rarity: AchievementRarity.RARE,
    points: 75,
    criteriaType: 'bands_favorited',
    criteriaValue: 25,
    sortOrder: 23,
  },
  {
    slug: 'ultimate-collector',
    name: 'Ultimate Collector',
    description: 'Favorite 50 bands',
    icon: 'gem',
    category: AchievementCategory.COLLECTING,
    rarity: AchievementRarity.LEGENDARY,
    points: 200,
    criteriaType: 'bands_favorited',
    criteriaValue: 50,
    sortOrder: 24,
  },
  {
    slug: 'video-saver',
    name: 'Video Saver',
    description: 'Favorite 10 videos',
    icon: 'bookmark',
    category: AchievementCategory.COLLECTING,
    rarity: AchievementRarity.COMMON,
    points: 10,
    criteriaType: 'videos_favorited',
    criteriaValue: 10,
    sortOrder: 25,
  },
  {
    slug: 'curator',
    name: 'Curator',
    description: 'Favorite 50 videos',
    icon: 'library',
    category: AchievementCategory.COLLECTING,
    rarity: AchievementRarity.UNCOMMON,
    points: 40,
    criteriaType: 'videos_favorited',
    criteriaValue: 50,
    sortOrder: 26,
  },
  {
    slug: 'archivist',
    name: 'Archivist',
    description: 'Favorite 100 videos',
    icon: 'archive',
    category: AchievementCategory.COLLECTING,
    rarity: AchievementRarity.RARE,
    points: 100,
    criteriaType: 'videos_favorited',
    criteriaValue: 100,
    sortOrder: 27,
  },
  {
    slug: 'playlist-creator',
    name: 'Playlist Creator',
    description: 'Create your first playlist',
    icon: 'list-music',
    category: AchievementCategory.COLLECTING,
    rarity: AchievementRarity.COMMON,
    points: 10,
    criteriaType: 'playlists_created',
    criteriaValue: 1,
    sortOrder: 28,
  },
  {
    slug: 'playlist-master',
    name: 'Playlist Master',
    description: 'Create 10 playlists',
    icon: 'disc',
    category: AchievementCategory.COLLECTING,
    rarity: AchievementRarity.RARE,
    points: 50,
    criteriaType: 'playlists_created',
    criteriaValue: 10,
    sortOrder: 29,
  },

  // ============ COMMUNITY ACHIEVEMENTS ============
  {
    slug: 'first-comment',
    name: 'Voice Heard',
    description: 'Post your first comment',
    icon: 'message-circle',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.COMMON,
    points: 5,
    criteriaType: 'comments_posted',
    criteriaValue: 1,
    sortOrder: 40,
  },
  {
    slug: 'conversationalist',
    name: 'Conversationalist',
    description: 'Post 25 comments',
    icon: 'messages-square',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.UNCOMMON,
    points: 25,
    criteriaType: 'comments_posted',
    criteriaValue: 25,
    sortOrder: 41,
  },
  {
    slug: 'community-pillar',
    name: 'Community Pillar',
    description: 'Post 100 comments',
    icon: 'users',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.RARE,
    points: 75,
    criteriaType: 'comments_posted',
    criteriaValue: 100,
    sortOrder: 42,
  },
  {
    slug: 'first-review',
    name: 'Critic',
    description: 'Write your first review',
    icon: 'edit',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.COMMON,
    points: 10,
    criteriaType: 'reviews_posted',
    criteriaValue: 1,
    sortOrder: 43,
  },
  {
    slug: 'reviewer',
    name: 'Reviewer',
    description: 'Write 10 reviews',
    icon: 'pen-tool',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.UNCOMMON,
    points: 40,
    criteriaType: 'reviews_posted',
    criteriaValue: 10,
    sortOrder: 44,
  },
  {
    slug: 'top-critic',
    name: 'Top Critic',
    description: 'Write 25 reviews',
    icon: 'award',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.RARE,
    points: 100,
    criteriaType: 'reviews_posted',
    criteriaValue: 25,
    sortOrder: 45,
  },
  {
    slug: 'social-butterfly',
    name: 'Social Butterfly',
    description: 'Follow 10 users',
    icon: 'user-plus',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.COMMON,
    points: 15,
    criteriaType: 'users_following',
    criteriaValue: 10,
    sortOrder: 46,
  },
  {
    slug: 'influencer',
    name: 'Influencer',
    description: 'Follow 50 users',
    icon: 'users-round',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.UNCOMMON,
    points: 35,
    criteriaType: 'users_following',
    criteriaValue: 50,
    sortOrder: 47,
  },
  {
    slug: 'sharer',
    name: 'Sharer',
    description: 'Share content 10 times',
    icon: 'share-2',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.COMMON,
    points: 20,
    criteriaType: 'shares_count',
    criteriaValue: 10,
    sortOrder: 48,
  },
  {
    slug: 'ambassador',
    name: 'Ambassador',
    description: 'Share content 50 times',
    icon: 'megaphone',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.RARE,
    points: 75,
    criteriaType: 'shares_count',
    criteriaValue: 50,
    sortOrder: 49,
  },

  // ============ SPECIAL ACHIEVEMENTS ============
  {
    slug: 'early-adopter',
    name: 'Early Adopter',
    description: 'Joined during the early days of BandHub',
    icon: 'rocket',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.LEGENDARY,
    points: 500,
    criteriaType: 'early_adopter',
    criteriaValue: 1,
    isSecret: false,
    sortOrder: 60,
  },
  {
    slug: 'one-year-member',
    name: 'Veteran',
    description: 'Member for 1 year',
    icon: 'cake',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.RARE,
    points: 100,
    criteriaType: 'account_age_days',
    criteriaValue: 365,
    sortOrder: 61,
  },
  {
    slug: 'two-year-member',
    name: 'Loyal Fan',
    description: 'Member for 2 years',
    icon: 'badge',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.EPIC,
    points: 200,
    criteriaType: 'account_age_days',
    criteriaValue: 730,
    sortOrder: 62,
  },
  {
    slug: 'founding-member',
    name: 'Founding Member',
    description: 'One of the first 1000 members',
    icon: 'shield',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.LEGENDARY,
    points: 1000,
    criteriaType: 'founding_member',
    criteriaValue: 1,
    isSecret: true,
    sortOrder: 63,
  },
  {
    slug: 'completionist',
    name: 'Completionist',
    description: 'Unlock 50 achievements',
    icon: 'check-circle',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.LEGENDARY,
    points: 500,
    criteriaType: 'achievements_unlocked',
    criteriaValue: 50,
    sortOrder: 64,
  },
];

/**
 * Level definitions - points required for each level
 */
export const LEVEL_DEFINITIONS = [
  { level: 1, title: 'Rookie', minPoints: 0 },
  { level: 2, title: 'Fan', minPoints: 50 },
  { level: 3, title: 'Enthusiast', minPoints: 150 },
  { level: 4, title: 'Dedicated', minPoints: 350 },
  { level: 5, title: 'Expert', minPoints: 600 },
  { level: 6, title: 'Master', minPoints: 1000 },
  { level: 7, title: 'Elite', minPoints: 1500 },
  { level: 8, title: 'Champion', minPoints: 2500 },
  { level: 9, title: 'Legend', minPoints: 4000 },
  { level: 10, title: 'Icon', minPoints: 6000 },
];

/**
 * Perks unlocked at each level
 */
export const LEVEL_PERKS = [
  { level: 1, perks: ['Access to all features'] },
  { level: 2, perks: ['Profile badge: Fan'] },
  { level: 3, perks: ['Profile badge: Enthusiast', 'Custom profile colors'] },
  { level: 4, perks: ['Profile badge: Dedicated', 'Early access to new features'] },
  { level: 5, perks: ['Profile badge: Expert', 'Priority support'] },
  { level: 6, perks: ['Profile badge: Master', 'Exclusive content access'] },
  { level: 7, perks: ['Profile badge: Elite', 'Beta tester access'] },
  { level: 8, perks: ['Profile badge: Champion', 'Featured profile eligibility'] },
  { level: 9, perks: ['Profile badge: Legend', 'Direct feedback channel'] },
  { level: 10, perks: ['Profile badge: Icon', 'All perks unlocked', 'Special recognition'] },
];

/**
 * Early adopter cutoff date
 */
export const EARLY_ADOPTER_CUTOFF = new Date('2025-12-31T23:59:59Z');

/**
 * Founding member count
 */
export const FOUNDING_MEMBER_LIMIT = 1000;

/**
 * Helper to get level from points
 */
export function getLevelFromPoints(points: number): { level: number; title: string; nextLevelPoints: number } {
  let currentLevel = LEVEL_DEFINITIONS[0];
  let nextLevelPoints = LEVEL_DEFINITIONS[1]?.minPoints || 0;

  for (let i = LEVEL_DEFINITIONS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_DEFINITIONS[i].minPoints) {
      currentLevel = LEVEL_DEFINITIONS[i];
      nextLevelPoints = LEVEL_DEFINITIONS[i + 1]?.minPoints || currentLevel.minPoints;
      break;
    }
  }

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    nextLevelPoints,
  };
}

/**
 * Get perks for a level
 */
export function getPerksForLevel(level: number): string[] {
  const allPerks: string[] = [];
  for (const perkDef of LEVEL_PERKS) {
    if (perkDef.level <= level) {
      allPerks.push(...perkDef.perks);
    }
  }
  return allPerks;
}

/**
 * Get next perks to unlock
 */
export function getNextPerks(level: number): { level: number; perk: string }[] {
  const nextPerks: { level: number; perk: string }[] = [];
  for (const perkDef of LEVEL_PERKS) {
    if (perkDef.level > level) {
      for (const perk of perkDef.perks) {
        nextPerks.push({ level: perkDef.level, perk });
      }
      if (nextPerks.length >= 3) break;
    }
  }
  return nextPerks.slice(0, 3);
}
