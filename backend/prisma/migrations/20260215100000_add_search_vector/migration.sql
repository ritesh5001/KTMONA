-- Add tsvector search column to products table
ALTER TABLE "products" ADD COLUMN "search_vector" tsvector;

-- Populate existing rows
UPDATE "products"
SET "search_vector" = to_tsvector('english', coalesce("title",'') || ' ' || coalesce("description",''));

-- Create GIN index for fast full-text search
CREATE INDEX "products_search_vector_idx" ON "products" USING GIN ("search_vector");

-- Trigger function to auto-update search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := to_tsvector('english', coalesce(NEW."title",'') || ' ' || coalesce(NEW."description",''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger
CREATE TRIGGER trg_products_search_vector
  BEFORE INSERT OR UPDATE OF "title", "description"
  ON "products"
  FOR EACH ROW
  EXECUTE FUNCTION products_search_vector_update();
