import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSlugs() {
  const schools = [
    'Tuskegee University',
    'Stillman College', 
    'University of Arkansas at Pine Bluff',
    'Howard University',
    'Clark Atlanta University',
    'Bowie State University',
    'Alcorn State University',
    'Mississippi Valley State University',
    'Fayetteville State University',
    'Central State University',
    'South Carolina State University',
    'Hampton University',
    'Virginia Union University'
  ];

  console.log('Checking database for these schools...\n');
  
  for (const school of schools) {
    const band = await prisma.band.findFirst({
      where: { schoolName: school },
      select: { slug: true, name: true, schoolName: true }
    });
    
    if (band) {
      console.log(`Found: ${school}`);
      console.log(`  DB Slug: ${band.slug}`);
      console.log(`  Name: ${band.name}\n`);
    } else {
      console.log(`NOT FOUND: ${school}\n`);
    }
  }
  
  await prisma.$disconnect();
}

checkSlugs();
