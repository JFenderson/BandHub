// apps/api/scripts/seed-missing-hbcus.ts
import { PrismaService } from '@bandhub/database';
import * as fs from 'fs';
import slugify from 'slugify'; // or your slug generator

const prisma = new PrismaService();
const bandsToCreate = JSON.parse(
  fs.readFileSync('./bands-to-create.json', 'utf-8')
);

async function seedMissingHbcus() {
  console.log(`Creating ${bandsToCreate.length} missing HBCU bands...\n`);
  
  for (const band of bandsToCreate) {
    const slug = slugify(band.name, { lower: true, strict: true });
    
    try {
      await prisma.band.create({
        data: {
          id: band.id, // Make sure band.id exists in your bandsToCreate data, or generate a unique id here
          name: band.name,
          slug,
          schoolName: band.schoolName,
          city: band.city,
          state: band.state,
          bandType: 'HBCU',
          conference: band.conference,
          description: band.description,
          searchKeywords: band.searchKeywords,
          isActive: true,
          isFeatured: false,
          updatedAt: new Date(), // Set to current date/time or use band.updatedAt if available
        },
      });
      console.log(`✅ Created: ${band.name}`);
    } catch (error) {
      console.error(`❌ Error creating ${band.name}:`, error.message);
    }
  }
  
  console.log('\n✅ All bands created!');
}

seedMissingHbcus()
  .catch(console.error)
  .finally(() => prisma.$disconnect());