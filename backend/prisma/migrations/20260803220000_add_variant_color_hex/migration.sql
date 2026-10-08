-- Swatch colour for a variant's vendor-named colour, as #RRGGBB.
-- Additive and idempotent: existing rows get NULL and are untouched.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "color_hex" TEXT;
