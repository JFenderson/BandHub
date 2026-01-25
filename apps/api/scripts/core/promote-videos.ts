/**
 * Video Promotion Script
 *
 * Promotes matched YouTubeVideos to the main Videos table for frontend display.
 * Only promotes videos that have been matched to a band (bandId is required in Video table).
 *
 * Usage: npx tsx apps/api/scripts/core/promote-videos.ts
 */
import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';

dotenv.config();
const prisma = new PrismaService();

async function promoteVideos() {
  console.log('Starting video promotion...');
  console.log('Database URL:', process.env.DATABASE_URL ? 'Found' : 'Not found');

  // Get YouTubeVideos that haven't been promoted yet and have a band assigned
  const youtubeVideos = await prisma.youTubeVideo.findMany({
    where: {
      isPromoted: false,
      bandId: { not: null }, // Required - Video table requires bandId
    },
    take: 50000, // Promote in batches
    include: {
      band: true,
      contentCreator: true,
    },
  });

  console.log(`Found ${youtubeVideos.length} videos to promote`);

  let promoted = 0;
  let skipped = 0;

  for (const ytVideo of youtubeVideos) {
    try {
      // Check if already exists in Video table
      const existing = await prisma.video.findUnique({
        where: { youtubeId: ytVideo.youtubeId },
      });

      if (existing) {
        console.log(`Skipping ${ytVideo.title} - already exists`);
        skipped++;
        continue;
      }

      // Create in Video table
      await prisma.video.create({
        data: {
          youtubeId: ytVideo.youtubeId,
          title: ytVideo.title,
          description: ytVideo.description,
          thumbnailUrl: ytVideo.thumbnailUrl,
          duration: ytVideo.duration,
          publishedAt: ytVideo.publishedAt,
          viewCount: ytVideo.viewCount,
          likeCount: ytVideo.likeCount,
          qualityScore: ytVideo.qualityScore,
          bandId: ytVideo.bandId!,
          opponentBandId: ytVideo.opponentBandId,
          creatorId: ytVideo.creatorId,
          isHidden: false,
        },
      });

      // Mark as promoted in YouTubeVideo
      await prisma.youTubeVideo.update({
        where: { id: ytVideo.id },
        data: {
          isPromoted: true,
          promotedAt: new Date(),
        },
      });

      promoted++;
      if (promoted % 100 === 0) {
        console.log(`Promoted ${promoted} videos... `);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error promoting video ${ytVideo.title}:`, errorMessage);
    }
  }

  console.log(`\nPromotion complete! `);
  console.log(`✅ Promoted: ${promoted}`);
  console.log(`⏭️  Skipped: ${skipped}`);
}

promoteVideos()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
