-- Add first-class variant pricing + moderation fields.
ALTER TABLE "product_variants"
ADD COLUMN "size" TEXT,
ADD COLUMN "seller_price" DOUBLE PRECISION,
ADD COLUMN "admin_listing_price" DOUBLE PRECISION,
ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "rejection_reason" TEXT,
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "approved_by_id" TEXT;

-- Backfill pricing/moderation from legacy variant + product state.
UPDATE "product_variants" pv
SET
    "size" = COALESCE(
        NULLIF(
            regexp_replace(
                trim(
                    BOTH ' -' FROM regexp_replace(
                        pv."sku",
                        '^.*-',
                        ''
                    )
                ),
                '\s+',
                ' ',
                'g'
            ),
            ''
        ),
        'Default'
    ),
    "seller_price" = COALESCE(pv."price", 0),
    "admin_listing_price" = p."admin_listing_price"::DOUBLE PRECISION,
    "price" = COALESCE(p."admin_listing_price"::DOUBLE PRECISION, pv."price", p."seller_price"::DOUBLE PRECISION, 0),
    "status" = p."status",
    "rejection_reason" = p."rejection_reason",
    "approved_at" = p."approved_at",
    "approved_by_id" = p."approved_by_id"
FROM "products" p
WHERE p."id" = pv."product_id";

-- Normalize duplicate SKUs within a product so the new product-level SKU uniqueness is valid.
WITH ranked AS (
    SELECT
        pv."id",
        pv."product_id",
        pv."sku",
        pv."color",
        ROW_NUMBER() OVER (
            PARTITION BY pv."product_id", pv."sku"
            ORDER BY pv."created_at" ASC, pv."id" ASC
        ) AS rn
    FROM "product_variants" pv
)
UPDATE "product_variants" pv
SET "sku" = CONCAT(
    ranked."sku",
    '-',
    COALESCE(
        NULLIF(
            regexp_replace(lower(COALESCE(ranked."color", 'variant')), '[^a-z0-9]+', '-', 'g'),
            ''
        ),
        'variant'
    ),
    '-',
    ranked.rn
)
FROM ranked
WHERE pv."id" = ranked."id"
  AND ranked.rn > 1;

-- Existing products without variants get a legacy default variant so they remain sellable.
INSERT INTO "product_variants" (
    "id",
    "product_id",
    "size",
    "color",
    "images",
    "sku",
    "seller_price",
    "admin_listing_price",
    "price",
    "compare_at_price",
    "status",
    "rejection_reason",
    "approved_at",
    "approved_by_id",
    "created_at",
    "updated_at"
)
SELECT
    'legacy_' || replace(gen_random_uuid()::text, '-', ''),
    p."id",
    'Default',
    NULL,
    ARRAY[]::TEXT[],
    'LEGACY-DEFAULT',
    COALESCE(p."seller_price"::DOUBLE PRECISION, 0),
    p."admin_listing_price"::DOUBLE PRECISION,
    COALESCE(p."admin_listing_price"::DOUBLE PRECISION, p."seller_price"::DOUBLE PRECISION, 0),
    NULL,
    p."status",
    p."rejection_reason",
    p."approved_at",
    p."approved_by_id",
    NOW(),
    NOW()
FROM "products" p
WHERE NOT EXISTS (
    SELECT 1
    FROM "product_variants" pv
    WHERE pv."product_id" = p."id"
);

-- Ensure every variant has an inventory row.
INSERT INTO "inventory" ("variant_id", "stock", "updated_at")
SELECT pv."id", 0, NOW()
FROM "product_variants" pv
WHERE NOT EXISTS (
    SELECT 1
    FROM "inventory" i
    WHERE i."variant_id" = pv."id"
);

-- Make the new fields required for future writes.
ALTER TABLE "product_variants"
ALTER COLUMN "size" SET NOT NULL,
ALTER COLUMN "size" SET DEFAULT 'Default',
ALTER COLUMN "seller_price" SET NOT NULL;

-- Replace old uniqueness with product-level SKU uniqueness.
ALTER TABLE "product_variants"
DROP CONSTRAINT IF EXISTS "product_variants_product_id_color_sku_key";

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT i.relname AS index_name
        FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_class i ON i.oid = ix.indexrelid
        LEFT JOIN pg_constraint c ON c.conindid = ix.indexrelid
        WHERE n.nspname = 'public'
          AND t.relname = 'product_variants'
          AND ix.indisunique = true
          AND c.oid IS NULL
          AND (
              pg_get_indexdef(i.oid) ILIKE '%(product_id, color, sku)%'
              OR pg_get_indexdef(i.oid) ILIKE '%(sku, color, product_id)%'
          )
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', r.index_name);
    END LOOP;
END $$;

ALTER TABLE "product_variants"
ADD CONSTRAINT "product_variants_product_id_sku_key" UNIQUE ("product_id", "sku");

ALTER TABLE "product_variants"
ADD CONSTRAINT "product_variants_approved_by_id_fkey"
FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "product_variants_product_id_size_color_idx" ON "product_variants"("product_id", "size", "color");
CREATE INDEX "product_variants_status_idx" ON "product_variants"("status");
CREATE INDEX "product_variants_approved_by_id_idx" ON "product_variants"("approved_by_id");
CREATE INDEX "product_variants_product_id_status_idx" ON "product_variants"("product_id", "status");

-- Recompute denormalized product summary prices from variants.
WITH ranked AS (
    SELECT
        pv."product_id",
        pv."seller_price",
        pv."admin_listing_price",
        ROW_NUMBER() OVER (
            PARTITION BY pv."product_id"
            ORDER BY
                CASE WHEN pv."status" = 'APPROVED' THEN 0 ELSE 1 END,
                COALESCE(pv."admin_listing_price", pv."seller_price") ASC,
                pv."created_at" ASC,
                pv."id" ASC
        ) AS rn
    FROM "product_variants" pv
)
UPDATE "products" p
SET
    "seller_price" = ranked."seller_price"::DECIMAL(10,2),
    "admin_listing_price" = ranked."admin_listing_price"::DECIMAL(10,2)
FROM ranked
WHERE ranked."product_id" = p."id"
  AND ranked.rn = 1;
