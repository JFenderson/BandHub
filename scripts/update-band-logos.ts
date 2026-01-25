/**
 * Script to update band logoUrl fields in the database
 *
 * This script maps each band's slug to the corresponding logo file in /band-logos/
 * Run with: npx tsx scripts/update-band-logos.ts
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// Mapping from band database slug → logo filename (without path)
// Logo files are stored in apps/web/public/band-logos/
const bandLogoMapping: Record<string, string> = {
  // Alabama
  'alabama-am-maroon-white': 'alabama-am.png',
  'mighty-marching-hornets': 'alabama-state.png',
  'purple-marching-machine': 'miles.png',
  'marching-crimson-pipers': 'tuskegee.png',
  'marching-tornadoes': 'talladega.png',
  'blue-pride': 'stillman.png',

  // Arkansas
  'm4': 'arkansas-pine-bluff.png',

  // Delaware
  'approaching-storm': 'delaware-state.png',

  // DC
  'showtime': 'howard.png',

  // Florida
  'marching-wildcats': 'bethune-cookman.png',
  'marching-100': 'florida-am.png',
  'roaring-lions-marching-band': 'florida-memorial.png',
  'edward-waters-marching-tigers': 'edward-waters.png',

  // Georgia
  'albany-state-marching-rams': 'albany-state.png',
  'mighty-marching-panthers': 'clark-atlanta.png',
  'blue-machine': 'fort-valley-state.png',
  'house-of-funk': 'morehouse.png',
  'powerhouse-of-the-south': 'savannah-state.png',

  // Kentucky
  'marching-thorobreds': 'kentucky-state.png',

  // Louisiana
  'world-famed': 'grambling-state.png',
  'human-jukebox': 'southern.png',

  // Maryland
  'symphony-of-soul': 'bowie-state.png',
  'magnificent-marching-machine': 'morgan-state.png',

  // Mississippi
  'sounds-of-dynomite': 'alcorn-state.png',
  'sonic-boom-of-the-south': 'jackson-state.png',
  'mean-green': 'mississippi-valley-state.png',
  'rust-marching-band': 'rust.png',
  'tougaloo-marching-band': 'tougaloo.png',

  // Missouri
  'lincoln-marching-band': 'lincoln.png',

  // North Carolina
  'sound-of-class': 'elizabeth-city-state.png',
  'bronco-express': 'fayetteville-state.png',
  'blue-and-gold-marching-machine': 'north-carolina-at.png',
  'sound-machine': 'north-carolina-central.png',
  'red-sea-of-sound': 'winston-salem-state.png',
  'golden-bulls-marching-band': 'johnson-c-smith.png',
  'livingstone-marching-band': 'livingstone.png',
  'shaw-marching-band': 'shaw.png',

  // Ohio
  'invincible-marching-marauders': 'central-state.png',

  // Oklahoma
  'marching-pride': 'langston.png',

  // South Carolina
  'marching-101': 'south-carolina-state.png',
  'allen-marching-band': 'allen.png',
  'marching-tiger-band-of-distinction': 'benedict.png',

  // Tennessee
  'aristocrat-of-bands': 'tennessee-state.png',
  'fisk-marching-band': 'fisk.png',
  'lane-marching-band': 'lane.png',

  // Texas
  'marching-storm': 'prairie-view-am.png',
  'ocean-of-soul': 'texas-southern.png',
  'texas-college-marching-band': 'texas-college.png',
  'wiley-marching-band': 'wiley.png',

  // Virginia
  'marching-force': 'hampton.png',
  'spartan-legion': 'norfolk-state.png',
  'trojan-explosion': 'virginia-state.png',
  'ambassador-of-sound': 'virginia-union.png',

  // West Virginia
  'bluefield-state-marching-band': 'bluefield-state.png',

  //All Star Bands
  'alabama-mass-band': 'alabama-mass.png',
  'dallas-legion-all-star-band': 'dallas-legion-all-stars.png',
  'georgia-all-star-mass-band': 'georgia-all-star.png',
  'greater-houston-all-star-band': 'greater-houston-all-star.png',
  'houston-united-mass-band': 'houston-united-mass.png',
  'memphis-mass-band': 'memphis-mass.png',
  'mississippi-all-star-alumni-band': 'mississippi-all-star.png',
  'nashville-all-star-band': 'nashville-mass.png',
  'new-orleans-all-star-band': 'new-orleans-all-star.png',
  'port-city-all-star-band': 'port-city-all-star.png',
  'north-carolina-mass-band': 'north-carolina-mass.png',
  '337-all-star-band': '337-all-star.png',
};

async function updateBandLogos() {
  console.log('🖼️  Updating band logo URLs...\n');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [slug, logoFilename] of Object.entries(bandLogoMapping)) {
    try {
      // Check if band exists
      const band = await prisma.band.findUnique({
        where: { slug },
        select: { id: true, name: true, logoUrl: true },
      });

      if (!band) {
        console.log(`⚠️  Band not found: ${slug}`);
        notFound++;
        continue;
      }

      // Construct the logo URL (relative path for static serving)
      const logoUrl = `/band-logos/${logoFilename}`;

      // Skip if already set to the same value
      if (band.logoUrl === logoUrl) {
        console.log(`⏭️  Already set: ${band.name}`);
        skipped++;
        continue;
      }

      // Update the band's logoUrl
      await prisma.band.update({
        where: { slug },
        data: { logoUrl },
      });

      console.log(`✅ Updated: ${band.name} → ${logoUrl}`);
      updated++;
    } catch (error) {
      console.error(`❌ Error updating ${slug}:`, error);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary:');
  console.log(`   Updated: ${updated}`);
  console.log(`   Already set: ${skipped}`);
  console.log(`   Not found: ${notFound}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Always clear Redis cache to ensure fresh data is served
  await clearBandCaches();
}

/**
 * Clear all band-related caches from Redis
 */
async function clearBandCaches() {
  console.log('🗑️  Clearing band caches from Redis...\n');

  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;

  console.log(`   Connecting to Redis at ${redisHost}:${redisPort}...`);

  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword || undefined,
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
  });

  try {
    // Test connection
    await redis.ping();
    console.log('   ✓ Connected to Redis\n');

    // Patterns to clear - covers all band-related cache keys
    const patterns = [
      'bands:*',
      'band:*',
      'popular:bands:*',
      'search:*',
    ];

    let totalDeleted = 0;

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`   Deleted ${keys.length} keys matching "${pattern}"`);
        totalDeleted += keys.length;
      } else {
        console.log(`   No keys found matching "${pattern}"`);
      }
    }

    if (totalDeleted > 0) {
      console.log(`\n✅ Cache cleared: ${totalDeleted} keys deleted`);
    } else {
      console.log('\n⚠️  No cache keys found. Cache may already be empty.');
      console.log('   If logos still don\'t appear, try restarting the API server.');
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error('⚠️  Could not connect to Redis (connection refused)');
      console.log('   Redis may not be running. Please restart the API server to clear caches.');
    } else {
      console.error('⚠️  Failed to clear Redis cache:', error.message || error);
    }
    console.log('\n📋 Manual cache clear options:');
    console.log('   1. Restart the API server');
    console.log('   2. Run: redis-cli FLUSHDB');
  } finally {
    await redis.quit();
  }
}

updateBandLogos()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
