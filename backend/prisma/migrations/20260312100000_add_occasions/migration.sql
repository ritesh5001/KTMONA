-- CreateTable
CREATE TABLE "occasions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occasions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_occasions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "occasion_id" TEXT NOT NULL,

    CONSTRAINT "product_occasions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "occasions_slug_key" ON "occasions"("slug");

-- CreateIndex
CREATE INDEX "occasions_slug_idx" ON "occasions"("slug");

-- CreateIndex
CREATE INDEX "occasions_is_active_idx" ON "occasions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_occasions_product_id_occasion_id_key" ON "product_occasions"("product_id", "occasion_id");

-- CreateIndex
CREATE INDEX "product_occasions_product_id_idx" ON "product_occasions"("product_id");

-- CreateIndex
CREATE INDEX "product_occasions_occasion_id_idx" ON "product_occasions"("occasion_id");

-- AddForeignKey
ALTER TABLE "product_occasions" ADD CONSTRAINT "product_occasions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_occasions" ADD CONSTRAINT "product_occasions_occasion_id_fkey" FOREIGN KEY ("occasion_id") REFERENCES "occasions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
