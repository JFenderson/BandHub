import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class CategoriesSeedService {
  constructor(private db: DatabaseService) {}

  async seedCategories() {
    console.log('🎭 Seeding video categories...');

    const categories = [
      {
        name: '5th Quarter',
        slug: '5th-quarter',
        description: 'Post-game performances and band battles',
        sortOrder: 1,
      },
      {
        name: 'Field Show',
        slug: 'field-show',
        description: 'Halftime performances and field shows',
        sortOrder: 2,
      },
      {
        name: 'Stand Battle',
        slug: 'stand-battle',
        description: 'Band battles and stand performances',
        sortOrder: 3,
      },
      {
        name: 'Parade',
        slug: 'parade',
        description: 'Parade performances and marching',
        sortOrder: 4,
      },
      {
        name: 'Practice',
        slug: 'practice',
        description: 'Practice sessions and rehearsals',
        sortOrder: 5,
      },
      {
        name: 'Concert Band',
        slug: 'concert-band',
        description: 'Concert performances and indoor shows',
        sortOrder: 6,
      },
      {
        name: 'Pep Rally',
        slug: 'pep-rally',
        description: 'Pep rallies and school spirit events',
        sortOrder: 7,
      },
      {
        name: 'Other',
        slug: 'other',
        description: 'Other band-related content',
        sortOrder: 99,
      },
    ];

    for (const categoryData of categories) {
      const category = await this.db.category.upsert({
        where: { slug: categoryData.slug },
        update: categoryData,
        create: categoryData,
      });

      console.log(`✅ Seeded category: ${category.name}`);
    }

    console.log('🎉 Category seeding complete!');
  }
}