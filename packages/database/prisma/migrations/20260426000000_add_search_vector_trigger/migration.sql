-- Auto-populate search_vector on INSERT/UPDATE of title or description
CREATE OR REPLACE FUNCTION videos_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS videos_search_vector_trigger ON videos;

CREATE TRIGGER videos_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description
  ON videos
  FOR EACH ROW EXECUTE FUNCTION videos_search_vector_update();

-- Backfill all existing rows
UPDATE videos
SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B');
