/**
 * Import Content Creators from the JSON export into the current DATABASE_URL.
 *
 * Usage (run against prod):
 *   DATABASE_URL="<prod-url>" npx tsx scripts/import-creators.ts
 *
 * Input: scripts/creators-export.json
 *
 * Uses upsert on youtubeChannelId so it's safe to re-run.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function importCreators() {
  const inputPath = path.join(process.cwd(), 'scripts', 'creators-export.json');

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    console.error('Run export-creators.ts first.');
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const creators: any[] = JSON.parse(raw);

  console.log(`Importing ${creators.length} creators into ${process.env.DATABASE_URL?.split('@')[1] ?? 'database'}...\n`);

  let created = 0;
  let updated = 0;

  for (const creator of creators) {
    // Strip relations-only or auto-managed fields that shouldn't be inserted directly
    const { id, createdAt, updatedAt, ...rest } = creator;

    const result = await prisma.contentCreator.upsert({
      where: { youtubeChannelId: creator.youtubeChannelId },
      create: {
        ...rest,
        // Preserve original id so existing video foreign keys still work
        // if this is a fresh prod DB. If prod already has the creator with
        // a different id, the update path will not change the id.
        id,
        createdAt: new Date(createdAt),
      },
      update: {
        name: rest.name,
        channelUrl: rest.channelUrl,
        description: rest.description,
        logoUrl: rest.logoUrl,
        thumbnailUrl: rest.thumbnailUrl,
        subscriberCount: rest.subscriberCount,
        totalVideoCount: rest.totalVideoCount,
        isVerified: rest.isVerified,
        isFeatured: rest.isFeatured,
        qualityScore: rest.qualityScore,
      },
    });

    // Detect create vs update by comparing timestamps
    if (new Date(result.createdAt).getTime() === new Date(createdAt).getTime()) {
      created++;
    } else {
      updated++;
    }

    process.stdout.write(`  ${result.name}\n`);
  }

  console.log(`\nDone! Created: ${created}, Updated: ${updated}`);
}

importCreators()
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
