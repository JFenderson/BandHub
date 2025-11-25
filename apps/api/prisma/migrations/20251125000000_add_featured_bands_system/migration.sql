-- AlterTable: Add featured fields to bands
ALTER TABLE "bands" ADD COLUMN "featured_order" INTEGER;
ALTER TABLE "bands" ADD COLUMN "featured_since" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bands_featured_order_idx" ON "bands"("featured_order");

-- CreateTable
CREATE TABLE "featured_band_clicks" (
    "id" TEXT NOT NULL,
    "band_id" TEXT NOT NULL,
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" TEXT,

    CONSTRAINT "featured_band_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "featured_band_clicks_band_id_idx" ON "featured_band_clicks"("band_id");

-- CreateIndex
CREATE INDEX "featured_band_clicks_clicked_at_idx" ON "featured_band_clicks"("clicked_at");

-- AddForeignKey
ALTER TABLE "featured_band_clicks" ADD CONSTRAINT "featured_band_clicks_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
