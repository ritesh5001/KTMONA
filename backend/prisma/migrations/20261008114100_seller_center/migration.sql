-- CreateEnum
CREATE TYPE "FulfillmentMode" AS ENUM ('SHIPROCKET', 'SELF_SHIP');

-- CreateEnum
CREATE TYPE "SellerClaimType" AS ENUM ('DAMAGED_RETURN', 'WRONG_RETURN', 'MISSING_ITEM_IN_RETURN', 'RTO_DAMAGED', 'RTO_NOT_RECEIVED', 'PAYMENT_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "SellerClaimStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SellerOfferStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "SellerLedgerType" AS ENUM ('AD_SPEND', 'PENALTY', 'CLAIM_CREDIT', 'ADJUSTMENT');

-- AlterEnum

-- This migration adds more than one value to an enum.

-- With PostgreSQL versions 11 and earlier, this is not possible

-- in a single migration. This can be worked around by creating

-- multiple migrations, each migration adding only one value to

-- the enum.


ALTER TYPE "ShipmentStatus" ADD VALUE 'RTO_INITIATED';
ALTER TYPE "ShipmentStatus" ADD VALUE 'RTO_DELIVERED';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "paused_by_seller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paused_for_vacation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "seller_profiles" ADD COLUMN     "enrolment_id" TEXT,
ADD COLUMN     "gst_registered" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pickup_address_line1" TEXT,
ADD COLUMN     "pickup_address_line2" TEXT,
ADD COLUMN     "pickup_city" TEXT,
ADD COLUMN     "pickup_contact_name" TEXT,
ADD COLUMN     "pickup_phone" TEXT,
ADD COLUMN     "pickup_pincode" TEXT,
ADD COLUMN     "pickup_state" TEXT,
ADD COLUMN     "store_description" TEXT,
ADD COLUMN     "store_logo" TEXT,
ADD COLUMN     "support_email" TEXT,
ADD COLUMN     "support_phone" TEXT,
ADD COLUMN     "vacation_mode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "fulfillment_mode" "FulfillmentMode" NOT NULL DEFAULT 'SELF_SHIP',
ADD COLUMN     "label_generated_at" TIMESTAMP(3),
ADD COLUMN     "label_url" TEXT,
ADD COLUMN     "manifest_id" TEXT,
ADD COLUMN     "manifested_at" TIMESTAMP(3),
ADD COLUMN     "pickup_requested_at" TIMESTAMP(3),
ADD COLUMN     "rto_delivered_at" TIMESTAMP(3),
ADD COLUMN     "rto_initiated_at" TIMESTAMP(3),
ADD COLUMN     "rto_reason" TEXT,
ADD COLUMN     "shiprocket_order_id" TEXT,
ADD COLUMN     "shiprocket_shipment_id" TEXT;

-- CreateTable
CREATE TABLE "seller_order_cancellations" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_order_cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_claims" (
    "id" TEXT NOT NULL,
    "claim_number" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "return_id" TEXT,
    "type" "SellerClaimType" NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amount_claimed" DOUBLE PRECISION,
    "status" "SellerClaimStatus" NOT NULL DEFAULT 'OPEN',
    "amount_approved" DOUBLE PRECISION,
    "resolution_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_offers" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discount_percent" DOUBLE PRECISION NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "SellerOfferStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_offer_items" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "original_price" DOUBLE PRECISION,
    "original_seller_price" DOUBLE PRECISION,
    "original_compare_at" DOUBLE PRECISION,
    "applied_price" DOUBLE PRECISION,
    "applied_seller_price" DOUBLE PRECISION,

    CONSTRAINT "seller_offer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daily_budget" DOUBLE PRECISION NOT NULL,
    "bid_per_click" DOUBLE PRECISION NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaign_products" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,

    CONSTRAINT "ad_campaign_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_daily_stats" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ad_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_ledger_entries" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "type" "SellerLedgerType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference_id" TEXT,
    "order_id" TEXT,
    "note" TEXT,
    "entry_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_order_cancellations_seller_id_created_at_idx" ON "seller_order_cancellations"("seller_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "seller_order_cancellations_order_id_seller_id_key" ON "seller_order_cancellations"("order_id", "seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_claims_claim_number_key" ON "seller_claims"("claim_number");

-- CreateIndex
CREATE INDEX "seller_claims_seller_id_created_at_idx" ON "seller_claims"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "seller_claims_status_idx" ON "seller_claims"("status");

-- CreateIndex
CREATE INDEX "seller_claims_order_id_idx" ON "seller_claims"("order_id");

-- CreateIndex
CREATE INDEX "seller_offers_seller_id_status_idx" ON "seller_offers"("seller_id", "status");

-- CreateIndex
CREATE INDEX "seller_offers_status_starts_at_idx" ON "seller_offers"("status", "starts_at");

-- CreateIndex
CREATE INDEX "seller_offers_status_ends_at_idx" ON "seller_offers"("status", "ends_at");

-- CreateIndex
CREATE INDEX "seller_offer_items_variant_id_idx" ON "seller_offer_items"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_offer_items_offer_id_variant_id_key" ON "seller_offer_items"("offer_id", "variant_id");

-- CreateIndex
CREATE INDEX "ad_campaigns_seller_id_status_idx" ON "ad_campaigns"("seller_id", "status");

-- CreateIndex
CREATE INDEX "ad_campaigns_status_idx" ON "ad_campaigns"("status");

-- CreateIndex
CREATE INDEX "ad_campaign_products_product_id_idx" ON "ad_campaign_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_campaign_products_campaign_id_product_id_key" ON "ad_campaign_products"("campaign_id", "product_id");

-- CreateIndex
CREATE INDEX "ad_daily_stats_campaign_id_date_idx" ON "ad_daily_stats"("campaign_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ad_daily_stats_campaign_id_product_id_date_key" ON "ad_daily_stats"("campaign_id", "product_id", "date");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_seller_id_created_at_idx" ON "seller_ledger_entries"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "seller_ledger_entries_seller_id_settled_at_idx" ON "seller_ledger_entries"("seller_id", "settled_at");

-- CreateIndex
CREATE UNIQUE INDEX "seller_ledger_entries_seller_id_type_reference_id_entry_dat_key" ON "seller_ledger_entries"("seller_id", "type", "reference_id", "entry_date");

-- AddForeignKey
ALTER TABLE "seller_offer_items" ADD CONSTRAINT "seller_offer_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaign_products" ADD CONSTRAINT "ad_campaign_products_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_daily_stats" ADD CONSTRAINT "ad_daily_stats_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
