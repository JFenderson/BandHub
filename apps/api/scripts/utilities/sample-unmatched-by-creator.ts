/**
 * Sample Unmatched Videos by Creator
 *
 * Shows sample video titles from each top unmatched creator channel
 * to help understand WHY they're not matching.
 *
 * Usage: npx tsx apps/api/scripts/utilities/sample-unmatched-by-creator.ts
 */
import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';

dotenv.config();
const prisma = new PrismaService();

async function main() {
  console.log('🔍 Sampling Unmatched Videos by Creator Channel\n');

  // Get top 10 channels with most unmatched videos
  const videos = await prisma.youTubeVideo.findMany({
    where: { bandId: null },
    select: { channelTitle: true, channelId: true },
  });

  const channelCounts: Record<string, { count: number; channelId: string }> = {};
  videos.forEach((v) => {
    const channel = v.channelTitle || 'Unknown';
    if (!channelCounts[channel]) {
      channelCounts[channel] = { count: 0, channelId: v.channelId };
    }
    channelCounts[channel].count++;
  });

  const topChannels = Object.entries(channelCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10);

  console.log('Top 10 Channels with Unmatched Videos:\n');

  for (const [channelName, data] of topChannels) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📺 ${channelName} (${data.count} unmatched videos)`);
    console.log(`${'='.repeat(60)}`);

    // Get sample titles from this channel
    const samples = await prisma.youTubeVideo.findMany({
      where: {
        bandId: null,
        channelId: data.channelId,
      },
      select: {
        title: true,
        description: true,
      },
      take: 15,
      orderBy: { viewCount: 'desc' }, // Show most viewed first
    });

    console.log('\nSample titles (top by views):');
    samples.forEach((v, i) => {
      console.log(`   ${i + 1}. ${v.title}`);
      // Show first 100 chars of description if it might help
      if (v.description && v.description.length > 10) {
        const descPreview = v.description.substring(0, 100).replace(/\n/g, ' ');
        console.log(`      └─ "${descPreview}..."`);
      }
    });
  }

  console.log('\n\n📊 Analysis Summary:');
  console.log('If titles mention specific bands, the matching algorithm may need new keywords.');
  console.log('If titles are generic (e.g., "Halftime Show"), these videos cannot be auto-matched.');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
