-- CreateTable
CREATE TABLE "refund_payout_details" (
    "user_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "upi_id" TEXT,
    "account_holder" TEXT,
    "account_number" TEXT,
    "ifsc" TEXT,
    "bank_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_payout_details_pkey" PRIMARY KEY ("user_id")
);
