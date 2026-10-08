"use client";

import * as React from "react";
import ProductDetailClient from "@/components/product-detail-client";
import ProductImageCarousel from "@/components/product-image-carousel";

interface Variant {
  id: string;
  size: string;
  color?: string | null;
  images?: string[];
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  inventory?: {
    stock: number;
  } | null;
}

interface ProductDetailMainProps {
  product: {
    id: string;
    title: string;
    description?: string | null;
    category?: { name: string } | null;
    categoryId?: string;
    categoryName?: string;
    sellerId?: string;
    images?: string[];
    price?: number;
    regularPrice?: number;
    sellerPrice?: number;
    adminPrice?: number;
    salePrice?: number;
    variants: Variant[];
  };
}

export default function ProductDetailMain({ product }: ProductDetailMainProps) {
  const initialImages = React.useMemo(
    () => (product.images?.length ? product.images : ["/images/product-placeholder.svg"]),
    [product.images]
  );

  const [carouselImages, setCarouselImages] = React.useState<string[]>(initialImages);

  React.useEffect(() => {
    setCarouselImages(initialImages);
  }, [initialImages, product.id]);

  return (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
      <div className="-mx-4 min-w-0 max-w-none sm:mx-0 sm:max-w-full">
        <ProductImageCarousel images={carouselImages} title={product?.title} />
      </div>
      <div className="min-w-0 max-w-full">
        <ProductDetailClient product={product} onVariantImagesChange={setCarouselImages} />
      </div>
    </section>
  );
}
