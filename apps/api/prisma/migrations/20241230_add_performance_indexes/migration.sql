-- Migration: Add Performance Indexes and Full-Text Search
-- This migration adds tsvector columns, GIN indexes, composite indexes, and triggers
-- to optimize query performance for HBCU Band Hub

-- ============================================================================
-- PART 1: Add tsvector columns for full-text search
-- ============================================================================

-- Add search_vector column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add search_vector column to bands table
ALTER TABLE bands ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add search_vector column to youtube_videos table
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ============================================================================
-- PART 2: Create functions to update tsvector columns
-- ============================================================================

-- Function to update videos search vector
CREATE OR REPLACE FUNCTION videos_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.event_name, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update bands search vector
CREATE OR REPLACE FUNCTION bands_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.school_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.city, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(NEW.search_keywords, ' ')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update youtube_videos search vector
CREATE OR REPLACE FUNCTION youtube_videos_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.channel_title, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 3: Create triggers to automatically update search vectors
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS videos_search_vector_trigger ON videos;
DROP TRIGGER IF EXISTS bands_search_vector_trigger ON bands;
DROP TRIGGER IF EXISTS youtube_videos_search_vector_trigger ON youtube_videos;

-- Create trigger for videos
CREATE TRIGGER videos_search_vector_trigger
  BEFORE INSERT OR UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION videos_search_vector_update();

-- Create trigger for bands
CREATE TRIGGER bands_search_vector_trigger
  BEFORE INSERT OR UPDATE ON bands
  FOR EACH ROW
  EXECUTE FUNCTION bands_search_vector_update();

-- Create trigger for youtube_videos
CREATE TRIGGER youtube_videos_search_vector_trigger
  BEFORE INSERT OR UPDATE ON youtube_videos
  FOR EACH ROW
  EXECUTE FUNCTION youtube_videos_search_vector_update();

-- ============================================================================
-- PART 4: Populate existing search vectors
-- ============================================================================

-- Update existing videos
UPDATE videos SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(event_name, '')), 'C') ||
  setweight(to_tsvector('english', array_to_string(tags, ' ')), 'D')
WHERE search_vector IS NULL;

-- Update existing bands
UPDATE bands SET search_vector = 
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(school_name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(city, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('english', array_to_string(search_keywords, ' ')), 'D')
WHERE search_vector IS NULL;

-- Update existing youtube_videos
UPDATE youtube_videos SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(channel_title, '')), 'C')
WHERE search_vector IS NULL;

-- ============================================================================
-- PART 5: Create GIN indexes for full-text search
-- ============================================================================

-- GIN index for videos full-text search
CREATE INDEX IF NOT EXISTS videos_search_vector_idx ON videos USING GIN(search_vector);

-- GIN index for bands full-text search
CREATE INDEX IF NOT EXISTS bands_search_vector_idx ON bands USING GIN(search_vector);

-- GIN index for youtube_videos full-text search
CREATE INDEX IF NOT EXISTS youtube_videos_search_vector_idx ON youtube_videos USING GIN(search_vector);

-- ============================================================================
-- PART 6: Additional composite indexes for common queries
-- ============================================================================

-- Videos table composite indexes
CREATE INDEX IF NOT EXISTS videos_band_hidden_published_idx 
  ON videos(band_id, is_hidden, published_at DESC);

CREATE INDEX IF NOT EXISTS videos_category_hidden_published_idx 
  ON videos(category_id, is_hidden, published_at DESC);

CREATE INDEX IF NOT EXISTS videos_band_category_hidden_idx 
  ON videos(band_id, category_id, is_hidden);

CREATE INDEX IF NOT EXISTS videos_event_year_hidden_idx 
  ON videos(event_year, is_hidden);

CREATE INDEX IF NOT EXISTS videos_opponent_hidden_idx 
  ON videos(opponent_band_id, is_hidden) WHERE opponent_band_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS videos_duration_idx 
  ON videos(duration);

