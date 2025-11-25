/**
 * Historical Video Backfill Script
 * 
 * This standalone script performs full historical syncs for bands that haven't been fully synced yet.
 * It respects daily quota limits (10,000 units) and implements rate limiting between bands.
 * 
 * Usage: npm run backfill
 * 
 * The script will:
 * 1. Find all bands that need a full sync
 * 2. Process them one by one with 1-hour delays
 * 3. Stop if daily quota is exceeded
 * 4. Resume from where it left off on next run
 */

import { PrismaClient, SyncJobType, SyncJobStatus, SyncStatus } from '@prisma/client';
import { google, youtube_v3 } from 'googleapis';
import * as readline from 'readline';

// Configuration
const config = {
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  DAILY_QUOTA_LIMIT: 10000,
  ESTIMATED_QUOTA_PER_BAND: 1200, // Conservative estimate
  DELAY_BETWEEN_BANDS_MS: 60 * 60 * 1000, // 1 hour
  YOUTUBE_LAUNCH_DATE: new Date('2005-04-23'),
  MAX_VIDEOS_PER_SEARCH: 50,
  SEARCH_QUERIES_PER_BAND: 5,
};

const prisma = new PrismaClient();
let youtube: youtube_v3.Youtube | null = null;
let quotaUsed = 0;

async function main() {
  console.log('🚀 Starting Historical Video Backfill');
  console.log('=====================================\n');

  // Initialize YouTube API
  if (!config.YOUTUBE_API_KEY) {
    console.error('❌ YOUTUBE_API_KEY environment variable is required');
    process.exit(1);
  }

  youtube = google.youtube({
    version: 'v3',
    auth: config.YOUTUBE_API_KEY,
  });

  // Get bands needing full sync
  const bands = await getBandsNeedingSync();
  
  if (bands.length === 0) {
    console.log('✅ All bands have been fully synced!');
    return;
  }

  console.log(`📊 Found ${bands.length} bands needing full sync:\n`);
  bands.forEach((band, index) => {
    console.log(`   ${index + 1}. ${band.name} (${band.schoolName})`);
  });
  console.log('');

  // Calculate estimated time and quota
  const estimatedQuota = bands.length * config.ESTIMATED_QUOTA_PER_BAND;
  const estimatedDays = Math.ceil(estimatedQuota / config.DAILY_QUOTA_LIMIT);
  const bandsPerDay = Math.floor(config.DAILY_QUOTA_LIMIT / config.ESTIMATED_QUOTA_PER_BAND);

  console.log(`📈 Estimated quota needed: ${estimatedQuota.toLocaleString()} units`);
  console.log(`📅 Estimated days to complete: ${estimatedDays}`);
  console.log(`🎯 Bands per day: ${bandsPerDay}\n`);

  // Confirm before starting
  const confirmed = await confirmStart();
  if (!confirmed) {
    console.log('❌ Backfill cancelled');
    return;
  }

  console.log('\n🔄 Starting backfill process...\n');

  // Process each band
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const remainingQuota = config.DAILY_QUOTA_LIMIT - quotaUsed;

    // Check if we have enough quota for this band
    if (remainingQuota < config.ESTIMATED_QUOTA_PER_BAND) {
      console.log(`\n⚠️  Daily quota limit approaching (${quotaUsed}/${config.DAILY_QUOTA_LIMIT})`);
      console.log('📅 Run this script again tomorrow to continue');
      console.log(`📊 Progress: ${i}/${bands.length} bands completed`);
      break;
    }

    console.log(`\n[${ i + 1}/${bands.length}] Processing: ${band.name}`);
    console.log(`   Quota used: ${quotaUsed}/${config.DAILY_QUOTA_LIMIT}`);

    try {
      const result = await syncBandFull(band);
      console.log(`   ✅ Synced: ${result.videosAdded} added, ${result.videosUpdated} updated`);
      console.log(`   📊 Quota used for band: ${result.quotaUsed}`);
    } catch (error) {
      console.error(`   ❌ Failed to sync: ${error}`);
    }

    // Wait before next band (unless it's the last one)
    if (i < bands.length - 1) {
      const remainingBands = bands.length - i - 1;
      console.log(`   ⏳ Waiting 1 hour before next band (${remainingBands} remaining)...`);
      await delay(config.DELAY_BETWEEN_BANDS_MS);
    }
  }

  console.log('\n=====================================');
  console.log('✅ Backfill session complete!');
  console.log(`📊 Total quota used: ${quotaUsed.toLocaleString()}`);
}

