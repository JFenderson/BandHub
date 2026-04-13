-- AlterTable
ALTER TABLE "youtube_videos" ADD COLUMN     "ai_excluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ai_extraction" JSONB,
ADD COLUMN     "ai_processed" BOOLEAN NOT NULL DEFAULT false;
