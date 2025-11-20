import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { HBCU_BANDS } from '../../config/hbcu-bands';

@Injectable()
export class BandsSeedService {
  constructor(private db: DatabaseService) {}

  async seedBands() {
    console.log('🎺 Seeding HBCU bands...');

    for (const bandConfig of HBCU_BANDS) {
      // Create slug from name
      const slug = bandConfig.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();

      const band = await this.db.band.upsert({
        where: { slug },
        update: {
          name: bandConfig.name,
          schoolName: bandConfig.school,
          city: bandConfig.city,
          state: bandConfig.state,
          youtubeChannelId: bandConfig.channelId,
          youtubePlaylistIds: bandConfig.playlistIds || [],
        },
        create: {
          name: bandConfig.name,
          slug,
          schoolName: bandConfig.school,
          city: bandConfig.city,
          state: bandConfig.state,
          youtubeChannelId: bandConfig.channelId,
          youtubePlaylistIds: bandConfig.playlistIds || [],
          isActive: true,
        },
      });

      console.log(`✅ Seeded band: ${band.name}`);
    }

    console.log('🎉 Band seeding complete!');
  }
}