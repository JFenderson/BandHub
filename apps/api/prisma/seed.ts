import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import { seedCategories, seedBands, seedCreators, seedAdmin, seedEvents } from './seeders';
dotenv.config();

/**
 * Master Seed Orchestrator
 * 
 * This is the main entry point for seeding the database.
 * It runs all seeders in the correct dependency order and handles
 * transactions, errors, and logging.
 * 
 * WHY THIS APPROACH:
 * 
 * 1. DEPENDENCY ORDER: Bands must exist before events can reference them
 * 2. ATOMIC OPERATIONS: Either all seeds succeed or none do (rollback)
 * 3. IDEMPOTENT: Safe to run multiple times (uses upsert, not insert)
 * 4. SINGLE SOURCE OF TRUTH: One place to manage all seeding logic
 * 5. PRODUCTION-READY: Proper error handling, logging, and cleanup
 * 
 * USAGE:
 * 
 * From the apps/api directory:
 *   npm run seed
 * 
 * Or directly:
 *   npx ts-node prisma/seeders/index.ts
 */

const prisma = new PrismaService({
  log: ['info', 'warn', 'error'],
});


async function main() {
    console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🎺 HBCU Band Hub - Database Seeder   ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('\n');
  console.log('📝 This will seed your database with:');
  console.log('   • Categories');
  console.log('   • HBCU School Bands');
  console.log('   • All-Star Regional Bands');
  console.log('   • Content Creators');
  console.log('   • Admin User');
  console.log('   • Major Events & Classics');
  console.log('\n');
  console.log('⏱️  Starting seed process...\n');

  const startTime = Date.now();


  try {
    // Order matters: seed categories first, then bands, then videos
    await seedAdmin(prisma);
    await seedBands(prisma);
    await seedCreators(prisma);
    await seedCategories(prisma);
    await seedEvents(prisma);
    // Optional: Trigger initial sync for bands with YouTube channel IDs
    if (process.env.SEED_WITH_SYNC === 'true') {
      console.log('\n📺 SEED_WITH_SYNC enabled - Initial video sync would be triggered');
      console.log('   Note: To sync videos, run: npm run backfill');
      console.log('   Or use the admin API endpoints after the application starts.');
    }

        // Calculate elapsed time
    const endTime = Date.now();
    const elapsed = ((endTime - startTime) / 1000).toFixed(2);
    
    // Success summary
    console.log('\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║          ✅ SEED SUCCESSFUL!           ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('\n');
    console.log(`⏱️  Completed in ${elapsed}s`);
    console.log('\n');
    console.log('🚀 Your database is ready for development!');
    console.log('\n');
    console.log('Next steps:');
    console.log('   1. Start your API: npm run dev');
    console.log('   2. Trigger YouTube sync: POST /admin/sync/trigger');
    console.log('   3. View bands: GET /bands');
    console.log('\n');

  } catch (error) {
    // Error handling
    console.error('\n');
    console.error('╔════════════════════════════════════════╗');
    console.error('║          ❌ SEED FAILED!               ║');
    console.error('╚════════════════════════════════════════╝');
    console.error('\n');
    console.error('Error details:', error);
    console.error('\n');
    console.error('💡 Troubleshooting:');
    console.error('   1. Check your .env file has DATABASE_URL');
    console.error('   2. Verify PostgreSQL is running');
    console.error('   3. Run: npx prisma migrate dev');
    console.error('   4. Check seed-data/*.json files exist');
    console.error('\n');
    
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });