-- Separate customer menu (STOREFRONT) from the seller listing tree (SELLER).
-- Every existing category is a seller category.
DO $$ BEGIN
    CREATE TYPE "CategoryScope" AS ENUM ('SELLER', 'STOREFRONT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "scope" "CategoryScope" NOT NULL DEFAULT 'SELLER';
CREATE INDEX IF NOT EXISTS "categories_scope_idx" ON "categories"("scope");

-- Storefront category → seller categories whose products it shows.
CREATE TABLE IF NOT EXISTS "category_links" (
    "storefront_id" TEXT NOT NULL,
    "seller_category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "category_links_pkey" PRIMARY KEY ("storefront_id", "seller_category_id")
);
CREATE INDEX IF NOT EXISTS "category_links_seller_category_id_idx" ON "category_links"("seller_category_id");

DO $$ BEGIN
    ALTER TABLE "category_links" ADD CONSTRAINT "category_links_storefront_id_fkey"
        FOREIGN KEY ("storefront_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE "category_links" ADD CONSTRAINT "category_links_seller_category_id_fkey"
        FOREIGN KEY ("seller_category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
