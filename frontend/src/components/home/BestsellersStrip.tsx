"use client";

import { useState } from "react";
import Link from "next/link";
import type { BestsellerProduct } from "@/services/bestsellers";
import {
  MarketplaceProductCard,
  type MarketplaceCardProduct,
} from "@/components/marketplace-product-card";
import { AudienceTabs, type Audience } from "@/components/home/AudienceTabs";

type Props = {
  bestsellers: BestsellerProduct[];
  kidsBestsellers?: BestsellerProduct[];
};

function toCardProduct(item: BestsellerProduct): MarketplaceCardProduct {
  return {
    id: item.productId,
    productId: item.productId,
    title: item.title,
    image: item.image ?? null,
    categoryName: item.categoryName ?? null,
    compareAtPrice: item.compareAtPrice ?? null,
    regularPrice: item.regularPrice ?? null,
    sellerPrice: item.sellerPrice ?? null,
    adminPrice: item.adminPrice ?? null,
    salePrice: item.salePrice ?? null,
    minPrice: item.minPrice ?? null,
    activeCoupon: item.activeCoupon ?? null,
    coupon: item.coupon ?? null,
    couponPreview: item.couponPreview ?? null,
    coupons: item.coupons ?? null,
  };
}

export function BestsellersStrip({ bestsellers, kidsBestsellers = [] }: Props) {
  const [audience, setAudience] = useState<Audience>("MENS");
  const items = audience === "MENS" ? bestsellers : kidsBestsellers;

  return (
    <section id="bestsellers" className="border-t border-border-soft">
      <div className="mx-auto max-w-460 px-3 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="mb-5 text-center">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.3em] text-brand-strong">Most Loved</p>
          <h2 className="mb-6 font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">Bestselling Pieces</h2>
          <AudienceTabs value={audience} onChange={setAudience} />
        </div>

        {items.length === 0 ? (
          <div className="border border-border-soft bg-card p-10 text-center text-sm text-muted-foreground">
            No bestsellers available for {audience === "MENS" ? "Mens" : "Kids"} yet.
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide sm:px-2" style={{ WebkitOverflowScrolling: "touch" }}>
            {items.map((item) => (
              <div
                key={item.id}
                className="shrink-0 snap-start w-[calc(50%-12px)] md:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)]"
              >
                <MarketplaceProductCard product={toCardProduct(item)} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 border-b border-transparent pb-1 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-300 hover:border-brand hover:text-foreground"
          >
            Browse All Bestsellers
            <span className="text-brand-strong">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
