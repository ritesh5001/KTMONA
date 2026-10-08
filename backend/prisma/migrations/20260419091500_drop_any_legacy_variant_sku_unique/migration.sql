-- Remove any legacy unique constraints that enforce (product_id, sku)
-- and keep only color-aware uniqueness.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'product_variants'
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 2
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname::text)
        FROM unnest(c.conkey) AS k(attnum)
        JOIN pg_attribute a
          ON a.attrelid = t.oid
         AND a.attnum = k.attnum
      ) = ARRAY['product_id', 'sku']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.product_variants DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT i.relname AS index_name
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class i ON i.oid = ix.indexrelid
    LEFT JOIN pg_constraint c ON c.conindid = ix.indexrelid
    WHERE n.nspname = 'public'
      AND t.relname = 'product_variants'
      AND ix.indisunique = true
      AND ix.indnkeyatts = 2
      AND c.oid IS NULL
      AND (
        pg_get_indexdef(i.oid) ILIKE '%(product_id, sku)%'
        OR pg_get_indexdef(i.oid) ILIKE '%(sku, product_id)%'
      )
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
