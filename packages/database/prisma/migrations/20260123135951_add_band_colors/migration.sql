-- CreateTable
CREATE TABLE "api_key_usage_logs" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "endpoint" TEXT,
    "method" TEXT,
    "avg_response_time" DOUBLE PRECISION,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "api_key_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_key_usage_logs_api_key_id_date_idx" ON "api_key_usage_logs"("api_key_id", "date" DESC);

-- CreateIndex
CREATE INDEX "api_key_usage_logs_date_idx" ON "api_key_usage_logs"("date");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_usage_logs_api_key_id_date_key" ON "api_key_usage_logs"("api_key_id", "date");

-- AddForeignKey
ALTER TABLE "api_key_usage_logs" ADD CONSTRAINT "api_key_usage_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
