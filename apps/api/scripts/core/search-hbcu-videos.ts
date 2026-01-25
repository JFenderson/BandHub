/**
 * HBCU Band Video Search Script
 *
 * Searches YouTube for videos using HBCU band names and keywords from hbcu-bands.ts
 * This finds videos from fan channels, media outlets, and other sources not
 * covered by the direct channel backfill.
 *
 * NOTE: YouTube Search API costs 100 quota units per search!
 * For quota-efficient video fetching, use backfill-band-videos.ts or
 * backfill-creator-videos.ts which use playlist APIs (1 unit per 50 videos).
 *
 * Usage: npx tsx apps/api/scripts/core/search-hbcu-videos.ts [options]
 *
 * Options:
 *   --dry-run           Preview without saving to database
 *   --limit <number>    Limit number of bands to process (default: all)
 *   --band <name>       Search for a specific band (partial match)
 *   --max-results <n>   Max videos per search query (default: 50)
 *   --skip-existing     Skip bands that already have videos in youtube_videos
 */
import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import { SyncStatus } from '@prisma/client';
import { google, youtube_v3 } from 'googleapis';
import { HBCU_BANDS, BandChannelConfig } from '../../src/config/hbcu-bands';

dotenv.config();
const prisma = new PrismaService();

// Configuration
const config = {
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  DAILY_QUOTA_LIMIT: parseInt(process.env.YOUTUBE_QUOTA_LIMIT || '10000'),
  RATE_LIMIT_DELAY_MS: 1000,
  // Search costs 100 quota units, so be conservative
  MAX_SEARCHES_PER_RUN: 50,
};

let youtube: youtube_v3.Youtube | null = null;
let quotaUsed = 0;

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipExisting = args.includes('--skip-existing');

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
const maxResultsPerSearch = getArgValue('--max-results', 50);
const specificBand = getArgString('--band');

interface SearchStats {
  totalSearches: number;
  totalVideosFound: number;
  totalVideosAdded: number;
  totalVideosSkipped: number;
  bandResults: Map<string, { found: number; added: number }>;
}

