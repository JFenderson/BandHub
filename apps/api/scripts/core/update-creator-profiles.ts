/**
 * Update Creator Profiles Script
 *
 * Fetches profile pictures, subscriber counts, and other channel info
 * from YouTube API for all content creators.
 *
 * Usage: npx tsx apps/api/scripts/core/update-creator-profiles.ts [options]
 *
 * Options:
 *   --dry-run       Preview without making changes
 *   --limit <n>     Limit number of creators to process
 *   --creator <id>  Update only a specific creator by ID
 */
import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import { google, youtube_v3 } from 'googleapis';

dotenv.config();
const prisma = new PrismaService();

// Configuration
const config = {
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  RATE_LIMIT_DELAY_MS: 500,
};

let youtube: youtube_v3.Youtube | null = null;
let quotaUsed = 0;

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
const specificCreatorId = getArgString('--creator');

async function main() {
  console.log('🖼️  Update Creator Profiles Script');
  console.log('===================================\n');

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

  // Get creators to update
  const whereClause: any = {
    youtubeChannelId: { not: '' },
  };
  if (specificCreatorId) {
    whereClause.id = specificCreatorId;
  }

  const creators = await prisma.contentCreator.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      youtubeChannelId: true,
      logoUrl: true,
      thumbnailUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log(`📊 Found ${creators.length} content creators\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches of 50 (YouTube API limit)
  const batchSize = 50;
  for (let i = 0; i < Math.min(creators.length, processLimit); i += batchSize) {
    const batch = creators.slice(i, Math.min(i + batchSize, processLimit));
    const channelIds = batch.map((c) => c.youtubeChannelId);

    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} creators)...`);

    try {
      // Fetch channel details from YouTube API
      const response = await youtube.channels.list({
        part: ['snippet', 'statistics', 'brandingSettings'],
        id: channelIds,
      });
      quotaUsed += 1;

      const channelData = new Map<string, youtube_v3.Schema$Channel>();
      for (const channel of response.data.items || []) {
        if (channel.id) {
          channelData.set(channel.id, channel);
        }
      }

      // Update each creator
      for (const creator of batch) {
        const channel = channelData.get(creator.youtubeChannelId);

        if (!channel) {
          console.log(`   ⚠️  No data found for ${creator.name}`);
          skipped++;
          continue;
        }

        const snippet = channel.snippet;
        const statistics = channel.statistics;

        // Get profile picture (highest quality available)
        const thumbnails = snippet?.thumbnails;
        const profilePicture =
          thumbnails?.high?.url ||
          thumbnails?.medium?.url ||
          thumbnails?.default?.url ||
          null;

        // Get banner image if available
        const bannerUrl = channel.brandingSettings?.image?.bannerExternalUrl || null;

        const updateData: any = {};

        // Only update if we have new data
        if (profilePicture && profilePicture !== creator.logoUrl) {
          updateData.logoUrl = profilePicture;
          updateData.thumbnailUrl = profilePicture;
        }

        if (statistics?.subscriberCount) {
          updateData.subscriberCount = parseInt(statistics.subscriberCount, 10);
        }

        if (statistics?.videoCount) {
          updateData.totalVideoCount = parseInt(statistics.videoCount, 10);
        }

        if (Object.keys(updateData).length === 0) {
          console.log(`   ⏭️  ${creator.name} - No updates needed`);
          skipped++;
          continue;
        }

        if (!dryRun) {
          await prisma.contentCreator.update({
            where: { id: creator.id },
            data: updateData,
          });
        }

        console.log(`   ✅ ${creator.name}`);
        if (updateData.logoUrl) {
          console.log(`      📷 Profile: ${updateData.logoUrl.substring(0, 50)}...`);
        }
        if (updateData.subscriberCount) {
          console.log(`      👥 Subscribers: ${updateData.subscriberCount.toLocaleString()}`);
        }
        if (updateData.totalVideoCount) {
          console.log(`      🎬 Videos: ${updateData.totalVideoCount.toLocaleString()}`);
        }

        updated++;
      }
    } catch (error) {
      console.error(`   ❌ Error processing batch: ${error}`);
      errors++;
    }

    // Rate limiting between batches
    if (i + batchSize < creators.length) {
      await delay(config.RATE_LIMIT_DELAY_MS);
    }
  }

  // Summary
  console.log('\n===================================');
  console.log('📊 UPDATE SUMMARY');
  console.log('===================================');
  console.log(`   Creators Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Quota Used: ${quotaUsed}`);

  if (dryRun) {
    console.log('\n📋 DRY RUN - No changes were made');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
