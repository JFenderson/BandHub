/**
 * Content Creator Videos Backfill Script
 * 
 * Fetches ALL videos from content creator YouTube channels and stores them in the YouTubeVideo table.
 * Uses the efficient playlist method for quota management.
 * 
 * Usage: npx tsx apps/api/scripts/backfill-creator-videos.ts [--dry-run] [--creator-id <id>]
 * 
 * Options:
 *   --dry-run      Preview what would be synced without making changes
 *   --creator-id   Sync only a specific creator by ID
 *   --limit        Maximum number of creators to process (default: all)
 */

import { PrismaClient, SyncStatus } from '@prisma/client';
import { google, youtube_v3 } from 'googleapis';

// Configuration
const config = {
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  DAILY_QUOTA_LIMIT: parseInt(process.env.YOUTUBE_QUOTA_LIMIT || '10000'),
  BATCH_SIZE: parseInt(process.env.YOUTUBE_SYNC_BATCH_SIZE || '10'),
  RATE_LIMIT_DELAY_MS: 1000,
  YOUTUBE_LAUNCH_DATE: new Date('2005-04-23'),
};

const prisma = new PrismaClient();
let youtube: youtube_v3.Youtube | null = null;
let quotaUsed = 0;

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const creatorIdIndex = args.indexOf('--creator-id');
const specificCreatorId = creatorIdIndex !== -1 ? args[creatorIdIndex + 1] : null;
const limitIndex = args.indexOf('--limit');
const processLimit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : Infinity;

