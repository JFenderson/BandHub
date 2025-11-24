/*
  Warnings:

  - You are about to drop the column `createdAt` on the `api_keys` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `api_keys` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `api_keys` table. All the data in the column will be lost.
  - You are about to drop the column `lastUsedAt` on the `api_keys` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `api_keys` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "api_keys" DROP COLUMN "createdAt",
DROP COLUMN "expiresAt",
DROP COLUMN "isActive",
DROP COLUMN "lastUsedAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "api_keys_key_idx" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_is_active_idx" ON "api_keys"("is_active");
