import { PrismaClient } from '@prisma/client';

interface CreateData {
    name: string;
    youtubeChannelId: string;
    channelUrl: string;
    description: string;
    logoUrl: string | null;
    thumbnailUrl: string | null;
    subscriberCount: number;
    totalVideoCount: number;
    videosInOurDb: number;
    isVerified: boolean;
    isFeatured: boolean;
    qualityScore: number;
}

const allCreators: CreateData[] = [
 {
      name: 'Killa Kev Productions',
      youtubeChannelId: 'UCg5f2-2Ym47GlOepGdoZn7A',
      channelUrl: 'https://www.youtube.com/@KillaKevProd',
      description: 'Legendary HBCU band videographer.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 95,
    },
    // TODO: fill youtubeChannelId via YouTube Data API
    {
      name: 'ShowtimeWeb',
      youtubeChannelId: '',
      channelUrl: 'https://www.youtube.com/@ShowtimeWeb',
      description: 'One of the biggest HBCU and show-style marching band channels.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 96,
    },
    // TODO: fill youtubeChannelId via YouTube Data API
    {
      name: 'MarchingSport',
      youtubeChannelId: '',
      channelUrl: 'https://www.youtube.com/@MarchingsportHD',
      description: 'Historic HBCU marching band archive and coverage.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 94,
    },
    // TODO: fill youtubeChannelId via YouTube Data API
    {
      name: 'A1 Media Bands',
      youtubeChannelId: '',
      channelUrl: 'https://www.youtube.com/@A1MediaBands',
      description: 'High-quality marching band coverage across high school and college.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 90,
    },
    {
      name: 'Smash Time Productions',
      youtubeChannelId: 'UCQTIn5MfgEkBTbGRghv2MyQ',
      channelUrl: 'https://www.youtube.com/@SmashTimeProductions',
      description: 'Event coverage, band battles, and dance / majorette content.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 88,
    },
    {
      name: 'BandTube High Definition',
      youtubeChannelId: 'UCR2Cb125Cm2R7X35LuP9rjg',
      channelUrl: 'https://www.youtube.com/@BandTubeHD',
      description: 'High-definition coverage of marching bands and BOTBs.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 92,
    },
    // TODO: fill youtubeChannelId via YouTube Data API
    {
      name: 'JSU Bands',
      youtubeChannelId: '',
      channelUrl: 'https://www.youtube.com/@JSUBands',
      description: 'Official media for Jackson State’s Sonic Boom of the South.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 93,
    },
    // TODO: fill youtubeChannelId via YouTube Data API
    {
      name: 'Human Jukebox Media',
      youtubeChannelId: '',
      channelUrl: 'https://www.youtube.com/@su_humanjukebox',
      description: 'Southern University Human Jukebox official media channel.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 93,
    },
    {
      name: 'AAMU Marching Maroon & White',
      youtubeChannelId: 'UCWeUjEMXg_IjJvuk5Dm7-zQ',
      channelUrl: 'https://www.youtube.com/@AAMUBAND',
      description: 'Official channel for Alabama A&M University’s Marching Maroon & White.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 87,
    },
];


export async function seedCreators(prisma: PrismaClient) {
console.log('Seeding content creators...');
let added = 0;
let updated = 0;

  for (const creator of allCreators) {
const result = await prisma.contentCreator.upsert({
      where: { youtubeChannelId: creator.youtubeChannelId },
      update: creator,
      create: creator,
    });

    if (result.createdAt === result.updatedAt) {
      added++;
      console.log(`✅ Added: ${creator.name}`);
    } else {
      updated++;
      console.log(`🔄 Updated: ${creator.name}`);
    }
  }

  console.log(`\n🎉 Seeding complete!`);
  console.log(`   Added: ${added} creators`);
  console.log(`   Updated: ${updated} creators`);
  console.log(`   Total: ${allCreators.length} creators`);
}

