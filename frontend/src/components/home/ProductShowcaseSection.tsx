"use client";

import { useState } from "react";
import Link from "next/link";
import { MarketplaceProductCard, type MarketplaceCardProduct } from "@/components/marketplace-product-card";
import { AudienceTabs, type Audience } from "@/components/home/AudienceTabs";

function pickShowcaseProducts(products?: MarketplaceCardProduct[]): MarketplaceCardProduct[] {
  if (!products?.length) return [];
  return products.slice(0, 8);
}

export function ProductShowcaseSection({
  initialProducts,
  kidsProducts,
}: {
  initialProducts?: MarketplaceCardProduct[];
  kidsProducts?: MarketplaceCardProduct[];
}) {
  const [audience, setAudience] = useState<Audience>("MENS");
  const products = pickShowcaseProducts(audience === "MENS" ? initialProducts : kidsProducts);

  return (
    <section id="product-showcase" className="border-t border-border-soft bg-mist/50 dark:bg-card/50">
      <div className="mx-auto max-w-460 px-3 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="mb-6 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-brand-strong">Our Picks</p>
          <h2 className="mb-6 font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">Product Showcase</h2>
          <AudienceTabs value={audience} onChange={setAudience} />
        </div>

        <div className="px-0 sm:px-2">
          {products.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No {audience === "MENS" ? "mens" : "kids"} products available right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 text-center">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-brand-strong"
          >
            View All
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
