import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();
const prisma = new PrismaService();

async function main() {
  console.log('🔍 Analyzing Unmatched Videos...');
  
  // 1. Get total count
  const count = await prisma.youTubeVideo.count({
    where: { bandId: null },
  });
  console.log(`\n📉 Total Unmatched Videos: ${count}`);

  if (count === 0) return;

  // 2. Group by Channel Name (Top 20)
  // This helps identify if specific channels are the problem
  console.log('\n📊 Top Channels with Unmatched Videos:');
  const videos = await prisma.youTubeVideo.findMany({
    where: { bandId: null },
    select: { channelTitle: true },
  });

  const channelCounts: Record<string, number> = {};
  videos.forEach(v => {
    const channel = v.channelTitle || 'Unknown Channel';
    channelCounts[channel] = (channelCounts[channel] || 0) + 1;
  });

  Object.entries(channelCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .forEach(([channel, count], index) => {
      console.log(`   ${index + 1}. ${channel}: ${count} videos`);
    });

  // 3. Show a sample of video titles
  console.log('\n📝 Sample Unmatched Titles (First 20):');
  const sampleVideos = await prisma.youTubeVideo.findMany({
    where: { bandId: null },
    select: { title: true, channelTitle: true },
    take: 20,
  });

  sampleVideos.forEach(v => {
    console.log(`   - [${v.channelTitle}] ${v.title}`);
  });

  // 4. Export to JSON for deep dive
  const exportPath = path.resolve(process.cwd(), 'unmatched_videos.json');
  console.log(`\n💾 Exporting full list to: ${exportPath}`);
  
  const allUnmatched = await prisma.youTubeVideo.findMany({
    where: { bandId: null },
    select: { 
      youtubeId: true, 
      title: true, 
      channelTitle: true, 
      publishedAt: true 
    },
  });

  fs.writeFileSync(exportPath, JSON.stringify(allUnmatched, null, 2));
  console.log('✅ Export complete!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());