"use client";
import { hasSession } from "@/lib/session";

import * as React from "react";
import { apiRequest } from "@/services/api";
import {
  MarketplaceProductCard,
  type MarketplaceCardProduct,
} from "@/components/marketplace-product-card";

interface RecommendationsResponse {
  products: Array<
    MarketplaceCardProduct & {
      recommendationScore: number;
    }
  >;
}

export function RecommendedForYouSection() {
  const [products, setProducts] = React.useState<RecommendationsResponse["products"]>([]);
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

    apiRequest<RecommendationsResponse>("/v1/personalization/recommendations", {
      method: "GET",
    })
      .then((data) => {
        if (active) setProducts(data.products ?? []);
      })
      .catch(() => {
        if (active) setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading || products.length === 0) return null;

  return (
    <section id="recommended" className="border-t border-border-soft">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-strong mb-4">
            Personalized Picks
          </p>
          <h2 className="font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            Recommended For You
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, 6).map((product) => (
            <div key={product.id}>
              <MarketplaceProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
