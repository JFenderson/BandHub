-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "creatorId" TEXT;

-- CreateTable
CREATE TABLE "content_creators" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "youtubeChannelId" TEXT NOT NULL,
    "channelUrl" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "subscriberCount" INTEGER NOT NULL DEFAULT 0,
    "totalVideoCount" INTEGER NOT NULL DEFAULT 0,
    "videosInOurDb" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "firstSyncedAt" TIMESTAMP(3),
    "lastFullSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_creators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_creators_youtubeChannelId_key" ON "content_creators"("youtubeChannelId");

-- CreateIndex
CREATE INDEX "content_creators_youtubeChannelId_idx" ON "content_creators"("youtubeChannelId");

-- CreateIndex
CREATE INDEX "content_creators_isFeatured_idx" ON "content_creators"("isFeatured");

-- CreateIndex
CREATE INDEX "content_creators_isVerified_idx" ON "content_creators"("isVerified");

-- CreateIndex
CREATE INDEX "content_creators_qualityScore_idx" ON "content_creators"("qualityScore");

-- CreateIndex
CREATE INDEX "content_creators_createdAt_idx" ON "content_creators"("createdAt");

-- CreateIndex
CREATE INDEX "videos_creatorId_idx" ON "videos"("creatorId");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "content_creators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
