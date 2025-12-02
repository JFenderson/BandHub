-- CreateTable
CREATE TABLE "youtube_videos" (
    "id" TEXT NOT NULL,
    "youtube_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3) NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "channel_id" TEXT NOT NULL,
    "channel_title" TEXT,
    "band_id" TEXT,
    "creator_id" TEXT,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "last_synced_at" TIMESTAMP(3),
    "sync_errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_promoted" BOOLEAN NOT NULL DEFAULT false,
    "promoted_at" TIMESTAMP(3),
    "quality_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "youtube_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "youtube_videos_youtube_id_key" ON "youtube_videos"("youtube_id");

-- CreateIndex
CREATE INDEX "youtube_videos_band_id_idx" ON "youtube_videos"("band_id");

-- CreateIndex
CREATE INDEX "youtube_videos_creator_id_idx" ON "youtube_videos"("creator_id");

-- CreateIndex
CREATE INDEX "youtube_videos_published_at_idx" ON "youtube_videos"("published_at" DESC);

-- CreateIndex
CREATE INDEX "youtube_videos_view_count_idx" ON "youtube_videos"("view_count" DESC);

-- CreateIndex
CREATE INDEX "youtube_videos_band_id_published_at_idx" ON "youtube_videos"("band_id", "published_at" DESC);

-- CreateIndex
CREATE INDEX "youtube_videos_creator_id_published_at_idx" ON "youtube_videos"("creator_id", "published_at" DESC);

-- CreateIndex
CREATE INDEX "youtube_videos_channel_id_idx" ON "youtube_videos"("channel_id");

-- CreateIndex
CREATE INDEX "youtube_videos_sync_status_idx" ON "youtube_videos"("sync_status");

-- CreateIndex
CREATE INDEX "youtube_videos_is_promoted_idx" ON "youtube_videos"("is_promoted");

-- CreateIndex
CREATE INDEX "youtube_videos_quality_score_idx" ON "youtube_videos"("quality_score" DESC);

-- AddForeignKey
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "content_creators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