CREATE INDEX IF NOT EXISTS videos_viewcount_idx 
  ON videos(view_count DESC);

CREATE INDEX IF NOT EXISTS videos_quality_idx 
  ON videos(quality_score DESC);

CREATE INDEX IF NOT EXISTS videos_band_viewcount_idx 
  ON videos(band_id, view_count DESC);

CREATE INDEX IF NOT EXISTS videos_hidden_published_idx 
  ON videos(is_hidden, published_at DESC);

-- Bands table composite indexes
CREATE INDEX IF NOT EXISTS bands_state_conference_idx 
  ON bands(state, conference);

CREATE INDEX IF NOT EXISTS bands_active_state_idx 
  ON bands(is_active, state);

CREATE INDEX IF NOT EXISTS bands_featured_order_idx 
  ON bands(is_featured, featured_order) WHERE is_featured = true;

-- YouTubeVideo table composite indexes
CREATE INDEX IF NOT EXISTS youtube_videos_channel_status_idx 
  ON youtube_videos(channel_id, sync_status);

CREATE INDEX IF NOT EXISTS youtube_videos_channel_synced_idx 
  ON youtube_videos(channel_id, last_synced_at);

CREATE INDEX IF NOT EXISTS youtube_videos_status_created_idx 
  ON youtube_videos(sync_status, created_at DESC);

-- ContentCreator table composite index
CREATE INDEX IF NOT EXISTS content_creators_featured_quality_idx 
  ON content_creators(is_featured, quality_score DESC) WHERE is_featured = true;

-- SyncJob table composite indexes
CREATE INDEX IF NOT EXISTS sync_jobs_status_created_idx 
  ON sync_jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS sync_jobs_band_status_idx 
  ON sync_jobs(band_id, status) WHERE band_id IS NOT NULL;

-- AuditLog table composite indexes
CREATE INDEX IF NOT EXISTS audit_logs_admin_created_idx 
  ON audit_logs(admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_entity_type_id_idx 
  ON audit_logs(entity_type, entity_id);

-- Events table composite index
CREATE INDEX IF NOT EXISTS events_active_year_idx 
  ON events(is_active, year) WHERE is_active = true;

-- ============================================================================
-- PART 7: Analyze tables to update statistics
-- ============================================================================

ANALYZE videos;
ANALYZE bands;
ANALYZE youtube_videos;
ANALYZE content_creators;
ANALYZE sync_jobs;
ANALYZE audit_logs;
ANALYZE events;

-- ============================================================================
-- PART 8: Create helpful database functions for search
-- ============================================================================

-- Function to search videos with ranking
CREATE OR REPLACE FUNCTION search_videos(
  search_query text,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id text,
  title text,
  rank real
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.title,
    ts_rank(v.search_vector, plainto_tsquery('english', search_query)) as rank
  FROM videos v
  WHERE v.search_vector @@ plainto_tsquery('english', search_query)
    AND v.is_hidden = false
  ORDER BY rank DESC, v.published_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get video count by band with caching hint
CREATE OR REPLACE FUNCTION get_band_video_counts()
RETURNS TABLE (
  band_id text,
  video_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.band_id,
    COUNT(*) as video_count
  FROM videos v
  WHERE v.is_hidden = false
  GROUP BY v.band_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Output migration summary
DO $$
DECLARE
  video_count integer;
  band_count integer;
  youtube_video_count integer;
BEGIN
  SELECT COUNT(*) INTO video_count FROM videos;
  SELECT COUNT(*) INTO band_count FROM bands;
  SELECT COUNT(*) INTO youtube_video_count FROM youtube_videos;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Performance Indexes Migration Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Videos indexed: %', video_count;
  RAISE NOTICE 'Bands indexed: %', band_count;
  RAISE NOTICE 'YouTube videos indexed: %', youtube_video_count;
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Full-text search is now enabled with tsvector';
  RAISE NOTICE 'All composite indexes have been created';
  RAISE NOTICE 'Triggers are active for automatic updates';
  RAISE NOTICE '============================================';
END $$;