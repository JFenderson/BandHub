import { PrismaClient, BandType } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    name: 'Stand Battle',
    slug: 'stand-battle',
    description: 'Bands competing in the stands',
    applicableTypes: [BandType.HBCU, BandType.ALL_STAR], // Use enum, not strings
  },
  {
    name: 'Field Playing',
    slug: 'field-playing',
    description: 'On-field performances and battles',
    applicableTypes: [BandType.HBCU, BandType.ALL_STAR],
  },
  
  // All-Star and HBCU categories
  {
    name: 'Entrance',
    slug: 'entrance',
    description: 'Band entrance before the games',
    applicableTypes: [BandType.HBCU, BandType.ALL_STAR],
  },
  {
    name: 'Exit',
    slug: 'exit',
    description: 'Band exit performances after the games',
    applicableTypes: [BandType.HBCU, BandType.ALL_STAR],
  },
  {
    name: 'Percussion Feature',
    slug: 'percussion-feature',
    description: 'Drumline and percussion showcases',
    applicableTypes: [BandType.HBCU, BandType.ALL_STAR],
  },
  
  // HBCU only categories
  {
    name: '5th Quarter',
    slug: '5th-quarter',
    description: 'Post-game performances',
    applicableTypes: [BandType.HBCU],
  },
  {
    name: 'Halftime Show',
    slug: 'halftime-show',
    description: 'Halftime field performances',
    applicableTypes: [BandType.HBCU],
  },
  {
    name: 'Parade',
    slug: 'parade',
    description: 'Parade performances',
    applicableTypes: [BandType.HBCU, BandType.ALL_STAR], // Rare but possible
  },
  {
    name: 'Practice',
    slug: 'practice',
    description: 'Practice sessions and rehearsals',
    applicableTypes: [BandType.HBCU, BandType.ALL_STAR],
  },
  {
    name: 'Concert',
    slug: 'concert',
    description: 'Concert band and indoor performances',
    applicableTypes: [BandType.HBCU],
  },
  {
    name: 'Zero Quarter',
    slug: 'zero-quarter',
    description: 'Zero quarter performances',
    applicableTypes: [BandType.HBCU],
  },
  {
    name: 'Other',
    slug: 'other',
    description: 'Other band-related content',
    applicableTypes: [BandType.HBCU, BandType.ALL_STAR],
  },
];

export async function seedCategories(prisma: PrismaClient) {
  console.log('Seeding categories...');
  
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { applicableTypes: category.applicableTypes },
      create: category,
    });
  }
  
  console.log(`Seeded ${categories.length} categories`);
}