-- AlterTable: Add invoice fields to orders (nullable, non-breaking)
ALTER TABLE "orders" ADD COLUMN "invoice_number" TEXT;
ALTER TABLE "orders" ADD COLUMN "invoice_issued_at" TIMESTAMP(3);

-- CreateIndex: Unique constraint on invoice_number
CREATE UNIQUE INDEX "orders_invoice_number_key" ON "orders"("invoice_number");
