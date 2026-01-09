#!/usr/bin/env tsx
/**
 * 🔄 HBCU Band Hub - Incremental Video Sync
 * 
 * Syncs videos from YouTube and adds them to your existing database.
 * Does NOT reset or delete any existing data.
 * 
 * Usage:
 *   npx tsx apps/api/scripts/sync-videos.ts [options]
 * 
 * Options:
 *   --quick           Fast sync with ~100-200 new videos (5-10 min)
 *   --full            Full sync from all band channels (30-60 min, high quota)
 *   --search          Search-based sync for all bands (15-20 min, medium quota)
 *   --limit <n>       Sync only N bands (e.g., --limit 10)
 *   --band-id <id>    Sync only a specific band by ID
 *   --creator-id <id> Sync only a specific creator by ID
 *   --dry-run         Preview what would be synced without making changes
 * 
 * Examples:
 *   npx tsx apps/api/scripts/sync-videos.ts --quick
 *   npx tsx apps/api/scripts/sync-videos.ts --full --limit 5
 *   npx tsx apps/api/scripts/sync-videos.ts --band-id cmjykgacj000py35h3quon6x8
 *   npx tsx apps/api/scripts/sync-videos.ts --dry-run --search
 */

import { PrismaService } from '@bandhub/database';
import { execSync } from 'child_process';
import * as path from 'path';

const prisma = new PrismaService();

// Parse command line arguments
const args = process.argv.slice(2);
const isQuick = args.includes('--quick');
const isFull = args.includes('--full');
const isSearch = args.includes('--search');
const dryRun = args.includes('--dry-run');

const limitIndex = args.indexOf('--limit');
const bandLimit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : undefined;

const bandIdIndex = args.indexOf('--band-id');
const specificBandId = bandIdIndex !== -1 ? args[bandIdIndex + 1] : undefined;

const creatorIdIndex = args.indexOf('--creator-id');
const specificCreatorId = creatorIdIndex !== -1 ? args[creatorIdIndex + 1] : undefined;

// Determine mode
let mode: 'quick' | 'full' | 'search';
if (isQuick) mode = 'quick';
else if (isFull) mode = 'full';
else if (isSearch) mode = 'search';
else mode = 'search'; // Default to search mode

