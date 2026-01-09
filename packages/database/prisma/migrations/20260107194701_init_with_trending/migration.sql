-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('FULL_SYNC', 'INCREMENTAL_SYNC', 'SINGLE_VIDEO', 'CHANNEL_SYNC');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TrendDirection" AS ENUM ('UP', 'DOWN', 'STABLE', 'NEW');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BAYOU_CLASSIC', 'SWAC_CHAMPIONSHIP', 'HOMECOMING', 'BATTLE_OF_THE_BANDS', 'FOOTBALL_GAME', 'PARADE', 'CONCERT', 'COMPETITION', 'EXHIBITION', 'OTHER');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'REFRESH_TOKEN_USED', 'REFRESH_REUSE_DETECTED', 'MFA_ENABLED', 'MFA_DISABLED', 'MFA_VERIFIED', 'MFA_FAILED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'MAGIC_LINK_CREATED', 'MAGIC_LINK_USED', 'OAUTH_LINKED', 'OAUTH_UNLINKED', 'SESSION_CREATED', 'SESSION_REVOKED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'SUSPICIOUS_LOGIN');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "QuotaAlertLevel" AS ENUM ('INFO', 'WARNING', 'CRITICAL', 'DEPLETED');

-- CreateEnum
CREATE TYPE "SyncPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

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
    "search_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured_order" INTEGER,
    "featured_since" TIMESTAMP(3),
    "earliest_video_date" TIMESTAMP(3),
    "first_synced_at" TIMESTAMP(3),
    "last_full_sync" TIMESTAMP(3),
    "latest_video_date" TIMESTAMP(3),
    "total_video_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bands_pkey" PRIMARY KEY ("id")
);

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
    "creatorId" TEXT,
    "search_vector" tsvector,

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
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "mfa_backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_enabled_at" TIMESTAMP(3),
    "mfa_secret" TEXT,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "password_changed_at" TIMESTAMP(3),
    "password_expires_at" TIMESTAMP(3),
    "session_version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "device_fingerprint" TEXT,
    "replaced_by" TEXT,
    "revoked_reason" TEXT,
    "session_id" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_type" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device_fingerprint" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "token_chain_id" TEXT,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "description" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandMetrics" (
    "id" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "viewsToday" INTEGER NOT NULL DEFAULT 0,
    "viewsThisWeek" INTEGER NOT NULL DEFAULT 0,
    "viewsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "totalFavorites" INTEGER NOT NULL DEFAULT 0,
    "totalFollowers" INTEGER NOT NULL DEFAULT 0,
    "totalShares" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "recentUploads" INTEGER NOT NULL DEFAULT 0,
    "avgVideoViews" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trendDirection" "TrendDirection" NOT NULL DEFAULT 'STABLE',
    "previousRank" INTEGER,
    "currentRank" INTEGER,
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BandMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBandFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBandFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandShare" (
    "id" TEXT NOT NULL,
    "bandId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BandShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "min_length" INTEGER NOT NULL DEFAULT 8,
    "max_length" INTEGER NOT NULL DEFAULT 128,
    "require_uppercase" BOOLEAN NOT NULL DEFAULT true,
    "require_lowercase" BOOLEAN NOT NULL DEFAULT true,
    "require_numbers" BOOLEAN NOT NULL DEFAULT true,
    "require_symbols" BOOLEAN NOT NULL DEFAULT false,
    "expiration_days" INTEGER NOT NULL DEFAULT 90,
    "history_count" INTEGER NOT NULL DEFAULT 5,
    "max_failed_attempts" INTEGER NOT NULL DEFAULT 5,
    "lockout_duration_minutes" INTEGER NOT NULL DEFAULT 15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "ip_address" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "user_agent" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
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
    "priority" "SyncPriority" NOT NULL DEFAULT 'MEDIUM',
    "estimated_quota_cost" INTEGER,
    "actual_quota_cost" INTEGER,
    "quota_approved" BOOLEAN NOT NULL DEFAULT false,
    "quota_approval_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT,
    "max_videos" INTEGER,
    "published_after" TIMESTAMP(3),
    "published_before" TIMESTAMP(3),
    "quota_used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_usage_log" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "band_id" TEXT,
    "band_name" TEXT,
    "sync_job_id" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quota_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_daily_summary" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_usage" INTEGER NOT NULL,
    "quota_limit" INTEGER NOT NULL,
    "percentage_used" DOUBLE PRECISION NOT NULL,
    "operation_breakdown" JSONB,
    "top_consumers" JSONB,
    "cache_hit_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_daily_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_alerts" (
    "id" TEXT NOT NULL,
    "level" "QuotaAlertLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "current_usage" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quota_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "popular_searches" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 1,
    "lastSearched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "popular_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_rotated_at" TIMESTAMP(3),
    "rotation_warnings_sent" INTEGER NOT NULL DEFAULT 0,
    "usage_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "device_type" TEXT,
    "browser" TEXT,
    "ip_address" TEXT,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_logs" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "results_count" INTEGER NOT NULL,
    "filters" JSONB,
    "user_id" TEXT,
    "session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_band_clicks" (
    "id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" TEXT,

    CONSTRAINT "featured_band_clicks_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "bands_featured_order_idx" ON "bands"("featured_order");

-- CreateIndex
CREATE INDEX "bands_youtube_channel_id_idx" ON "bands"("youtube_channel_id");

-- CreateIndex
CREATE INDEX "bands_state_conference_idx" ON "bands"("state", "conference");

-- CreateIndex
CREATE INDEX "bands_is_active_state_idx" ON "bands"("is_active", "state");

-- CreateIndex
CREATE INDEX "bands_is_featured_featured_order_idx" ON "bands"("is_featured", "featured_order");

-- CreateIndex
CREATE UNIQUE INDEX "content_creators_youtubeChannelId_key" ON "content_creators"("youtubeChannelId");

-- CreateIndex
CREATE INDEX "content_creators_youtubeChannelId_idx" ON "content_creators"("youtubeChannelId");

-- CreateIndex
CREATE INDEX "content_creators_isFeatured_qualityScore_idx" ON "content_creators"("isFeatured", "qualityScore" DESC);

-- CreateIndex
CREATE INDEX "content_creators_isFeatured_idx" ON "content_creators"("isFeatured");

-- CreateIndex
CREATE INDEX "content_creators_isVerified_idx" ON "content_creators"("isVerified");

-- CreateIndex
CREATE INDEX "content_creators_qualityScore_idx" ON "content_creators"("qualityScore");

-- CreateIndex
CREATE INDEX "content_creators_createdAt_idx" ON "content_creators"("createdAt");

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
CREATE INDEX "youtube_videos_channel_id_sync_status_idx" ON "youtube_videos"("channel_id", "sync_status");

-- CreateIndex
CREATE INDEX "youtube_videos_channel_id_last_synced_at_idx" ON "youtube_videos"("channel_id", "last_synced_at");

-- CreateIndex
CREATE INDEX "youtube_videos_sync_status_created_at_idx" ON "youtube_videos"("sync_status", "created_at");

-- CreateIndex
CREATE INDEX "youtube_videos_quality_score_idx" ON "youtube_videos"("quality_score" DESC);

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
CREATE INDEX "videos_creatorId_idx" ON "videos"("creatorId");

-- CreateIndex
CREATE INDEX "videos_is_hidden_published_at_idx" ON "videos"("is_hidden", "published_at" DESC);

-- CreateIndex
CREATE INDEX "videos_band_id_is_hidden_published_at_idx" ON "videos"("band_id", "is_hidden", "published_at" DESC);

-- CreateIndex
CREATE INDEX "videos_category_id_is_hidden_published_at_idx" ON "videos"("category_id", "is_hidden", "published_at" DESC);

-- CreateIndex
CREATE INDEX "videos_band_id_category_id_is_hidden_idx" ON "videos"("band_id", "category_id", "is_hidden");

-- CreateIndex
CREATE INDEX "videos_event_year_is_hidden_idx" ON "videos"("event_year", "is_hidden");

-- CreateIndex
CREATE INDEX "videos_opponent_band_id_is_hidden_idx" ON "videos"("opponent_band_id", "is_hidden");

-- CreateIndex
CREATE INDEX "videos_duration_idx" ON "videos"("duration");

-- CreateIndex
CREATE INDEX "videos_quality_score_idx" ON "videos"("quality_score" DESC);

-- CreateIndex
CREATE INDEX "videos_band_id_view_count_idx" ON "videos"("band_id", "view_count" DESC);

-- CreateIndex
CREATE INDEX "videos_search_vector_idx" ON "videos" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_slug_idx" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_event_type_idx" ON "events"("event_type");

-- CreateIndex
CREATE INDEX "events_event_date_idx" ON "events"("event_date");

-- CreateIndex
CREATE INDEX "events_is_active_year_idx" ON "events"("is_active", "year");

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
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_password_reset_tokens_token_key" ON "admin_password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "admin_password_reset_tokens_token_idx" ON "admin_password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "admin_password_reset_tokens_admin_user_id_idx" ON "admin_password_reset_tokens"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_password_reset_tokens_expires_at_idx" ON "admin_password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "admin_sessions_user_id_idx" ON "admin_sessions"("user_id");

-- CreateIndex
CREATE INDEX "admin_sessions_is_active_idx" ON "admin_sessions"("is_active");

-- CreateIndex
CREATE INDEX "admin_sessions_last_activity_at_idx" ON "admin_sessions"("last_activity_at" DESC);

-- CreateIndex
CREATE INDEX "admin_sessions_token_chain_id_idx" ON "admin_sessions"("token_chain_id");

-- CreateIndex
CREATE INDEX "security_events_user_id_idx" ON "security_events"("user_id");

-- CreateIndex
CREATE INDEX "security_events_event_type_idx" ON "security_events"("event_type");

-- CreateIndex
CREATE INDEX "security_events_severity_idx" ON "security_events"("severity");

-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "security_events_ip_address_idx" ON "security_events"("ip_address");

-- CreateIndex
CREATE INDEX "password_history_user_id_idx" ON "password_history"("user_id");

-- CreateIndex
CREATE INDEX "password_history_created_at_idx" ON "password_history"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "magic_links_token_key" ON "magic_links"("token");

-- CreateIndex
CREATE INDEX "magic_links_token_idx" ON "magic_links"("token");

-- CreateIndex
CREATE INDEX "magic_links_user_id_idx" ON "magic_links"("user_id");

-- CreateIndex
CREATE INDEX "magic_links_email_idx" ON "magic_links"("email");

-- CreateIndex
CREATE INDEX "magic_links_expires_at_idx" ON "magic_links"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "BandMetrics_bandId_key" ON "BandMetrics"("bandId");

-- CreateIndex
CREATE INDEX "BandMetrics_trendingScore_idx" ON "BandMetrics"("trendingScore" DESC);

-- CreateIndex
CREATE INDEX "BandMetrics_bandId_idx" ON "BandMetrics"("bandId");

-- CreateIndex
CREATE INDEX "BandMetrics_lastCalculated_idx" ON "BandMetrics"("lastCalculated");

-- CreateIndex
CREATE INDEX "UserBandFavorite_userId_idx" ON "UserBandFavorite"("userId");

-- CreateIndex
CREATE INDEX "UserBandFavorite_bandId_idx" ON "UserBandFavorite"("bandId");

-- CreateIndex
CREATE INDEX "UserBandFavorite_createdAt_idx" ON "UserBandFavorite"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserBandFavorite_userId_bandId_key" ON "UserBandFavorite"("userId", "bandId");

-- CreateIndex
CREATE INDEX "BandShare_bandId_idx" ON "BandShare"("bandId");

-- CreateIndex
CREATE INDEX "BandShare_createdAt_idx" ON "BandShare"("createdAt");

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE INDEX "oauth_accounts_provider_idx" ON "oauth_accounts"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_user_id_key" ON "oauth_accounts"("provider", "provider_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "jwt_keys_key_id_key" ON "jwt_keys"("key_id");

-- CreateIndex
CREATE INDEX "jwt_keys_is_active_idx" ON "jwt_keys"("is_active");

-- CreateIndex
CREATE INDEX "jwt_keys_is_primary_idx" ON "jwt_keys"("is_primary");

-- CreateIndex
CREATE INDEX "sync_jobs_band_id_idx" ON "sync_jobs"("band_id");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "sync_jobs_priority_idx" ON "sync_jobs"("priority");

-- CreateIndex
CREATE INDEX "sync_jobs_priority_status_idx" ON "sync_jobs"("priority", "status");

-- CreateIndex
CREATE INDEX "sync_jobs_quota_approved_idx" ON "sync_jobs"("quota_approved");

-- CreateIndex
CREATE INDEX "sync_jobs_created_at_idx" ON "sync_jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "sync_jobs_status_created_at_idx" ON "sync_jobs"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sync_jobs_band_id_status_idx" ON "sync_jobs"("band_id", "status");

-- CreateIndex
CREATE INDEX "quota_usage_log_timestamp_idx" ON "quota_usage_log"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "quota_usage_log_operation_idx" ON "quota_usage_log"("operation");

-- CreateIndex
CREATE INDEX "quota_usage_log_band_id_idx" ON "quota_usage_log"("band_id");

-- CreateIndex
CREATE INDEX "quota_usage_log_sync_job_id_idx" ON "quota_usage_log"("sync_job_id");

-- CreateIndex
CREATE INDEX "quota_usage_log_success_idx" ON "quota_usage_log"("success");

-- CreateIndex
CREATE INDEX "quota_usage_log_cache_hit_idx" ON "quota_usage_log"("cache_hit");

-- CreateIndex
CREATE INDEX "quota_usage_log_timestamp_operation_idx" ON "quota_usage_log"("timestamp" DESC, "operation");

-- CreateIndex
CREATE INDEX "quota_usage_log_timestamp_band_id_idx" ON "quota_usage_log"("timestamp" DESC, "band_id");

-- CreateIndex
CREATE UNIQUE INDEX "quota_daily_summary_date_key" ON "quota_daily_summary"("date");

-- CreateIndex
CREATE INDEX "quota_daily_summary_date_idx" ON "quota_daily_summary"("date" DESC);

-- CreateIndex
CREATE INDEX "quota_daily_summary_percentage_used_idx" ON "quota_daily_summary"("percentage_used" DESC);

-- CreateIndex
CREATE INDEX "quota_alerts_timestamp_idx" ON "quota_alerts"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "quota_alerts_level_idx" ON "quota_alerts"("level");

-- CreateIndex
CREATE INDEX "quota_alerts_acknowledged_idx" ON "quota_alerts"("acknowledged");

-- CreateIndex
CREATE INDEX "quota_alerts_level_acknowledged_idx" ON "quota_alerts"("level", "acknowledged");

-- CreateIndex
CREATE UNIQUE INDEX "popular_searches_query_key" ON "popular_searches"("query");

-- CreateIndex
CREATE INDEX "popular_searches_searchCount_idx" ON "popular_searches"("searchCount");

-- CreateIndex
CREATE INDEX "popular_searches_lastSearched_idx" ON "popular_searches"("lastSearched");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_key_idx" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_is_active_idx" ON "api_keys"("is_active");

-- CreateIndex
CREATE INDEX "api_keys_expires_at_idx" ON "api_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_key" ON "user_sessions"("token");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_token_idx" ON "user_sessions"("token");

-- CreateIndex
CREATE INDEX "search_logs_query_idx" ON "search_logs"("query");

-- CreateIndex
CREATE INDEX "search_logs_created_at_idx" ON "search_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "search_logs_user_id_idx" ON "search_logs"("user_id");

-- CreateIndex
CREATE INDEX "featured_band_clicks_band_id_idx" ON "featured_band_clicks"("band_id");

-- CreateIndex
CREATE INDEX "featured_band_clicks_clicked_at_idx" ON "featured_band_clicks"("clicked_at");

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
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "content_creators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "content_creators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_opponent_band_id_fkey" FOREIGN KEY ("opponent_band_id") REFERENCES "bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_videos" ADD CONSTRAINT "event_videos_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bands" ADD CONSTRAINT "event_bands_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_password_reset_tokens" ADD CONSTRAINT "admin_password_reset_tokens_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "admin_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandMetrics" ADD CONSTRAINT "BandMetrics_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBandFavorite" ADD CONSTRAINT "UserBandFavorite_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandShare" ADD CONSTRAINT "BandShare_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_usage_log" ADD CONSTRAINT "quota_usage_log_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_usage_log" ADD CONSTRAINT "quota_usage_log_sync_job_id_fkey" FOREIGN KEY ("sync_job_id") REFERENCES "sync_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_band_clicks" ADD CONSTRAINT "featured_band_clicks_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_videos" ADD CONSTRAINT "favorite_videos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_videos" ADD CONSTRAINT "favorite_videos_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_bands" ADD CONSTRAINT "favorite_bands_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_bands" ADD CONSTRAINT "favorite_bands_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_later" ADD CONSTRAINT "watch_later_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_later" ADD CONSTRAINT "watch_later_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
