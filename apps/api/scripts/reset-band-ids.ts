// apps/api/scripts/reset-band-ids.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Resetting all band_id values...');
  
  const result = await prisma.youTubeVideo.updateMany({
    where: { bandId: { not: null } },
    data: { bandId: null }
  });
  
  console.log(`✅ Reset ${result.count} video band_ids to null`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());