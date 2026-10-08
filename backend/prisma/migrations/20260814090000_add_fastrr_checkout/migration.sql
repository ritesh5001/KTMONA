-- Shiprocket Checkout (Fastrr).
--
-- Fastrr hosts the address + payment step, so between minting an access token and
-- their webhook landing there is no order in this database at all — only a
-- checkout session. Their webhook identifies the checkout solely by their own
-- order id, so this table is the only way back to our user, our variants and our
-- coupon. Without it a successful payment would arrive with nowhere to land.
--
-- Additive and idempotent; nothing here touches the existing PhonePe flow.

-- Fastrr brokers the gateway rather than being one, so the underlying
-- Razorpay/UPI transaction id is recorded in payments.provider_payment_id.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'FASTRR';

DO $$
BEGIN
    CREATE TYPE "FastrrSessionStatus" AS ENUM ('INITIATED', 'COMPLETED', 'FAILED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "fastrr_checkout_sessions" (
    "id"              TEXT NOT NULL,
    "fastrr_order_id" TEXT NOT NULL,
    "user_id"         TEXT NOT NULL,
    "cart_id"         TEXT,
    -- Snapshot of exactly what was sent to Fastrr. Deliberately not a live join:
    -- a price edit or a deleted variant between token and webhook must not change
    -- what the buyer is billed for.
    "items"           JSONB NOT NULL,
    "coupon_code"     TEXT,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mobile_app"      BOOLEAN NOT NULL DEFAULT false,
    "status"          "FastrrSessionStatus" NOT NULL DEFAULT 'INITIATED',
    -- Set once the order exists here. UNIQUE is the idempotency guarantee: a
    -- redelivered webhook cannot mint a second order for the same checkout.
    "order_id"        TEXT,
    "failure_reason"  TEXT,
    "last_polled_at"  TIMESTAMP(3),
    "expires_at"      TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fastrr_checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fastrr_checkout_sessions_fastrr_order_id_key"
    ON "fastrr_checkout_sessions"("fastrr_order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "fastrr_checkout_sessions_order_id_key"
    ON "fastrr_checkout_sessions"("order_id");

CREATE INDEX IF NOT EXISTS "fastrr_checkout_sessions_user_id_idx"
    ON "fastrr_checkout_sessions"("user_id");

-- Drives the reconciliation sweep: oldest INITIATED sessions first.
CREATE INDEX IF NOT EXISTS "fastrr_checkout_sessions_status_created_at_idx"
    ON "fastrr_checkout_sessions"("status", "created_at");

DO $$
BEGIN
    ALTER TABLE "fastrr_checkout_sessions"
        ADD CONSTRAINT "fastrr_checkout_sessions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE "fastrr_checkout_sessions"
        ADD CONSTRAINT "fastrr_checkout_sessions_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;
