-- Add shipping pincode snapshot on order for checkout and seller panel visibility
ALTER TABLE "orders"
ADD COLUMN "shipping_pincode" TEXT;
