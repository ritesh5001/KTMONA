-- Add safety indexes and unique constraint on inventory_movements
-- Prevents duplicate RESERVE/RELEASE per (order, variant, type) and speeds up integrity queries.

-- Unique constraint: one RESERVE and one RELEASE per (order, variant)
CREATE UNIQUE INDEX "inventory_movements_order_variant_type_key" ON "inventory_movements"("order_id", "variant_id", "type");

-- Composite index for integrity check queries: aggregating by (variant, type)
CREATE INDEX "inventory_movements_variant_type_idx" ON "inventory_movements"("variant_id", "type");

-- Index on createdAt for stale-order cleanup queries
CREATE INDEX "inventory_movements_created_at_idx" ON "inventory_movements"("created_at");
