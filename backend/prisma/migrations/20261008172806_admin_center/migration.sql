-- CreateEnum
CREATE TYPE "PlatformCampaignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnnouncementLevel" AS ENUM ('INFO', 'WARNING', 'SUCCESS');

-- AlterTable
ALTER TABLE "seller_ledger_entries" ADD COLUMN     "payout_id" TEXT,
ADD COLUMN     "waived_at" TIMESTAMP(3),
ADD COLUMN     "waived_by" TEXT;

-- AlterTable
ALTER TABLE "seller_offers" ADD COLUMN     "campaign_id" TEXT;

-- AlterTable
ALTER TABLE "seller_profiles" ADD COLUMN     "kyc_rejection_reason" TEXT,
ADD COLUMN     "kyc_verified_at" TIMESTAMP(3),
ADD COLUMN     "payout_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payout_hold_reason" TEXT,
ADD COLUMN     "status_reason" TEXT;

-- AlterTable
ALTER TABLE "seller_settlements" ADD COLUMN     "payout_id" TEXT;

-- CreateTable
CREATE TABLE "seller_payouts" (
    "id" TEXT NOT NULL,
    "payout_number" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "settlements_amount" DOUBLE PRECISION NOT NULL,
    "ledger_amount" DOUBLE PRECISION NOT NULL,
    "settlement_count" INTEGER NOT NULL,
    "ledger_count" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "note" TEXT,
    "bank_snapshot" JSONB,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "banner_image" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "join_deadline" TIMESTAMP(3),
    "min_discount_percent" DOUBLE PRECISION NOT NULL,
    "category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PlatformCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "level" "AnnouncementLevel" NOT NULL DEFAULT 'INFO',
    "link_url" TEXT,
    "link_label" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_payouts_payout_number_key" ON "seller_payouts"("payout_number");

-- CreateIndex
CREATE INDEX "seller_payouts_seller_id_created_at_idx" ON "seller_payouts"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "seller_payouts_created_at_idx" ON "seller_payouts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_campaigns_slug_key" ON "platform_campaigns"("slug");

-- CreateIndex
CREATE INDEX "platform_campaigns_status_starts_at_idx" ON "platform_campaigns"("status", "starts_at");

-- CreateIndex
CREATE INDEX "seller_announcements_is_active_starts_at_idx" ON "seller_announcements"("is_active", "starts_at");

-- CreateIndex
CREATE INDEX "seller_offers_campaign_id_idx" ON "seller_offers"("campaign_id");
