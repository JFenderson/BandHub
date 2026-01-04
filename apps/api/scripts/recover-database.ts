#!/usr/bin/env tsx
/**
 * 🚀 HBCU Band Hub - Complete Database Recovery Script
 * 
 * This script handles the entire database recovery process in one command.
 * 
 * Usage:
 *   npx tsx apps/api/scripts/recover-database.ts [options]
 * 
 * Options:
 *   --quick           Fast recovery with ~100-200 videos (5-10 min)
 *   --full            Full recovery with all band videos (30-60 min, high quota)
 *   --limit <n>       Sync only N bands (e.g., --limit 10)
 *   --skip-videos     Only reset schema and seed data, no video sync
 *   --dry-run         Preview what would happen without making changes
 * 
 * Examples:
 *   npx tsx apps/api/scripts/recover-database.ts --quick
 *   npx tsx apps/api/scripts/recover-database.ts --full --limit 10
 *   npx tsx apps/api/scripts/recover-database.ts --skip-videos
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const isQuick = args.includes('--quick');
const isFull = args.includes('--full');
const skipVideos = args.includes('--skip-videos');
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const bandLimit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : undefined;

// Configuration
const config = {
  mode: isQuick ? 'quick' : isFull ? 'full' : 'moderate',
  skipVideos,
  dryRun,
  bandLimit,
};

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 HBCU Band Hub - Database Recovery');
  console.log('═══════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  console.log('Configuration:');
  console.log(`  Mode: ${config.mode}`);
  console.log(`  Skip Videos: ${config.skipVideos ? 'Yes' : 'No'}`);
  console.log(`  Band Limit: ${config.bandLimit || 'None (all bands)'}`);
  console.log(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}\n`);

  const startTime = Date.now();

  try {
    // Step 1: Verify environment
    await step1_verifyEnvironment();

    // Step 2: Reset database schema
    await step2_resetSchema();

    // Step 3: Run seeders
    await step3_runSeeders();

    // Step 4: Verify database state
    await step4_verifyDatabase();

    // Step 5: Sync videos (if not skipped)
    if (!config.skipVideos) {
      await step5_syncVideos();
    } else {
      console.log('\n⏭️  Skipping video sync (--skip-videos flag)\n');
    }

    // Step 6: Final verification
    await step6_finalVerification();

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Database Recovery Complete!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`⏱️  Total time: ${duration} minutes\n`);

    // Show next steps
    showNextSteps();

  } catch (error) {
    console.error('\n❌ Recovery failed:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check that PostgreSQL is running');
    console.error('   2. Verify .env file has YOUTUBE_API_KEY');
    console.error('   3. Check that Redis is running');
    console.error('   4. Review the error message above');
    process.exit(1);
  }
}

async function step1_verifyEnvironment() {
  console.log('─────────────────────────────────────────────────────');
  console.log('Step 1: Verifying Environment');
  console.log('─────────────────────────────────────────────────────\n');

  // Check .env file
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found. Create one in the project root.');
  }
  console.log('✅ .env file found');

  // Check required environment variables
  const requiredVars = ['DATABASE_URL', 'YOUTUBE_API_KEY'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  console.log('✅ Required environment variables set');

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
  } catch (error) {
    throw new Error('Cannot connect to database. Is PostgreSQL running?');
  }

  console.log('\n');
}

async function step2_resetSchema() {
  console.log('─────────────────────────────────────────────────────');
  console.log('Step 2: Resetting Database Schema');
  console.log('─────────────────────────────────────────────────────\n');

  if (dryRun) {
    console.log('📋 Would run: prisma migrate reset --force');
    console.log('📋 Would run: prisma generate\n');
    return;
  }

  console.log('⚠️  This will drop all existing data!');
  console.log('Running: prisma migrate reset --force\n');

  try {
    const dbPath = path.resolve(process.cwd(), 'packages/database');
    execSync('npx prisma migrate reset --force --skip-seed', {
      cwd: dbPath,
      stdio: 'inherit',
    });
    console.log('\n✅ Database schema reset complete');

    console.log('Running: prisma generate\n');
    execSync('npx prisma generate', {
      cwd: dbPath,
      stdio: 'inherit',
    });
    console.log('\n✅ Prisma client generated');
  } catch (error) {
    throw new Error('Failed to reset database schema');
  }

  console.log('\n');
}

async function step3_runSeeders() {
  console.log('─────────────────────────────────────────────────────');
  console.log('Step 3: Running Database Seeders');
  console.log('─────────────────────────────────────────────────────\n');

  if (dryRun) {
    console.log('📋 Would seed categories, bands, and creators\n');
    return;
  }

  try {
    const dbPath = path.resolve(process.cwd(), 'packages/database');
    console.log('Running: npx prisma db seed\n');
    
    execSync('npx prisma db seed', {
      cwd: dbPath,
      stdio: 'inherit',
    });
    
    console.log('\n✅ Seeders completed successfully');
  } catch (error) {
    throw new Error('Failed to run seeders');
  }

  console.log('\n');
}

async function step4_verifyDatabase() {
  console.log('─────────────────────────────────────────────────────');
  console.log('Step 4: Verifying Database State');
  console.log('─────────────────────────────────────────────────────\n');

  const bandCount = await prisma.band.count();
  const categoryCount = await prisma.category.count();
  const creatorCount = await prisma.contentCreator.count();

  console.log(`📊 Database Counts:`);
  console.log(`   Bands: ${bandCount}`);
  console.log(`   Categories: ${categoryCount}`);
  console.log(`   Content Creators: ${creatorCount}`);

  if (bandCount === 0) {
    throw new Error('No bands found! Seeder may have failed.');
  }

  if (categoryCount === 0) {
    throw new Error('No categories found! Seeder may have failed.');
  }

  console.log('\n✅ Database state verified\n');
}

async function step5_syncVideos() {
  console.log('─────────────────────────────────────────────────────');
  console.log('Step 5: Syncing Videos from YouTube');
  console.log('─────────────────────────────────────────────────────\n');

  if (dryRun) {
    console.log(`📋 Would sync videos in ${config.mode} mode`);
    if (config.bandLimit) {
      console.log(`📋 Would limit to ${config.bandLimit} bands`);
    }
    console.log('\n');
    return;
  }

  const scriptPath = path.resolve(process.cwd(), 'apps/api/scripts');

  try {
    if (config.mode === 'quick') {
      // Quick mode: Use simple YouTube pull
      console.log('🏃 Quick mode: Running simple YouTube pull');
      console.log('Expected: ~100-200 videos in 5-10 minutes\n');
      
      execSync('npx tsx simple-youtube-pull.ts', {
        cwd: scriptPath,
        stdio: 'inherit',
      });

    } else if (config.mode === 'full') {
      // Full mode: Backfill all bands
      console.log('🐢 Full mode: Running complete band backfill');
      console.log('Expected: 2,000-4,000 videos in 30-60 minutes\n');
      
      const limitArg = config.bandLimit ? `--limit ${config.bandLimit}` : '';
      execSync(`npx tsx backfill-band-videos.ts ${limitArg}`, {
        cwd: scriptPath,
        stdio: 'inherit',
      });

      // Also backfill creators
      console.log('\n📺 Syncing content creator videos...\n');
      execSync(`npx tsx backfill-creator-videos.ts ${limitArg}`, {
        cwd: scriptPath,
        stdio: 'inherit',
      });

    } else {
      // Moderate mode: Sync all bands via search
      console.log('⚡ Moderate mode: Syncing via YouTube search');
      console.log('Expected: 300-500 videos in 15-20 minutes\n');
      
      execSync('npx tsx sync-all-bands.ts', {
        cwd: scriptPath,
        stdio: 'inherit',
      });
    }

    // Run matching and promotion
    console.log('\n🔗 Matching videos to bands...\n');
    execSync('npx tsx match-videos-to-bands.ts', {
      cwd: scriptPath,
      stdio: 'inherit',
    });

    console.log('\n📤 Promoting videos to main table...\n');
    execSync('npx tsx promote-videos.ts', {
      cwd: scriptPath,
      stdio: 'inherit',
    });

    console.log('\n✅ Video sync complete\n');

  } catch (error) {
    console.error('\n⚠️  Video sync encountered errors but continuing...\n');
  }
}

async function step6_finalVerification() {
  console.log('─────────────────────────────────────────────────────');
  console.log('Step 6: Final Verification');
  console.log('─────────────────────────────────────────────────────\n');

  const stats = {
    bands: await prisma.band.count(),
    categories: await prisma.category.count(),
    creators: await prisma.contentCreator.count(),
    youtubeVideos: await prisma.youTubeVideo.count(),
    videos: await prisma.video.count(),
  };

  console.log('📊 Final Database Statistics:');
  console.log(`   Bands: ${stats.bands}`);
  console.log(`   Categories: ${stats.categories}`);
  console.log(`   Content Creators: ${stats.creators}`);
  console.log(`   YouTube Videos (raw): ${stats.youtubeVideos}`);
  console.log(`   Videos (promoted): ${stats.videos}`);

  // Show top bands by video count
  console.log('\n🏆 Top 5 Bands by Video Count:');
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
    take: 5
  });

  topBands.forEach((band, index) => {
    console.log(`   ${index + 1}. ${band.name}: ${band._count.videos} videos`);
  });

  console.log('\n');
}

function showNextSteps() {
  console.log('📝 Next Steps:\n');
  console.log('1. Start the backend:');
  console.log('   cd apps/api && npm run start:dev\n');
  console.log('2. Start the frontend:');
  console.log('   cd apps/web && npm run dev\n');
  console.log('3. Test the search:');
  console.log('   http://localhost:3000/search?q=southern\n');
  console.log('4. View a band profile:');
  console.log('   http://localhost:3000/bands/human-jukebox\n');
  
  if (config.mode !== 'full') {
    console.log('💡 To get more videos later:');
    console.log('   npx tsx apps/api/scripts/recover-database.ts --full\n');
  }

  console.log('📚 For more info, see: DATABASE_RECOVERY_RUNBOOK.md\n');
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