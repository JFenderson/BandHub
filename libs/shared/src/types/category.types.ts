export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_CATEGORIES = [
  { name: '5th Quarter', slug: '5th-quarter', sortOrder: 1 },
  { name: 'Field Show', slug: 'field-show', sortOrder: 2 },
  { name: 'Stand Battle', slug: 'stand-battle', sortOrder: 3 },
  { name: 'Parade', slug: 'parade', sortOrder: 4 },
  { name: 'Practice', slug: 'practice', sortOrder: 5 },
  { name: 'Concert Band', slug: 'concert-band', sortOrder: 6 },
] as const;