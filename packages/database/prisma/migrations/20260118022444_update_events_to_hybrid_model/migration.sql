/*
  Warnings:

  - The values [BAYOU_CLASSIC,SWAC_CHAMPIONSHIP,HOMECOMING,COMPETITION,EXHIBITION,OTHER] on the enum `EventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EventType_new" AS ENUM ('BATTLE_OF_THE_BANDS', 'FOOTBALL_GAME', 'PARADE', 'CONCERT', 'SHOWCASE', 'CONFERENCE_CHAMPIONSHIP');
ALTER TABLE "events" ALTER COLUMN "event_type" TYPE "EventType_new" USING ("event_type"::text::"EventType_new");
ALTER TYPE "EventType" RENAME TO "EventType_old";
ALTER TYPE "EventType_new" RENAME TO "EventType";
DROP TYPE "EventType_old";
COMMIT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "is_recurring" SET DEFAULT true;
