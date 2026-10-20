-- ShipMaxx courier integration: a new fulfilment mode, ShipMaxx ids, and the
-- courier status polled from ShipMaxx tracking (it has no webhooks).
ALTER TYPE "FulfillmentMode" ADD VALUE IF NOT EXISTS 'SHIPMAXX';

ALTER TABLE "shipments"
    ADD COLUMN IF NOT EXISTS "shipmaxx_order_id" TEXT,
    ADD COLUMN IF NOT EXISTS "courier_status" TEXT,
    ADD COLUMN IF NOT EXISTS "tracking_synced_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "shipments_fulfillment_mode_status_tracking_synced_at_idx"
    ON "shipments" ("fulfillment_mode", "status", "tracking_synced_at");

ALTER TABLE "seller_profiles" ADD COLUMN IF NOT EXISTS "shipmaxx_warehouse_id" INTEGER;
