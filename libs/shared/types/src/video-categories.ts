export const CATEGORY_PATTERNS: Array<{
  category: string;
  patterns: RegExp[];
  weight: number;
}> = [
  {
    category: '5th-quarter',
    patterns: [
      /5th\s*quarter/i,
      /fifth\s*quarter/i,
      /after\s*the\s*game/i,
      /post\s*game/i,
    ],
    weight: 10,
  },
  {
    category: 'stand-battle',
    patterns: [
      /stand\s*battle/i,
      /stands?\s*vs\.?/i,
      /battle\s*of\s*(the\s*)?bands/i,
      /band\s*battle/i,
    ],
    weight: 9,
  },
  {
    category: 'field-show',
    patterns: [
      /field\s*show/i,
      /marching\s*show/i,
      /drill\s*team/i,
      /formation/i,
    ],
    weight: 8,
  },
  {
    category: 'halftime',
    patterns: [
      /half\s*time/i,
      /halftime/i,
    ],
    weight: 7,
  },
  {
    category: 'pregame',
    patterns: [
      /pre\s*game/i,
      /pregame/i,
      /before\s*the\s*game/i,
    ],
    weight: 7,
  },
  {
    category: 'parade',
    patterns: [
      /parade/i,
      /marching\s*down/i,
      /homecoming\s*parade/i,
    ],
    weight: 6,
  },
  {
    category: 'practice',
    patterns: [
      /practice/i,
      /rehearsal/i,
      /band\s*room/i,
      /sectional/i,
    ],
    weight: 5,
  },
  {
    category: 'concert',
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