-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "packet_barcode" TEXT,
ADD COLUMN     "packet_scanned_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "category_requests" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category_id" TEXT,
    "parent_id" TEXT,
    "name" TEXT,
    "description" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "result_category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_requests_status_created_at_idx" ON "category_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "category_requests_seller_id_created_at_idx" ON "category_requests"("seller_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_seller_id_packet_barcode_key" ON "shipments"("seller_id", "packet_barcode");

