/**
 * AI-powered video categorization using Claude.
 *
 * Processes videos in the "other" category (or uncategorized) and uses Claude Haiku
 * to classify them based on title + description. Much more accurate than regex alone
 * because it understands context (e.g. "Homecoming 2024" → halftime show).
 *
 * Usage:
 *   ANTHROPIC_API_KEY="sk-ant-..." DATABASE_URL="..." npx tsx scripts/ai-categorize-videos.ts
 *
 * Options (env vars):
 *   BATCH_SIZE     - videos per parallel batch (default: 20)
 *   DRY_RUN        - set to "true" to print decisions without writing to DB
 *   LIMIT          - max videos to process (useful for testing, e.g. LIMIT=100)
 *
 * Safe to re-run — only processes videos currently in "other" or uncategorized.
 * Already-categorized videos are never touched.
 */

import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '20', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;

const CATEGORIES = [
  { slug: '5th-quarter',   label: '5th Quarter',   hint: 'Post-game performance after the final whistle, band keeps playing in the stands after the game ends' },
  { slug: 'stand-battle',  label: 'Stand Battle',  hint: 'Competitive battle between two bands playing against each other in the stands or head-to-head' },
  { slug: 'field-show',    label: 'Field Show',    hint: 'Full marching band performance on the field with formations and drill' },
  { slug: 'halftime',      label: 'Halftime',      hint: 'Halftime show performance during a football game at the midpoint' },
  { slug: 'pregame',       label: 'Pregame',       hint: 'Performance before the game starts' },
  { slug: 'entrance',      label: 'Entrance',      hint: 'Band marching into the stadium, arrival, or opening entrance' },
  { slug: 'parade',        label: 'Parade',        hint: 'Band marching in a parade through streets or campus' },
  { slug: 'practice',      label: 'Practice',      hint: 'Rehearsal, practice session, band camp, or sectional' },
  { slug: 'concert-band',  label: 'Concert Band',  hint: 'Indoor concert, symphonic, or non-marching performance' },
  { slug: 'other',         label: 'Other',         hint: 'Does not clearly fit any above category' },
];

const CATEGORY_LIST = CATEGORIES
  .map(c => `  ${c.slug} — ${c.label}: ${c.hint}`)
  .join('\n');

// Shared system prompt — cached on first call by the API
const SYSTEM_PROMPT = `You are an expert at categorizing HBCU (Historically Black Colleges and Universities) marching band videos.

Given a video title and description, respond with ONLY the single most appropriate category slug from this list:

${CATEGORY_LIST}

Rules:
- Reply with ONLY the slug (e.g. "halftime"), no explanation, no punctuation
- "Homecoming" videos are almost always halftime shows unless the title says otherwise
- "vs" or "versus" in the title usually means a stand battle
- If genuinely unclear, use "other"`;

async function classifyVideo(title: string, description: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 15,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Title: ${title}\nDescription: ${description.slice(0, 400) || 'No description'}`,
    }],
  });

  const slug = (response.content[0] as Anthropic.TextBlock).text.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return CATEGORIES.find(c => c.slug === slug)?.slug ?? 'other';
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY env var is required');
    process.exit(1);
  }

  if (DRY_RUN) console.log('DRY RUN — no DB writes will happen\n');

  // Load all categories from DB
  const dbCategories = await prisma.category.findMany();
  const categoryBySlug = new Map(dbCategories.map(c => [c.slug, c]));
  const otherCategory = categoryBySlug.get('other');

  if (dbCategories.length === 0) {
    console.error('No categories found in DB. Create categories first via the admin portal.');
    process.exit(1);
  }

  console.log(`Categories in DB: ${dbCategories.map(c => c.slug).join(', ')}\n`);

  // Target: videos that are "other" or uncategorized
  const whereClause = otherCategory
    ? { OR: [{ categoryId: otherCategory.id }, { categoryId: null }] }
    : { categoryId: null };

  const total = await prisma.video.count({ where: whereClause });
  const toProcess = LIMIT ? Math.min(total, LIMIT) : total;
  console.log(`Found ${total} videos to categorize${LIMIT ? ` (capped at ${LIMIT})` : ''}\n`);

  if (toProcess === 0) {
    console.log('Nothing to do.');
    return;
  }

  const breakdown: Record<string, number> = {};
  let processed = 0;
  let reclassified = 0;
  let errors = 0;
  let lastId: string | undefined;
  const startTime = Date.now();

  while (processed < toProcess) {
    const batchLimit = Math.min(BATCH_SIZE, toProcess - processed);

    const videos = await prisma.video.findMany({
      where: {
        ...whereClause,
        ...(lastId ? { id: { gt: lastId } } : {}),
      },
      select: { id: true, title: true, description: true },
      orderBy: { id: 'asc' },
      take: batchLimit,
    });

    if (videos.length === 0) break;
    lastId = videos[videos.length - 1].id;

    // Classify all videos in the batch in parallel
    const results = await Promise.allSettled(
      videos.map(async (video) => {
        const slug = await classifyVideo(video.title, video.description || '');
        return { video, slug };
      })
    );

    // Write results to DB
    for (const result of results) {
      if (result.status === 'rejected') {
        errors++;
        console.error(`  Error: ${result.reason}`);
        continue;
      }

      const { video, slug } = result.value;
      const dbCategory = categoryBySlug.get(slug);

      // Only write if we found a specific category (skip if still "other" or not in DB)
      if (dbCategory && dbCategory.id !== otherCategory?.id) {
        if (!DRY_RUN) {
          await prisma.video.update({
            where: { id: video.id },
            data: { categoryId: dbCategory.id },
          });
        }
        breakdown[slug] = (breakdown[slug] ?? 0) + 1;
        reclassified++;
        if (DRY_RUN) {
          console.log(`  [DRY] "${video.title.slice(0, 60)}" → ${slug}`);
        }
      }
    }

    processed += videos.length;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (processed / (Date.now() - startTime) * 1000).toFixed(1);
    const eta = ((toProcess - processed) / parseFloat(rate)).toFixed(0);
    process.stdout.write(
      `\rProgress: ${processed}/${toProcess} | Reclassified: ${reclassified} | Errors: ${errors} | ${rate} vid/s | ETA: ${eta}s   `
    );

    // Small delay to stay well within rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n\n=== Done ===');
  console.log(`Processed:     ${processed}`);
  console.log(`Reclassified:  ${reclassified}`);
  console.log(`Stayed other:  ${processed - reclassified - errors}`);
  console.log(`Errors:        ${errors}`);
  console.log('\nBreakdown:');
  for (const [slug, count] of Object.entries(breakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${slug.padEnd(14)} ${count}`);
  }
}

main()
  .catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
