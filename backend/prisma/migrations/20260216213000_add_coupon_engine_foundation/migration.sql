-- Phase 9A: Coupon / Promocode Engine foundation

-- Coupon type enum
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FLAT');

-- Extend orders with coupon snapshot fields
ALTER TABLE "orders"
  ADD COLUMN "coupon_code" TEXT,
  ADD COLUMN "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Coupons master
CREATE TABLE "coupons" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "CouponType" NOT NULL,
  "value" DECIMAL(10,2) NOT NULL,
  "max_discount_amount" DECIMAL(10,2),
  "min_order_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "usage_limit" INTEGER,
  "per_user_limit" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "valid_from" TIMESTAMP(3) NOT NULL,
  "valid_until" TIMESTAMP(3) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "seller_id" TEXT,
  "first_time_user_only" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_seller_id_idx" ON "coupons"("seller_id");
CREATE INDEX "coupons_valid_from_valid_until_idx" ON "coupons"("valid_from", "valid_until");

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Coupon redemption ledger
CREATE TABLE "coupon_redemptions" (
  "id" TEXT NOT NULL,
  "coupon_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "discount_amount" DECIMAL(10,2) NOT NULL,
  "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupon_redemptions_coupon_id_user_id_order_id_key" ON "coupon_redemptions"("coupon_id", "user_id", "order_id");
CREATE INDEX "coupon_redemptions_user_id_idx" ON "coupon_redemptions"("user_id");

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
