// fix-bands-bandtype.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Fixing band types...');
  
  const result = await prisma.$executeRaw`
    UPDATE bands 
    SET band_type = 'HBCU' 
    WHERE band_type = 'SCHOOL'
  `;
  
  console.log(`✅ Updated ${result} bands from SCHOOL → HBCU`);
  
  // Show current counts
  const counts = await prisma.$queryRaw`
    SELECT band_type, COUNT(*) as count 
    FROM bands 
    GROUP BY band_type
  `;
  
  console.log('\n📊 Current band types:');
  console.table(counts);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());