// YouTube Import Script - Handles Required bandId
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { PrismaService } from '@bandhub/database';

dotenv.config();
const prisma = new PrismaService();

async function importHBCUVideos() {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  
  const youtube = google.youtube({
    version: 'v3',
    auth: API_KEY,
  });

  console.log('🎺 Starting HBCU video import...\n');

  // Step 1: Create default "Unknown Band" if it doesn't exist
  const defaultBand = await prisma.band.upsert({
    where: { slug: 'unknown-band' },
    update: {},
    create: {
      name: 'Unknown Band',
      slug: 'unknown-band',
      schoolName: 'Unknown School',
      city: 'Unknown',
      state: 'Unknown',
      isActive: false, // Don't show in main listings
    },
  });

  console.log(`🏫 Default band ready: ${defaultBand.name} (ID: ${defaultBand.id})\n`);

  // Step 2: Search for HBCU videos
  const searches = [
    'Southern University Human Jukebox marching band',
    'Jackson State Sonic Boom marching band',
    'FAMU Marching 100 Florida A&M',
    'Howard University Showtime marching band',
    'HBCU marching band 5th quarter',
  ];

  let totalVideosImported = 0;

  for (const searchTerm of searches) {
    console.log(`🔍 Searching for: "${searchTerm}"`);
    
    try {
      const response = await youtube.search.list({
        part: ['snippet'],
        q: searchTerm,
        type: ['video'],
        maxResults: 10,
        order: 'relevance',
      });

      if (response.data.items) {
        for (const item of response.data.items) {
          if (!item.id?.videoId || !item.snippet) continue;

          try {
            // Check if video already exists
            const existingVideo = await prisma.video.findUnique({
              where: { youtubeId: item.id.videoId }
            });

            if (existingVideo) {
              console.log(`   ⏭️  Skipping duplicate: ${item.snippet.title}`);
              continue;
            }

            // Detect band or use default
            const detectedBandName = detectBandFromTitle(item.snippet.title || '');
            let bandId = defaultBand.id; // Default fallback

            if (detectedBandName) {
              // Try to create/find the specific band
              const bandSlug = detectedBandName
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-');

              const specificBand = await prisma.band.upsert({
                where: { slug: bandSlug },
                update: {},
                create: {
                  name: detectedBandName,
                  slug: bandSlug,
                  schoolName: extractSchoolName(detectedBandName),
                  city: 'To Be Updated',
                  state: 'To Be Updated',
                  youtubeChannelId: item.snippet.channelId,
                  isActive: true,
                },
              });

              bandId = specificBand.id;
              console.log(`   🏫 Using band: ${specificBand.name}`);
            }

            // Create the video with required bandId
            await prisma.video.create({
              data: {
                youtubeId: item.id.videoId,
                title: item.snippet.title || 'Untitled',
                description: item.snippet.description || '',
                thumbnailUrl: item.snippet.thumbnails?.high?.url || 
                             item.snippet.thumbnails?.medium?.url || 
                             item.snippet.thumbnails?.default?.url || '',
                duration: 0, // We'll populate this later
                publishedAt: new Date(item.snippet.publishedAt || new Date()),
                bandId: bandId, // Always provide a bandId
              },
            });

            console.log(`   ✅ Imported: ${item.snippet.title}`);
            totalVideosImported++;

          } catch (error: any) {
            console.error(`   ❌ Failed to import video: ${error.message}`);
          }
        }
      }

      // Don't hammer the API
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.error(`❌ Search failed for "${searchTerm}": ${error.message}`);
    }
  }

  console.log(`\n🎉 Import complete!`);
  console.log(`📊 Total videos imported: ${totalVideosImported}`);

  // Show statistics
  const totalVideos = await prisma.video.count();
  const totalBands = await prisma.band.count();
  const bandStats = await prisma.band.findMany({
    include: {
      _count: {
        select: { videos: true }
      }
    },
    orderBy: {
      videos: {
        _count: 'desc'
      }
    },
    take: 5
  });

  console.log(`\n📈 Database Statistics:`);
  console.log(`   Total videos: ${totalVideos}`);
  console.log(`   Total bands: ${totalBands}`);
  console.log(`\n🏆 Top Bands by Video Count:`);
  bandStats.forEach((band, index) => {
    console.log(`   ${index + 1}. ${band.name}: ${band._count.videos} videos`);
  });

  await prisma.$disconnect();
}

// Simple band detection from video titles
function detectBandFromTitle(title: string): string | undefined {
  const titleLower = title.toLowerCase();
  
  const bandPatterns = [
    { pattern: /(southern university|human jukebox)/i, name: 'Southern University Human Jukebox' },
    { pattern: /(jackson state|sonic boom)/i, name: 'Jackson State Sonic Boom' },
    { pattern: /(famu|marching 100|florida a&m)/i, name: 'Florida A&M Marching 100' },
    { pattern: /(howard university|showtime)/i, name: 'Howard University Showtime' },
    { pattern: /(nc a&t|north carolina a&t|blue.*gold)/i, name: 'North Carolina A&T Blue and Gold Marching Machine' },
    { pattern: /(grambling|tiger.*marching)/i, name: 'Grambling State Tiger Marching Band' },
    { pattern: /(prairie view|marching storm)/i, name: 'Prairie View A&M Marching Storm' },
    { pattern: /(texas southern|ocean.*soul)/i, name: 'Texas Southern Ocean of Soul' },
  ];

  for (const { pattern, name } of bandPatterns) {
    if (pattern.test(titleLower)) {
      return name;
    }
  }
  return undefined;
}

// Extract school name from band name
function extractSchoolName(bandName: string): string {
  if (bandName.includes('Southern University')) return 'Southern University';
  if (bandName.includes('Jackson State')) return 'Jackson State University';
  if (bandName.includes('Florida A&M') || bandName.includes('FAMU')) return 'Florida A&M University';
  if (bandName.includes('Howard University')) return 'Howard University';
  if (bandName.includes('North Carolina A&T')) return 'North Carolina A&T State University';
  if (bandName.includes('Grambling')) return 'Grambling State University';
  if (bandName.includes('Prairie View')) return 'Prairie View A&M University';
  if (bandName.includes('Texas Southern')) return 'Texas Southern University';
  
  return 'Unknown University';
}

importHBCUVideos().catch(console.error);