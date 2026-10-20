-- Fast name search over the seller category tree (ILIKE '%term%').
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "categories_name_trgm_idx" ON "categories" USING GIN ("name" gin_trgm_ops);
