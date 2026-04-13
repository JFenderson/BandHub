import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { LibrarianExtraction } from '@hbcu-band-hub/shared-types';

// Inlined band data to avoid fragile cross-package runtime require()
const HBCU_BANDS = [
  { name: "Southern University Human Jukebox", school: "Southern University", keywords: ["southern university", "human jukebox", "swac", "baton rouge", "su", "jags", "jaguars", "southern u"] },
  { name: "Jackson State Sonic Boom of the South", school: "Jackson State University", keywords: ["jackson state", "sonic boom", "swac", "mississippi", "jsu", "sbots", "sonic boom of the south", "tigers"] },
  { name: "Florida A&M Marching 100", school: "Florida A&M University", keywords: ["famu", "marching 100", "swac", "tallahassee", "rattlers", "florida a&m", "florida am", "the 100"] },
  { name: "Bethune-Cookman Marching Wildcats", school: "Bethune-Cookman University", keywords: ["bethune cookman", "marching wildcats", "swac", "daytona", "bcu", "bethune-cookman", "wildcats"] },
  { name: "Texas Southern Ocean of Soul", school: "Texas Southern University", keywords: ["texas southern", "ocean of soul", "swac", "houston", "txsu", "tsu", "tigers"] },
  { name: "Grambling State Tiger Marching Band", school: "Grambling State University", keywords: ["grambling", "tiger marching band", "world famed", "swac", "louisiana", "gsu", "grambling state", "g-men", "tigers"] },
  { name: "Prairie View A&M Marching Storm", school: "Prairie View A&M University", keywords: ["prairie view", "marching storm", "swac", "pvamu", "pv", "panthers"] },
  { name: "Alabama State Mighty Marching Hornets", school: "Alabama State University", keywords: ["alabama state", "mighty marching hornets", "swac", "montgomery", "asu", "bama state", "mmh", "hornets"] },
  { name: "Alabama A&M Marching Maroon and White", school: "Alabama A&M University", keywords: ["alabama a&m", "marching maroon and white", "swac", "huntsville", "aamu", "alabama am", "maroon and white", "bulldogs"] },
  { name: "Alcorn State Sounds of Dyn-O-Mite", school: "Alcorn State University", keywords: ["alcorn state", "sounds of dyn-o-mite", "sod", "swac", "mississippi", "sounds of dynomite", "dynomite", "braves"] },
  { name: "Mississippi Valley State Mean Green Marching Machine", school: "Mississippi Valley State University", keywords: ["mississippi valley state", "mean green marching machine", "swac", "mvsu", "mississippi valley", "valley", "mean green", "mgmm", "delta devils", "devils"] },
  { name: "UAPB Marching Musical Machine of the Mid-South", school: "University of Arkansas at Pine Bluff", keywords: ["uapb", "m4", "marching musical machine", "swac", "arkansas", "university of arkansas at pine bluff"] },
  { name: "Howard University Showtime Marching Band", school: "Howard University", keywords: ["howard university", "showtime", "meac", "washington dc", "bison"] },
  { name: "North Carolina Central Sound Machine", school: "North Carolina Central University", keywords: ["nccu", "sound machine", "meac", "durham", "eagles", "north carolina central", "nc central"] },
  { name: "Norfolk State Spartan Legion", school: "Norfolk State University", keywords: ["norfolk state", "spartan legion", "meac", "virginia", "behold", "nsu", "spartans"] },
  { name: "Morgan State Magnificent Marching Machine", school: "Morgan State University", keywords: ["morgan state", "magnificent marching machine", "meac", "baltimore", "bears"] },
  { name: "South Carolina State Marching 101", school: "South Carolina State University", keywords: ["sc state", "marching 101", "meac", "orangeburg", "bulldogs"] },
  { name: "Delaware State Approaching Storm", school: "Delaware State University", keywords: ["delaware state", "approaching storm", "meac", "dover", "hornets"] },
  { name: "Virginia State Trojan Explosion", school: "Virginia State University", keywords: ["virginia state", "trojan explosion", "ciaa", "petersburg", "trojans"] },
  { name: "Winston-Salem State Red Sea of Sound", school: "Winston-Salem State University", keywords: ["wssu", "red sea of sound", "ciaa", "winston-salem", "rams", "winston salem state"] },
  { name: "Bowie State Symphony of Soul", school: "Bowie State University", keywords: ["bowie state", "symphony of soul", "ciaa", "maryland", "bulldogs", "marching bulldogs"] },
  { name: "Elizabeth City State Marching Sound of Class", school: "Elizabeth City State University", keywords: ["ecsu", "sound of class", "ciaa", "vikings"] },
  { name: "Fayetteville State Marching Bronco Express", school: "Fayetteville State University", keywords: ["fayetteville state", "bronco express", "ciaa", "broncos", "blue and white machine"] },
  { name: "Shaw University Platinum Sound", school: "Shaw University", keywords: ["shaw university", "platinum sound", "ciaa", "raleigh", "bears"] },
  { name: "Virginia Union Ambassadors of Sound", school: "Virginia Union University", keywords: ["virginia union", "ambassadors of sound", "ciaa", "richmond", "panthers", "vuu"] },
  { name: "Johnson C. Smith International Institution of Sound", school: "Johnson C. Smith University", keywords: ["jcsu", "international institution of sound", "iiovs", "ciaa", "charlotte"] },
  { name: "Livingstone College Blue Thunder", school: "Livingstone College", keywords: ["livingstone", "blue thunder", "ciaa", "blue bears"] },
  { name: "Lincoln University Orange Crush", school: "Lincoln University", keywords: ["lincoln university", "orange crush", "ciaa", "pennsylvania", "lions"] },
  { name: "Bluefield State Blue Soul Marching Band", school: "Bluefield State University", keywords: ["bluefield state", "blue soul", "ciaa", "west virginia"] },
  { name: "Miles College Purple Marching Machine", school: "Miles College", keywords: ["miles college", "purple marching machine", "siac", "pmm", "purple machine"] },
  { name: "Tuskegee University Golden Voices", school: "Tuskegee University", keywords: ["tuskegee", "golden voices", "marching crimson pipers", "siac", "tu", "mcp", "crimson piper", "golden tigers"] },
  { name: "Albany State Marching Rams Show Band", school: "Albany State University", keywords: ["albany state", "marching rams", "siac", "asu", "mrsb", "marching rams show band", "golden rams"] },
  { name: "Benedict College Band of Distinction", school: "Benedict College", keywords: ["benedict college", "band of distinction", "siac", "tigers"] },
  { name: "Fort Valley State Blue Machine", school: "Fort Valley State University", keywords: ["fort valley state", "blue machine", "siac", "wildcats"] },
  { name: "Savannah State Powerhouse of the South", school: "Savannah State University", keywords: ["savannah state", "powerhouse of the south", "siac", "tigers", "ssu"] },
  { name: "Clark Atlanta Mighty Marching Panthers", school: "Clark Atlanta University", keywords: ["clark atlanta", "mighty marching panthers", "siac", "atlanta", "cau", "mighty marching panther band", "panthers"] },
  { name: "Morehouse College House of Funk", school: "Morehouse College", keywords: ["morehouse", "house of funk", "siac", "maroon tigers"] },
  { name: "Central State Invincible Marching Marauders", school: "Central State University", keywords: ["central state", "invincible marching marauders", "siac", "marauders"] },
  { name: "Kentucky State Mighty Marching Thorobreds", school: "Kentucky State University", keywords: ["kentucky state", "mighty marching thorobreds", "siac", "thorobreds"] },
  { name: "Lane College Quiet Storm", school: "Lane College", keywords: ["lane college", "quiet storm", "siac", "dragons"] },
  { name: "Edward Waters Triple Threat Marching Band", school: "Edward Waters University", keywords: ["edward waters", "triple threat", "siac", "tigers", "ewu"] },
  { name: "North Carolina A&T Blue and Gold Marching Machine", school: "North Carolina A&T State University", keywords: ["nc a&t", "blue and gold", "marching machine", "caa", "bgmm", "north carolina a&t", "aggies"] },
  { name: "Hampton University Marching Force", school: "Hampton University", keywords: ["hampton university", "marching force", "caa", "pirates"] },
  { name: "Tennessee State Aristocrat of Bands", school: "Tennessee State University", keywords: ["tennessee state", "aristocrat of bands", "ovc", "aob", "tsu", "tigers"] },
  { name: "Talladega College Great Tornado", school: "Talladega College", keywords: ["talladega", "great tornado", "marching band"] },
  { name: "Langston University Marching Pride", school: "Langston University", keywords: ["langston", "marching pride", "lump", "lions"] },
  { name: "Florida Memorial The Roar", school: "Florida Memorial University", keywords: ["florida memorial", "the roar", "fmu", "lions"] },
  { name: "Allen University Band of Gold", school: "Allen University", keywords: ["allen university", "band of gold", "au", "yellow jackets"] },
  { name: "Fisk University Music City Sound", school: "Fisk University", keywords: ["fisk university", "music city sound", "bulldogs"] },
  { name: "Wiley University Marching Grandioso", school: "Wiley University", keywords: ["wiley", "marching grandioso", "wildcats"] },
  { name: "Saint Augustine's Superior Sound", school: "Saint Augustine's University", keywords: ["saint augustine", "superior sound", "falcons"] },
  { name: "Rust College Marching Bearcats", school: "Rust College", keywords: ["rust college", "marching bearcats", "mississippi"] },
  { name: "Texas College Marching Steers", school: "Texas College", keywords: ["texas college", "marching steers", "tyler", "texas"] },
  { name: "Tougaloo College Marching Band", school: "Tougaloo College", keywords: ["tougaloo", "marching band", "jacktown", "mississippi"] },
];