async function main() {
  console.log('🔍 HBCU Band Video Search Script');
  console.log('=================================\n');

  if (dryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  // Initialize YouTube API
  if (!config.YOUTUBE_API_KEY) {
    console.error('❌ YOUTUBE_API_KEY environment variable is required');
    process.exit(1);
  }

  youtube = google.youtube({
    version: 'v3',
    auth: config.YOUTUBE_API_KEY,
  });

  // Filter bands if specific band requested
  let bandsToProcess = HBCU_BANDS;
  if (specificBand) {
    bandsToProcess = HBCU_BANDS.filter(
      (b) =>
        b.name.toLowerCase().includes(specificBand.toLowerCase()) ||
        b.school.toLowerCase().includes(specificBand.toLowerCase())
    );
    if (bandsToProcess.length === 0) {
      console.error(`❌ No bands found matching "${specificBand}"`);
      process.exit(1);
    }
  }

  console.log(`📊 HBCU Bands in config: ${bandsToProcess.length}`);
  console.log(`🔢 Max results per search: ${maxResultsPerSearch}`);
  console.log(`💰 Quota limit: ${config.DAILY_QUOTA_LIMIT}\n`);

  // Get band IDs from database for linking
  const dbBands = await prisma.band.findMany({
    select: { id: true, name: true, schoolName: true },
  });

  const bandIdMap = new Map<string, string>();
  for (const band of dbBands) {
    bandIdMap.set(band.schoolName.toLowerCase(), band.id);
    bandIdMap.set(band.name.toLowerCase(), band.id);
  }

  const stats: SearchStats = {
    totalSearches: 0,
    totalVideosFound: 0,
    totalVideosAdded: 0,
    totalVideosSkipped: 0,
    bandResults: new Map(),
  };

  let processed = 0;

  for (const bandConfig of bandsToProcess) {
    if (processed >= processLimit) {
      console.log(`\n⏹️  Reached processing limit of ${processLimit} bands`);
      break;
    }

    // Check quota (search costs 100 units)
    if (quotaUsed + 100 >= config.DAILY_QUOTA_LIMIT * 0.9) {
      console.log(`\n⚠️  Approaching daily quota limit (${quotaUsed}/${config.DAILY_QUOTA_LIMIT})`);
      break;
    }

    if (stats.totalSearches >= config.MAX_SEARCHES_PER_RUN) {
      console.log(`\n⚠️  Reached max searches per run (${config.MAX_SEARCHES_PER_RUN})`);
      break;
    }

    // Find band ID in database
    const bandId =
      bandIdMap.get(bandConfig.school.toLowerCase()) ||
      bandIdMap.get(bandConfig.name.toLowerCase());

    if (!bandId) {
      console.log(`\n⚠️  Skipping ${bandConfig.name} - not found in database`);
      continue;
    }

    // Skip if band already has videos and flag is set
    if (skipExisting) {
      const existingCount = await prisma.youTubeVideo.count({
        where: { bandId },
      });
      if (existingCount > 0) {
        console.log(`\n⏭️  Skipping ${bandConfig.name} - already has ${existingCount} videos`);
        continue;
      }
    }

    console.log(`\n[${processed + 1}] Searching: ${bandConfig.name}`);
    console.log(`   School: ${bandConfig.school}`);
    console.log(`   Keywords: ${bandConfig.keywords.slice(0, 5).join(', ')}...`);

    try {
      const result = await searchBandVideos(bandConfig, bandId);
      stats.totalSearches++;
      stats.totalVideosFound += result.found;
      stats.totalVideosAdded += result.added;
      stats.totalVideosSkipped += result.skipped;
      stats.bandResults.set(bandConfig.name, { found: result.found, added: result.added });

      console.log(`   ✅ Found: ${result.found}, Added: ${result.added}, Skipped: ${result.skipped}`);
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
    }

    processed++;
    await delay(config.RATE_LIMIT_DELAY_MS * 2);
  }

  // Summary
  console.log('\n=================================');
  console.log('📊 SEARCH SUMMARY');
  console.log('=================================');
  console.log(`   Bands Searched: ${processed}`);
  console.log(`   Total Searches: ${stats.totalSearches}`);
  console.log(`   Videos Found: ${stats.totalVideosFound}`);
  console.log(`   Videos Added: ${stats.totalVideosAdded}`);
  console.log(`   Videos Skipped (duplicates): ${stats.totalVideosSkipped}`);
  console.log(`   Quota Used: ~${quotaUsed}`);

  if (stats.bandResults.size > 0) {
    console.log('\n🏆 Top bands by videos found:');
    Array.from(stats.bandResults.entries())
      .sort((a, b) => b[1].found - a[1].found)
      .slice(0, 10)
      .forEach(([name, result], i) => {
        console.log(`   ${i + 1}. ${name}: ${result.found} found, ${result.added} added`);
      });
  }

  if (dryRun) {
    console.log('\n📋 DRY RUN - No changes were made');
  }
}

async function searchBandVideos(
  bandConfig: BandChannelConfig,
  bandId: string
): Promise<{ found: number; added: number; skipped: number }> {
  if (!youtube) {
    return { found: 0, added: 0, skipped: 0 };
  }

  let found = 0;
  let added = 0;
  let skipped = 0;

  // Build search query - use band name and top keywords
  const searchQueries = [
    `"${bandConfig.name}"`, // Exact band name
    `"${bandConfig.school}" marching band`, // School + marching band
  ];

  // Add specific keywords that are unique enough
  const uniqueKeywords = bandConfig.keywords.filter(
    (k) => k.length >= 8 && !k.includes(' ')
  );
  if (uniqueKeywords.length > 0) {
    searchQueries.push(`"${uniqueKeywords[0]}" band`);
  }

  // Use the most specific search query
  const query = searchQueries[0];

  try {
    // Search YouTube - costs 100 quota units
    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      q: query,
      type: ['video'],
      maxResults: maxResultsPerSearch,
      order: 'relevance',
      videoDuration: 'medium', // Filter out very short/long videos
      relevanceLanguage: 'en',
    });
    quotaUsed += 100;

    const videos = searchResponse.data.items || [];
    found = videos.length;

    if (dryRun) {
      console.log(`   📋 Would process ${found} videos (dry run)`);
      return { found, added: found, skipped: 0 };
    }

    // Get video details for duration and stats
    const videoIds = videos
      .map((v) => v.id?.videoId)
      .filter((id): id is string => !!id);

    let videoDetails = new Map<string, { duration: number; viewCount: number; likeCount: number }>();

    if (videoIds.length > 0) {
      const detailsResponse = await youtube.videos.list({
        part: ['contentDetails', 'statistics'],
        id: videoIds,
      });
      quotaUsed += 1;

      for (const item of detailsResponse.data.items || []) {
        if (item.id) {
          videoDetails.set(item.id, {
            duration: parseDuration(item.contentDetails?.duration || ''),
            viewCount: parseInt(item.statistics?.viewCount || '0'),
            likeCount: parseInt(item.statistics?.likeCount || '0'),
          });
        }
      }
    }

    // Process each video
    for (const video of videos) {
      const videoId = video.id?.videoId;
      if (!videoId) continue;

      // Check if already exists
      const existing = await prisma.youTubeVideo.findUnique({
        where: { youtubeId: videoId },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const details = videoDetails.get(videoId) || { duration: 0, viewCount: 0, likeCount: 0 };
      const publishedAt = new Date(video.snippet?.publishedAt || new Date());

      try {
        await prisma.youTubeVideo.create({
          data: {
            youtubeId: videoId,
            title: video.snippet?.title || 'Unknown',
            description: video.snippet?.description || '',
            thumbnailUrl:
              video.snippet?.thumbnails?.high?.url ||
              video.snippet?.thumbnails?.default?.url ||
              '',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            duration: details.duration,
            publishedAt,
            viewCount: details.viewCount,
            likeCount: details.likeCount,
            channelId: video.snippet?.channelId || '',
            channelTitle: video.snippet?.channelTitle || '',
            bandId: bandId, // Pre-assign the band since we searched for it
            qualityScore: 50, // Default score for search results
            syncStatus: SyncStatus.COMPLETED,
            lastSyncedAt: new Date(),
          },
        });
        added++;
      } catch (error) {
        console.log(`   ⚠️  Error saving video ${videoId}: ${error}`);
      }
    }
  } catch (error) {
    throw error;
  }

  return { found, added, skipped };
}

function parseDuration(isoDuration: string): number {
  if (!isoDuration) return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the script
main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
