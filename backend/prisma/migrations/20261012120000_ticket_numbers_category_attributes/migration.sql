-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "ticket_number" SERIAL NOT NULL;

-- Number existing tickets in the order they were opened, then continue from there.
WITH ordered AS (
    SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn FROM "support_tickets"
)
UPDATE "support_tickets" t SET "ticket_number" = ordered.rn FROM ordered WHERE ordered."id" = t."id";
SELECT setval(pg_get_serial_sequence('support_tickets', 'ticket_number'), COALESCE((SELECT MAX("ticket_number") FROM "support_tickets"), 0) + 1, false);

-- CreateTable
CREATE TABLE "category_attributes" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SELECT',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_attributes_category_id_sort_order_idx" ON "category_attributes"("category_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "category_attributes_category_id_key_key" ON "category_attributes"("category_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

