-- Allow same SKU (size) across different colors for the same product.
-- Example: White + M and Blue + M should both be valid variants.
ALTER TABLE "product_variants"
DROP CONSTRAINT IF EXISTS "product_variants_product_id_sku_key";

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'product_variants_product_id_color_sku_key'
			AND conrelid = 'product_variants'::regclass
	) THEN
		ALTER TABLE "product_variants"
		ADD CONSTRAINT "product_variants_product_id_color_sku_key"
		UNIQUE ("product_id", "color", "sku");
	END IF;
END $$;
