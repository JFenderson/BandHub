-- CreateTable
CREATE TABLE "favorite_videos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_bands" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_later" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "watched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_later_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_new_video" BOOLEAN NOT NULL DEFAULT true,
    "email_upcoming" BOOLEAN NOT NULL DEFAULT true,
    "email_weekly_digest" BOOLEAN NOT NULL DEFAULT true,
    "in_app_notifications" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorite_videos_user_id_idx" ON "favorite_videos"("user_id");

-- CreateIndex
CREATE INDEX "favorite_videos_video_id_idx" ON "favorite_videos"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_videos_user_id_video_id_key" ON "favorite_videos"("user_id", "video_id");

-- CreateIndex
CREATE INDEX "favorite_bands_user_id_idx" ON "favorite_bands"("user_id");

-- CreateIndex
CREATE INDEX "favorite_bands_band_id_idx" ON "favorite_bands"("band_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_bands_user_id_band_id_key" ON "favorite_bands"("user_id", "band_id");

-- CreateIndex
CREATE INDEX "watch_later_user_id_idx" ON "watch_later"("user_id");

-- CreateIndex
CREATE INDEX "watch_later_video_id_idx" ON "watch_later"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "watch_later_user_id_video_id_key" ON "watch_later"("user_id", "video_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "favorite_videos" ADD CONSTRAINT "favorite_videos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_videos" ADD CONSTRAINT "favorite_videos_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_bands" ADD CONSTRAINT "favorite_bands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_bands" ADD CONSTRAINT "favorite_bands_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_later" ADD CONSTRAINT "watch_later_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_later" ADD CONSTRAINT "watch_later_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
