-- CreateEnum
CREATE TYPE "MatchSource" AS ENUM ('CHANNEL_OWNERSHIP', 'AI', 'ALIAS', 'MANUAL');

-- CreateEnum
CREATE TYPE "VideoBandRole" AS ENUM ('PRIMARY', 'OPPONENT', 'PARTICIPANT');

-- AlterTable: youtube_videos — add match tracking columns
ALTER TABLE "youtube_videos"
  ADD COLUMN "match_confidence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "match_source" "MatchSource",
  ADD COLUMN "participant_band_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "youtube_videos_match_source_quality_score_idx" ON "youtube_videos"("match_source", "quality_score");

-- CreateTable
CREATE TABLE "video_bands" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "role" "VideoBandRole" NOT NULL DEFAULT 'PARTICIPANT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_bands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_bands_video_id_band_id_key" ON "video_bands"("video_id", "band_id");

-- CreateIndex
CREATE INDEX "video_bands_band_id_idx" ON "video_bands"("band_id");

-- CreateIndex
CREATE INDEX "video_bands_video_id_idx" ON "video_bands"("video_id");

-- AddForeignKey
ALTER TABLE "video_bands" ADD CONSTRAINT "video_bands_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_bands" ADD CONSTRAINT "video_bands_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
