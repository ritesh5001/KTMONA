-- Remove any legacy UNIQUE INDEX enforcing (product_id, sku) on product_variants.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT i.relname AS index_name
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a1 ON a1.attrelid = t.oid AND a1.attnum = ix.indkey[0]
    JOIN pg_attribute a2 ON a2.attrelid = t.oid AND a2.attnum = ix.indkey[1]
    LEFT JOIN pg_constraint c ON c.conindid = ix.indexrelid
    WHERE n.nspname = 'public'
      AND t.relname = 'product_variants'
      AND ix.indisunique = true
      AND ix.indnkeyatts = 2
      AND a1.attname = 'product_id'
      AND a2.attname = 'sku'
      AND c.oid IS NULL
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.index_name);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variants_product_id_color_sku_key'
      AND conrelid = 'public.product_variants'::regclass
  ) THEN
    ALTER TABLE public.product_variants
    ADD CONSTRAINT product_variants_product_id_color_sku_key
    UNIQUE (product_id, color, sku);
  END IF;
END $$;
