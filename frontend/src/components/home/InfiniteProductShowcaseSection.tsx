"use client";

import * as React from "react";
import Link from "next/link";
import {
  MarketplaceProductCard,
  type MarketplaceCardProduct,
} from "@/components/marketplace-product-card";
import { AudienceTabs, type Audience } from "@/components/home/AudienceTabs";

type ProductListResponse = {
  data?: MarketplaceCardProduct[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
};

const PAGE_SIZE = 8;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function mergeUniqueProducts(
  current: MarketplaceCardProduct[],
  incoming: MarketplaceCardProduct[]
): MarketplaceCardProduct[] {
  if (incoming.length === 0) return current;

  const seen = new Set(current.map((product) => product.id));
  const merged = [...current];

  for (const product of incoming) {
    if (!seen.has(product.id)) {
      merged.push(product);
      seen.add(product.id);
    }
  }

  return merged;
}

export function InfiniteProductShowcaseSection({
  initialProducts,
  kidsProducts,
}: {
  initialProducts?: MarketplaceCardProduct[];
  kidsProducts?: MarketplaceCardProduct[];
}) {
  const hasApi = Boolean(API_BASE_URL);
  const [audience, setAudience] = React.useState<Audience>("MENS");

  const initialForAudience = React.useMemo(() => {
    const source = audience === "MENS" ? initialProducts : kidsProducts;
    return mergeUniqueProducts([], (source ?? []).slice(0, PAGE_SIZE));
  }, [audience, initialProducts, kidsProducts]);

  const [products, setProducts] = React.useState<MarketplaceCardProduct[]>(initialForAudience);
  const [visibleCount, setVisibleCount] = React.useState(
    Math.min(PAGE_SIZE, initialForAudience.length)
  );
  const [nextPage, setNextPage] = React.useState(initialForAudience.length > 0 ? 2 : 1);
  const [isPrefetching, setIsPrefetching] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(hasApi);
  const [pendingReveal, setPendingReveal] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setProducts(initialForAudience);
    setVisibleCount(Math.min(PAGE_SIZE, initialForAudience.length));
    setNextPage(initialForAudience.length > 0 ? 2 : 1);
    setHasMore(hasApi);
    setHasError(false);
    setPendingReveal(false);
  }, [audience, initialForAudience, hasApi]);

  const prefetchNextPage = React.useCallback(async () => {
    if (!API_BASE_URL || isPrefetching || !hasMore) return;

    setIsPrefetching(true);
    setHasError(false);

    try {
      const query = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
        sort: "newest",
        audience,
      });

      const response = await fetch(`${API_BASE_URL}/v1/products?${query.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load products");
      }

      const payload = (await response.json()) as ProductListResponse;
      const incoming = Array.isArray(payload.data) ? payload.data : [];
      const totalPages = payload.pagination?.totalPages;

      setProducts((previous) => mergeUniqueProducts(previous, incoming));
      setNextPage((previous) => previous + 1);

      const canLoadMore =
        typeof totalPages === "number"
          ? nextPage < totalPages
          : incoming.length === PAGE_SIZE;

      setHasMore(canLoadMore && incoming.length > 0);
    } catch {
      setHasError(true);
      setHasMore(false);
    } finally {
      setIsPrefetching(false);
    }
  }, [audience, hasMore, isPrefetching, nextPage]);

  const displayedProducts = React.useMemo(
    () => products.slice(0, visibleCount),
    [products, visibleCount]
  );

  React.useEffect(() => {
    if (!API_BASE_URL) return;
    if (products.length > 0) return;

    void prefetchNextPage();
  }, [products.length, prefetchNextPage]);

  React.useEffect(() => {
    if (visibleCount > 0) return;
    if (products.length === 0) return;

    setVisibleCount(Math.min(PAGE_SIZE, products.length));
  }, [products.length, visibleCount]);

  React.useEffect(() => {
    if (!hasApi || !hasMore || isPrefetching) return;

    const bufferedCount = products.length - visibleCount;
    if (bufferedCount >= PAGE_SIZE) return;

    void prefetchNextPage();
  }, [hasApi, hasMore, isPrefetching, prefetchNextPage, products.length, visibleCount]);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (!target?.isIntersecting) return;

        if (visibleCount < products.length) {
          setVisibleCount((previous) => Math.min(previous + PAGE_SIZE, products.length));
          return;
        }

        if (hasMore) {
          setPendingReveal(true);
        }
      },
      {
        root: null,
        rootMargin: "250px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, products.length, visibleCount]);

  React.useEffect(() => {
    if (!pendingReveal) return;

    if (visibleCount < products.length) {
      setVisibleCount((previous) => Math.min(previous + PAGE_SIZE, products.length));
      setPendingReveal(false);
      return;
    }

    if (!hasMore && !isPrefetching) {
      setPendingReveal(false);
    }
  }, [hasMore, isPrefetching, pendingReveal, products.length, visibleCount]);

  return (
    <section id="product-showcase-infinite" className="border-t border-border-soft bg-mist/50 dark:bg-card/50">
      <div className="mx-auto max-w-460 px-3 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="mb-6 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-brand-strong">Explore More</p>
          <h2 className="mb-6 font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            Product Showcase
          </h2>
          <AudienceTabs value={audience} onChange={setAudience} />
        </div>

        <div className="px-0 sm:px-2">
          {displayedProducts.length === 0 && !isPrefetching ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No {audience === "MENS" ? "mens" : "kids"} products available right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {displayedProducts.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />

          {hasError ? (
            <p className="mt-6 text-center text-xs text-muted-foreground" role="status">
              Could not load more products right now.
            </p>
          ) : isPrefetching ? (
            <div
              className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-soft border-t-brand" />
              <span>Loading next products...</span>
            </div>
          ) : hasMore ? (
            <p className="mt-6 text-center text-xs text-muted-foreground" role="status">
              Scroll down to reveal more preloaded products
            </p>
          ) : displayedProducts.length > 0 ? (
            <p className="mt-6 text-center text-xs text-muted-foreground" role="status">
              You&apos;ve reached the end of the showcase.
            </p>
          ) : null}
        </div>

        <div className="mt-5 text-center">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-brand-strong"
          >
            View All
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
