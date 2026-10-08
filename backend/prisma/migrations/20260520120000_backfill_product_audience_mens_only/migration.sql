-- Backfill existing products so the catalog is mens-only.
UPDATE "products"
SET "audience" = 'MENS'
WHERE "audience" IS DISTINCT FROM 'MENS';
