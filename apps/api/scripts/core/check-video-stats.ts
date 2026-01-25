import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStats() {
  console.log('📊 Video Table Statistics\n');

  const ytTotal = await prisma.youTubeVideo.count();
  const ytWithBand = await prisma.youTubeVideo.count({ where: { bandId: { not: null } } });
  const ytPromoted = await prisma.youTubeVideo.count({ where: { isPromoted: true } });
  const ytNotPromoted = await prisma.youTubeVideo.count({ where: { isPromoted: false } });
  const ytWithBandNotPromoted = await prisma.youTubeVideo.count({
    where: { bandId: { not: null }, isPromoted: false }
  });

  console.log('═══════════════════════════════════════');
  console.log('YouTubeVideos Table (youtube_videos)');
  console.log('═══════════════════════════════════════');
  console.log(`  Total videos:              ${ytTotal}`);
  console.log(`  With bandId:               ${ytWithBand}`);
  console.log(`  Without bandId:            ${ytTotal - ytWithBand}`);
  console.log(`  Already promoted:          ${ytPromoted}`);
  console.log(`  Not promoted:              ${ytNotPromoted}`);
  console.log(`  With band + not promoted:  ${ytWithBandNotPromoted}`);
  console.log('');

  const videoTotal = await prisma.video.count();
  // bandId is required in videos table, so all videos have a band
  const videoWithBand = videoTotal;

  console.log('═══════════════════════════════════════');
  console.log('Videos Table (videos)');
  console.log('═══════════════════════════════════════');
  console.log(`  Total videos:              ${videoTotal}`);
  console.log(`  With bandId:               ${videoWithBand}`);
  console.log('');

  if (ytTotal - ytWithBand > 0) {
    console.log('⚠️  You have videos without bands assigned.');
    console.log('   Run the enhanced-match-videos script to assign bands:');
    console.log('   npx tsx scripts/core/enhanced-match-videos.ts');
  }

  if (ytWithBandNotPromoted > 0) {
    console.log(`\n📌 ${ytWithBandNotPromoted} videos ready to promote.`);
    console.log('   Run: npx tsx scripts/core/promote-videos.ts');
  }

  await prisma.$disconnect();
}

checkStats().catch(console.error);
