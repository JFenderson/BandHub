-- CreateIndex
CREATE INDEX "videos_band_id_published_at_is_hidden_idx" ON "videos"("band_id", "published_at" DESC, "is_hidden");

-- CreateIndex
CREATE INDEX "videos_category_id_quality_score_idx" ON "videos"("category_id", "quality_score" DESC);

-- CreateIndex
CREATE INDEX "videos_created_at_idx" ON "videos"("created_at" DESC);

-- CreateIndex
CREATE INDEX "videos_event_year_event_name_idx" ON "videos"("event_year", "event_name");
