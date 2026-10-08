-- Add Mens/Kids audience to products. Existing rows default to MENS.

-- CreateEnum
CREATE TYPE "ProductAudience" AS ENUM ('MENS', 'KIDS');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "audience" "ProductAudience" NOT NULL DEFAULT 'MENS';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_audience_idx" ON "products" ("audience");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_audience_is_published_deleted_by_admin_status_admi_idx"
ON "products" ("audience", "is_published", "deleted_by_admin", "status", "admin_listing_price");
