-- Restore dropped full-text index for search relevance queries.
CREATE INDEX IF NOT EXISTS "products_search_vector_idx"
ON "products" USING GIN ("search_vector");

-- Seller products list hot path: WHERE seller_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS "products_seller_created_at_desc_idx"
ON "products" ("seller_id", "created_at" DESC);

-- Cheapest variant lookup hot path: WHERE product_id IN (...) ORDER BY price, created_at
CREATE INDEX IF NOT EXISTS "product_variants_product_price_created_at_idx"
ON "product_variants" ("product_id", "price", "created_at");

-- Public catalog list hot path.
CREATE INDEX IF NOT EXISTS "products_public_created_at_idx"
ON "products" ("created_at" DESC)
WHERE "status" = 'APPROVED'
  AND "deleted_by_admin" = false
  AND "admin_listing_price" IS NOT NULL;

-- Public catalog list with category filter (marketplace/collections reads).
CREATE INDEX IF NOT EXISTS "products_public_category_created_at_idx"
ON "products" ("category_id", "created_at" DESC)
WHERE "status" = 'APPROVED'
  AND "deleted_by_admin" = false
  AND "admin_listing_price" IS NOT NULL;
