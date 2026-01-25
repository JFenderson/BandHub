/**
 * Link Creator Videos Script
 *
 * Links YouTubeVideos to their ContentCreator records based on channelId matching.
 * This ensures videos from known creator channels have the creatorId set.
 *
 * Usage: npx tsx apps/api/scripts/core/link-creator-videos.ts [options]
 *
 * Options:
 *   --dry-run       Preview without making changes
 *   --creator <id>  Only process a specific creator by ID
 *   --limit <n>     Limit number of videos to process (default: all)
 */
import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';

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
const specificCreatorId = getArgString('--creator');

interface LinkStats {
  totalCreators: number;
  totalVideosLinked: number;
  creatorResults: Map<string, { name: string; videosLinked: number }>;
}

async function main() {
  console.log('🔗 Link Creator Videos Script');
  console.log('==============================\n');

  if (dryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  // Get all content creators with their YouTube channel IDs
  const whereCreator: any = {
    youtubeChannelId: { not: '' },
  };
  if (specificCreatorId) {
    whereCreator.id = specificCreatorId;
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

  console.log(`📊 Found ${creators.length} content creators with YouTube channels\n`);

  // Build a map of channelId -> creatorId for fast lookup
  const channelToCreator = new Map<string, { id: string; name: string }>();
  for (const creator of creators) {
    channelToCreator.set(creator.youtubeChannelId, {
      id: creator.id,
      name: creator.name,
    });
  }

  const stats: LinkStats = {
    totalCreators: 0,
    totalVideosLinked: 0,
    creatorResults: new Map(),
  };

  // Find videos that match creator channels but don't have creatorId set
  console.log('🔍 Finding unlinked videos from creator channels...\n');

  const channelIds = Array.from(channelToCreator.keys());

  // Get count of unlinked videos
  const unlinkedCount = await prisma.youTubeVideo.count({
    where: {
      channelId: { in: channelIds },
      creatorId: null,
    },
  });

  console.log(`📹 Found ${unlinkedCount} unlinked videos from known creator channels\n`);

  if (unlinkedCount === 0) {
    console.log('✅ All videos from creator channels are already linked!');
    return;
  }

  // Process in batches
  const batchSize = 1000;
  let processed = 0;
  let totalLinked = 0;

  while (processed < Math.min(unlinkedCount, processLimit)) {
    const videos = await prisma.youTubeVideo.findMany({
      where: {
        channelId: { in: channelIds },
        creatorId: null,
      },
      select: {
        id: true,
        title: true,
        channelId: true,
        channelTitle: true,
      },
      take: batchSize,
    });

    if (videos.length === 0) break;

    console.log(`\n📦 Processing batch of ${videos.length} videos (${processed + 1}-${processed + videos.length})...`);

    for (const video of videos) {
      const creator = channelToCreator.get(video.channelId);
      if (!creator) continue;

      if (!dryRun) {
        await prisma.youTubeVideo.update({
          where: { id: video.id },
          data: { creatorId: creator.id },
        });
      }

      // Track stats
      const existing = stats.creatorResults.get(creator.id);
      if (existing) {
        existing.videosLinked++;
      } else {
        stats.creatorResults.set(creator.id, {
          name: creator.name,
          videosLinked: 1,
        });
      }

      totalLinked++;
      processed++;

      if (processed >= processLimit) break;
    }

    if (totalLinked % 500 === 0) {
      console.log(`   ✅ Linked ${totalLinked} videos so far...`);
    }
  }

  stats.totalVideosLinked = totalLinked;
  stats.totalCreators = stats.creatorResults.size;

  // Summary
  console.log('\n==============================');
  console.log('📊 LINK SUMMARY');
  console.log('==============================');
  console.log(`   Creators with videos linked: ${stats.totalCreators}`);
  console.log(`   Total videos linked: ${stats.totalVideosLinked}`);

  if (stats.creatorResults.size > 0) {
    console.log('\n🏆 Videos linked by creator:');
    Array.from(stats.creatorResults.entries())
      .sort((a, b) => b[1].videosLinked - a[1].videosLinked)
      .slice(0, 20)
      .forEach(([_, result], i) => {
        console.log(`   ${i + 1}. ${result.name}: ${result.videosLinked} videos`);
      });
  }

  // Update creator video counts
  if (!dryRun && stats.totalVideosLinked > 0) {
    console.log('\n📊 Updating creator video counts...');
    for (const [creatorId, _] of stats.creatorResults) {
      const count = await prisma.youTubeVideo.count({
        where: { creatorId },
      });
      await prisma.contentCreator.update({
        where: { id: creatorId },
        data: { videosInOurDb: count },
      });
    }
    console.log('   ✅ Creator video counts updated');
  }

  if (dryRun) {
    console.log('\n📋 DRY RUN - No changes were made');
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
