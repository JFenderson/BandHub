-- AlterTable: youtube_videos — add match-failure tracking columns
ALTER TABLE "youtube_videos"
  ADD COLUMN "no_match_reason" TEXT,
  ADD COLUMN "match_attempted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "youtube_videos_no_match_reason_idx" ON "youtube_videos"("no_match_reason");

-- CreateIndex
CREATE INDEX "youtube_videos_match_attempted_at_idx" ON "youtube_videos"("match_attempted_at");
