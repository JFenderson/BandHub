-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BAYOU_CLASSIC', 'SWAC_CHAMPIONSHIP', 'HOMECOMING', 'BATTLE_OF_THE_BANDS', 'FOOTBALL_GAME', 'PARADE', 'CONCERT', 'COMPETITION', 'EXHIBITION', 'OTHER');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "last_rotated_at" TIMESTAMP(3),
ADD COLUMN     "rotation_warnings_sent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'info',
ADD COLUMN     "user_agent" TEXT;

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "event_type" "EventType" NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "location" TEXT,
    "venue" TEXT,
    "city" TEXT,
    "state" TEXT,
    "year" INTEGER NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_videos" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_bands" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jwt_keys" (
    "id" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "rotated_at" TIMESTAMP(3),

    CONSTRAINT "jwt_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_slug_idx" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_event_type_idx" ON "events"("event_type");

-- CreateIndex
CREATE INDEX "events_event_date_idx" ON "events"("event_date");

-- CreateIndex
CREATE INDEX "events_year_idx" ON "events"("year");

-- CreateIndex
CREATE INDEX "events_is_active_idx" ON "events"("is_active");

-- CreateIndex
CREATE INDEX "event_videos_event_id_idx" ON "event_videos"("event_id");

-- CreateIndex
CREATE INDEX "event_videos_video_id_idx" ON "event_videos"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_videos_event_id_video_id_key" ON "event_videos"("event_id", "video_id");

-- CreateIndex
CREATE INDEX "event_bands_event_id_idx" ON "event_bands"("event_id");

-- CreateIndex
CREATE INDEX "event_bands_band_id_idx" ON "event_bands"("band_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_bands_event_id_band_id_key" ON "event_bands"("event_id", "band_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_password_reset_tokens_token_key" ON "admin_password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "admin_password_reset_tokens_token_idx" ON "admin_password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "admin_password_reset_tokens_admin_user_id_idx" ON "admin_password_reset_tokens"("admin_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "jwt_keys_key_id_key" ON "jwt_keys"("key_id");

-- CreateIndex
CREATE INDEX "jwt_keys_is_active_idx" ON "jwt_keys"("is_active");

-- CreateIndex
CREATE INDEX "jwt_keys_is_primary_idx" ON "jwt_keys"("is_primary");

-- CreateIndex
CREATE INDEX "api_keys_expires_at_idx" ON "api_keys"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- AddForeignKey
ALTER TABLE "event_videos" ADD CONSTRAINT "event_videos_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bands" ADD CONSTRAINT "event_bands_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_password_reset_tokens" ADD CONSTRAINT "admin_password_reset_tokens_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
