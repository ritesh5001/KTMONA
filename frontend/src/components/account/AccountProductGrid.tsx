"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  MarketplaceProductCard,
  type MarketplaceCardProduct,
} from "@/components/marketplace-product-card";
import { apiRequest } from "@/services/api";

/**
 * Customer panel page that lists products from a personalization endpoint
 * (Recently Viewed, Recommended For You).
 */
export function AccountProductGrid({
  endpoint,
  eyebrow,
  title,
  description,
  emptyText,
}: {
  endpoint: string;
  eyebrow: string;
  title: string;
  description: string;
  emptyText: string;
}) {
  const [products, setProducts] = React.useState<MarketplaceCardProduct[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    apiRequest<{ products: MarketplaceCardProduct[] }>(endpoint)
      .then((res) => {
        if (!cancelled) setProducts(res.products ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error(`Unable to load ${title.toLowerCase()}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, title]);

  return (
    <div className="min-h-[50vh]">
      <div className="flex w-full flex-col gap-8">
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-brand-strong">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="h-px bg-border-soft" />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-20 text-center">
            <p className="text-sm text-muted-foreground">{emptyText}</p>
            <Link href="/marketplace">
              <Button size="md" variant="primary">
                Explore Marketplace
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
            {products.map((product) => (
              <MarketplaceProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
