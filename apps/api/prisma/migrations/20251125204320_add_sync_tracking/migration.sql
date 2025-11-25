-- AlterEnum
ALTER TYPE "SyncJobType" ADD VALUE 'CHANNEL_SYNC';

-- AlterTable
ALTER TABLE "bands" ADD COLUMN     "earliest_video_date" TIMESTAMP(3),
ADD COLUMN     "first_synced_at" TIMESTAMP(3),
ADD COLUMN     "last_full_sync" TIMESTAMP(3),
ADD COLUMN     "latest_video_date" TIMESTAMP(3),
ADD COLUMN     "total_video_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sync_jobs" ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "max_videos" INTEGER,
ADD COLUMN     "published_after" TIMESTAMP(3),
ADD COLUMN     "published_before" TIMESTAMP(3),
ADD COLUMN     "quota_used" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "bands_youtube_channel_id_idx" ON "bands"("youtube_channel_id");

-- CreateIndex
CREATE INDEX "sync_jobs_band_id_status_idx" ON "sync_jobs"("band_id", "status");
