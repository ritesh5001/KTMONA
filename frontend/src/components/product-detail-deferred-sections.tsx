"use client";

import dynamic from "next/dynamic";

const ProductReviews = dynamic(() => import("@/components/product-reviews"), {
  ssr: false,
  loading: () => (
    <div className="border border-border-soft bg-card p-8 text-sm text-muted-foreground">
      Loading reviews...
    </div>
  ),
});

const RelatedProducts = dynamic(
  () => import("@/components/related-products").then((mod) => mod.RelatedProducts),
  {
    ssr: false,
    loading: () => (
      <section className="border-t border-border-soft pt-16">
        <div className="mb-10">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.25em] text-brand-strong">
            You May Also Like
          </p>
          <h2 className="font-serif text-2xl font-light text-foreground">
            Related Products
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="animate-pulse space-y-3 border border-border-soft p-4">
              <div className="aspect-3/4 bg-mist dark:bg-navy/20" />
              <div className="h-4 w-3/4 rounded bg-mist dark:bg-navy/20" />
              <div className="h-3 w-1/2 rounded bg-mist dark:bg-navy/20" />
            </div>
          ))}
        </div>
      </section>
    ),
  }
);

const RecentlyViewedTracker = dynamic(
  () => import("@/components/recently-viewed-tracker").then((mod) => mod.RecentlyViewedTracker),
  { ssr: false }
);

export function ProductDetailDeferredSections({
  productId,
  categoryId,
}: {
  productId: string;
  /** Lets Related Products page through the whole category, not just 8 picks. */
  categoryId?: string | null;
}) {
  return (
    <>
      <RecentlyViewedTracker productId={productId} />
      <section className="border-t border-border-soft pt-16">
        <ProductReviews productId={productId} />
      </section>
      <RelatedProducts productId={productId} categoryId={categoryId} />
    </>
  );
}
