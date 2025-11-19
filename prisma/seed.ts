import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: '5th-quarter' },
      update: {},
      create: {
        name: '5th Quarter',
        slug: '5th-quarter',
        description: 'Post-game performances in the stands after football games',
        sortOrder: 1,
      },
    }),
       prisma.category.upsert({
      where: { slug: '0-quarter' },
      update: {},
      create: {
        name: '0 Quarter',
        slug: '0-quarter',
        description: 'Pre-game performances in the stands before football games',
        sortOrder: 1,
      },
    }),
           prisma.category.upsert({
      where: { slug: 'zero-quarter' },
      update: {},
      create: {
        name: 'zero Quarter',
        slug: 'zero-quarter',
        description: 'Pre-game performances in the stands before football games',
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'field-show' },
      update: {},
      create: {
        name: 'Field Show',
        slug: 'field-show',
        description: 'Halftime performances on the football field',
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'stand-battle' },
      update: {},
      create: {
        name: 'Stand Battle',
        slug: 'stand-battle',
        description: 'Band vs band battles in the stands during games',
        sortOrder: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'parade' },
      update: {},
      create: {
        name: 'Parade',
        slug: 'parade',
        description: 'Marching performances in parades and events',
        sortOrder: 4,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'practice' },
      update: {},
      create: {
        name: 'Practice',
        slug: 'practice',
        description: 'Rehearsals and practice sessions',
        sortOrder: 5,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'concert-band' },
      update: {},
      create: {
        name: 'Concert Band',
        slug: 'concert-band',
        description: 'Indoor concert performances',
        sortOrder: 6,
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // Create sample bands
  const bands = await Promise.all([
    prisma.band.upsert({
      where: { slug: 'sonic-boom-of-the-south' },
      update: {},
      create: {
        name: 'Sonic Boom of the South',
        slug: 'sonic-boom-of-the-south',
        schoolName: 'Jackson State University',
        city: 'Jackson',
        state: 'MS',
        conference: 'SWAC',
        foundedYear: 1946,
        description: 'The Sonic Boom of the South is the marching band of Jackson State University, known for their powerful sound and innovative halftime shows.',
        youtubeChannelId: null, // Add real channel ID when ready
        youtubePlaylistIds: [],
        isActive: true,
        isFeatured: true,
      },
    }),
    prisma.band.upsert({
      where: { slug: 'human-jukebox' },
      update: {},
      create: {
        name: 'Human Jukebox',
        slug: 'human-jukebox',
        schoolName: 'Southern University',
        city: 'Baton Rouge',
        state: 'LA',
        conference: 'SWAC',
        foundedYear: 1947,
        description: 'The Human Jukebox, officially known as the Southern University Marching Band, is famous for their musical versatility and crowd engagement.',
        youtubeChannelId: null,
        youtubePlaylistIds: [],
        isActive: true,
        isFeatured: true,
      },
    }),
    prisma.band.upsert({
      where: { slug: 'world-famed' },
      update: {},
      create: {
        name: 'World Famed',
        slug: 'world-famed',
        schoolName: 'Grambling State University',
        city: 'Grambling',
        state: 'LA',
        conference: 'SWAC',
        foundedYear: 1926,
        description: 'The World Famed Tiger Marching Band from Grambling State University is one of the oldest HBCU bands with a rich tradition.',
        youtubeChannelId: null,
        youtubePlaylistIds: [],
        isActive: true,
        isFeatured: true,
      },
    }),
    prisma.band.upsert({
      where: { slug: 'marching-wildcats' },
      update: {},
      create: {
        name: 'Marching Wildcats',
        slug: 'marching-wildcats',
        schoolName: 'Bethune-Cookman University',
        city: 'Daytona Beach',
        state: 'FL',
        conference: 'SWAC',
        foundedYear: 1948,
        description: 'The Marching Wildcats are known for their high-energy performances and signature dance routines.',
        youtubeChannelId: null,
        youtubePlaylistIds: [],
        isActive: true,
        isFeatured: false,
      },
    }),
    prisma.band.upsert({
      where: { slug: 'mighty-marching-hornets' },
      update: {},
      create: {
        name: 'Mighty Marching Hornets',
        slug: 'mighty-marching-hornets',
        schoolName: 'Alabama State University',
        city: 'Montgomery',
        state: 'AL',
        conference: 'SWAC',
        foundedYear: 1954,
        description: 'The Mighty Marching Hornets are recognized for their precision marching and musical excellence.',
        youtubeChannelId: null,
        youtubePlaylistIds: [],
        isActive: true,
        isFeatured: false,
      },
    }),
    prisma.band.upsert({
      where: { slug: 'spartan-legion' },
      update: {},
      create: {
        name: 'Spartan Legion',
        slug: 'spartan-legion',
        schoolName: 'Norfolk State University',
        city: 'Norfolk',
        state: 'VA',
        conference: 'MEAC',
        foundedYear: 1960,
        description: 'The Spartan Legion represents Norfolk State University with powerful performances in the MEAC conference.',
        youtubeChannelId: null,
        youtubePlaylistIds: [],
        isActive: true,
        isFeatured: false,
      },
    }),
  ]);

  console.log(`✅ Created ${bands.length} bands`);

  // Create sample videos (with fake YouTube IDs for development)
  const sampleVideos = [
    {
      youtubeId: 'sample_video_001',
      title: 'Sonic Boom - 5th Quarter vs Southern 2023',
      description: 'Amazing 5th quarter performance at the annual rivalry game',
      thumbnailUrl: 'https://img.youtube.com/vi/sample_video_001/hqdefault.jpg',
      duration: 845,
      publishedAt: new Date('2023-11-15'),
      viewCount: 125000,
      likeCount: 3200,
      bandSlug: 'sonic-boom-of-the-south',
      opponentBandSlug: 'human-jukebox',
      categorySlug: '5th-quarter',
      eventName: 'Boombox Classic',
      eventYear: 2023,
      tags: ['rivalry', 'boombox', 'classics'],
    },
    {
      youtubeId: 'sample_video_002',
      title: 'Southern University Halftime Show - Bayou Classic 2023',
      description: 'Full halftime performance at the Bayou Classic',
      thumbnailUrl: 'https://img.youtube.com/vi/sample_video_002/hqdefault.jpg',
      duration: 1200,
      publishedAt: new Date('2023-11-25'),
      viewCount: 250000,
      likeCount: 8500,
      bandSlug: 'human-jukebox',
      opponentBandSlug: 'world-famed',
      categorySlug: 'field-show',
      eventName: 'Bayou Classic',
      eventYear: 2023,
      tags: ['bayou-classic', 'halftime', 'championship'],
    },
    {
      youtubeId: 'sample_video_003',
      title: 'Grambling State Practice Session - New Drill',
      description: 'Behind the scenes look at the band learning a new formation',
      thumbnailUrl: 'https://img.youtube.com/vi/sample_video_003/hqdefault.jpg',
      duration: 420,
      publishedAt: new Date('2023-09-10'),
      viewCount: 45000,
      likeCount: 1200,
      bandSlug: 'world-famed',
      opponentBandSlug: null,
      categorySlug: 'practice',
      eventName: null,
      eventYear: 2023,
      tags: ['behind-the-scenes', 'practice', 'drill'],
    },
    {
      youtubeId: 'sample_video_004',
      title: 'Stand Battle - Jackson State vs Alabama State 2024',
      description: 'Intense stand battle during the fourth quarter',
      thumbnailUrl: 'https://img.youtube.com/vi/sample_video_004/hqdefault.jpg',
      duration: 630,
      publishedAt: new Date('2024-10-05'),
      viewCount: 89000,
      likeCount: 2800,
      bandSlug: 'sonic-boom-of-the-south',
      opponentBandSlug: 'mighty-marching-hornets',
      categorySlug: 'stand-battle',
      eventName: 'Jackson State vs Alabama State',
      eventYear: 2024,
      tags: ['stand-battle', 'jackson-state-vs-alabama-state', 'rivalry'],
    },
    {
      youtubeId: 'sample_video_005',
      title: 'Norfolk State Homecoming Parade 2023',
      description: 'Spartan Legion marching through campus for homecoming',
      thumbnailUrl: 'https://img.youtube.com/vi/sample_video_005/hqdefault.jpg',
      duration: 540,
      publishedAt: new Date('2023-10-21'),
      viewCount: 32000,
      likeCount: 950,
      bandSlug: 'spartan-legion',
      opponentBandSlug: null,
      categorySlug: 'parade',
      eventName: 'Homecoming',
      eventYear: 2023,
      tags: ['homecoming', 'parade', 'meac'],
    },
  ];

  for (const videoData of sampleVideos) {
    const band = bands.find((b) => b.slug === videoData.bandSlug);
    const opponentBand = videoData.opponentBandSlug
      ? bands.find((b) => b.slug === videoData.opponentBandSlug)
      : null;
    const category = categories.find((c) => c.slug === videoData.categorySlug);

    if (!band) {
      console.warn(`Band not found: ${videoData.bandSlug}`);
      continue;
    }

    await prisma.video.upsert({
      where: { youtubeId: videoData.youtubeId },
      update: {},
      create: {
        youtubeId: videoData.youtubeId,
        title: videoData.title,
        description: videoData.description,
        thumbnailUrl: videoData.thumbnailUrl,
        duration: videoData.duration,
        publishedAt: videoData.publishedAt,
        viewCount: videoData.viewCount,
        likeCount: videoData.likeCount,
        bandId: band.id,
        opponentBandId: opponentBand?.id || null,
        categoryId: category?.id || null,
        eventName: videoData.eventName,
        eventYear: videoData.eventYear,
        tags: videoData.tags,
      },
    });
  }

  console.log(`✅ Created ${sampleVideos.length} sample videos`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });