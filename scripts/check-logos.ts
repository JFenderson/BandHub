import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLogos() {
  const bands = await prisma.band.findMany({
    select: { slug: true, name: true, logoUrl: true },
    take: 10,
  });

  console.log('Sample bands with logoUrl:');
  bands.forEach(b => {
    console.log(`  ${b.slug}: ${b.logoUrl || '(none)'}`);
  });

  const withLogos = await prisma.band.count({ where: { logoUrl: { not: null } } });
  const total = await prisma.band.count();

  console.log(`\nBands with logos: ${withLogos}/${total}`);
}

checkLogos()
  .finally(() => prisma.$disconnect());
