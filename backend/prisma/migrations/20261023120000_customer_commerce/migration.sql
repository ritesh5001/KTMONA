-- Customer commerce batch: save for later, checkout idempotency, returnable flag,
-- return/replacement details, shipment delay notice, saved payments, account
-- deletion requests and notification consent.

-- AlterEnum
ALTER TYPE "ReturnStatus" ADD VALUE IF NOT EXISTS 'REPLACED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_UPDATE';

-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('RETURN', 'REPLACEMENT');

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN "saved_for_later" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "checkout_key" TEXT;
CREATE UNIQUE INDEX "orders_checkout_key_key" ON "orders"("checkout_key");

-- AlterTable
ALTER TABLE "products" ADD COLUMN "is_returnable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "return_requests"
    ADD COLUMN "type" "ReturnType" NOT NULL DEFAULT 'RETURN',
    ADD COLUMN "reason_code" TEXT,
    ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "pickup_status" TEXT,
    ADD COLUMN "pickup_date" TIMESTAMP(3),
    ADD COLUMN "pickup_carrier" TEXT,
    ADD COLUMN "pickup_tracking" TEXT,
    ADD COLUMN "replacement_tracking" TEXT,
    ADD COLUMN "appeal_note" TEXT,
    ADD COLUMN "appealed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "delay_notified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "razorpay_customer_id" TEXT,
    ADD COLUMN "deletion_requested_at" TIMESTAMP(3),
    ADD COLUMN "deletion_reason" TEXT;
CREATE UNIQUE INDEX "users_razorpay_customer_id_key" ON "users"("razorpay_customer_id");

-- AlterTable
ALTER TABLE "user_preferences"
    ADD COLUMN "whatsapp_notifications" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "marketing_notifications" BOOLEAN NOT NULL DEFAULT false;
