"use client";
import { hasSession } from "@/lib/session";

import * as React from "react";
import Link from "next/link";
import { apiRequest } from "@/services/api";
import { MarketplaceProductCard } from "@/components/marketplace-product-card";

interface RecentlyViewedProduct {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  sellerPrice: number;
  adminListingPrice: number | null;
  isPublished: boolean;
  category: { id: string; name: string } | null;
  viewedAt: number;
}

/**
 * Recently Viewed section for the homepage.
 * Only renders when the user is authenticated and has viewed products.
 */
export function RecentlyViewedSection() {
  const [products, setProducts] = React.useState<RecentlyViewedProduct[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    // Skip API call entirely for anonymous users — avoids 401 console noise
    const hasToken = hasSession();
    if (!hasToken) {
      setProducts([]);
      setLoading(false);
      return;
    }

    apiRequest<{ products: RecentlyViewedProduct[] }>(
      "/v1/personalization/recently-viewed"
    )
      .then((data) => {
        if (active) setProducts(data.products ?? []);
      })
      .catch(() => {
        // Not logged in or no data — hide section
        if (active) setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Hide section entirely when empty or when user is not authenticated
  if (!loading && products.length === 0) return null;

  // Also hide while loading to avoid layout shift for anonymous users
  if (loading) return null;

  return (
    <section className="border-t border-border-soft">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-strong mb-4">
              Continue Exploring
            </p>
            <h2 className="font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">
              Recently Viewed
            </h2>
          </div>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-300 hover:text-foreground border-b border-transparent hover:border-brand pb-1"
          >
            View All
            <span className="text-brand-strong">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, 8).map((product) => (
            <div key={product.id}>
              <MarketplaceProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
