"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MarketplaceProductCard,
  type MarketplaceCardProduct,
} from "@/components/marketplace-product-card";
import { AudienceTabs, type Audience } from "@/components/home/AudienceTabs";

interface NewArrivalsSectionProps {
  mensProducts: MarketplaceCardProduct[];
  kidsProducts: MarketplaceCardProduct[];
}

export function NewArrivalsSection({
  mensProducts,
  kidsProducts,
}: NewArrivalsSectionProps) {
  const [audience, setAudience] = useState<Audience>("MENS");
  const products = audience === "MENS" ? mensProducts : kidsProducts;

  return (
    <section id="new" className="border-t border-border-soft bg-mist/50 dark:bg-card/50">
      <div className="mx-auto max-w-460 px-3 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6 px-0 sm:px-2">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-strong">
              New Arrivals
            </p>
            <h2 className="font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Just Landed
              <br />
              <span className="italic">on KTMONA</span>
            </h2>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
              The latest products from verified sellers across India,
              reviewed by our team before they go live.
            </p>
            <div className="pt-2">
              <AudienceTabs value={audience} onChange={setAudience} />
            </div>
            <div className="pt-4">
              <Link
                href="/marketplace"
                className="inline-flex h-12 items-center justify-center bg-ink px-8 text-xs font-medium uppercase tracking-[0.15em] text-paper transition-all duration-400 hover:bg-navy dark:bg-brand dark:text-ink dark:hover:bg-brand-muted"
              >
                Discover New Arrivals
              </Link>
            </div>
          </div>

          <div className="px-0 sm:px-2">
            {products.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {products.map((product) => (
                  <MarketplaceProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="border border-border-soft bg-card p-10 text-center text-sm text-muted-foreground">
                No {audience === "MENS" ? "mens" : "kids"} products available right now.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
