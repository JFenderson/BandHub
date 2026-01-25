/**
 * Quick check of creator image URLs in database
 */
import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';

dotenv.config();
const prisma = new PrismaService();

async function main() {
  const creators = await prisma.contentCreator.findMany({
    select: {
      name: true,
      logoUrl: true,
      thumbnailUrl: true,
      subscriberCount: true,
    },
    take: 10,
  });

  console.log('Sample of creator data in database:\n');

  for (const creator of creators) {
    console.log(`${creator.name}:`);
    console.log(`  logoUrl: ${creator.logoUrl || '(empty)'}`);
    console.log(`  thumbnailUrl: ${creator.thumbnailUrl || '(empty)'}`);
    console.log(`  subscribers: ${creator.subscriberCount}`);
    console.log('');
  }

  // Count how many have images
  const withImages = await prisma.contentCreator.count({
    where: {
      OR: [
        { logoUrl: { not: null } },
        { thumbnailUrl: { not: null } },
      ],
    },
  });

  const total = await prisma.contentCreator.count();

  console.log(`\nSummary: ${withImages}/${total} creators have profile images`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
