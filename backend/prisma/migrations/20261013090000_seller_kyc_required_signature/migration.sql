-- Per-seller switch: admins may let a seller list products before KYC is verified.
ALTER TABLE "seller_profiles" ADD COLUMN "kyc_required" BOOLEAN NOT NULL DEFAULT true;

-- Seller's signature image for the "Authorised Signatory" line on invoices.
ALTER TABLE "seller_profiles" ADD COLUMN "signature_url" TEXT;
