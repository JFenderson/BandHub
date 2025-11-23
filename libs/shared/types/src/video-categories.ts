// Video category type definition
export type VideoCategory =
  | 'FIFTH_QUARTER'
  | 'FIELD_SHOW'
  | 'STAND_BATTLE'
  | 'PARADE'
  | 'PRACTICE'
  | 'CONCERT_BAND'
  | 'HALFTIME'
  | 'ENTRANCE'
  | 'PREGAME'
  | 'OTHER';

// Category pattern matching for auto-categorization
export const CATEGORY_PATTERNS: Array<{
  category: string;
  patterns: RegExp[];
  weight: number;
}> = [
  {
    category: 'FIFTH_QUARTER', // Changed to match enum
    patterns: [
      /5th\s*quarter/i,
      /fifth\s*quarter/i,
      /after\s*the\s*game/i,
      /post\s*game/i,
    ],
    weight: 10,
  },
  {
    category: 'STAND_BATTLE', // Changed to match enum
    patterns: [
      /stand\s*battle/i,
      /stands?\s*vs\.?/i,
      /battle\s*of\s*(the\s*)?bands/i,
      /band\s*battle/i,
    ],
    weight: 9,
  },
  {
    category: 'FIELD_SHOW', // Changed to match enum
    patterns: [
      /field\s*show/i,
      /marching\s*show/i,
      /drill\s*team/i,
      /formation/i,
    ],
    weight: 8,
  },
  {
    category: 'HALFTIME', // Changed to match enum
    patterns: [
      /half\s*time/i,
      /halftime/i,
    ],
    weight: 7,
  },
  {
    category: 'PREGAME', // Changed to match enum
    patterns: [
      /pre\s*game/i,
      /pregame/i,
      /before\s*the\s*game/i,
    ],
    weight: 7,
  },
  {
    category: 'ENTRANCE', // Added for completeness
    patterns: [
      /entrance/i,
      /entering/i,
      /arrival/i,
    ],
    weight: 6,
  },
  {
    category: 'PARADE', // Changed to match enum
    patterns: [
      /parade/i,
      /marching\s*down/i,
      /homecoming\s*parade/i,
    ],
    weight: 6,
  },
  {
    category: 'PRACTICE', // Changed to match enum
    patterns: [
      /practice/i,
      /rehearsal/i,
      /band\s*room/i,
      /sectional/i,
    ],
    weight: 5,
  },
  {
    category: 'CONCERT_BAND', // Changed to match enum
    patterns: [
      /concert/i,
      /spring\s*show/i,
      /indoor/i,
      /symphonic/i,
    ],
    weight: 5,
  },
];

export const IRRELEVANT_PATTERNS: RegExp[] = [
  /high\s*school/i,
  /middle\s*school/i,
  /junior\s*high/i,
  /youth\s*band/i,
  /\breaction\b/i,
  /\breact\b/i,
  /\breview\b/i,
  /gameplay/i,
  /video\s*game/i,
  /nfl/i,
  /\bnba\b/i,
];

export const EVENT_PATTERNS = {
  versus: /(\w+(?:\s+\w+)*)\s+(?:vs\.?|versus)\s+(\w+(?:\s+\w+)*)/i,
  eventYear: /(homecoming|classic|invitational|bowl|championship)\s*(\d{4})/i,
  date: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
  venue: /(?:at|@)\s+([A-Z][A-Za-z\s]+(?:Stadium|Field|Arena|Center))/,
};