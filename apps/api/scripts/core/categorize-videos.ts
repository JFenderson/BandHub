/**
 * Categorize Videos Script
 *
 * Direct port of BackfillCategoriesProcessor — runs keyword-based category
 * detection against the Video table. No AI quota consumed.
 *
 * Processes videos in cursor-based batches so it can safely handle 50k+ rows.
 * By default only processes videos with no category assigned.
 *
 * Usage:
 *   npx tsx --env-file=apps/api/.env apps/api/scripts/core/categorize-videos.ts
 *   npx tsx --env-file=apps/api/.env apps/api/scripts/core/categorize-videos.ts --all
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env — works from both tsx (scripts/core/) and compiled bundle (scripts/dist/)
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config({ path: resolve(__dirname, '../../../apps/api/.env') });
dotenv.config();

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Category patterns — mirrors database.service.ts detectCategorySlug()
// ---------------------------------------------------------------------------

const CATEGORY_RULES: Array<{ slug: string; pattern: RegExp }> = [
  // High school first — overrides all other categories
  { slug: 'high-school',        pattern: /\b(high\s*school|hs\s*band|jr\.?\s*high|middle\s*school|prep\s*school|h\.?s\.?\s*marching)\b/i },
  // Game-timing categories — zero quarter (before game) before 5th quarter (after game)
  { slug: 'zero-quarter',       pattern: /\b(zero[\s-]quarter|0[\s-]quarter|0th[\s-]quarter)\b/i },
  { slug: '5th-quarter',        pattern: /\b(5th\s*quarter|fifth\s*quarter|post\s*game|after\s*the\s*game)\b/i },
  // Stand battle — BOTB is the abbreviation for Battle of the Bands events; section instrument
  // battles (trombone, trumpet, etc.) are stand content even without the word "battle"
  { slug: 'stand-battle',       pattern: /\b(stand\s*battle|battle\s*of\s*(the\s*)?bands|band\s*battle|stands?\s*vs\.?|stands|botb|bita)\b|\b(trombone|trumpet|saxophone|sax|flute|clarinet|tuba|brass|woodwind)\s*(battle|vs\.?|feature|section)\b/i },
  // Percussion showcase — "stick tape" is the HBCU community term; plain "drumline" catches
  // channel-style highlight videos ("GSU Drumline Highlights")
  { slug: 'percussion-feature', pattern: /\b(stick[\s-]tape|drum\s*feature|percussion\s*feature|drumline\s*feature|snare\s*feature|tenor\s*feature|quad\s*feature|bass\s*feature|drumline)\b/i },
  { slug: 'field-playing',      pattern: /\b(field\s*show|marching\s*show|formation|drill\s*team|field\s*playing|on[\s-]field)\b/i },
  { slug: 'halftime-show',      pattern: /\b(halftime|half\s*time|half-time)\b/i },
  // entrance: "marching in" is the standard HBCU title format for entering the stadium
  { slug: 'entrance',           pattern: /\b(entrance|entering|arrival|pregame|pre\s*game|before\s*the\s*game|marching\s+in)\b/i },
  // exit: "marching out" is the mirror of "marching in"; plain "exit" is too generic
  { slug: 'exit',               pattern: /\b(march(ing)?\s*[\s-]?out|exit\s*march|band\s*exit|leaving\s*the\s*field)\b/i },
  { slug: 'parade',             pattern: /\b(parade|homecoming\s*parade|mardi\s*gras)\b/i },
  // practice: jamborees and scrimmages are rehearsal-type events
  { slug: 'practice',           pattern: /\b(practice|rehearsal|sectional|band\s*camp|band\s*room|jamboree|scrimmage)\b/i },
  { slug: 'concert',            pattern: /\b(concert|symphonic|spring\s*show|indoor)\b/i },
  // performance: song-performance videos that use the "Song | Band Year" title format common
  // on HBCU channels, or explicit performance/showcase keywords — placed last so more specific
  // categories take priority
  { slug: 'performance',        pattern: /\bperformance\b|\bshowcase\b|\bspotlight\b|\bperforms?\b|.+\|.+20\d\d/i },
];

function detectCategorySlug(title: string, description: string, bandType?: string): string {
  const text = `${title} ${description}`.toLowerCase();
  for (const { slug, pattern } of CATEGORY_RULES) {
    // Never tag HBCU/ALL_STAR band videos as high-school — the title may reference
    // a high-school opponent or event (e.g. "High School Day", "vs X High School")
    if (slug === 'high-school' && bandType && bandType !== 'HIGH_SCHOOL') continue;
    if (pattern.test(text)) return slug;
  }
  return 'other';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const uncategorizedOnly = !args.includes('--all');

  console.log('=== Categorize Videos Script ===');
  console.log(`Database: ${process.env.DATABASE_URL ? 'connected' : 'NOT FOUND — set DATABASE_URL'}`);
  console.log(`Mode: ${uncategorizedOnly ? 'uncategorized only' : 'ALL videos (re-categorize)'}\n`);

  // Load category slug → id map
  console.log('Loading categories...');
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryMap = new Map<string, string>(categories.map((c) => [c.slug, c.id]));
  console.log(`Loaded ${categoryMap.size} categories:`);
  for (const [slug, id] of categoryMap) console.log(`  ${slug} → ${id}`);

  // Count total
  const total = await prisma.video.count({
    where: uncategorizedOnly ? { categoryId: null } : {},
  });
  console.log(`\nVideos to process: ${total}`);

  if (total === 0) {
    console.log('Nothing to do.');
    return;
  }

  let categorized = 0;
  let skipped = 0;
  let errors = 0;
  const breakdown: Record<string, number> = {};
  const startTime = Date.now();
  let lastId: string | undefined;
  let processed = 0;

  while (true) {
    const videos = await prisma.video.findMany({
      where: {
        ...(uncategorizedOnly ? { categoryId: null } : {}),
        ...(lastId ? { id: { gt: lastId } } : {}),
      },
      select: { id: true, title: true, description: true, band: { select: { bandType: true } } },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });

    if (videos.length === 0) break;

    lastId = videos[videos.length - 1].id;

    // Group by detected category
    const categoryGroups = new Map<string, string[]>();

    for (const video of videos) {
      try {
        const slug = detectCategorySlug(video.title, video.description || '', (video as any).band?.bandType);
        const catId = categoryMap.get(slug);
        if (catId) {
          const ids = categoryGroups.get(catId) ?? [];
          ids.push(video.id);
          categoryGroups.set(catId, ids);
        } else {
          // slug not in DB (e.g., 'other' not seeded) — skip
          skipped++;
        }
      } catch {
        errors++;
      }
    }

    // Bulk update each category group
    for (const [catId, videoIds] of categoryGroups) {
      await prisma.video.updateMany({
        where: { id: { in: videoIds } },
        data: { categoryId: catId },
      });
      // Find slug for breakdown
      const slug = [...categoryMap.entries()].find(([, id]) => id === catId)?.[0] ?? catId;
      breakdown[slug] = (breakdown[slug] ?? 0) + videoIds.length;
      categorized += videoIds.length;
    }

    processed += videos.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  [${elapsed}s] ${processed}/${total} — categorized: ${categorized}, skipped: ${skipped}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== Results ===');
  console.log(`Total processed : ${processed}`);
  console.log(`Categorized     : ${categorized}`);
  console.log(`Skipped         : ${skipped}`);
  console.log(`Errors          : ${errors}`);
  console.log(`Duration        : ${elapsed}s`);
  console.log('\nBreakdown:');
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  for (const [slug, count] of sorted) {
    console.log(`  ${slug.padEnd(20)} ${count.toLocaleString()}`);
  }
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
