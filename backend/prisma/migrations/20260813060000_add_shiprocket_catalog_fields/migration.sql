-- Fields the Shiprocket (Fastrr) catalog sync needs that this schema never had.
--
-- Shiprocket keys its catalog on unique long ids, but every primary key here is a
-- CUID string. Hashing one into a number risks collisions and shifts if the hash
-- ever changes, so each synced table gets a BIGSERIAL surrogate instead: Postgres
-- assigns it once, it never changes, and the CUID stays the internal key.
--
-- All additive and idempotent — existing rows keep working untouched.

-- Numeric surrogates for the three tables Shiprocket reads.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "external_id" BIGSERIAL;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "external_id" BIGSERIAL;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "external_id" BIGSERIAL;

CREATE UNIQUE INDEX IF NOT EXISTS "products_external_id_key" ON "products"("external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_external_id_key" ON "product_variants"("external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "categories_external_id_key" ON "categories"("external_id");

-- Shiprocket keys products on `handle`. Deriving it from the title per request
-- would mean a title edit silently creates a new product on their side, so it is
-- stored once and left alone. Backfilled by scripts/backfill-product-slugs.ts.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key" ON "products"("slug");

-- Shipping is rated on weight, and nothing here stored one. Per variant, because
-- a 44 weighs more than a 36. NULL means "not measured yet" — the catalog API
-- substitutes a category fallback rather than declaring a parcel weightless.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "weight_grams" INTEGER;

-- Categories tracked created_at only, so Shiprocket had no way to tell when a
-- collection last changed.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);
UPDATE "categories" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
