import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    name: '5th Quarter',
    slug: '5th-quarter',
    description: 'Post-game performances in the stands',
    sortOrder: 1,
  },
  {
    name: 'Field Show',
    slug: 'field-show',
    description: 'Halftime and competition field performances',
    sortOrder: 2,
  },
  {
    name: 'Stand Battle',
    slug: 'stand-battle',
    description: 'Band battles in the stands during games',
    sortOrder: 3,
  },
  {
    name: 'Halftime',
    slug: 'halftime',
    description: 'Halftime show performances',
    sortOrder: 4,
  },
  {
    name: 'Pregame',
    slug: 'pregame',
    description: 'Pre-game performances and entrances',
    sortOrder: 5,
  },
  {
    name: 'Parade',
    slug: 'parade',
    description: 'Parade and marching performances',
    sortOrder: 6,
  },
  {
    name: 'Practice',
    slug: 'practice',
    description: 'Practice sessions and rehearsals',
    sortOrder: 7,
  },
  {
    name: 'Concert',
    slug: 'concert',
    description: 'Concert band and indoor performances',
    sortOrder: 8,
  },
  {
    name: 'Other',
    slug: 'other',
    description: 'Other band-related content',
    sortOrder: 99,
  },
];

async function seedCategories() {
  console.log('Seeding categories...');
  
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }
  
  console.log(`Seeded ${categories.length} categories`);
}

seedCategories()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });