-- CreateEnum
CREATE TYPE "InventoryMovementReason" AS ENUM ('CHECKOUT', 'CANCELLATION', 'RETURN', 'STALE_CLEANUP', 'MANUAL');

-- AlterTable: add reason column with default
ALTER TABLE "inventory_movements" ADD COLUMN "reason" "InventoryMovementReason" NOT NULL DEFAULT 'CHECKOUT';

-- Drop old unique constraint
DROP INDEX IF EXISTS "inventory_movements_order_variant_type_key";

-- Add new unique constraint including reason
CREATE UNIQUE INDEX "inventory_movements_order_variant_type_reason_key" ON "inventory_movements"("order_id", "variant_id", "type", "reason");
