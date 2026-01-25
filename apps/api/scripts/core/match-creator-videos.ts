/**
 * Match Creator Videos Script
 *
 * Specifically targets videos from known content creator channels that don't have
 * a bandId assigned yet. Uses enhanced matching with creator context.
 *
 * This script:
 * 1. Links videos to their content creators (if not already linked)
 * 2. Runs matching on unmatched videos from creator channels
 * 3. Uses lower confidence thresholds for verified creator channels
 *
 * Usage: npx tsx apps/api/scripts/core/match-creator-videos.ts [options]
 *
 * Options:
 *   --dry-run           Preview without making changes
 *   --creator <name>    Only process a specific creator (partial match)
 *   --limit <n>         Limit number of videos to process (default: all)
 *   --min-score <n>     Minimum match score (default: 40 for creator videos)
 */
import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import { HBCU_BANDS } from '../../src/config/hbcu-bands';

dotenv.config();
const prisma = new PrismaService();

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function getArgValue(argName: string, defaultValue: number): number {
  const index = args.indexOf(argName);
  if (index === -1 || index + 1 >= args.length) return defaultValue;
  return parseInt(args[index + 1], 10) || defaultValue;
}

function getArgString(argName: string): string | null {
  const index = args.indexOf(argName);
  if (index === -1 || index + 1 >= args.length) return null;
  return args[index + 1];
}

const processLimit = getArgValue('--limit', Infinity);
const minScore = getArgValue('--min-score', 40); // Lower threshold for creator videos
const specificCreator = getArgString('--creator');

// All-Star bands configuration
const ALL_STAR_BANDS = [
  { name: 'All-Star Band', aliases: ['all star', 'all-star', 'allstar'] },
  { name: 'BOTB All-Stars', aliases: ['botb all-star', 'battle of the bands all-star'] },
  { name: 'All-American Band', aliases: ['all american', 'all-american'] },
  { name: 'High School All-Stars', aliases: ['hs all-star', 'high school all-star'] },
];

interface BandWithAliases {
  id: string;
  name: string;
  aliases: string[];
  schoolName?: string;
}

interface MatchResult {
  bandId: string;
  bandName: string;
  score: number;
  matchedOn: string;
}

interface Stats {
  totalCreators: number;
  totalVideosProcessed: number;
  totalMatched: number;
  totalAlreadyMatched: number;
  creatorResults: Map<string, { name: string; processed: number; matched: number }>;
  bandCounts: Map<string, number>;
}

