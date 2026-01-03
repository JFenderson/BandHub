-- CreateTable
CREATE TABLE "popular_searches" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 1,
    "lastSearched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "popular_searches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "popular_searches_query_key" ON "popular_searches"("query");

-- CreateIndex
CREATE INDEX "popular_searches_searchCount_idx" ON "popular_searches"("searchCount");

-- CreateIndex
CREATE INDEX "popular_searches_lastSearched_idx" ON "popular_searches"("lastSearched");

-- Add search_vector column to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (
  to_tsvector('english', 
    coalesce(title, '') || ' ' || 
    coalesce(description, '') || ' ' || 
    coalesce(event_name, '') || ' ' ||
    coalesce(tags::text, '')
  )
) STORED;

-- Create GIN index for fast full-text search on videos
CREATE INDEX IF NOT EXISTS videos_search_vector_idx 
ON videos USING GIN (search_vector);

-- Add search_vector column to bands table
ALTER TABLE bands 
ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (
  to_tsvector('english', 
    coalesce(name, '') || ' ' || 
    coalesce(school_name, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(state, '')
  )
) STORED;

-- Create GIN index for fast full-text search on bands
CREATE INDEX IF NOT EXISTS bands_search_vector_idx 
ON bands USING GIN (search_vector);
