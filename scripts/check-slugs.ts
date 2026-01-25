import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSlugs() {
  const schools = [
    'Dallas Legion All-Star Band',
    'Alabama Mass Band',
    'Georgia All-Star Mass Band',
    'Greater Houston All-Star Band',
    'Houston United Mass Band',
    'Memphis Mass Band',
    'Mississippi All-Star Alumni Band',
    'Nashville Mass Band',
    'New Orleans All-Star Band',
    'Port City All-Star Band',
    'North Carolina Mass Band',
    '337 All-Star Band',
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
