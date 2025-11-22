-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('FULL_SYNC', 'INCREMENTAL_SYNC', 'SINGLE_VIDEO');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "bands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "school_name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "conference" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "description" TEXT,
    "founded_year" INTEGER,
    "youtube_channel_id" TEXT,
    "youtube_playlist_ids" TEXT[],
    "last_sync_at" TIMESTAMP(3),
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "youtube_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "event_name" TEXT,
    "event_year" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hide_reason" TEXT,
    "quality_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "band_id" TEXT NOT NULL,
    "opponent_band_id" TEXT,
    "category_id" TEXT,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'MODERATOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB,
    "admin_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "band_id" TEXT,
    "job_type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "videos_found" INTEGER NOT NULL DEFAULT 0,
    "videos_added" INTEGER NOT NULL DEFAULT 0,
    "videos_updated" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bands_slug_key" ON "bands"("slug");

-- CreateIndex
CREATE INDEX "bands_slug_idx" ON "bands"("slug");

-- CreateIndex
CREATE INDEX "bands_school_name_idx" ON "bands"("school_name");

-- CreateIndex
CREATE INDEX "bands_state_idx" ON "bands"("state");

-- CreateIndex
CREATE INDEX "bands_conference_idx" ON "bands"("conference");

-- CreateIndex
CREATE INDEX "bands_is_active_is_featured_idx" ON "bands"("is_active", "is_featured");

-- CreateIndex
CREATE UNIQUE INDEX "videos_youtube_id_key" ON "videos"("youtube_id");

-- CreateIndex
CREATE INDEX "videos_band_id_idx" ON "videos"("band_id");

-- CreateIndex
CREATE INDEX "videos_opponent_band_id_idx" ON "videos"("opponent_band_id");

-- CreateIndex
CREATE INDEX "videos_category_id_idx" ON "videos"("category_id");

-- CreateIndex
CREATE INDEX "videos_event_year_idx" ON "videos"("event_year");

-- CreateIndex
CREATE INDEX "videos_published_at_idx" ON "videos"("published_at" DESC);

-- CreateIndex
CREATE INDEX "videos_view_count_idx" ON "videos"("view_count" DESC);

-- CreateIndex
CREATE INDEX "videos_is_hidden_idx" ON "videos"("is_hidden");

-- CreateIndex
CREATE INDEX "videos_band_id_category_id_idx" ON "videos"("band_id", "category_id");

-- CreateIndex
CREATE INDEX "videos_band_id_event_year_idx" ON "videos"("band_id", "event_year");

-- CreateIndex
CREATE INDEX "videos_title_idx" ON "videos"("title");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_admin_user_id_idx" ON "audit_logs"("admin_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "sync_jobs_band_id_idx" ON "sync_jobs"("band_id");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "sync_jobs_created_at_idx" ON "sync_jobs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_opponent_band_id_fkey" FOREIGN KEY ("opponent_band_id") REFERENCES "bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
