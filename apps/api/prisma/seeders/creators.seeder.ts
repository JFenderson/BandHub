import { PrismaClient } from '@prisma/client';

export async function seedCreators(prisma: PrismaClient) {
  const creators = [
    {
      name: 'KillaKev',
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
    {
      name: 'CrabHBCU',
      youtubeChannelId: 'UCxxxxxxxxxx2',
      channelUrl: 'https://www.youtube.com/channel/UCxxxxxxxxxx2',
      description: 'High-quality HBCU band coverage.',
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
      name: 'HBCU Bandhead',
      youtubeChannelId: 'UCxxxxxxxxxx3',
      channelUrl: 'https://www.youtube.com/channel/UCxxxxxxxxxx3',
      description: 'Consistent uploads of HBCU band events.',
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
      name: 'Fifth Quarter TV',
      youtubeChannelId: 'UCxxxxxxxxxx4',
      channelUrl: 'https://www.youtube.com/channel/UCxxxxxxxxxx4',
      description: 'Fifth Quarter battles and more.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 85,
    },
    {
      name: 'Band Room Network',
      youtubeChannelId: 'UCxxxxxxxxxx5',
      channelUrl: 'https://www.youtube.com/channel/UCxxxxxxxxxx5',
      description: 'Band Room Network official channel.',
      logoUrl: null,
      thumbnailUrl: null,
      subscriberCount: 0,
      totalVideoCount: 0,
      videosInOurDb: 0,
      isVerified: true,
      isFeatured: true,
      qualityScore: 80,
    },
    // Add 10-15 more creators here with real channel IDs
  ];

  for (const creator of creators) {
    await prisma.contentCreator.upsert({
      where: { youtubeChannelId: creator.youtubeChannelId },
      update: creator,
      create: creator,
    });
  }
}
