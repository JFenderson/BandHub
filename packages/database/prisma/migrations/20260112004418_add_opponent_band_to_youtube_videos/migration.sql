-- AlterTable
ALTER TABLE "youtube_videos" ADD COLUMN     "opponent_band_id" TEXT;

-- CreateIndex
CREATE INDEX "youtube_videos_opponent_band_id_idx" ON "youtube_videos"("opponent_band_id");

-- AddForeignKey
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_opponent_band_id_fkey" FOREIGN KEY ("opponent_band_id") REFERENCES "bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
