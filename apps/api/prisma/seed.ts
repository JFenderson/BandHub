import { PrismaClient } from '@prisma/client';
import { seedCategories, seedBands } from './seeders';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Order matters: seed categories first, then bands, then videos
    await seedCategories(prisma);
    await seedBands(prisma);
    
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