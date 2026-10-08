-- Add COD (Cash on Delivery) to the PaymentProvider enum
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'COD';
