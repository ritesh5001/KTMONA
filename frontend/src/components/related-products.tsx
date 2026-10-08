"use client";

import * as React from "react";
import { getRelatedProducts } from "@/services/search";
import {
  MarketplaceProductCard,
  type MarketplaceCardProduct,
} from "@/components/marketplace-product-card";

/**
 * Everything else in this product's category, revealed as the shopper scrolls.
 *
 * This used to be a single fixed request for 8 products, which is all the
 * `/related` endpoint can usefully return — its limit is capped at 20 and it has
 * no paging. Browsing the rest of a category meant leaving the page.
 *
 * So it pages `/v1/products?categoryId=…` instead, with the same buffer-ahead
 * reveal the homepage showcase uses: the next page is fetched before the shopper
 * reaches the end, and the sentinel only uncovers what is already in memory, so
 * scrolling never lands on a spinner.
 */

const PAGE_SIZE = 8;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

type ProductListResponse = {
  data?: MarketplaceCardProduct[];
  pagination?: { page?: number; totalPages?: number };
};

interface RelatedProductsProps {
  productId: string;
  /** Omitted only if the page failed to load the product; falls back to /related. */
  categoryId?: string | null;
}

function mergeUnique(
  current: MarketplaceCardProduct[],
  incoming: MarketplaceCardProduct[],
  excludeId: string
): MarketplaceCardProduct[] {
  if (incoming.length === 0) return current;

  const seen = new Set(current.map((product) => product.id));
  const merged = [...current];

  for (const product of incoming) {
    // The product being viewed is in its own category; it is not a suggestion.
    if (product.id === excludeId || seen.has(product.id)) continue;
    merged.push(product);
    seen.add(product.id);
  }

  return merged;
}

export function RelatedProducts({ productId, categoryId }: RelatedProductsProps) {
  const canPage = Boolean(API_BASE_URL && categoryId);

  const [products, setProducts] = React.useState<MarketplaceCardProduct[]>([]);
  const [visibleCount, setVisibleCount] = React.useState(0);
  const [nextPage, setNextPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFetching, setIsFetching] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Ref, not state: the fetcher reads it to bail out, and putting it in the
  // dependency list would rebuild the callback on every page and re-trigger.
  const fetchingRef = React.useRef(false);

  // Identifies the product whose list is being built. A response that arrives
  // after the shopper has moved to another product belongs to the old category,
  // and merging it would mix two categories together and desync the page
  // counter — so late replies are dropped.
  const requestKey = `${productId}:${categoryId ?? ""}`;
  const requestKeyRef = React.useRef(requestKey);
  requestKeyRef.current = requestKey;

  const loadNextPage = React.useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsFetching(true);

    const issuedFor = requestKeyRef.current;
    const isStale = () => requestKeyRef.current !== issuedFor;

    try {
      if (!canPage) {
        // No category to page through — fall back to the original endpoint and
        // treat its single response as the whole list.
        const fallback = await getRelatedProducts(productId, 20);
        if (isStale()) return;
        setProducts((previous) => mergeUnique(previous, fallback, productId));
        setHasMore(false);
        return;
      }

      const query = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
        categoryId: categoryId!,
      });

      const response = await fetch(`${API_BASE_URL}/v1/products?${query.toString()}`);
      if (!response.ok) throw new Error("Unable to load related products");

      const payload = (await response.json()) as ProductListResponse;
      if (isStale()) return;

      const incoming = Array.isArray(payload.data) ? payload.data : [];
      const totalPages = payload.pagination?.totalPages;

      setProducts((previous) => mergeUnique(previous, incoming, productId));
      setNextPage((previous) => previous + 1);
      setHasMore(
        typeof totalPages === "number" ? nextPage < totalPages : incoming.length === PAGE_SIZE
      );
    } catch {
      // Whatever already loaded stays on screen; only the tail is lost.
      if (!isStale()) setHasMore(false);
    } finally {
      // The fetch really did end, so always release the guard and the spinner.
      // A new cycle cannot have started before this line: it is gated on the
      // same ref, which is still set until now.
      fetchingRef.current = false;
      setIsFetching(false);
      // ...but a stale finish must not clear the skeleton the new product just
      // put back up.
      if (!isStale()) setIsLoading(false);
    }
  }, [canPage, categoryId, nextPage, productId]);

  // Reset when the shopper navigates to another product.
  React.useEffect(() => {
    setProducts([]);
    setVisibleCount(0);
    setNextPage(1);
    setIsLoading(true);
    setHasMore(true);
  }, [productId, categoryId]);

  React.useEffect(() => {
    if (products.length === 0 && hasMore) void loadNextPage();
  }, [hasMore, loadNextPage, products.length]);

  // Reveal the first page as soon as anything arrives.
  React.useEffect(() => {
    if (visibleCount === 0 && products.length > 0) {
      setVisibleCount(Math.min(PAGE_SIZE, products.length));
    }
  }, [products.length, visibleCount]);

  // Keep at least one page buffered ahead of what is on screen.
  React.useEffect(() => {
    if (!hasMore || isFetching || visibleCount === 0) return;
    if (products.length - visibleCount >= PAGE_SIZE) return;
    void loadNextPage();
  }, [hasMore, isFetching, loadNextPage, products.length, visibleCount]);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((previous) =>
          previous < products.length ? Math.min(previous + PAGE_SIZE, products.length) : previous
        );
      },
      { root: null, rootMargin: "250px 0px", threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [products.length]);

  const displayed = React.useMemo(
    () => products.slice(0, visibleCount),
    [products, visibleCount]
  );

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="border-t border-border-soft pt-16">
      <div className="mb-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-brand-strong mb-4">
          You May Also Like
        </p>
        <h2 className="font-serif text-2xl font-light text-foreground">
          Related Products
        </h2>
      </div>

      {isLoading && displayed.length === 0 ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse space-y-3 border border-border-soft p-4"
            >
              <div className="aspect-3/4 bg-mist dark:bg-navy/20" />
              <div className="h-4 bg-mist dark:bg-navy/20 rounded w-3/4" />
              <div className="h-3 bg-mist dark:bg-navy/20 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {displayed.map((product) => (
            <MarketplaceProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />

      {isFetching && displayed.length > 0 ? (
        <div
          className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-soft border-t-brand" />
          <span>Loading more products...</span>
        </div>
      ) : !hasMore && visibleCount >= products.length && displayed.length > 0 ? (
        <p className="mt-6 text-center text-xs text-muted-foreground" role="status">
          You&apos;ve seen everything in this category.
        </p>
      ) : null}
    </section>
  );
}
