/**
 * Export Content Creators from current DATABASE_URL to a JSON file.
 *
 * Usage:
 *   npx tsx scripts/export-creators.ts
 *
 * Output: scripts/creators-export.json
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function exportCreators() {
  console.log('Exporting content creators...\n');

  const creators = await prisma.contentCreator.findMany({
    orderBy: { name: 'asc' },
  });

  if (creators.length === 0) {
    console.log('No content creators found in this database.');
    return;
  }

  const outputPath = path.join(process.cwd(), 'scripts', 'creators-export.json');
  fs.writeFileSync(outputPath, JSON.stringify(creators, null, 2), 'utf-8');

  console.log(`Exported ${creators.length} creators to ${outputPath}`);
  console.log('\nNext: run the import script against your production DATABASE_URL:');
  console.log('  DATABASE_URL="<prod-url>" npx tsx scripts/import-creators.ts');
}

exportCreators()
  .catch((err) => {
    console.error('Export failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
