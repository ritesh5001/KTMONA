-- CreateIndex: order.createdAt for analytics time-range queries
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex: sellerSettlement.createdAt for revenue chart grouping
CREATE INDEX IF NOT EXISTS "seller_settlements_created_at_idx" ON "seller_settlements"("created_at");
