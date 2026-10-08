-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_PRODUCT_APPROVED';

-- AlterTable
ALTER TABLE "products"
ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT;

-- Backfill existing products to keep backward compatibility
UPDATE "products"
SET "status" = CASE
	WHEN "deleted_by_admin" = true THEN 'REJECTED'::"ProductStatus"
	WHEN "is_published" = true THEN 'APPROVED'::"ProductStatus"
	ELSE 'PENDING'::"ProductStatus"
END;

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");