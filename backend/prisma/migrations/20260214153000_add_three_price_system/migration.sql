-- AlterTable
ALTER TABLE "products"
ADD COLUMN     "seller_price" DECIMAL(10,2),
ADD COLUMN     "admin_listing_price" DECIMAL(10,2),
ADD COLUMN     "price_approved_at" TIMESTAMP(3),
ADD COLUMN     "price_approved_by_id" TEXT;

-- Backfill seller price from first available variant price to maintain compatibility
UPDATE "products" p
SET "seller_price" = COALESCE(
    (
        SELECT MIN(pv."price")::DECIMAL(10,2)
        FROM "product_variants" pv
        WHERE pv."product_id" = p."id"
    ),
    0
)
WHERE p."seller_price" IS NULL;

-- Make seller_price required
ALTER TABLE "products"
ALTER COLUMN "seller_price" SET NOT NULL;

-- Add relation + indexes for price approval metadata
ALTER TABLE "products"
ADD CONSTRAINT "products_price_approved_by_id_fkey"
FOREIGN KEY ("price_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "products_admin_listing_price_idx" ON "products"("admin_listing_price");
CREATE INDEX "products_price_approved_by_id_idx" ON "products"("price_approved_by_id");

-- AlterTable
ALTER TABLE "order_items"
ADD COLUMN     "seller_price_snapshot" DOUBLE PRECISION,
ADD COLUMN     "admin_price_snapshot" DOUBLE PRECISION,
ADD COLUMN     "platform_margin" DOUBLE PRECISION;

-- Backfill snapshots for existing order items
UPDATE "order_items"
SET "seller_price_snapshot" = "price_snapshot",
    "admin_price_snapshot" = "price_snapshot",
    "platform_margin" = 0
WHERE "seller_price_snapshot" IS NULL
   OR "admin_price_snapshot" IS NULL
   OR "platform_margin" IS NULL;

-- Make snapshot fields required for new writes
ALTER TABLE "order_items"
ALTER COLUMN "seller_price_snapshot" SET NOT NULL,
ALTER COLUMN "admin_price_snapshot" SET NOT NULL,
ALTER COLUMN "platform_margin" SET NOT NULL;