async function getBandsNeedingSync() {
  return prisma.band.findMany({
    where: {
      isActive: true,
      OR: [
        { lastFullSync: null },
        { firstSyncedAt: null },
      ],
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      schoolName: true,
      youtubeChannelId: true,
      searchKeywords: true,
    },
  });
}

async function syncBandFull(band: {
  id: string;
  name: string;
  schoolName: string;
  youtubeChannelId: string | null;
  searchKeywords: string[];
}) {
  const startTime = Date.now();
  let videosAdded = 0;
  let videosUpdated = 0;
  let bandQuotaUsed = 0;
  const errors: string[] = [];

  // Create sync job record
  const syncJob = await prisma.syncJob.create({
    data: {
      bandId: band.id,
      jobType: SyncJobType.FULL_SYNC,
      status: SyncJobStatus.IN_PROGRESS,
      startedAt: new Date(),
      publishedAfter: config.YOUTUBE_LAUNCH_DATE,
      publishedBefore: new Date(),
    },
  });

  // Update band status
  await prisma.band.update({
    where: { id: band.id },
    data: { syncStatus: SyncStatus.IN_PROGRESS },
  });

  try {
    // Generate search queries
    const queries = generateSearchQueries(band.name, band.schoolName, band.searchKeywords);

    // Execute searches
    for (const query of queries) {
      try {
        const videos = await searchVideos(query);
        bandQuotaUsed += 100; // Search costs 100 quota units
        quotaUsed += 100;

        for (const video of videos) {
          try {
            const details = await getVideoDetails(video.id);
            bandQuotaUsed += 1;
            quotaUsed += 1;

            if (details) {
              const result = await upsertVideo(band.id, video, details);
              if (result === 'added') videosAdded++;
              else if (result === 'updated') videosUpdated++;
            }
          } catch (error) {
            errors.push(`Failed to process video ${video.id}: ${error}`);
          }
        }

        // Rate limiting
        await delay(1000);
      } catch (error) {
        errors.push(`Search query "${query}" failed: ${error}`);
      }
    }

    // Update sync job as completed
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: SyncJobStatus.COMPLETED,
        completedAt: new Date(),
        videosFound: videosAdded + videosUpdated,
        videosAdded,
        videosUpdated,
        quotaUsed: bandQuotaUsed,
        errors,
      },
    });

    // Update band metadata
    await updateBandMetadata(band.id);

  } catch (error) {
    // Update sync job as failed
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: SyncJobStatus.FAILED,
        completedAt: new Date(),
        videosAdded,
        videosUpdated,
        quotaUsed: bandQuotaUsed,
        errors: [...errors, String(error)],
        errorMessage: String(error),
      },
    });

    await prisma.band.update({
      where: { id: band.id },
      data: { syncStatus: SyncStatus.FAILED },
    });

    throw error;
  }

  return {
    videosAdded,
    videosUpdated,
    quotaUsed: bandQuotaUsed,
    duration: Date.now() - startTime,
  };
}

function generateSearchQueries(bandName: string, schoolName: string, keywords: string[]): string[] {
  const queries = [
    `"${bandName}" marching band`,
    `"${schoolName}" marching band`,
    `"${bandName}" halftime show`,
    `"${bandName}" field show`,
    `"${schoolName}" HBCU band`,
  ];

  // Add custom keywords
  for (const keyword of keywords.slice(0, 3)) {
    queries.push(`"${keyword}" marching band`);
  }

  return queries.slice(0, config.SEARCH_QUERIES_PER_BAND);
}

