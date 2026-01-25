// apps/api/scripts/utilities/reset-band-ids.ts
/**
 * Reset Script for Video Pipeline
 *
 * Usage:
 *   npx tsx scripts/utilities/reset-band-ids.ts [options]
 *
 * Options:
 *   --bands-only      Reset only bandId (default if no options)
 *   --promotion-only  Reset only promotion status
 *   --all             Reset both bandId and promotion status
 *   --delete-videos   Also delete all records from videos table
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const resetBands = args.includes('--bands-only') || args.includes('--all') || args.length === 0;
const resetPromotion = args.includes('--promotion-only') || args.includes('--all');
const deleteVideos = args.includes('--delete-videos');

async function main() {
  console.log('🔄 Video Pipeline Reset Script\n');

  // Delete videos from videos table if requested
  if (deleteVideos) {
    console.log('🗑️  Deleting all records from videos table...');
    const deleteResult = await prisma.video.deleteMany({});
    console.log(`   Deleted ${deleteResult.count} videos from videos table\n`);
  }

  // Reset promotion status
  if (resetPromotion) {
    console.log('🔄 Resetting promotion status...');
    const promotionResult = await prisma.youTubeVideo.updateMany({
      where: { isPromoted: true },
      data: {
        isPromoted: false,
        promotedAt: null
      }
    });
    console.log(`   Reset ${promotionResult.count} videos to isPromoted=false\n`);
  }

  // Reset band IDs
  if (resetBands) {
    console.log('🔄 Resetting all band_id values...');
    const bandResult = await prisma.youTubeVideo.updateMany({
      where: { bandId: { not: null } },
      data: {
        bandId: null,
        opponentBandId: null,
        qualityScore: 0
      }
    });
    console.log(`   Reset ${bandResult.count} video band_ids to null\n`);
  }

  console.log('✅ Reset complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());