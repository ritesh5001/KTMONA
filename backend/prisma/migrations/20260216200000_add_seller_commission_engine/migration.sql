-- Phase 8D: Seller Commission Engine

-- Add SETTLED value to SettlementStatus enum
ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'SETTLED';

-- Create seller_commission_configs table
CREATE TABLE "seller_commission_configs" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "commission_pct" DECIMAL(5,2) NOT NULL,
    "platform_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_commission_configs_pkey" PRIMARY KEY ("id")
);

-- Unique index on seller_id
CREATE UNIQUE INDEX "seller_commission_configs_seller_id_key" ON "seller_commission_configs"("seller_id");

-- FK to users
ALTER TABLE "seller_commission_configs" ADD CONSTRAINT "seller_commission_configs_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Evolve seller_settlements: drop old columns, add new columns
-- Drop existing data (dev environment, safe with db push)
TRUNCATE TABLE "seller_settlements";

-- Drop old column
ALTER TABLE "seller_settlements" DROP COLUMN IF EXISTS "order_item_id";
ALTER TABLE "seller_settlements" DROP COLUMN IF EXISTS "amount";

-- Add new columns
ALTER TABLE "seller_settlements" ADD COLUMN "order_id" TEXT NOT NULL;
ALTER TABLE "seller_settlements" ADD COLUMN "gross_amount" DOUBLE PRECISION NOT NULL;
ALTER TABLE "seller_settlements" ADD COLUMN "commission_amount" DOUBLE PRECISION NOT NULL;
ALTER TABLE "seller_settlements" ADD COLUMN "platform_fee" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "seller_settlements" ADD COLUMN "net_amount" DOUBLE PRECISION NOT NULL;
ALTER TABLE "seller_settlements" ADD COLUMN "settled_at" TIMESTAMP(3);

-- Unique constraint on (order_id, seller_id)
CREATE UNIQUE INDEX "seller_settlements_order_id_seller_id_key" ON "seller_settlements"("order_id", "seller_id");

-- FK to orders
ALTER TABLE "seller_settlements" ADD CONSTRAINT "seller_settlements_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK to users
ALTER TABLE "seller_settlements" ADD CONSTRAINT "seller_settlements_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