async function searchVideos(query: string): Promise<Array<{ id: string; title: string; publishedAt: string }>> {
  if (!youtube) throw new Error('YouTube API not initialized');

  const response = await youtube.search.list({
    part: ['snippet'],
    q: query,
    type: ['video'],
    maxResults: config.MAX_VIDEOS_PER_SEARCH,
    order: 'relevance',
    publishedAfter: config.YOUTUBE_LAUNCH_DATE.toISOString(),
  });

  return (response.data.items || [])
    .filter((item) => item.id?.videoId)
    .map((item) => ({
      id: item.id!.videoId!,
      title: item.snippet?.title || 'Unknown',
      publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
    }));
}

async function getVideoDetails(videoId: string) {
  if (!youtube) return null;

  try {
    const response = await youtube.videos.list({
      part: ['contentDetails', 'statistics', 'snippet'],
      id: [videoId],
    });

    const video = response.data.items?.[0];
    if (!video) return null;

    return {
      title: video.snippet?.title || 'Unknown',
      description: video.snippet?.description || '',
      thumbnailUrl: video.snippet?.thumbnails?.high?.url || 
                    video.snippet?.thumbnails?.default?.url || '',
      publishedAt: new Date(video.snippet?.publishedAt || new Date()),
      duration: parseDuration(video.contentDetails?.duration || ''),
      viewCount: parseInt(video.statistics?.viewCount || '0'),
      likeCount: parseInt(video.statistics?.likeCount || '0'),
    };
  } catch (error) {
    console.error(`   Failed to get details for video ${videoId}:`, error);
    return null;
  }
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

async function upsertVideo(
  bandId: string,
  searchResult: { id: string; title: string },
  details: NonNullable<Awaited<ReturnType<typeof getVideoDetails>>>,
): Promise<'added' | 'updated'> {
  const existing = await prisma.video.findUnique({
    where: { youtubeId: searchResult.id },
  });

  if (existing) {
    await prisma.video.update({
      where: { id: existing.id },
      data: {
        viewCount: details.viewCount,
        likeCount: details.likeCount,
        title: details.title,
        description: details.description,
        thumbnailUrl: details.thumbnailUrl,
      },
    });
    return 'updated';
  }

  await prisma.video.create({
    data: {
      youtubeId: searchResult.id,
      title: details.title,
      description: details.description,
      thumbnailUrl: details.thumbnailUrl,
      publishedAt: details.publishedAt,
      duration: details.duration,
      viewCount: details.viewCount,
      likeCount: details.likeCount,
      bandId,
    },
  });
  return 'added';
}

async function updateBandMetadata(bandId: string) {
  const now = new Date();

  const [earliestVideo, latestVideo, videoCount] = await Promise.all([
    prisma.video.findFirst({
      where: { bandId },
      orderBy: { publishedAt: 'asc' },
      select: { publishedAt: true },
    }),
    prisma.video.findFirst({
      where: { bandId },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    }),
    prisma.video.count({ where: { bandId } }),
  ]);

  const band = await prisma.band.findUnique({ where: { id: bandId } });

  await prisma.band.update({
    where: { id: bandId },
    data: {
      lastSyncAt: now,
      syncStatus: SyncStatus.COMPLETED,
      firstSyncedAt: band?.firstSyncedAt || now,
      lastFullSync: now,
      earliestVideoDate: earliestVideo?.publishedAt,
      latestVideoDate: latestVideo?.publishedAt,
      totalVideoCount: videoCount,
    },
  });
}

async function confirmStart(): Promise<boolean> {
  // In non-interactive mode, default to yes
  if (!process.stdin.isTTY) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Continue with backfill? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
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
