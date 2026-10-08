-- AlterTable: Add GST fields to products
ALTER TABLE "products" ADD COLUMN "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "hsn_code" TEXT;

-- AlterTable: Add state to users (buyer state for GST split)
ALTER TABLE "users" ADD COLUMN "state" TEXT;

-- AlterTable: Add gstin and state to seller_profiles
ALTER TABLE "seller_profiles" ADD COLUMN "gstin" TEXT;
ALTER TABLE "seller_profiles" ADD COLUMN "state" TEXT NOT NULL DEFAULT '';

-- AlterTable: Add GST snapshot fields to order_items
ALTER TABLE "order_items" ADD COLUMN "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN "taxable_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN "cgst_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN "sgst_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN "igst_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN "item_total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: Add GST summary fields to orders
ALTER TABLE "orders" ADD COLUMN "sub_total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "total_tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "grand_total" DOUBLE PRECISION NOT NULL DEFAULT 0;
