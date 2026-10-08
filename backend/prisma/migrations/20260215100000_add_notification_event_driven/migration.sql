-- AlterEnum: Add PAYMENT_SUCCESS and PAYMENT_FAILED to NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_SUCCESS';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';

-- AlterTable: Add event_key, is_read, read_at columns to notifications
ALTER TABLE "notifications" ADD COLUMN "event_key" TEXT;
ALTER TABLE "notifications" ADD COLUMN "is_read" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notifications" ADD COLUMN "read_at" TIMESTAMP(3);

-- CreateIndex: Unique constraint on (user_id, event_key) for idempotency
CREATE UNIQUE INDEX "notifications_user_event_key" ON "notifications"("user_id", "event_key");
