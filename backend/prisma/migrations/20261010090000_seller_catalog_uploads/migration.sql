-- CreateEnum
CREATE TYPE "CatalogUploadMode" AS ENUM ('SINGLE', 'BULK');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "attributes" JSONB,
ADD COLUMN "legal_info" JSONB,
ADD COLUMN "style_code" TEXT,
ADD COLUMN "catalog_upload_id" TEXT;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "wdrp_price" DOUBLE PRECISION,
ADD COLUMN "prepaid_discount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "catalog_uploads" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "mode" "CatalogUploadMode" NOT NULL,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "draft" JSONB,
    "file_name" TEXT,
    "rows_total" INTEGER NOT NULL DEFAULT 0,
    "rows_failed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_view_daily" (
    "product_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_view_daily_pkey" PRIMARY KEY ("product_id","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_uploads_file_id_key" ON "catalog_uploads"("file_id");

-- CreateIndex
CREATE INDEX "catalog_uploads_seller_id_mode_created_at_idx" ON "catalog_uploads"("seller_id", "mode", "created_at");

-- CreateIndex
CREATE INDEX "product_view_daily_seller_id_day_idx" ON "product_view_daily"("seller_id", "day");

-- CreateIndex
CREATE INDEX "products_catalog_upload_id_idx" ON "products"("catalog_upload_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_catalog_upload_id_fkey" FOREIGN KEY ("catalog_upload_id") REFERENCES "catalog_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
