-- Offers, cashback wallet, referrals, product alerts and review trust features.

-- Coupons: scope, visibility, auto-apply, terms
ALTER TABLE "coupons"
    ADD COLUMN "title" TEXT,
    ADD COLUMN "terms" TEXT,
    ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "auto_apply" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "product_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "excluded_product_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "excluded_category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Orders: wallet use and automatic discounts
ALTER TABLE "orders"
    ADD COLUMN "wallet_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "auto_discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "auto_discount_label" TEXT;

-- Users: referral code and referrer
ALTER TABLE "users"
    ADD COLUMN "referral_code" TEXT,
    ADD COLUMN "referred_by_id" TEXT;
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- Wishlist price-drop baseline
ALTER TABLE "wishlist_items" ADD COLUMN "price_at_add" DOUBLE PRECISION;

-- Reviews: variant, verified purchase, seller rating, reports
ALTER TABLE "reviews"
    ADD COLUMN "variant_label" TEXT,
    ADD COLUMN "variant_id" TEXT,
    ADD COLUMN "verified_purchase" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "order_id" TEXT,
    ADD COLUMN "seller_rating" INTEGER,
    ADD COLUMN "report_count" INTEGER NOT NULL DEFAULT 0;

-- Wallet
CREATE TYPE "WalletTxnKind" AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "WalletTxnSource" AS ENUM ('CASHBACK', 'REFERRAL', 'CHECKOUT', 'ORDER_REFUND', 'EXPIRY', 'ADMIN');
CREATE TYPE "WalletTxnStatus" AS ENUM ('PENDING', 'AVAILABLE', 'REVERSED', 'DONE');

CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "WalletTxnKind" NOT NULL,
    "source" "WalletTxnSource" NOT NULL,
    "status" "WalletTxnStatus" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remaining" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order_id" TEXT,
    "note" TEXT,
    "available_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "wallet_transactions_user_id_status_idx" ON "wallet_transactions"("user_id", "status");
CREATE INDEX "wallet_transactions_order_id_idx" ON "wallet_transactions"("order_id");
CREATE INDEX "wallet_transactions_status_available_at_idx" ON "wallet_transactions"("status", "available_at");
CREATE INDEX "wallet_transactions_status_expires_at_idx" ON "wallet_transactions"("status", "expires_at");

-- Referrals
CREATE TYPE "ReferralStatus" AS ENUM ('SIGNED_UP', 'ORDERED', 'REWARDED', 'CANCELLED');

CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referred_user_id" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'SIGNED_UP',
    "first_order_id" TEXT,
    "rewarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "referrals_referred_user_id_key" ON "referrals"("referred_user_id");
CREATE INDEX "referrals_referrer_id_idx" ON "referrals"("referrer_id");

-- Product alerts
CREATE TYPE "ProductAlertType" AS ENUM ('BACK_IN_STOCK', 'PRICE_DROP');

CREATE TABLE "product_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL DEFAULT '',
    "type" "ProductAlertType" NOT NULL,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_alerts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_alerts_user_id_product_id_variant_id_type_key" ON "product_alerts"("user_id", "product_id", "variant_id", "type");
CREATE INDEX "product_alerts_type_notified_at_idx" ON "product_alerts"("type", "notified_at");

-- Review votes and reports
CREATE TABLE "review_votes" (
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_votes_pkey" PRIMARY KEY ("review_id", "user_id")
);

CREATE TABLE "review_reports" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "review_reports_review_id_user_id_key" ON "review_reports"("review_id", "user_id");
CREATE INDEX "review_reports_resolved_at_idx" ON "review_reports"("resolved_at");

-- Product Q&A
CREATE TABLE "product_questions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "answered_by" TEXT,
    "answered_at" TIMESTAMP(3),
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_questions_product_id_answered_at_idx" ON "product_questions"("product_id", "answered_at");
CREATE INDEX "product_questions_answered_at_idx" ON "product_questions"("answered_at");

-- Incorrect product information reports
CREATE TABLE "product_reports" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_reports_status_created_at_idx" ON "product_reports"("status", "created_at");
CREATE INDEX "product_reports_product_id_idx" ON "product_reports"("product_id");
