-- Add color and variant image list support for ProductVariant without data loss.
ALTER TABLE "product_variants"
ADD COLUMN IF NOT EXISTS "color" TEXT;

ALTER TABLE "product_variants"
ADD COLUMN IF NOT EXISTS "images" TEXT[];

UPDATE "product_variants"
SET "images" = ARRAY[]::TEXT[]
WHERE "images" IS NULL;

ALTER TABLE "product_variants"
ALTER COLUMN "images" SET DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "product_variants"
ALTER COLUMN "images" SET NOT NULL;
