-- Add a dedicated notification type for shipment creation emails to customers.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType'
      AND e.enumlabel = 'SHIPMENT_CREATED'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SHIPMENT_CREATED';
  END IF;
END $$;
