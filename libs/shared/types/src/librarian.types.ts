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
  primaryBandName?: string;
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
