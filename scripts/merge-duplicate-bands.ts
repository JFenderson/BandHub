/**
 * Merge Script: Consolidate Duplicate Band Entries
 * 
 * This script intelligently merges duplicate band entries by:
 * 1. Identifying the "primary" band (most complete data)
 * 2. Merging fields from duplicates (logos, colors, descriptions)
 * 3. Reassigning all videos to the primary band
 * 4. Updating related records (favorites, shares, metrics)
 * 5. Safely deleting duplicate entries
 * 
 * Usage: 
 *   DRY_RUN=true npx tsx scripts/merge-duplicate-bands.ts  # Preview changes
 *   npx tsx scripts/merge-duplicate-bands.ts                # Execute merge
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === 'true';

interface BandInfo {
  id: string;
  name: string;
  slug: string;
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  description: string | null;
  nickname: string | null;
  city: string | null;
  videoCount: number;
  favoriteCount: number;
  shareCount: number;
  createdAt: Date;
}

async function mergeDuplicateBands() {
  console.log('🔧 Starting duplicate band merge process...\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made to the database\n');
  } else {
    console.log('⚠️  LIVE MODE - Changes will be committed to the database\n');
  }

  try {
    // Fetch all bands with related counts
    const bands = await prisma.band.findMany({
      include: {
        _count: {
          select: {
            videos: true,
            userFavorites: true,
            shares: true,
          },
        },
      },
      orderBy: {
        schoolName: 'asc',
      },
    });

    // Group by schoolName
    const bandsBySchool = new Map<string, BandInfo[]>();

    for (const band of bands) {
      const bandInfo: BandInfo = {
        id: band.id,
        name: band.name,
        slug: band.slug,
        schoolName: band.schoolName,
        logoUrl: band.logoUrl,
        primaryColor: band.primaryColor,
        secondaryColor: band.secondaryColor,
        description: band.description,
        nickname: band.nickname,
        city: band.city,
        videoCount: band._count.videos,
        favoriteCount: band._count.userFavorites,
        shareCount: band._count.shares,
        createdAt: band.createdAt,
      };

      if (!bandsBySchool.has(band.schoolName)) {
        bandsBySchool.set(band.schoolName, []);
      }
      bandsBySchool.get(band.schoolName)!.push(bandInfo);
    }

    // Find and merge duplicates
    let mergedCount = 0;
    let totalDuplicatesRemoved = 0;

    for (const [schoolName, bandsList] of Array.from(bandsBySchool.entries())) {
      if (bandsList.length > 1) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🎵 Merging: ${schoolName}`);
        console.log(`   Found ${bandsList.length} entries\n`);

        // Sort by completeness
        const sorted = bandsList.sort((a, b) => {
          const scoreA = calculateCompletenessScore(a);
          const scoreB = calculateCompletenessScore(b);
          return scoreB - scoreA;
        });

        const primary = sorted[0];
        const duplicates = sorted.slice(1);

        console.log(`   👑 Primary: ${primary.slug} (ID: ${primary.id})`);
        console.log(`   📊 Videos: ${primary.videoCount}, Favorites: ${primary.favoriteCount}\n`);

        // Merge data from duplicates
        const mergedData = await mergeData(primary, duplicates);

        // Process merge
        if (!DRY_RUN) {
          await performMerge(primary.id, duplicates, mergedData);
        } else {
          console.log(`   [DRY RUN] Would merge the following:`);
          for (const dup of duplicates) {
            console.log(`   - ${dup.slug} (${dup.videoCount} videos, ${dup.favoriteCount} favorites)`);
          }
          console.log(`\n   [DRY RUN] Would update primary with:`, mergedData);
        }

        mergedCount++;
        totalDuplicatesRemoved += duplicates.length;

        console.log(`   ✅ ${DRY_RUN ? 'Would merge' : 'Merged'} ${duplicates.length} duplicate(s)\n`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 MERGE SUMMARY\n');
    console.log(`   Schools merged: ${mergedCount}`);
    console.log(`   Duplicate bands ${DRY_RUN ? 'to be removed' : 'removed'}: ${totalDuplicatesRemoved}`);
    console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

    if (DRY_RUN) {
      console.log('💡 To execute the merge, run without DRY_RUN:\n');
      console.log('   npx tsx scripts/merge-duplicate-bands.ts\n');
    } else {
      console.log('✅ Merge completed successfully!\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Error during merge:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function mergeData(primary: BandInfo, duplicates: BandInfo[]) {
  const updates: any = {};

  // Merge logo (prefer non-null)
  if (!primary.logoUrl) {
    const withLogo = duplicates.find(b => b.logoUrl);
    if (withLogo) {
      updates.logoUrl = withLogo.logoUrl;
      console.log(`   🖼️  Adding logo from ${withLogo.slug}`);
    }
  }

  // Merge colors (prefer non-null)
  if (!primary.primaryColor || !primary.secondaryColor) {
    const withColors = duplicates.find(b => b.primaryColor && b.secondaryColor);
    if (withColors) {
      if (!primary.primaryColor && withColors.primaryColor) {
        updates.primaryColor = withColors.primaryColor;
      }
      if (!primary.secondaryColor && withColors.secondaryColor) {
        updates.secondaryColor = withColors.secondaryColor;
      }
      console.log(`   🎨 Adding colors from ${withColors.slug}`);
    }
  }

  // Merge description (prefer longer, more detailed)
  if (!primary.description || primary.description.length < 50) {
    const withDescription = duplicates.find(b => b.description && b.description.length > 50);
    if (withDescription) {
      updates.description = withDescription.description;
      console.log(`   📝 Using description from ${withDescription.slug}`);
    }
  }

  // Merge nickname (prefer non-null)
  if (!primary.nickname) {
    const withNickname = duplicates.find(b => b.nickname);
    if (withNickname) {
      updates.nickname = withNickname.nickname;
      console.log(`   🏷️  Adding nickname from ${withNickname.slug}`);
    }
  }

  // Merge city (prefer non-null)
  if (!primary.city) {
    const withCity = duplicates.find(b => b.city);
    if (withCity) {
      updates.city = withCity.city;
      console.log(`   📍 Adding city from ${withCity.slug}`);
    }
  }

  return updates;
}

async function performMerge(primaryId: string, duplicates: BandInfo[], mergedData: any) {
  // Use transaction for data integrity
  await prisma.$transaction(async (tx) => {
    // Update primary band with merged data
    if (Object.keys(mergedData).length > 0) {
      await tx.band.update({
        where: { id: primaryId },
        data: mergedData,
      });
      console.log(`   ✏️  Updated primary band with merged data`);
    }

    // Process each duplicate
    for (const duplicate of duplicates) {
      console.log(`\n   🔄 Processing duplicate: ${duplicate.slug}`);

      // Reassign videos
      const videoUpdateResult = await tx.video.updateMany({
        where: { bandId: duplicate.id },
        data: { bandId: primaryId },
      });
      if (videoUpdateResult.count > 0) {
        console.log(`      📹 Reassigned ${videoUpdateResult.count} videos`);
      }

      // Reassign opponent videos
      const opponentVideoUpdateResult = await tx.video.updateMany({
        where: { opponentBandId: duplicate.id },
        data: { opponentBandId: primaryId },
      });
      if (opponentVideoUpdateResult.count > 0) {
        console.log(`      📹 Reassigned ${opponentVideoUpdateResult.count} opponent videos`);
      }

      // Reassign YouTube videos
      const youtubeVideoUpdateResult = await tx.youTubeVideo.updateMany({
        where: { bandId: duplicate.id },
        data: { bandId: primaryId },
      });
      if (youtubeVideoUpdateResult.count > 0) {
        console.log(`      📺 Reassigned ${youtubeVideoUpdateResult.count} YouTube videos`);
      }

      // Reassign opponent YouTube videos
      const opponentYoutubeVideoUpdateResult = await tx.youTubeVideo.updateMany({
        where: { opponentBandId: duplicate.id },
        data: { opponentBandId: primaryId },
      });
      if (opponentYoutubeVideoUpdateResult.count > 0) {
        console.log(`      📺 Reassigned ${opponentYoutubeVideoUpdateResult.count} opponent YouTube videos`);
      }

      // Handle favorites - delete duplicates for same user
      const existingFavorites = await tx.userBandFavorite.findMany({
        where: { bandId: primaryId },
        select: { userId: true },
      });
      const existingUserIds = new Set(existingFavorites.map(f => f.userId));

      // First, delete favorites that would create duplicates
      const duplicateFavorites = await tx.userBandFavorite.findMany({
        where: {
          bandId: duplicate.id,
          userId: { in: Array.from(existingUserIds) },
        },
      });
      
      if (duplicateFavorites.length > 0) {
        await tx.userBandFavorite.deleteMany({
          where: {
            id: { in: duplicateFavorites.map(f => f.id) },
          },
        });
        console.log(`      ⚠️  Removed ${duplicateFavorites.length} duplicate favorites`);
      }

      // Then reassign remaining unique favorites
      const favoriteUpdateResult = await tx.userBandFavorite.updateMany({
        where: { bandId: duplicate.id },
        data: { bandId: primaryId },
      });
      if (favoriteUpdateResult.count > 0) {
        console.log(`      ⭐ Reassigned ${favoriteUpdateResult.count} favorites`);
      }

      // Reassign shares
      const shareUpdateResult = await tx.bandShare.updateMany({
        where: { bandId: duplicate.id },
        data: { bandId: primaryId },
      });
      if (shareUpdateResult.count > 0) {
        console.log(`      📤 Reassigned ${shareUpdateResult.count} shares`);
      }

      // Reassign featured clicks
      await tx.featuredBandClick.updateMany({
        where: { bandId: duplicate.id },
        data: { bandId: primaryId },
      });

      // Reassign reviews
      await tx.review.updateMany({
        where: { bandId: duplicate.id },
        data: { bandId: primaryId },
      });

      // Reassign content shares
      await tx.contentShare.updateMany({
        where: { bandId: duplicate.id },
        data: { bandId: primaryId },
      });

      // Delete duplicate's metrics if exists
      await tx.bandMetrics.deleteMany({
        where: { bandId: duplicate.id },
      });

      // Finally, delete the duplicate band
      await tx.band.delete({
        where: { id: duplicate.id },
      });

      console.log(`      🗑️  Deleted duplicate band`);
    }
  });
}

function calculateCompletenessScore(band: BandInfo): number {
  let score = 0;

  // Videos are most important
  score += band.videoCount * 10;

  // Logo and colors
  if (band.logoUrl) score += 5;
  if (band.primaryColor && band.secondaryColor) score += 3;

  // Description
  if (band.description && band.description.length > 50) score += 2;

  // User engagement
  score += band.favoriteCount * 2;
  score += band.shareCount * 1;

  // Older bands get slight preference
  const ageInDays = (Date.now() - band.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  score += Math.min(ageInDays / 10, 5);

  return score;
}

// Run the script
mergeDuplicateBands().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