const ALL_STAR_BANDS = [
  { name: "Georgia All-Star Mass Band", aliases: ["aamb", "georgia mass band", "gmb", "atlanta all-star", "atlanta mass band", "georgia all-star", "ga mass band", "gamb", "georgia mass"] },
  { name: "New Orleans All-Star Band", aliases: ["noasb", "new orleans all-star", "nola all-star", "new orleans all star", "nola allstar", "nola all star"] },
  { name: "Mississippi All-Star Alumni Band", aliases: ["maab", "mississippi all-star alumni", "mississippi all-star", "ms all-star", "mississippi mass"] },
  { name: "Dallas Legion All-Star Band", aliases: ["dlasb", "the legion", "dallas legion", "dallas all-star", "dallas all star", "dfw all-star"] },
  { name: "Broward All-Star Band", aliases: ["broward all-star", "broward all star", "south florida all-star"] },
  { name: "Austin All-Star Band", aliases: ["austin all-star", "austin all star", "atx all-star"] },
  { name: "Alabama Mass Band", aliases: ["alabama all-star", "alabama mass band", "bama mass band", "alabama mass"] },
  { name: "Magic City All-Star Band", aliases: ["magic city all-star", "magic city", "birmingham all-star", "bham all-star", "birmingham mass"] },
  { name: "Memphis Mass Band", aliases: ["memphis mass", "mmb", "memphis mass band", "memphis all-star", "real memphis mass"] },
  { name: "The Regulators", aliases: ["regulators", "the regulators"] },
  { name: "North Carolina Mass Band", aliases: ["nc mass band", "north carolina all-star", "nc all-star", "north carolina mass band", "carolina mass"] },
  { name: "LLI All-Star Band", aliases: ["lli", "lli all-star"] },
  { name: "Houston All-Star Band", aliases: ["houston all-star", "houston all star", "htx all-star", "houston mass"] },
  { name: "Charlotte All-Star Band", aliases: ["charlotte all-star", "clt all star", "queen city all-star", "charlotte mass"] },
];

