

/**
 * Enhanced Video-to-Band Matching Script - V2
 *
 * Uses your existing hbcu-bands.ts configuration.
 * Matches YouTubeVideo records to bands including:
 * - HBCU bands (from your config)
 * - All-Star bands
 * - Automatic filtering of high schools, middle schools, podcasts
 *
 * Usage: npx tsx apps/api/scripts/enhanced-match-videos-v2.ts [options]
 *
 * Options:
 *   --dry-run              Preview without making changes
 *   --limit <number>       Process limited videos
 *   --min-confidence <n>   Minimum confidence score (0-100)
 *   --skip-exclusions      Don't apply exclusion filters
 */

import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import * as fs from 'fs';
import * as path from 'path';
import { HBCU_BANDS } from '../../src/config/hbcu-bands';


dotenv.config();
const prisma = new PrismaService();

// Load all-star configuration
const allStarConfig = JSON.parse(
  fs.readFileSync(path.resolve('./allstar-config.json'), 'utf-8')
);

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipExclusions = args.includes('--skip-exclusions');

function parseIntArg(argName: string, defaultValue: number, min?: number, max?: number): number {
  const index = args.indexOf(argName);
  if (index === -1 || index + 1 >= args.length) return defaultValue;
  
  const value = parseInt(args[index + 1], 10);
  if (isNaN(value)) {
    console.warn(`⚠️  Invalid ${argName}, using default: ${defaultValue}`);
    return defaultValue;
  }
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

const processLimit = parseIntArg('--limit', Infinity, 1);
const minConfidence = parseIntArg('--min-confidence', 30, 0, 100);

// Battle detection keywords
const battleKeywords = [
  ' vs ', ' vs. ', ' v. ', ' v ', ' versus ',
  'battle', 'botb', 'band battle', 'battle of the bands',
  'showdown', 'face off', 'faceoff',
];

interface BandWithAliases {
  id: string;
  name: string;
  schoolName: string;
  state: string;
  bandType: string;
  aliases: string[];
}

interface MatchResult {
  bandId: string;
  bandName: string;
  bandType: string;
  score: number;
  matchedAlias: string;
  matchType: 'exact_band_name' | 'school_name' | 'partial' | 'abbreviation' | 'all_star';
}

interface VideoMatchStats {
  totalProcessed: number;
  matchedHBCU: number;
  matchedAllStar: number;
  excluded: number;
  singleBand: number;
  battleVideos: number;
  noMatch: number;
  lowConfidence: number;
  exclusionReasons: Map<string, number>;
  bandCounts: Map<string, number>;
}

/**
 * Check if video should be excluded
 */
function shouldExclude(text: string): { exclude: boolean; reason?: string } {
  if (skipExclusions) return { exclude: false };

  const lowerText = text.toLowerCase();

  for (const pattern of allStarConfig.exclusionPatterns.highSchool) {
    if (lowerText.includes(pattern.toLowerCase())) {
      return { exclude: true, reason: 'high_school' };
    }
  }

  for (const pattern of allStarConfig.exclusionPatterns.middleSchool) {
    if (lowerText.includes(pattern.toLowerCase())) {
      return { exclude: true, reason: 'middle_school' };
    }
  }

  for (const pattern of allStarConfig.exclusionPatterns.podcasts) {
    if (pattern.startsWith(' ')) {
      const regex = new RegExp(pattern.trim(), 'i');
      if (regex.test(lowerText)) {
        return { exclude: true, reason: 'podcast_show' };
      }
    } else if (lowerText.includes(pattern.toLowerCase())) {
      return { exclude: true, reason: 'podcast_show' };
    }
  }

  for (const pattern of allStarConfig.exclusionPatterns.generic) {
    if (lowerText.includes(pattern.toLowerCase())) {
      return { exclude: true, reason: 'generic_content' };
    }
  }

  return { exclude: false };
}

/**
 * Generate aliases from HBCU band config
 */
function generateHBCUAliases(hbcuConfig: typeof HBCU_BANDS[0]): string[] {
  const aliases = new Set<string>();

  // Add band name
  aliases.add(hbcuConfig.name.toLowerCase());

  // Add school name
  aliases.add(hbcuConfig.school.toLowerCase());

  // Add all keywords from config
  for (const keyword of hbcuConfig.keywords) {
    aliases.add(keyword.toLowerCase());
  }

  // Extract band nickname from full name
  // e.g., "Southern University Human Jukebox" → "human jukebox"
  const nameParts = hbcuConfig.name.split(' ');
  if (nameParts.length > 2) {
    // Try to find the nickname (usually after the school name)
    const schoolWords = hbcuConfig.school.toLowerCase().split(' ');
    const nameWords = hbcuConfig.name.toLowerCase().split(' ');
    
    // Find where school name ends in band name
    let nicknameStart = 0;
    for (let i = 0; i < schoolWords.length && i < nameWords.length; i++) {
      if (schoolWords[i] === nameWords[i]) {
        nicknameStart = i + 1;
      } else {
        break;
      }
    }
    
    if (nicknameStart > 0 && nicknameStart < nameWords.length) {
      const nickname = nameWords.slice(nicknameStart).join(' ');
      if (nickname.length > 3) {
        aliases.add(nickname);
      }
    }
  }

  // School name without "University" or "College"
  const schoolSimple = hbcuConfig.school
    .replace(/\s+university$/i, '')
    .replace(/\s+college$/i, '')
    .trim()
    .toLowerCase();
  
  if (schoolSimple !== hbcuConfig.school.toLowerCase()) {
    aliases.add(schoolSimple);
  }

  // Generate acronym from school
  const schoolWords = hbcuConfig.school
    .replace(/&/g, 'and')
    .split(/\s+/)
    .filter((w) => !['of', 'the', 'at', 'and'].includes(w.toLowerCase()));
  
  const acronym = schoolWords.map((w) => w[0]).join('').toLowerCase();
  if (acronym.length >= 2 && acronym.length <= 5) {
    aliases.add(acronym);
  }

  return Array.from(aliases).filter((a) => a.length >= 3);
}

/**
 * Generate aliases for all-star bands
 */
function generateAllStarAliases(bandName: string): string[] {
  const allStarBand = allStarConfig.allStarBands.find(
    (b: any) => b.name.toLowerCase() === bandName.toLowerCase()
  );

  if (allStarBand) {
    return [
      allStarBand.name.toLowerCase(),
      ...allStarBand.aliases.map((a: string) => a.toLowerCase()),
    ];
  }

  return [bandName.toLowerCase()];
}

/**
 * Check if text contains battle keywords
 */
function isBattleVideo(text: string): boolean {
  const lowerText = text.toLowerCase();
  return battleKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Find matches for a video
 */
function findMatches(searchText: string, bandsWithAliases: BandWithAliases[]): MatchResult[] {
  const matches: MatchResult[] = [];
  const lowerText = searchText.toLowerCase();

  for (const band of bandsWithAliases) {
    let bestScore = 0;
    let bestAlias = '';
    let bestMatchType: MatchResult['matchType'] = 'abbreviation';

    for (const alias of band.aliases) {
      if (alias.length < 3) continue;

      let found = false;
      if (alias.length <= 4) {
        // Short alias - use word boundary
        const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
        found = regex.test(lowerText);
      } else {
        found = lowerText.includes(alias);
      }

      if (found) {
        let score = 0;
        let matchType: MatchResult['matchType'] = 'abbreviation';

        // Score based on match type and band type
        if (band.bandType === 'ALL_STAR') {
          if (alias === band.name.toLowerCase()) {
            score = 110;
            matchType = 'all_star';
          } else if (alias.length >= 4) {
            score = 90;
            matchType = 'all_star';
          } else {
            score = 70;
            matchType = 'all_star';
          }
        } else {
          // HBCU scoring
          if (alias === band.name.toLowerCase()) {
            score = 100;
            matchType = 'exact_band_name';
          } else if (alias === band.schoolName.toLowerCase()) {
            score = 80;
            matchType = 'school_name';
          } else if (alias.length >= 8) {
            score = 60;
            matchType = 'partial';
          } else if (alias.length >= 5) {
            score = 50;
            matchType = 'partial';
          } else {
            score = 30;
            matchType = 'abbreviation';
          }
        }

        // Boost if in first 200 chars
        if (lowerText.substring(0, 200).includes(alias)) {
          score += 10;
        }

        if (score > bestScore) {
          bestScore = score;
          bestAlias = alias;
          bestMatchType = matchType;
        }
      }
    }

    if (bestScore > 0) {
      matches.push({
        bandId: band.id,
        bandName: band.name,
        bandType: band.bandType,
        score: bestScore,
        matchedAlias: bestAlias,
        matchType: bestMatchType,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Main matching function
 */
async function main() {
  console.log('🎯 Enhanced Video Matching (V2 - Using hbcu-bands.ts)');
  console.log('====================================================\n');

  if (dryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  if (skipExclusions) {
    console.log('⚠️  EXCLUSIONS DISABLED\n');
  }

  console.log(`⚙️  Configuration:`);
  console.log(`   HBCU Bands in config: ${HBCU_BANDS.length}`);
  console.log(`   Min Confidence: ${minConfidence}`);
  console.log(`   Process Limit: ${processLimit === Infinity ? 'All' : processLimit}\n`);

  // Fetch all bands from database
  console.log('📊 Fetching bands from database...');
  const bands = await prisma.band.findMany({
    select: {
      id: true,
      name: true,
      schoolName: true,
      state: true,
      bandType: true,
    },
  });

  console.log(`   Found ${bands.length} bands in database\n`);

  // Generate aliases
  console.log('🔧 Generating aliases for bands...');
  
  // Create a map of school names to HBCU config for quick lookup
  const hbcuConfigMap = new Map();
  for (const hbcu of HBCU_BANDS) {
    hbcuConfigMap.set(hbcu.school.toLowerCase(), hbcu);
  }

  const bandsWithAliases: BandWithAliases[] = bands.map((band) => {
    // Check if this is an all-star band
    const isAllStar = band.name.toLowerCase().includes('all-star') ||
                     band.name.toLowerCase().includes('mass band');
    
    let aliases: string[];
    
    if (isAllStar) {
      // Generate all-star aliases
      aliases = generateAllStarAliases(band.name);
    } else {
      // Try to find HBCU config for this band
      const hbcuConfig = hbcuConfigMap.get(band.schoolName.toLowerCase());
      
      if (hbcuConfig) {
        // Use config-based aliases (better!)
        aliases = generateHBCUAliases(hbcuConfig);
      } else {
        // Fallback: basic aliases
        aliases = [
          band.name.toLowerCase(),
          band.schoolName.toLowerCase(),
        ];
      }
    }

    return {
      ...band,
      bandType: isAllStar ? 'ALL_STAR' : 'HBCU',
      aliases,
    };
  });

  console.log(`   Generated aliases for ${bandsWithAliases.length} bands\n`);

  // Fetch unmatched videos
  console.log('📥 Fetching unmatched videos...');
  const videos = await prisma.youTubeVideo.findMany({
    where: { bandId: null },
    select: {
      id: true,
      youtubeId: true,
      title: true,
      description: true,
      channelTitle: true,
    },
    take: processLimit === Infinity ? undefined : processLimit,
    orderBy: { createdAt: 'desc' as const },
  });

  console.log(`   Found ${videos.length} unmatched videos\n`);

  if (videos.length === 0) {
    console.log('✅ No unmatched videos to process');
    return;
  }

  // Statistics
  const stats: VideoMatchStats = {
    totalProcessed: 0,
    matchedHBCU: 0,
    matchedAllStar: 0,
    excluded: 0,
    singleBand: 0,
    battleVideos: 0,
    noMatch: 0,
    lowConfidence: 0,
    exclusionReasons: new Map(),
    bandCounts: new Map(),
  };

  console.log('🔄 Processing videos...\n');

  for (const video of videos) {
    stats.totalProcessed++;

    const searchText = [
      video.title || '',
      video.description || '',
      video.channelTitle || '',
    ].join(' ');

    // Check exclusions first
    const exclusionCheck = shouldExclude(searchText);
    if (exclusionCheck.exclude) {
      stats.excluded++;
      const reason = exclusionCheck.reason || 'unknown';
      stats.exclusionReasons.set(reason, (stats.exclusionReasons.get(reason) || 0) + 1);
      

      continue;
    }

    // Find matches
    const matches = findMatches(searchText, bandsWithAliases);

    if (matches.length === 0) {
      stats.noMatch++;
      continue;
    }

    const topMatch = matches[0];

    if (topMatch.score < minConfidence) {
      stats.lowConfidence++;
      continue;
    }

    // Track by band type
    if (topMatch.bandType === 'ALL_STAR') {
      stats.matchedAllStar++;
    } else {
      stats.matchedHBCU++;
    }

    // Check for battle
    const isBattle = isBattleVideo(searchText);
    if (isBattle && matches.length >= 2) {
      const secondMatch = matches.find((m) => m.bandId !== topMatch.bandId);
      if (secondMatch && secondMatch.score >= minConfidence) {
        stats.battleVideos++;
      } else {
        stats.singleBand++;
      }
    } else {
      stats.singleBand++;
    }

    stats.bandCounts.set(topMatch.bandName, (stats.bandCounts.get(topMatch.bandName) || 0) + 1);

    // Update database
    if (!dryRun) {
      try {
        await prisma.youTubeVideo.update({
          where: { id: video.id },
          data: {
            bandId: topMatch.bandId,
            qualityScore: topMatch.score,
          },
        });
      } catch (error) {
        console.error(`   ❌ Error updating ${video.youtubeId}:`, error);
      }
    }

    if (stats.totalProcessed % 100 === 0) {
      console.log(`   Processed ${stats.totalProcessed}/${videos.length}...`);
    }
  }

  // Print summary
  const totalMatched = stats.matchedHBCU + stats.matchedAllStar;
  
  console.log('\n🎯 Enhanced Matching Summary');
  console.log('===========================');
  console.log(`Total videos processed: ${stats.totalProcessed}`);
  console.log(`\n✅ Total matched: ${totalMatched}`);
  console.log(`   🎓 HBCU bands: ${stats.matchedHBCU}`);
  console.log(`   🌟 All-Star bands: ${stats.matchedAllStar}`);
  console.log(`   - Single band: ${stats.singleBand}`);
  console.log(`   ⚔️ Battle (2 bands): ${stats.battleVideos}`);
  console.log(`\n🚫 Excluded: ${stats.excluded}`);
  
  if (stats.exclusionReasons.size > 0) {
    console.log(`   Breakdown:`);
    for (const [reason, count] of stats.exclusionReasons.entries()) {
      console.log(`     - ${reason}: ${count}`);
    }
  }
  
  console.log(`\n❓ No match: ${stats.noMatch}`);
  console.log(`⚠️  Low confidence: ${stats.lowConfidence}`);

  const matchRate = stats.totalProcessed > 0
    ? ((totalMatched / stats.totalProcessed) * 100).toFixed(1)
    : '0';
  console.log(`\n📈 Match Rate: ${matchRate}%`);

  if (stats.bandCounts.size > 0) {
    console.log('\n🏆 Top matched bands:');
    Array.from(stats.bandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([name, count], index) => {
        console.log(`   ${index + 1}. ${name} - ${count} videos`);
      });
  }

  if (dryRun) {
    console.log('\n📋 DRY RUN - No changes made');
  } else {
    console.log(`\n✅ Updated ${totalMatched} videos`);
    console.log(`✅ Excluded ${stats.excluded} non-HBCU videos`);
  }
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });