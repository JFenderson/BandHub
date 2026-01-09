// YouTube Import Script - Properly loads environment variables
import { google } from 'googleapis';
import { PrismaService } from '@bandhub/database';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Try to load .env from multiple locations
function loadEnvironmentVariables() {
  const possibleEnvPaths = [
    path.resolve(process.cwd(), '.env'),                    // Project root
    path.resolve(process.cwd(), '../.env'),           // API directory
    path.resolve(__dirname, '../../../.env'),               // From script location
    path.resolve(__dirname, '../../../../.env'),            // One level up
  ];

  console.log('🔍 Looking for .env file...');
  
  for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`✅ Found .env file at: ${envPath}`);
      dotenv.config({ path: envPath });
      return true;
    } else {
      console.log(`❌ Not found: ${envPath}`);
    }
  }
  
  return false;
}


const prisma = new PrismaService();

async function importHBCUVideos() {
  // Load environment variables
  const envLoaded = loadEnvironmentVariables();
  
  if (!envLoaded) {
    console.log('⚠️  No .env file found, checking process.env directly...');
  }

  const API_KEY = process.env.YOUTUBE_API_KEY;
  
  if (!API_KEY) {
    console.log('❌ YOUTUBE_API_KEY not found!');
    console.log('\n🔧 To fix this:');
    console.log('1. Create a .env file in your project root (BandHub/.env)');
    console.log('2. Add this line: YOUTUBE_API_KEY=your_actual_api_key');
    console.log('3. Make sure .env is in your .gitignore file');
    console.log('\nAlternatively, set the environment variable:');
    console.log('Windows: set YOUTUBE_API_KEY=your_key');
    console.log('Mac/Linux: export YOUTUBE_API_KEY=your_key');
    return;
  }

  console.log(`🔑 Using API key: ${API_KEY.substring(0, 10)}...`);
  
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
      isActive: false,
    },
  });

  console.log(`🏫 Default band ready: ${defaultBand.name}\n`);

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
            let bandId = defaultBand.id;

            if (detectedBandName) {
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

            // Create the video
            await prisma.video.create({
              data: {
                youtubeId: item.id.videoId,
                title: item.snippet.title || 'Untitled',
                description: item.snippet.description || '',
                thumbnailUrl: item.snippet.thumbnails?.high?.url || 
                             item.snippet.thumbnails?.medium?.url || 
                             item.snippet.thumbnails?.default?.url || '',
                duration: 0,
                publishedAt: new Date(item.snippet.publishedAt || new Date()),
                bandId: bandId,
              },
            });

            console.log(`   ✅ Imported: ${item.snippet.title}`);
            totalVideosImported++;

          } catch (error: any) {
            console.error(`   ❌ Failed to import video: ${error.message}`);
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.error(`❌ Search failed for "${searchTerm}": ${error.message}`);
    }
  }

  console.log(`\n🎉 Import complete!`);
  console.log(`📊 Total videos imported: ${totalVideosImported}`);

  await prisma.$disconnect();
}

// Band detection functions (same as before)
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