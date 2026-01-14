import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import { seedCategories, seedBands, seedCreators, seedAllStarBands } from './seeders';
dotenv.config();

const prisma = new PrismaService();


async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Order matters: seed categories first, then bands, then videos
    await seedCategories(prisma);
    await seedBands(prisma);
    await seedCreators(prisma);
    await seedAllStarBands(prisma);
    // Optional: Trigger initial sync for bands with YouTube channel IDs
    if (process.env.SEED_WITH_SYNC === 'true') {
      console.log('\n📺 SEED_WITH_SYNC enabled - Initial video sync would be triggered');
      console.log('   Note: To sync videos, run: npm run backfill');
      console.log('   Or use the admin API endpoints after the application starts.');
    }
    
    // Add more seeders here as needed:
    // await seedVideos(prisma);
    // await seedAdminUsers(prisma);

    console.log('\n✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
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