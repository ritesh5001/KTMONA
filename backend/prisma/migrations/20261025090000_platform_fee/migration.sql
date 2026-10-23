-- Platform fee charged on an order, recorded on its own so it can be shown
-- separately from GST. It stays included in total_tax_amount as before.
ALTER TABLE "orders" ADD COLUMN "platform_fee_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
