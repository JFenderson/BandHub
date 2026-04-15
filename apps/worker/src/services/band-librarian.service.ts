import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { LibrarianExtraction } from '@hbcu-band-hub/shared-types';
import { DatabaseService } from './database.service';

interface BandContextEntry {
  id: string;
  name: string;
  schoolName: string;
  bandType: string;
  searchKeywords: string[];
}

interface VideoInput {
  title: string;
  description: string;
  tags: string[];
  channelTitle: string;
}

const FALLBACK_EXTRACTION: LibrarianExtraction = {
  isHbcuBandContent: true,
  videoCategory: 'OTHER',
  isBattle: false,
  confidence: 0,
};

@Injectable()
export class BandLibrarianService implements OnModuleInit {
  private readonly logger = new Logger(BandLibrarianService.name);
  private readonly client: Anthropic;
  private systemPrompt: string = '';
  private bandContextCount: number = 0;

  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {
    const apiKey = configService.get<string>('ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey });
  }

  async onModuleInit(): Promise<void> {
    await this.refreshBandContext();
  }

  /**
   * Refresh the system prompt with current band data from the database.
   * Call this when band records are added or updated.
   */
  async refreshBandContext(): Promise<void> {
    try {
      const bands = await this.databaseService.band.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          schoolName: true,
          bandType: true,
          searchKeywords: true,
        },
        orderBy: { name: 'asc' },
      });

