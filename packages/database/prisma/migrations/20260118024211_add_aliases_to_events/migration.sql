-- AlterTable
ALTER TABLE "events" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
