/*
  Warnings:

  - You are about to drop the column `admin_user_id` on the `admin_password_reset_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `admin_password_reset_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `expires_at` on the `admin_password_reset_tokens` table. All the data in the column will be lost.
  - Added the required column `adminUserId` to the `admin_password_reset_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expireAt` to the `admin_password_reset_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BandType" AS ENUM ('HBCU', 'ALL_STAR');

-- DropForeignKey
ALTER TABLE "admin_password_reset_tokens" DROP CONSTRAINT "admin_password_reset_tokens_admin_user_id_fkey";

-- DropIndex
DROP INDEX "admin_password_reset_tokens_admin_user_id_idx";

-- DropIndex
DROP INDEX "admin_password_reset_tokens_expires_at_idx";

-- AlterTable
ALTER TABLE "admin_password_reset_tokens" DROP COLUMN "admin_user_id",
DROP COLUMN "created_at",
DROP COLUMN "expires_at",
ADD COLUMN     "adminUserId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expireAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "bands" ADD COLUMN     "band_type" "BandType" NOT NULL DEFAULT 'HBCU',
ALTER COLUMN "city" DROP NOT NULL;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "applicableTypes" "BandType"[] DEFAULT ARRAY['HBCU', 'ALL_STAR']::"BandType"[];

-- CreateIndex
CREATE INDEX "admin_password_reset_tokens_adminUserId_idx" ON "admin_password_reset_tokens"("adminUserId");

-- CreateIndex
CREATE INDEX "admin_password_reset_tokens_expireAt_idx" ON "admin_password_reset_tokens"("expireAt");

-- CreateIndex
CREATE INDEX "bands_band_type_idx" ON "bands"("band_type");

-- AddForeignKey
ALTER TABLE "admin_password_reset_tokens" ADD CONSTRAINT "admin_password_reset_tokens_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
