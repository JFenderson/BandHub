export type LibrarianExclusionReason =
  | 'high_school'
  | 'middle_school'
  | 'non_band_school'
  | 'drum_corps'
  | 'podcast'
  | 'unrelated';

export interface LibrarianExtraction {
  isHbcuBandContent: boolean;
  exclusionReason?: LibrarianExclusionReason;
  /** Exact DB id of the primary band. Preferred over primaryBandName for matching. */
  primaryBandId?: string;
  /** Exact DB id of the opponent band (2-band battles). */
  opponentBandId?: string;
  /** All band IDs when 3+ bands are present (includes primary and opponent). */
  participantBandIds?: string[];
  /** Whether the primary band is a marching or pep band (for same-school disambiguation). */
  bandSubtype?: 'marching' | 'pep' | 'unknown';
  /** Kept for debug logging — do not use for DB lookups. */
  primaryBandName?: string;
  /** Kept for debug logging — do not use for DB lookups. */
  opponentBandName?: string;
  videoCategory:
    | 'FIFTH_QUARTER'
    | 'STAND_BATTLE'
    | 'FIELD_SHOW'
    | 'HALFTIME'
    | 'PREGAME'
    | 'ENTRANCE'
    | 'PARADE'
    | 'PRACTICE'
    | 'CONCERT_BAND'
    | 'OTHER';
  isBattle: boolean;
  eventName?: string;
  eventYear?: number;
  confidence: number;
}