const config = {
  mode,
  dryRun,
  bandLimit,
  specificBandId,
  specificCreatorId,
};

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔄 HBCU Band Hub - Incremental Video Sync');
  console.log('═══════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  console.log('Configuration:');
  console.log(`  Mode: ${config.mode}`);
  console.log(`  Band Limit: ${config.bandLimit || 'None'}`);
  console.log(`  Specific Band ID: ${config.specificBandId || 'None'}`);
  console.log(`  Specific Creator ID: ${config.specificCreatorId || 'None'}`);
  console.log(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}\n`);

  const startTime = Date.now();

  try {
    // Step 1: Show current stats
    await showCurrentStats();

    // Step 2: Sync videos
    await syncVideos();

    // Step 3: Match and promote
    await matchAndPromote();

    // Step 4: Show final stats
    await showFinalStats();

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Video Sync Complete!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`⏱️  Total time: ${duration} minutes\n`);

  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check that .env has YOUTUBE_API_KEY');
    console.error('   2. Verify you have quota remaining');
    console.error('   3. Check script files exist in apps/api/scripts/');
    console.error('   4. Review the error message above');
    process.exit(1);
  }
}

async function showCurrentStats() {
  console.log('─────────────────────────────────────────────────────');
  console.log('📊 Current Database State');
  console.log('─────────────────────────────────────────────────────\n');

  const stats = {
    bands: await prisma.band.count(),
    categories: await prisma.category.count(),
    creators: await prisma.contentCreator.count(),
    youtubeVideos: await prisma.youTubeVideo.count(),
    videos: await prisma.video.count(),
  };

  console.log(`   Bands: ${stats.bands}`);
  console.log(`   Categories: ${stats.categories}`);
  console.log(`   Content Creators: ${stats.creators}`);
  console.log(`   YouTube Videos (raw): ${stats.youtubeVideos}`);
  console.log(`   Videos (promoted): ${stats.videos}\n`);

  if (stats.videos === 0) {
    console.log('💡 You have no videos yet. This will be your first sync!\n');
  } else {
    console.log(`✅ You have ${stats.videos} existing videos. Adding more...\n`);
  }
}

async function syncVideos() {
  console.log('─────────────────────────────────────────────────────');
  console.log('🎥 Syncing Videos from YouTube');
  console.log('─────────────────────────────────────────────────────\n');

  if (dryRun) {
    console.log(`📋 Would sync videos in ${config.mode} mode`);
    if (config.bandLimit) {
      console.log(`📋 Would limit to ${config.bandLimit} bands`);
    }
    if (config.specificBandId) {
      console.log(`📋 Would sync only band: ${config.specificBandId}`);
    }
    if (config.specificCreatorId) {
      console.log(`📋 Would sync only creator: ${config.specificCreatorId}`);
    }
    console.log('\n');
    return;
  }

  const scriptPath = path.resolve(process.cwd(), 'apps/api/scripts');

  try {
    if (config.specificBandId) {
      // Sync specific band
      console.log(`🎯 Syncing specific band: ${config.specificBandId}\n`);
      execSync(`npx tsx ./backfill-band-videos.ts --band-id ${config.specificBandId}`, {
        cwd: scriptPath,
        stdio: 'inherit',
      });

    } else if (config.specificCreatorId) {
      // Sync specific creator
      console.log(`🎯 Syncing specific creator: ${config.specificCreatorId}\n`);
      execSync(`npx tsx ./backfill-creator-videos.ts --creator-id ${config.specificCreatorId}`, {
        cwd: scriptPath,
        stdio: 'inherit',
      });

    } else if (config.mode === 'quick') {
      // Quick mode: Use simple YouTube pull
      console.log('🏃 Quick mode: Running simple YouTube pull');
      console.log('Expected: ~100-200 new videos in 5-10 minutes\n');
      
      execSync('npx tsx ./simple-youtube-pull.ts', {
        cwd: scriptPath,
        stdio: 'inherit',
      });

    } else if (config.mode === 'full') {
      // Full mode: Backfill all bands
      console.log('🐢 Full mode: Running complete band backfill');
      console.log('Expected: Many new videos in 30-60 minutes\n');
      
      const limitArg = config.bandLimit ? `--limit ${config.bandLimit}` : '';
      execSync(`npx tsx ./backfill-band-videos.ts ${limitArg}`, {
        cwd: scriptPath,
        stdio: 'inherit',
      });

      // Also backfill creators if no specific target
      if (!config.bandLimit) {
        console.log('\n📺 Syncing content creator videos...\n');
        execSync('npx tsx ./backfill-creator-videos.ts', {
          cwd: scriptPath,
          stdio: 'inherit',
        });
      }

    } else {
      // Search mode: Sync all bands via search (default)
      console.log('⚡ Search mode: Syncing via YouTube search');
      console.log('Expected: ~300-500 new videos in 15-20 minutes\n');
      
      execSync('npx tsx ./sync-all-bands.ts', {
        cwd: scriptPath,
        stdio: 'inherit',
      });
    }

    console.log('\n✅ Video sync from YouTube complete\n');

  } catch (error) {
    console.error('\n⚠️  Video sync encountered errors but continuing...\n');
    console.error(error);
  }
}

async function matchAndPromote() {
  console.log('─────────────────────────────────────────────────────');
  console.log('🔗 Matching & Promoting Videos');
  console.log('─────────────────────────────────────────────────────\n');

  if (dryRun) {
    console.log('📋 Would match videos to bands');
    console.log('📋 Would promote videos to main table\n');
    return;
  }

  const scriptPath = path.resolve(process.cwd(), 'apps/api/scripts');

  try {
    // Match videos to bands
    console.log('🔗 Matching videos to bands...\n');
    execSync('npx tsx ./match-videos-to-bands.ts', {
      cwd: scriptPath,
      stdio: 'inherit',
    });

    // Promote to main table
    console.log('\n📤 Promoting videos to main table...\n');
    execSync('npx tsx ./promote-videos.ts', {
      cwd: scriptPath,
      stdio: 'inherit',
    });

    console.log('\n✅ Match and promote complete\n');

  } catch (error) {
    console.error('\n⚠️  Match/promote encountered errors but continuing...\n');
    console.error(error);
  }
}

async function showFinalStats() {
  console.log('─────────────────────────────────────────────────────');
  console.log('📊 Final Database Statistics');
  console.log('─────────────────────────────────────────────────────\n');

  const stats = {
    bands: await prisma.band.count(),
    categories: await prisma.category.count(),
    creators: await prisma.contentCreator.count(),
    youtubeVideos: await prisma.youTubeVideo.count(),
    videos: await prisma.video.count(),
  };

  console.log(`   Bands: ${stats.bands}`);
  console.log(`   Categories: ${stats.categories}`);
  console.log(`   Content Creators: ${stats.creators}`);
  console.log(`   YouTube Videos (raw): ${stats.youtubeVideos}`);
  console.log(`   Videos (promoted): ${stats.videos}`);

  // Show top bands by video count
  console.log('\n🏆 Top 10 Bands by Video Count:');
  const topBands = await prisma.band.findMany({
    include: {
      _count: {
        select: { videos: true }
      }
    },
    orderBy: {
      videos: {
        _count: 'desc'
      }
    },
    take: 10
  });

  topBands.forEach((band, index) => {
    console.log(`   ${index + 1}. ${band.name}: ${band._count.videos} videos`);
  });

  // Show bands with no videos
  const bandsWithoutVideos = await prisma.band.count({
    where: {
      videos: {
        none: {}
      }
    }
  });

  if (bandsWithoutVideos > 0) {
    console.log(`\n⚠️  ${bandsWithoutVideos} bands still have no videos`);
    console.log('   Run this script again to continue syncing');
  } else {
    console.log('\n✅ All bands have videos!');
  }

  console.log('\n');
}

// Run the script
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });