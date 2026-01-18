import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BandData {
  name: string;
  slug: string;
  schoolName: string;
  city: string;
  state: string;
  conference?: string;
  foundedYear?: number;
  description?: string;
  youtubeChannelId?: string | null;
  youtubePlaylistIds?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
}

const allHBCUBands: BandData[] = [
  // Alabama
  {
    name: 'Marching Maroon and White',
    slug: 'alabama-am-maroon-white',
    schoolName: 'Alabama A&M University',
    city: 'Huntsville',
    state: 'Alabama',
    conference: 'SWAC',
    foundedYear: 1875,
    description: 'The Marching Maroon and White represents Alabama A&M University with pride and precision.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'Mighty Marching Hornets',
    slug: 'mighty-marching-hornets',
    schoolName: 'Alabama State University',
    city: 'Montgomery',
    state: 'Alabama',
    conference: 'SWAC',
    foundedYear: 1867,
    description: 'The Mighty Marching Hornets are recognized for their precision marching and musical excellence.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'Purple Marching Machine',
    slug: 'purple-marching-machine',
    schoolName: 'Miles College',
    city: 'Fairfield',
    state: 'Alabama',
    conference: 'SIAC',
    foundedYear: 1898,
    description: 'The Purple Marching Machine brings energy and excellence to Miles College.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'Marching Crimson Piper',
    slug: 'marching-crimson-piper',
    schoolName: 'Tuskegee University',
    city: 'Tuskegee',
    state: 'Alabama',
    conference: 'SIAC',
    foundedYear: 1881,
    description: 'The Marching Crimson Piper is the pride of Tuskegee University.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },

  // Arkansas
  {
    name: 'Marching Musical Machine',
    slug: 'uapb-marching-musical-machine',
    schoolName: 'University of Arkansas at Pine Bluff',
    city: 'Pine Bluff',
    state: 'Arkansas',
    conference: 'SWAC',
    foundedYear: 1873,
    description: 'The Marching Musical Machine of UAPB is known for their dynamic performances.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },

  // Delaware
  {
    name: 'Approaching Storm',
    slug: 'approaching-storm',
    schoolName: 'Delaware State University',
    city: 'Dover',
    state: 'Delaware',
    conference: 'MEAC',
    foundedYear: 1891,
    description: 'The Approaching Storm brings thunder to Delaware State performances.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },

  // District of Columbia
  {
    name: 'Showtime Marching Band',
    slug: 'showtime-marching-band',
    schoolName: 'Howard University',
    city: 'Washington',
    state: 'District of Columbia',
    conference: 'MEAC',
    foundedYear: 1867,
    description: 'Howard University Showtime Marching Band is one of the most prestigious HBCU bands.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },

  // Florida
  {
    name: 'Marching Wildcats',
    slug: 'marching-wildcats',
    schoolName: 'Bethune-Cookman University',
    city: 'Daytona Beach',
    state: 'Florida',
    conference: 'SWAC',
    foundedYear: 1904,
    description: 'The Marching Wildcats are known for their high-energy performances and signature dance routines.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'Marching 100',
    slug: 'marching-100',
    schoolName: 'Florida A&M University',
    city: 'Tallahassee',
    state: 'Florida',
    conference: 'SWAC',
    foundedYear: 1887,
    description: 'The legendary Marching 100, known for their innovative high-stepping style and precision.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },

  // Georgia
  {
    name: 'Marching Rams',
    slug: 'albany-state-marching-rams',
    schoolName: 'Albany State University',
    city: 'Albany',
    state: 'Georgia',
    conference: 'SIAC',
    foundedYear: 1903,
    description: 'The Albany State Marching Rams represent their university with pride.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'Mighty Marching Panther Band',
    slug: 'mighty-marching-panther-band',
    schoolName: 'Clark Atlanta University',
    city: 'Atlanta',
    state: 'Georgia',
    conference: 'SIAC',
    foundedYear: 1988,
    description: 'Clark Atlanta University Mighty Marching Panther Band brings energy to the Atlanta University Center.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'Blue Machine',
    slug: 'blue-machine',
    schoolName: 'Fort Valley State University',
    city: 'Fort Valley',
    state: 'Georgia',
    conference: 'SIAC',
    foundedYear: 1895,
    description: 'The Blue Machine Marching Band is a powerhouse of sound and precision.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'House of Funk',
    slug: 'house-of-funk',
    schoolName: 'Morehouse College',
    city: 'Atlanta',
    state: 'Georgia',
    conference: 'SIAC',
    foundedYear: 1867,
    description: 'Morehouse College House of Funk brings sophisticated musicianship to every performance.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'Powerhouse of the South',
    slug: 'powerhouse-of-the-south',
    schoolName: 'Savannah State University',
    city: 'Savannah',
    state: 'Georgia',
    conference: 'SIAC',
    foundedYear: 1890,
    description: 'Savannah State Powerhouse of the South delivers powerful performances.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },

  // Louisiana
  {
    name: 'World Famed',
    slug: 'world-famed',
    schoolName: 'Grambling State University',
    city: 'Grambling',
    state: 'Louisiana',
    conference: 'SWAC',
    foundedYear: 1926,
    description: 'The World Famed Tiger Marching Band from Grambling State University is one of the oldest HBCU bands with a rich tradition.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'Human Jukebox',
    slug: 'human-jukebox',
    schoolName: 'Southern University',
    city: 'Baton Rouge',
    state: 'Louisiana',
    conference: 'SWAC',
    foundedYear: 1947,
    description: 'The Human Jukebox, officially known as the Southern University Marching Band, is famous for their musical versatility and crowd engagement.',
    youtubeChannelId: 'UCmV4mlNNrLQvLCi5qfj8s9A',
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },

  // Maryland
  {
    name: 'Marching Bulldogs',
    slug: 'bowie-state-marching-bulldogs',
    schoolName: 'Bowie State University',
    city: 'Bowie',
    state: 'Maryland',
    conference: 'CIAA',
    foundedYear: 1865,
    description: 'Bowie State Marching Bulldogs represent their university with distinction.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'Magnificent Marching Machine',
    slug: 'magnificent-marching-machine',
    schoolName: 'Morgan State University',
    city: 'Baltimore',
    state: 'Maryland',
    conference: 'MEAC',
    foundedYear: 1867,
    description: 'Morgan State Magnificent Marching Machine is a Baltimore tradition.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },

  // Mississippi
  {
    name: 'Sounds of Dyn-O-Mite',
    slug: 'sounds-of-dyn-o-mite',
    schoolName: 'Alcorn State University',
    city: 'Lorman',
    state: 'Mississippi',
    conference: 'SWAC',
    foundedYear: 1871,
    description: 'Alcorn State Sounds of Dyn-O-Mite bring explosive performances.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'Sonic Boom of the South',
    slug: 'sonic-boom-of-the-south',
    schoolName: 'Jackson State University',
    city: 'Jackson',
    state: 'MS',
    conference: 'SWAC',
    foundedYear: 1946,
    description: 'The Sonic Boom of the South is the marching band of Jackson State University, known for their powerful sound and innovative halftime shows.',
    youtubeChannelId: 'UC9vK8FqGQCGEKJQao-8-_Dw',
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'Mean Green Marching Machine',
    slug: 'mean-green-marching-machine',
    schoolName: 'Mississippi Valley State University',
    city: 'Itta Bena',
    state: 'Mississippi',
    conference: 'SWAC',
    foundedYear: 1950,
    description: 'MVSU Mean Green Marching Machine represents the Delta with pride.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },

  // North Carolina
  {
    name: 'Sound of Class',
    slug: 'sound-of-class',
    schoolName: 'Elizabeth City State University',
    city: 'Elizabeth City',
    state: 'North Carolina',
    conference: 'CIAA',
    foundedYear: 1891,
    description: 'ECSU Sound of Class brings sophistication to every performance.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'Blue and White Machine',
    slug: 'blue-and-white-machine',
    schoolName: 'Fayetteville State University',
    city: 'Fayetteville',
    state: 'North Carolina',
    conference: 'CIAA',
    foundedYear: 1867,
    description: 'Fayetteville State Blue and White Machine is a CIAA powerhouse.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'Blue and Gold Marching Machine',
    slug: 'blue-and-gold-marching-machine',
    schoolName: 'North Carolina A&T State University',
    city: 'Greensboro',
    state: 'North Carolina',
    conference: 'CAA',
    foundedYear: 1891,
    description: 'NC A&T Blue and Gold Marching Machine is one of the largest HBCU bands.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'Sound Machine',
    slug: 'sound-machine',
    schoolName: 'North Carolina Central University',
    city: 'Durham',
    state: 'North Carolina',
    conference: 'MEAC',
    foundedYear: 1910,
    description: 'NCCU Sound Machine delivers powerful performances in the Triangle.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
  {
    name: 'Red Sea of Sound',
    slug: 'red-sea-of-sound',
    schoolName: 'Winston-Salem State University',
    city: 'Winston-Salem',
    state: 'North Carolina',
    conference: 'CIAA',
    foundedYear: 1892,
    description: 'Winston-Salem State Red Sea of Sound floods stadiums with music.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },

  // Ohio
  {
    name: 'Marching Marauders',
    slug: 'marching-marauders',
    schoolName: 'Central State University',
    city: 'Wilberforce',
    state: 'Ohio',
    conference: 'SIAC',
    foundedYear: 1887,
    description: 'Central State Marching Marauders represent Ohio HBCU excellence.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },

  // Oklahoma
  {
    name: 'Marching Pride',
    slug: 'marching-pride',
    schoolName: 'Langston University',
    city: 'Langston',
    state: 'Oklahoma',
    conference: 'Independent',
    foundedYear: 1897,
    description: 'Langston University Marching Pride represents Oklahoma HBCUs.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },

  // South Carolina
  {
    name: '101',
    slug: '101-band',
    schoolName: 'South Carolina State University',
    city: 'Orangeburg',
    state: 'South Carolina',
    conference: 'MEAC',
    foundedYear: 1896,
    description: 'The legendary 101 Band from SC State is known for their precision and musicality.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },

  // Tennessee
  {
    name: 'Aristocrat of Bands',
    slug: 'aristocrat-of-bands',
    schoolName: 'Tennessee State University',
    city: 'Nashville',
    state: 'Tennessee',
    conference: 'OVC',
    foundedYear: 1912,
    description: 'Tennessee State Aristocrat of Bands is one of the most decorated HBCU bands.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },

  // Texas
  {
    name: 'Marching Storm',
    slug: 'marching-storm',
    schoolName: 'Prairie View A&M University',
    city: 'Prairie View',
    state: 'Texas',
    conference: 'SWAC',
    foundedYear: 1876,
    description: 'Prairie View A&M Marching Storm brings Texas-sized energy.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'Ocean of Soul',
    slug: 'ocean-of-soul',
    schoolName: 'Texas Southern University',
    city: 'Houston',
    state: 'Texas',
    conference: 'SWAC',
    foundedYear: 1927,
    description: 'Texas Southern Ocean of Soul is a Houston tradition.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },

  // Virginia
  {
    name: 'Force',
    slug: 'the-force',
    schoolName: 'Hampton University',
    city: 'Hampton',
    state: 'Virginia',
    conference: 'CAA',
    foundedYear: 1868,
    description: 'Hampton University The Force is a powerhouse in Virginia.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'Spartan Legion',
    slug: 'spartan-legion',
    schoolName: 'Norfolk State University',
    city: 'Norfolk',
    state: 'Virginia',
    conference: 'MEAC',
    foundedYear: 1935,
    description: 'The Spartan Legion represents Norfolk State University with powerful performances in the MEAC conference.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: true,
  },
  {
    name: 'Trojan Explosion',
    slug: 'trojan-explosion',
    schoolName: 'Virginia State University',
    city: 'Petersburg',
    state: 'Virginia',
    conference: 'CIAA',
    foundedYear: 1882,
    description: 'Virginia State Trojan Explosion brings explosive performances.',
    youtubeChannelId: null,
    youtubePlaylistIds: [],
    isActive: true,
    isFeatured: false,
  },
];

export async function seedBands(prisma: PrismaClient) {
  console.log('🌱 Seeding all HBCU bands...');

  let added = 0;
  let updated = 0;

  for (const band of allHBCUBands) {
    const result = await prisma.band.upsert({
      where: { slug: band.slug },
      update: {
        ...band,
      },
      create: {
        ...band,
      },
    });
    
    if (result.createdAt === result.updatedAt) {
      added++;
      console.log(`✅ Added: ${band.name}`);
    } else {
      updated++;
      console.log(`🔄 Updated: ${band.name}`);
    }
  }

  console.log(`\n🎉 Seeding complete!`);
  console.log(`   Added: ${added} bands`);
  console.log(`   Updated: ${updated} bands`);
  console.log(`   Total: ${allHBCUBands.length} bands`);
}
