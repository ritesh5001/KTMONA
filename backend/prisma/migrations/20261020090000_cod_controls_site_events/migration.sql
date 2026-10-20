-- Admin switches to turn Cash on Delivery off per customer, seller or product.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cod_disabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cod_disabled" BOOLEAN NOT NULL DEFAULT false;

-- Storefront traffic (visitors, seller sign-up attempts, product views).
CREATE TABLE IF NOT EXISTS "site_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "user_id" TEXT,
    "product_id" TEXT NOT NULL DEFAULT '',
    "day" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "site_events_type_visitor_id_day_product_id_key" ON "site_events"("type", "visitor_id", "day", "product_id");
CREATE INDEX IF NOT EXISTS "site_events_type_day_idx" ON "site_events"("type", "day");
