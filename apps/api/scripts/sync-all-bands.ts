// YouTube Import Script - Searches ALL bands in the database
import { google } from 'googleapis';
import { PrismaService } from '@bandhub/database';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
function loadEnvironmentVariables() {
  const possibleEnvPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/api/.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../../.env'),
  ];

  for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`✅ Found .env file at: ${envPath}`);
      dotenv.config({ path: envPath });
      return true;
    }
  }
  return false;
}


const prisma = new PrismaService();

async function syncAllBands() {
  loadEnvironmentVariables();
  
  const API_KEY = process.env.YOUTUBE_API_KEY;
  
  if (!API_KEY) {
    console.log('❌ YOUTUBE_API_KEY not found!');
    console.log('\n🔧 Add YOUTUBE_API_KEY to your .env file');
    return;
  }

  console.log(`🔑 Using API key: ${API_KEY.substring(0, 10)}...`);
  
  const youtube = google.youtube({
    version: 'v3',
    auth: API_KEY,
  });

  console.log('🎺 Starting video import for ALL bands...\n');

  // Get ALL active bands from the database
  const allBands = await prisma.band.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.log(`📋 Found ${allBands.length} active bands to search\n`);

  let totalVideosImported = 0;
  let bandsWithVideosAdded = 0;

  // Loop through each band
  for (let i = 0; i < allBands.length; i++) {
    const band = allBands[i];
    console.log(`\n[${i + 1}/${allBands.length}] 🎵 Searching for: ${band.name}`);
    console.log(`   School: ${band.schoolName}`);

    // Build search query for this band
    const searchQuery = buildSearchQuery(band);
    console.log(`   Query: "${searchQuery}"`);

    let bandVideosCount = 0;

    try {
      const response = await youtube.search.list({
        part: ['snippet'],
        q: searchQuery,
        type: ['video'],
        maxResults: 15, // Get 15 videos per band
        order: 'relevance',
        publishedAfter: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // Last year
        videoDuration: 'any',
      });

      if (response.data.items && response.data.items.length > 0) {
        for (const item of response.data.items) {
          if (!item.id?.videoId || !item.snippet) continue;

          try {
            // Check if video already exists
            const existingVideo = await prisma.video.findUnique({
              where: { youtubeId: item.id.videoId }
            });

            if (existingVideo) {
              console.log(`   ⏭️  Skip: ${item.snippet.title?.substring(0, 50)}...`);
              continue;
            }

            // Get video details (duration, views, etc.)
            const videoDetails = await getVideoDetails(youtube, item.id.videoId);

            // Create the video - FIXED: removed channelId and channelTitle
            await prisma.video.create({
              data: {
                youtubeId: item.id.videoId,
                title: item.snippet.title || 'Untitled',
                description: item.snippet.description || '',
                thumbnailUrl: item.snippet.thumbnails?.high?.url || 
                             item.snippet.thumbnails?.medium?.url || 
                             item.snippet.thumbnails?.default?.url || '',
                duration: videoDetails?.duration || 0,
                viewCount: videoDetails?.viewCount || 0,
                likeCount: videoDetails?.likeCount || 0,
                publishedAt: new Date(item.snippet.publishedAt || new Date()),
                bandId: band.id,
                // Removed: channelId and channelTitle - not in schema
              },
            });

            console.log(`   ✅ Added: ${item.snippet.title?.substring(0, 60)}...`);
            bandVideosCount++;
            totalVideosImported++;

          } catch (error: any) {
            console.error(`   ❌ Error importing video: ${error.message}`);
          }
        }

        if (bandVideosCount > 0) {
          bandsWithVideosAdded++;
        }
        console.log(`   📊 Added ${bandVideosCount} videos for ${band.name}`);
      } else {
        console.log(`   ⚠️  No videos found`);
      }

      // Delay to avoid hitting API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`   ❌ Search failed: ${error.message}`);
      
      // If quota exceeded, stop
      if (error.message?.includes('quota')) {
        console.log('\n🛑 YouTube API quota exceeded. Stopping import.');
        break;
      }
    }
  }

  // Final statistics
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Import Complete!');
  console.log('='.repeat(60));
  console.log(`📊 Total videos imported: ${totalVideosImported}`);
  console.log(`🏫 Bands with new videos: ${bandsWithVideosAdded}/${allBands.length}`);
  
  // Show database stats
  const dbStats = await getDatabaseStats();
  console.log(`\n📈 Database Statistics:`);
  console.log(`   Total videos: ${dbStats.totalVideos}`);
  console.log(`   Total bands: ${dbStats.totalBands}`);
  console.log(`   Bands with videos: ${dbStats.bandsWithVideos}`);
  console.log(`   Bands without videos: ${dbStats.bandsWithoutVideos}`);

  // Show top bands by video count
  console.log(`\n🏆 Top 10 Bands by Video Count:`);
  dbStats.topBands.forEach((band: any, index: number) => {
    console.log(`   ${index + 1}. ${band.name}: ${band._count.videos} videos`);
  });

  await prisma.$disconnect();
}

// Helper function to build search query for a band
function buildSearchQuery(band: any): string {
  const terms = [
    band.name,
    band.schoolName,
    'marching band',
  ];
  
  // Add conference if available
  if (band.conference) {
    terms.push(band.conference);
  }
  
  // Add HBCU to help filter results
  terms.push('HBCU');
  
  return terms.join(' ');
}

// Helper function to get video details
async function getVideoDetails(youtube: any, videoId: string) {
  try {
    const response = await youtube.videos.list({
      part: ['contentDetails', 'statistics'],
      id: [videoId],
    });

    const video = response.data.items?.[0];
    if (!video) return null;
    
    return {
      duration: parseDuration(video.contentDetails?.duration || ''),
      viewCount: parseInt(video.statistics?.viewCount || '0'),
      likeCount: parseInt(video.statistics?.likeCount || '0'),
    };
  } catch (error) {
    return null;
  }
}

// Helper function to parse ISO 8601 duration
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Helper function to get database statistics
async function getDatabaseStats() {
  const totalVideos = await prisma.video.count();
  const totalBands = await prisma.band.count();
  
  const bandsWithVideos = await prisma.band.count({
    where: {
      videos: {
        some: {}
      }
    }
  });
  
  const bandsWithoutVideos = totalBands - bandsWithVideos;
  
  const topBands = await prisma.band.findMany({
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
    take: 10
  });
  
  return {
    totalVideos,
    totalBands,
    bandsWithVideos,
    bandsWithoutVideos,
    topBands,
  };
}

syncAllBands().catch(console.error);