const FALLBACK_EXTRACTION: LibrarianExtraction = {
  isHbcuBandContent: true,
  videoCategory: 'OTHER',
  isBattle: false,
  confidence: 0,
};

@Injectable()
export class BandLibrarianService {
  private readonly logger = new Logger(BandLibrarianService.name);
  private readonly client: Anthropic;
  private readonly systemPrompt: string;

  constructor(private configService: ConfigService) {
    const apiKey = configService.get<string>('ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey });
    this.systemPrompt = this.buildSystemPrompt();
  }

  async classify(input: {
    title: string;
    description: string;
    tags: string[];
    channelTitle: string;
  }): Promise<LibrarianExtraction> {
    const { title, description, tags, channelTitle } = input;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
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
            content: `Title: ${title}\nChannel: ${channelTitle}\nDescription: ${description.slice(0, 500)}\nTags: ${tags.join(', ')}`,
          },
        ],
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      // Strip markdown code fences if present
      const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonText) as LibrarianExtraction;
      return parsed;
    } catch (err) {
      this.logger.warn(`Librarian classification failed for "${title}": ${err}`);
      return FALLBACK_EXTRACTION;
    }
  }

  private buildSystemPrompt(): string {
    const hbcuList = HBCU_BANDS.map(
      (b) => `- ${b.name} | School: ${b.school} | Also known as: ${b.keywords.join(', ')}`,
    ).join('\n');

    const allStarList = ALL_STAR_BANDS.map(
      (b) => `- ${b.name} | Aliases: ${b.aliases.join(', ')}`,
    ).join('\n');

    return `You are the HBCU Band Librarian — an expert cataloger of HBCU marching band videos.

Given YouTube video metadata, extract structured information and return ONLY valid JSON.

## KNOWN HBCU BANDS
${hbcuList}

## KNOWN ALL-STAR BANDS
${allStarList}

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
Exclude (isHbcuBandContent: false) if the video is:
- HIGH SCHOOL: mentions "high school", "hs band", "freshman/sophomore/senior band",
  "varsity band", "pep band", "prep school", specific high school names,
  "Bands of America", "BOA", grade levels (9th, 10th, 11th, 12th grade)
- MIDDLE SCHOOL: "middle school", "junior high", "elementary", youth band
- DRUM CORPS: DCI, "drum corps", "corps" competition content (not HBCU bands)
- NON_BAND_SCHOOL: sports highlights, campus tours, graduation ceremonies,
  commencement, choir concerts, step shows, Greek shows, athletics content
- PODCAST: interview shows, reaction videos, talk shows, vlogs
- UNRELATED: nothing to do with HBCU marching bands

## IMPORTANT RULES
- "Homecoming" without other context = HALFTIME
- "vs" or "versus" = likely STAND_BATTLE, set isBattle: true
- If from a known band's channel but title is vague (e.g. "Fall Review"), still include it
- primaryBandName MUST exactly match one of the names in the KNOWN HBCU BANDS or ALL-STAR BANDS lists above, or be omitted
- confidence: your certainty 0-100 that the classification is correct

## OUTPUT FORMAT
Return ONLY this JSON, no other text:
{
  "isHbcuBandContent": boolean,
  "exclusionReason": "high_school" | "middle_school" | "non_band_school" | "drum_corps" | "podcast" | "unrelated" | null,
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
