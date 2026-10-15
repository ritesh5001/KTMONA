-- Admin-set rating, review count and "people viewed" count per product.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "display_rating" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "display_review_count" INTEGER;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "display_view_count" INTEGER;

-- Reviewer name for reviews added or edited by an admin.
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "author_name" TEXT;