async function main() {
  console.log('🎯 Match Creator Videos Script');
  console.log('===============================\n');

  if (dryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  console.log(`⚙️  Minimum score threshold: ${minScore}`);
  console.log(`⚙️  Process limit: ${processLimit === Infinity ? 'unlimited' : processLimit}\n`);

  // Get all bands from database with their info
  const dbBands = await prisma.band.findMany({
    select: {
      id: true,
      name: true,
      schoolName: true,
    },
  });

  // Build bands with aliases for matching
  const bandsWithAliases: BandWithAliases[] = [];

  // Add HBCU bands from config
  for (const hbcuBand of HBCU_BANDS) {
    const dbBand = dbBands.find(
      (b) =>
        b.schoolName.toLowerCase() === hbcuBand.school.toLowerCase() ||
        b.name.toLowerCase() === hbcuBand.name.toLowerCase()
    );
    if (dbBand) {
      bandsWithAliases.push({
        id: dbBand.id,
        name: dbBand.name,
        schoolName: dbBand.schoolName,
        aliases: generateAliases(hbcuBand, dbBand),
      });
    }
  }

  // Add any database bands not in HBCU config
  for (const dbBand of dbBands) {
    if (!bandsWithAliases.find((b) => b.id === dbBand.id)) {
      bandsWithAliases.push({
        id: dbBand.id,
        name: dbBand.name,
        schoolName: dbBand.schoolName,
        aliases: [
          dbBand.name.toLowerCase(),
          dbBand.schoolName.toLowerCase(),
        ],
      });
    }
  }

  console.log(`📊 Loaded ${bandsWithAliases.length} bands for matching\n`);

  // Get content creators
  const whereCreator: any = {
    youtubeChannelId: { not: '' },
    isVerified: true, // Only verified creators
  };
  if (specificCreator) {
    whereCreator.name = { contains: specificCreator, mode: 'insensitive' };
  }

  const creators = await prisma.contentCreator.findMany({
    where: whereCreator,
    select: {
      id: true,
      name: true,
      youtubeChannelId: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log(`📊 Found ${creators.length} verified content creators\n`);

  // Build channelId -> creator map
  const channelToCreator = new Map<string, { id: string; name: string }>();
  for (const creator of creators) {
    channelToCreator.set(creator.youtubeChannelId, {
      id: creator.id,
      name: creator.name,
    });
  }

  const stats: Stats = {
    totalCreators: 0,
    totalVideosProcessed: 0,
    totalMatched: 0,
    totalAlreadyMatched: 0,
    creatorResults: new Map(),
    bandCounts: new Map(),
  };

  // Process each creator's unmatched videos
  let totalProcessed = 0;

  for (const creator of creators) {
    if (totalProcessed >= processLimit) break;

    // Get unmatched videos from this creator's channel
    const videos = await prisma.youTubeVideo.findMany({
      where: {
        channelId: creator.youtubeChannelId,
        bandId: null, // Unmatched only
      },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        description: true,
        creatorId: true,
      },
      take: Math.min(1000, processLimit - totalProcessed),
    });

    if (videos.length === 0) continue;

    console.log(`\n🎬 Processing: ${creator.name} (${videos.length} unmatched videos)`);

    let creatorMatched = 0;
    let creatorProcessed = 0;

    for (const video of videos) {
      if (totalProcessed >= processLimit) break;

      // Link to creator if not already linked
      if (!video.creatorId && !dryRun) {
        await prisma.youTubeVideo.update({
          where: { id: video.id },
          data: { creatorId: creator.id },
        });
      }

      // Try to match to a band
      const searchText = `${video.title} ${video.description || ''}`.toLowerCase();
      const match = findBestMatch(searchText, bandsWithAliases);

      if (match && match.score >= minScore) {
        if (!dryRun) {
          await prisma.youTubeVideo.update({
            where: { id: video.id },
            data: {
              bandId: match.bandId,
              qualityScore: match.score,
              creatorId: creator.id,
            },
          });
        }
        creatorMatched++;
        stats.totalMatched++;
        stats.bandCounts.set(match.bandName, (stats.bandCounts.get(match.bandName) || 0) + 1);
      }

      creatorProcessed++;
      totalProcessed++;
      stats.totalVideosProcessed++;
    }

    if (creatorProcessed > 0) {
      stats.totalCreators++;
      stats.creatorResults.set(creator.id, {
        name: creator.name,
        processed: creatorProcessed,
        matched: creatorMatched,
      });
      console.log(`   ✅ Matched: ${creatorMatched}/${creatorProcessed} videos`);
    }
  }

  // Summary
  console.log('\n===============================');
  console.log('📊 MATCH SUMMARY');
  console.log('===============================');
  console.log(`   Creators Processed: ${stats.totalCreators}`);
  console.log(`   Videos Processed: ${stats.totalVideosProcessed}`);
  console.log(`   Videos Matched: ${stats.totalMatched}`);
  console.log(`   Match Rate: ${stats.totalVideosProcessed > 0 ? ((stats.totalMatched / stats.totalVideosProcessed) * 100).toFixed(1) : 0}%`);

  if (stats.creatorResults.size > 0) {
    console.log('\n🏆 Results by Creator:');
    Array.from(stats.creatorResults.entries())
      .sort((a, b) => b[1].matched - a[1].matched)
      .slice(0, 15)
      .forEach(([_, result], i) => {
        const rate = result.processed > 0 ? ((result.matched / result.processed) * 100).toFixed(0) : 0;
        console.log(`   ${i + 1}. ${result.name}: ${result.matched}/${result.processed} (${rate}%)`);
      });
  }

  if (stats.bandCounts.size > 0) {
    console.log('\n🎺 Top Matched Bands:');
    Array.from(stats.bandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([bandName, count], i) => {
        console.log(`   ${i + 1}. ${bandName}: ${count} videos`);
      });
  }

  if (dryRun) {
    console.log('\n📋 DRY RUN - No changes were made');
  }
}

function generateAliases(
  hbcuConfig: (typeof HBCU_BANDS)[0],
  dbBand: { name: string; schoolName: string }
): string[] {
  const aliases = new Set<string>();

  // Add band name variations
  aliases.add(hbcuConfig.name.toLowerCase());
  aliases.add(dbBand.name.toLowerCase());

  // Add school name
  aliases.add(hbcuConfig.school.toLowerCase());
  aliases.add(dbBand.schoolName.toLowerCase());

  // Add keywords from config
  for (const keyword of hbcuConfig.keywords) {
    if (keyword.length >= 4) {
      aliases.add(keyword.toLowerCase());
    }
  }

  // Add common variations
  const schoolShort = hbcuConfig.school
    .replace(/university/i, '')
    .replace(/college/i, '')
    .replace(/state/i, '')
    .trim()
    .toLowerCase();
  if (schoolShort.length >= 3) {
    aliases.add(schoolShort);
  }

  return Array.from(aliases);
}

function findBestMatch(searchText: string, bands: BandWithAliases[]): MatchResult | null {
  let bestMatch: MatchResult | null = null;
  const first200 = searchText.substring(0, 200);

  for (const band of bands) {
    for (const alias of band.aliases) {
      if (alias.length < 3) continue;

      let found = false;

      // Check for match
      if (alias.length <= 4) {
        // Short alias - need word boundary
        const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
        found = regex.test(searchText);
      } else {
        found = searchText.includes(alias);
      }

      if (found) {
        let score = 0;

        // Score based on alias length and type
        if (alias === band.name.toLowerCase()) {
          score = 80; // Exact band name
        } else if (alias === band.schoolName?.toLowerCase()) {
          score = 70; // School name
        } else if (alias.length >= 10) {
          score = 60; // Long keyword
        } else if (alias.length >= 6) {
          score = 50; // Medium keyword
        } else {
          score = 35; // Short keyword
        }

        // Boost if in title area (first 200 chars)
        if (first200.includes(alias)) {
          score += 15;
        }

        // Boost for longer matches
        if (alias.length >= 15) {
          score += 10;
        }

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            bandId: band.id,
            bandName: band.name,
            score,
            matchedOn: alias,
          };
        }
      }
    }
  }

  return bestMatch;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
