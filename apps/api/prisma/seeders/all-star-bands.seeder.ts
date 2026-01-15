// apps/api/prisma/seeders/all-star-bands.seeder.ts
import { PrismaClient, BandType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Simple slug generator
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')      // Replace spaces with -
    .replace(/--+/g, '-')      // Replace multiple - with single -
    .trim();
}

async function seedAllStarBands(prisma: PrismaClient) {
  console.log('🎺 Seeding all-star bands from extraction...');

  // Load the extracted template
  const templatePath = path.resolve(process.cwd(), 'allstar-bands-to-create.json');
  const allStarBands = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

  console.log(`   Found ${allStarBands.length} all-star bands to create\n`);

  let created = 0;
  let updated = 0;

  for (const band of allStarBands) {
    // Generate slug from name
    const slug = slugify(band.name);
    
    const existing = await prisma.band.findUnique({
      where: { slug },
    });

    if (existing) {
      await prisma.band.update({
        where: { slug },
        data: {
          name: band.name,
          schoolName: band.name, // Use name as schoolName for all-stars
          city: band.city || null,
          state: band.state || 'Various',
          bandType: BandType.ALL_STAR,
          description: band.description,
          searchKeywords: band.searchKeywords || [],
          isActive: true,
        },
      });
      console.log(`   🔄 Updated: ${band.name}`);
      updated++;
    } else {
      await prisma.band.create({
        data: {
          name: band.name,
          slug,
          schoolName: band.name, // Use name as schoolName for all-stars
          city: band.city || null,
          state: band.state || 'Various',
          bandType: BandType.ALL_STAR,
          description: band.description,
          searchKeywords: band.searchKeywords || [],
          isActive: true,
        },
      });
      console.log(`   ✅ Created: ${band.name}`);
      created++;
    }
  }

  console.log(`\n✅ All-star bands seeded!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total: ${created + updated}`);
}

seedAllStarBands()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });