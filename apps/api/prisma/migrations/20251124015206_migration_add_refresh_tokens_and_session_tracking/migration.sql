/*
  Warnings:

  - You are about to drop the column `created_at` on the `admin_users` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `admin_users` table. All the data in the column will be lost.
  - You are about to drop the column `last_login_at` on the `admin_users` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `admin_users` table. All the data in the column will be lost.
  - The `role` column on the `admin_users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `admin_user_id` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `details` on the `audit_logs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_admin_user_id_fkey";

-- DropIndex
DROP INDEX "audit_logs_admin_user_id_idx";

-- AlterTable
ALTER TABLE "admin_users" DROP COLUMN "created_at",
DROP COLUMN "is_active",
DROP COLUMN "last_login_at",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "role",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'admin',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "admin_user_id",
DROP COLUMN "details",
ADD COLUMN     "user_id" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