async function main() {
  console.log('🚀 Starting Content Creator Videos Backfill');
  console.log('============================================\n');

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

  // Get content creators with YouTube channel IDs
  const creators = await getCreatorsToSync();

  if (creators.length === 0) {
    console.log('✅ No content creators with YouTube channels to sync');
    return;
  }

  console.log(`📊 Found ${creators.length} content creators\n`);

  let processed = 0;
  let totalVideosAdded = 0;
  let totalVideosUpdated = 0;
  const errors: string[] = [];

  for (const creator of creators) {
    if (processed >= processLimit) {
      console.log(`\n⏹️  Reached processing limit of ${processLimit} creators`);
      break;
    }

    // Check quota
    if (quotaUsed >= config.DAILY_QUOTA_LIMIT * 0.9) {
      console.log(`\n⚠️  Approaching daily quota limit (${quotaUsed}/${config.DAILY_QUOTA_LIMIT})`);
      console.log('📅 Run this script again tomorrow to continue');
      break;
    }

    console.log(`\n[${processed + 1}/${Math.min(creators.length, processLimit)}] Processing: ${creator.name}`);
    console.log(`   YouTube Channel: ${creator.youtubeChannelId}`);
    console.log(`   Current Quota Used: ${quotaUsed}/${config.DAILY_QUOTA_LIMIT}`);

    try {
      const result = await syncCreatorVideos(creator);
      totalVideosAdded += result.added;
      totalVideosUpdated += result.updated;
      console.log(`   ✅ Added: ${result.added}, Updated: ${result.updated}, Quota: ${result.quotaUsed}`);
    } catch (error) {
      const errorMsg = `Failed to sync ${creator.name}: ${error}`;
      errors.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
    }

    processed++;

    // Rate limiting between creators
    if (processed < creators.length) {
      await delay(config.RATE_LIMIT_DELAY_MS * 2);
    }
  }

  // Summary
  console.log('\n============================================');
  console.log('📊 BACKFILL SUMMARY');
  console.log('============================================');
  console.log(`   Creators Processed: ${processed}`);
  console.log(`   Videos Added: ${totalVideosAdded}`);
  console.log(`   Videos Updated: ${totalVideosUpdated}`);
  console.log(`   Total Quota Used: ${quotaUsed}`);
  console.log(`   Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach((e) => console.log(`   - ${e}`));
  }
}

async function getCreatorsToSync() {
  const where: any = {
    NOT: {
      youtubeChannelId: '',
    },
  };

  if (specificCreatorId) {
    where.id = specificCreatorId;
  }

  return prisma.contentCreator.findMany({
    where,
    select: {
      id: true,
      name: true,
      youtubeChannelId: true,
      lastSyncedAt: true,
      lastFullSync: true,
    },
    orderBy: { name: 'asc' },
  });
}

async function syncCreatorVideos(creator: {
  id: string;
  name: string;
  youtubeChannelId: string;
  lastSyncedAt: Date | null;
}) {
  if (!youtube) {
    return { added: 0, updated: 0, quotaUsed: 0 };
  }

  let added = 0;
  let updated = 0;
  let creatorQuotaUsed = 0;

  try {
    // Get uploads playlist ID
    const channelResponse = await youtube.channels.list({
      part: ['contentDetails'],
      id: [creator.youtubeChannelId],
    });
    creatorQuotaUsed += 1;
    quotaUsed += 1;

    const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.log(`   ⚠️  No uploads playlist found for channel ${creator.youtubeChannelId}`);
      return { added, updated, quotaUsed: creatorQuotaUsed };
    }

    // Fetch all videos from uploads playlist with pagination
    let pageToken: string | undefined;
    const allVideoItems: any[] = [];

    do {
      const playlistResponse = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken,
      });
      creatorQuotaUsed += 1;
      quotaUsed += 1;

      allVideoItems.push(...(playlistResponse.data.items || []));
      pageToken = playlistResponse.data.nextPageToken || undefined;

      console.log(`   📥 Fetched ${allVideoItems.length} video items...`);
    } while (pageToken);

    console.log(`   📹 Total videos found: ${allVideoItems.length}`);

    if (dryRun) {
      console.log(`   📋 Would process ${allVideoItems.length} videos (dry run)`);
      return { added: allVideoItems.length, updated: 0, quotaUsed: creatorQuotaUsed };
    }

    // Process videos in batches for detail enrichment
    const batchSize = 50;
    for (let i = 0; i < allVideoItems.length; i += batchSize) {
      const batch = allVideoItems.slice(i, i + batchSize);
      const videoIds = batch
        .map((item) => item.snippet?.resourceId?.videoId)
        .filter(Boolean);

      // Get video details (duration, view count, etc.)
      let videoDetails: Map<string, { duration: number; viewCount: number; likeCount: number }> = new Map();
      
      if (videoIds.length > 0) {
        const detailsResponse = await youtube.videos.list({
          part: ['contentDetails', 'statistics'],
          id: videoIds,
        });
        creatorQuotaUsed += 1;
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

      // Upsert each video
      for (const item of batch) {
        const videoId = item.snippet?.resourceId?.videoId;
        if (!videoId) continue;

        const details = videoDetails.get(videoId) || { duration: 0, viewCount: 0, likeCount: 0 };
        const publishedAt = new Date(item.snippet?.publishedAt || item.contentDetails?.videoPublishedAt || new Date());

        try {
          const existing = await prisma.youTubeVideo.findUnique({
            where: { youtubeId: videoId },
          });

          if (existing) {
            await prisma.youTubeVideo.update({
              where: { id: existing.id },
              data: {
                title: item.snippet?.title || 'Unknown',
                description: item.snippet?.description || '',
                thumbnailUrl: item.snippet?.thumbnails?.high?.url || 
                             item.snippet?.thumbnails?.default?.url || '',
                viewCount: details.viewCount,
                likeCount: details.likeCount,
                lastSyncedAt: new Date(),
                syncStatus: SyncStatus.COMPLETED,
                // If video was already linked to a creator, keep it; otherwise, link to this creator
                creatorId: existing.creatorId || creator.id,
              },
            });
            updated++;
          } else {
            await prisma.youTubeVideo.create({
              data: {
                youtubeId: videoId,
                title: item.snippet?.title || 'Unknown',
                description: item.snippet?.description || '',
                thumbnailUrl: item.snippet?.thumbnails?.high?.url || 
                             item.snippet?.thumbnails?.default?.url || '',
                url: `https://www.youtube.com/watch?v=${videoId}`,
                duration: details.duration,
                publishedAt,
                viewCount: details.viewCount,
                likeCount: details.likeCount,
                channelId: item.snippet?.channelId || creator.youtubeChannelId,
                channelTitle: item.snippet?.channelTitle || creator.name,
                creatorId: creator.id,
                syncStatus: SyncStatus.COMPLETED,
                lastSyncedAt: new Date(),
              },
            });
            added++;
          }
        } catch (error) {
          console.log(`   ⚠️  Error processing video ${videoId}: ${error}`);
        }
      }

      // Rate limiting between batches
      await delay(config.RATE_LIMIT_DELAY_MS);
    }

    // Update creator sync tracking
    await prisma.contentCreator.update({
      where: { id: creator.id },
      data: {
        lastSyncedAt: new Date(),
        lastFullSync: new Date(),
        videosInOurDb: await prisma.youTubeVideo.count({
          where: { creatorId: creator.id },
        }),
      },
    });

  } catch (error) {
    console.log(`   ❌ Error syncing creator: ${error}`);
    throw error;
  }

  return { added, updated, quotaUsed: creatorQuotaUsed };
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