      this.bandContextCount = bands.length;
      this.systemPrompt = this.buildSystemPrompt(bands);
      this.logger.log(`Band librarian context refreshed: ${bands.length} bands loaded`);
    } catch (err) {
      this.logger.error('Failed to refresh band context from database', err);
      // Keep existing systemPrompt if refresh fails
    }
  }

  /**
   * Classify a single video. Returns LibrarianExtraction with band IDs when available.
   */
  async classify(input: VideoInput): Promise<LibrarianExtraction> {
    const results = await this.classifyBatch([input]);
    return results[0] ?? FALLBACK_EXTRACTION;
  }

  /**
   * Classify a batch of videos in a single Claude call (up to 5 videos per call).
   * More efficient than classify() for bulk operations — 5x fewer API calls.
   */
  async classifyBatch(inputs: VideoInput[]): Promise<LibrarianExtraction[]> {
    if (inputs.length === 0) return [];

    // Refresh context if bands appear to be stale (empty prompt)
    if (!this.systemPrompt) {
      await this.refreshBandContext();
    }

    const isBatch = inputs.length > 1;

    try {
      const userContent = isBatch
        ? this.buildBatchUserMessage(inputs)
        : this.buildSingleUserMessage(inputs[0]);

      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: isBatch ? 1500 : 500,
        system: [
          {
            type: 'text',
            text: this.systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ] as any,
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

      if (isBatch) {
        const parsed = JSON.parse(jsonText) as Array<LibrarianExtraction & { videoIndex?: number }>;
        if (!Array.isArray(parsed)) {
          this.logger.warn('Batch classification returned non-array — falling back');
          return inputs.map(() => FALLBACK_EXTRACTION);
        }
        // Re-order by videoIndex if present, otherwise trust array order
        const ordered = new Array(inputs.length).fill(FALLBACK_EXTRACTION);
        parsed.forEach((item, i) => {
          const idx = typeof item.videoIndex === 'number' ? item.videoIndex - 1 : i;
          if (idx >= 0 && idx < inputs.length) {
            const { videoIndex: _vi, ...extraction } = item as any;
            ordered[idx] = extraction as LibrarianExtraction;
          }
        });
        return ordered;
      } else {
        const parsed = JSON.parse(jsonText) as LibrarianExtraction;
        return [parsed];
      }
    } catch (err) {
      this.logger.warn(`Librarian classification failed for ${inputs.length} video(s): ${err}`);
      return inputs.map(() => FALLBACK_EXTRACTION);
    }
  }

  private buildSingleUserMessage(input: VideoInput): string {
    return [
      `CHANNEL (strong signal): ${input.channelTitle}`,
      `TITLE: ${input.title}`,
      `DESCRIPTION (first 300 chars): ${(input.description || '').slice(0, 300)}`,
      input.tags.length > 0 ? `TAGS: ${input.tags.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildBatchUserMessage(inputs: VideoInput[]): string {
    const blocks = inputs.map((input, i) =>
      [
        `VIDEO_${i + 1}:`,
        `CHANNEL (strong signal): ${input.channelTitle}`,
        `TITLE: ${input.title}`,
        `DESCRIPTION (first 300 chars): ${(input.description || '').slice(0, 300)}`,
        input.tags.length > 0 ? `TAGS: ${input.tags.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );

    return (
      `Classify the following ${inputs.length} videos. Return a JSON array with one object per video in the same order. Include "videoIndex" (1-based) in each object.\n\n` +
      blocks.join('\n\n')
    );
  }

  private buildSystemPrompt(bands: BandContextEntry[]): string {
    const hbcuBands = bands.filter((b) => b.bandType === 'HBCU');
    const allStarBands = bands.filter((b) => b.bandType === 'ALL_STAR');

    const hbcuList = hbcuBands
      .map(
        (b) =>
          `- ID:${b.id} | ${b.name} | School: ${b.schoolName} | AKA: ${b.searchKeywords.join(', ')}`,
      )
      .join('\n');

    const allStarList = allStarBands
      .map((b) => `- ID:${b.id} | ${b.name} | AKA: ${b.searchKeywords.join(', ')}`)
      .join('\n');

    return `You are the HBCU Band Librarian — an expert cataloger of HBCU marching band videos.

Given YouTube video metadata, extract structured information and return ONLY valid JSON.
No markdown fences. No explanation. JSON only.

## BAND ROSTER
Match the video to one of these bands using the EXACT ID string shown.

### HBCU MARCHING BANDS
${hbcuList}

### ALL-STAR / MASS BANDS
${allStarList}

## CHANNEL TITLE IS THE STRONGEST SIGNAL
Channel title is the STRONGEST single signal for identifying which band is in a video.
If the channel title contains a band name or school name, weight it 3x vs the video title or description.
NOTE: "creator channels" (third-party channels that cover multiple bands) may post about any band — in that case the video TITLE takes precedence over channel title.
If the channel title is a band's own channel name, that band is almost certainly the primary band.

## BAND SUBTYPE DISAMBIGUATION
Some schools have both a marching band and a pep band. Detect:
- PEP BAND signals: "pep band", "basketball", "gym", "indoor", "bleacher", "sideline"
- MARCHING BAND signals: "halftime", "parade", "field show", "homecoming", "BOTB", "battle", "fifth quarter"
Set bandSubtype to "pep", "marching", or "unknown".

## BATTLE / SHOWDOWN DETECTION
Set isBattle: true if the video contains "vs", "versus", "battle", "BOTB", "showdown", "face off".
For 2-band battles: set primaryBandId (first/main band) and opponentBandId (second band).
For 3+ band battles (e.g., "337 vs LLI vs Regulators"):
  - Set primaryBandId to the first band mentioned
  - Set opponentBandId to the second band mentioned
  - Set participantBandIds to ALL band IDs including primaryBandId and opponentBandId
  - participantBandIds MUST contain every band you identified in the video

## VIDEO CATEGORIES
- FIFTH_QUARTER: Post-game performance after the final whistle in the stands
- STAND_BATTLE: Competitive battle between two bands in the stands or head-to-head
- FIELD_SHOW: Full marching show on the field with formations and drill
- HALFTIME: Halftime show performance during a football game
- PREGAME: Performance before the game starts
- ENTRANCE: Band marching into the stadium or arrival
- PARADE: Band marching in a parade through streets or campus
- PRACTICE: Rehearsal, practice session, band camp, or sectional
- CONCERT_BAND: Indoor concert, symphonic, or non-marching performance
- OTHER: Does not clearly fit any above category

## KNOWN EVENTS
Bayou Classic (Southern University vs Grambling State),
Magic City Classic (Alabama State vs Alabama A&M),
Florida Classic (Florida A&M vs Bethune-Cookman),
MEAC/SWAC Challenge, Honda Battle of the Bands, Southern Heritage Classic,
Atlanta Football Classic, NC Classic, Circle City Classic, Gateway Classic

## EXCLUSION RULES
Set isHbcuBandContent: false and provide exclusionReason if:
- HIGH SCHOOL: "high school", "hs band", "BOA", "Bands of America", grade levels, "varsity band", "prep school", specific high school names
- MIDDLE SCHOOL: "middle school", "junior high", "elementary", youth band
- DRUM CORPS: DCI, "drum corps", "corps" competition content (not HBCU bands)
- NON_BAND_SCHOOL: sports highlights, campus tours, graduation ceremonies, commencement, choir concerts, step shows, Greek shows, athletics content
- PODCAST: interview shows, reaction videos, talk shows, vlogs
- UNRELATED: nothing to do with HBCU marching bands

## IMPORTANT RULES
- Return primaryBandId using EXACT ID strings from the BAND ROSTER — never invent or guess IDs
- If you cannot find a matching band, set primaryBandId: null and confidence below 50
- confidence: 0-100 reflecting certainty that the classification is correct (50+ = usable match, 80+ = high confidence)
- "Homecoming" without other context = HALFTIME
- participantBandIds should be an empty array [] when there are fewer than 3 bands or when you are not sure

## OUTPUT FORMAT
Return ONLY this JSON (or a JSON array if classifying multiple videos):
{
  "isHbcuBandContent": boolean,
  "exclusionReason": "high_school" | "middle_school" | "non_band_school" | "drum_corps" | "podcast" | "unrelated" | null,
  "primaryBandId": "<exact ID from roster>" | null,
  "opponentBandId": "<exact ID from roster>" | null,
  "participantBandIds": ["<id>", ...],
  "bandSubtype": "marching" | "pep" | "unknown",
  "primaryBandName": string | null,
  "opponentBandName": string | null,
  "videoCategory": "FIFTH_QUARTER" | "STAND_BATTLE" | "FIELD_SHOW" | "HALFTIME" | "PREGAME" | "ENTRANCE" | "PARADE" | "PRACTICE" | "CONCERT_BAND" | "OTHER",
  "isBattle": boolean,
  "eventName": string | null,
  "eventYear": number | null,
  "confidence": number
}`;
  }
}
