-- Public catalog and dashboard hot-path indexes.
-- All indexes are additive and safe for existing data.

CREATE INDEX IF NOT EXISTS "products_public_status_created_at_idx"
ON "products" ("status", "deleted_by_admin", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "products_public_category_status_created_at_idx"
ON "products" ("category_id", "status", "deleted_by_admin", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "product_variants_approved_price_idx"
ON "product_variants" ("product_id", "status", "price", "created_at");

CREATE INDEX IF NOT EXISTS "order_items_seller_order_idx"
ON "order_items" ("seller_id", "order_id");

CREATE INDEX IF NOT EXISTS "order_items_seller_product_idx"
ON "order_items" ("seller_id", "product_id");

CREATE INDEX IF NOT EXISTS "seller_settlements_seller_status_order_idx"
ON "seller_settlements" ("seller_id", "status", "order_id");

CREATE INDEX IF NOT EXISTS "notifications_user_read_created_at_idx"
ON "notifications" ("user_id", "is_read", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "notifications_user_created_at_idx"
ON "notifications" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "wishlist_items_wishlist_created_at_idx"
ON "wishlist_items" ("wishlist_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "reviews_product_hidden_created_at_idx"
ON "reviews" ("product_id", "is_hidden", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "cancellation_requests_user_created_at_idx"
ON "cancellation_requests" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "cancellation_requests_status_created_at_idx"
ON "cancellation_requests" ("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "return_requests_user_created_at_idx"
ON "return_requests" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "return_requests_status_created_at_idx"
ON "return_requests" ("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "reels_status_created_at_idx"
ON "reels" ("status", "created_at" DESC);
