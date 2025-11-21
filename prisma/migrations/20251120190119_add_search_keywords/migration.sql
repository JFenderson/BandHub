-- AlterTable
ALTER TABLE "bands" ADD COLUMN     "search_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
