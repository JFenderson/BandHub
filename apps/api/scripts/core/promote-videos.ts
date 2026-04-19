/**
 * Promote Videos Script
 *
 * Direct port of PromoteVideosProcessor — upserts matched YouTubeVideos into
 * the public Video table and refreshes VideoBand junction rows.
 *
 * Key differences from the old script:
 *   - Uses upsert (not create), so re-running is safe
 *   - Updates bandId / opponentBandId on existing Video rows (fix after rematch)
 *   - Rebuilds VideoBand junction rows on re-promotion
 *   - Applies keyword-based category detection
 *
 * Usage:
 *   npx tsx --env-file=apps/api/.env apps/api/scripts/core/promote-videos.ts
 *   npx tsx --env-file=apps/api/.env apps/api/scripts/core/promote-videos.ts --limit=10000
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Category detection — mirrors PromoteVideosProcessor.determineCategory()
// ---------------------------------------------------------------------------

function determineCategory(video: { title: string; description: string | null; aiExtraction: any }): string | null {
  const aiData = video.aiExtraction as { videoCategory?: string } | null;
  if (aiData?.videoCategory && aiData.videoCategory !== 'OTHER') {
    const slugMap: Record<string, string> = {
      FIFTH_QUARTER:  '5th-quarter',
      STAND_BATTLE:   'stand-battle',
      FIELD_SHOW:     'field-show',
      HALFTIME:       'halftime',
      PREGAME:        'pregame',
      ENTRANCE:       'entrance',
      PARADE:         'parade',
      PRACTICE:       'practice',
      CONCERT_BAND:   'concert-band',
    };
    const slug = slugMap[aiData.videoCategory];
    if (slug) return slug;
  }

  const text = `${video.title || ''} ${video.description || ''}`.toLowerCase();

  if (/\b(5th\s*quarter|fifth\s*quarter|post\s*game|after\s*the\s*game)\b/i.test(text))         return '5th-quarter';
  if (/\b(stand\s*battle|battle\s*of\s*(the\s*)?bands|band\s*battle|stands?\s*vs\.?)\b/i.test(text)) return 'stand-battle';
  if (/\b(field\s*show|marching\s*show|formation|drill\s*team)\b/i.test(text))                  return 'field-show';
  if (/\b(halftime|half\s*time|half-time)\b/i.test(text))                                        return 'halftime';
  if (/\b(pregame|pre\s*game|before\s*the\s*game)\b/i.test(text))                               return 'pregame';
  if (/\b(entrance|entering|arrival)\b/i.test(text))                                             return 'entrance';
  if (/\b(parade|homecoming\s*parade|mardi\s*gras)\b/i.test(text))                              return 'parade';
  if (/\b(practice|rehearsal|sectional|band\s*camp|band\s*room)\b/i.test(text))                 return 'practice';
  if (/\b(concert|symphonic|spring\s*show|indoor)\b/i.test(text))                               return 'concert-band';

  return 'other';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  console.log('=== Promote Videos Script ===');
  console.log(`Database: ${process.env.DATABASE_URL ? 'connected' : 'NOT FOUND — set DATABASE_URL'}`);
  if (limit) console.log(`Limit: ${limit}`);

  // Pre-load category slug → id map
  console.log('\nLoading categories...');
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryMap = new Map<string, string>(categories.map((c) => [c.slug, c.id]));
  console.log(`Loaded ${categoryMap.size} categories`);

  // Fetch videos ready to promote
  console.log('\nFetching matched videos not yet promoted...');
  const videosToPromote = await (prisma.youTubeVideo.findMany as any)({
    where: {
      bandId: { not: null },
      isPromoted: false,
    },
    select: {
      id: true,
      youtubeId: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      duration: true,
      publishedAt: true,
      viewCount: true,
      likeCount: true,
      bandId: true,
      opponentBandId: true,
      participantBandIds: true,
      qualityScore: true,
      aiExtraction: true,
    },
    take: limit,
    orderBy: { publishedAt: 'desc' },
  });

  console.log(`Found ${videosToPromote.length} videos ready for promotion\n`);

  if (videosToPromote.length === 0) {
    console.log('Nothing to promote.');
    return;
  }

  let promoted = 0;
  let updated = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const [index, ytv] of videosToPromote.entries()) {
    try {
      const categorySlug = determineCategory(ytv);
      const categoryId = categorySlug ? categoryMap.get(categorySlug) ?? null : null;

      // Check if Video row already exists (determines whether to rebuild VideoBand rows)
      const existingVideo = await prisma.video.findUnique({
        where: { youtubeId: ytv.youtubeId },
        select: { id: true },
      });

      // Upsert — always updates bandId / opponentBandId in case of rematch
      const upserted = await prisma.video.upsert({
        where: { youtubeId: ytv.youtubeId },
        create: {
          youtubeId:      ytv.youtubeId,
          title:          ytv.title,
          description:    ytv.description || '',
          thumbnailUrl:   ytv.thumbnailUrl,
          duration:       ytv.duration,
          publishedAt:    ytv.publishedAt,
          viewCount:      ytv.viewCount,
          likeCount:      ytv.likeCount,
          bandId:         ytv.bandId!,
          opponentBandId: ytv.opponentBandId ?? null,
          categoryId:     categoryId ?? undefined,
          qualityScore:   ytv.qualityScore,
          isHidden:       false,
        },
        update: {
          viewCount:      ytv.viewCount,
          likeCount:      ytv.likeCount,
          bandId:         ytv.bandId!,
          opponentBandId: ytv.opponentBandId ?? null,
          qualityScore:   ytv.qualityScore,
          ...(categoryId ? { categoryId } : {}),
        },
        select: { id: true },
      });

      // Rebuild VideoBand junction rows
      const participantBandIds: string[] = ytv.participantBandIds ?? [];
      if (existingVideo) {
        await (prisma as any).videoBand.deleteMany({ where: { videoId: upserted.id } });
      }
      if (participantBandIds.length > 0) {
        const videoBandData = participantBandIds.map((bandId: string) => ({
          videoId: upserted.id,
          bandId,
          role:
            bandId === ytv.bandId         ? 'PRIMARY'     :
            bandId === ytv.opponentBandId ? 'OPPONENT'    :
                                            'PARTICIPANT',
        }));
        await (prisma as any).videoBand.createMany({ data: videoBandData, skipDuplicates: true });
      }

      // Mark promoted
      await prisma.youTubeVideo.update({
        where: { id: ytv.id },
        data: { isPromoted: true, promotedAt: new Date() },
      });

      if (existingVideo) updated++; else promoted++;

    } catch (err) {
      errors++;
      console.error(`  Error promoting ${ytv.youtubeId}: ${err instanceof Error ? err.message : err}`);
    }

    if ((index + 1) % 500 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  [${elapsed}s] ${index + 1}/${videosToPromote.length} — new: ${promoted}, updated: ${updated}, errors: ${errors}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Results ===');
  console.log(`Total processed : ${videosToPromote.length}`);
  console.log(`New promotions  : ${promoted}`);
  console.log(`Re-promotions   : ${updated}`);
  console.log(`Errors          : ${errors}`);
  console.log(`Duration        : ${elapsed}s`);
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
