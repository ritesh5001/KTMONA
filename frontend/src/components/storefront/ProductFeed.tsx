"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { SlidersHorizontal, X } from "lucide-react";
import { apiRequest } from "@/services/api";
import { ProductTile, type ProductTileData } from "@/components/storefront/ProductTile";
import { categoryHref, type CategoryNode } from "@/lib/category-tree";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const SORTS = [
  { value: "newest", label: "New Arrivals" },
  { value: "price_asc", label: "Price (Low to High)" },
  { value: "price_desc", label: "Price (High to Low)" },
  { value: "discount", label: "Discount" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

const PRICES = [
  { key: "u200", label: "Under ₹200", min: undefined, max: 199 },
  { key: "200-499", label: "₹200 – ₹499", min: 200, max: 499 },
  { key: "500-999", label: "₹500 – ₹999", min: 500, max: 999 },
  { key: "1000-1999", label: "₹1,000 – ₹1,999", min: 1000, max: 1999 },
  { key: "2000", label: "₹2,000 and above", min: 2000, max: undefined },
] as const;

interface ListResponse {
  data: ProductTileData[];
  pagination: { page: number; total: number; totalPages: number };
}

/**
 * "Products For You": a filter sidebar (sort, category, price) beside an
 * endlessly loading product grid, as on Meesho's home and listing pages.
 *
 * `categoryId` scopes the feed (its subcategories included); `subcategories`
 * are offered as links in the Category filter.
 */
export function ProductFeed({
  title = "Products For You",
  categoryId,
  subcategories,
  categoryHeading = "Category",
  priceLock = false,
}: {
  /** Heading above the feed; `null` hides it (the page already has one). */
  title?: string | null;
  categoryId?: string;
  subcategories?: CategoryNode[];
  categoryHeading?: string;
  /** Only products with an active KTMONA Price Lock. */
  priceLock?: boolean;
}) {
  const [sort, setSort] = React.useState<Sort>("newest");
  const [priceKey, setPriceKey] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const price = PRICES.find((p) => p.key === priceKey);

  const { data: shipping } = useSWR("config-shipping", () => apiRequest<{ enabled: boolean }>("/v1/config/shipping"), {
    revalidateOnFocus: false,
  });
  const freeDelivery = shipping ? !shipping.enabled : false;

  const getKey = (index: number, previous: ListResponse | null) => {
    if (previous && index + 1 > previous.pagination.totalPages) return null;
    const q = new URLSearchParams({ page: String(index + 1), limit: String(PAGE_SIZE), sort });
    if (categoryId) q.set("categoryId", categoryId);
    if (priceLock) q.set("priceLock", "1");
    if (price?.min != null) q.set("minPrice", String(price.min));
    if (price?.max != null) q.set("maxPrice", String(price.max));
    return `/v1/products?${q.toString()}`;
  };
  const { data, size, setSize, isLoading, isValidating, error } = useSWRInfinite<ListResponse>(getKey, (url: string) => apiRequest<ListResponse>(url), {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  });

  const products = data?.flatMap((p) => p.data) ?? [];
  const total = data?.[0]?.pagination.total ?? 0;
  const totalPages = data?.[0]?.pagination.totalPages ?? 0;
  const hasMore = size < totalPages;
  const loadingMore = isValidating && size > (data?.length ?? 0);

  // Load the next page when the sentinel scrolls into view.
  const sentinel = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isValidating) setSize((s) => s + 1);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isValidating, setSize]);

  const filters = (
    <FilterPanel
      sort={sort}
      onSort={setSort}
      priceKey={priceKey}
      onPrice={setPriceKey}
      subcategories={subcategories}
      categoryHeading={categoryHeading}
    />
  );

  return (
    <section className={cn("mx-auto max-w-[1440px] px-4 xl:px-8", title ? "py-8" : "pb-8 pt-5")}>
      {title ? <h2 className="mb-5 text-xl font-semibold text-foreground sm:text-2xl">{title}</h2> : null}

      <div className="flex gap-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-[140px] space-y-4">{filters}</div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {isLoading && !data ? "Loading products…" : `${total.toLocaleString("en-IN")} ${total === 1 ? "product" : "products"}`}
            </p>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border-soft px-3 py-2 text-sm font-medium lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" /> Sort & Filter
            </button>
          </div>

          {error && !data ? (
            <p className="rounded-lg border border-border-soft bg-card p-8 text-center text-sm text-muted-foreground">
              Couldn&apos;t load products. Please refresh the page.
            </p>
          ) : isLoading && !data ? (
            <Grid>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-border-soft">
                  <div className="aspect-[4/5] animate-pulse bg-mist" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-mist" />
                    <div className="h-4 w-1/3 animate-pulse rounded bg-mist" />
                  </div>
                </div>
              ))}
            </Grid>
          ) : products.length === 0 ? (
            <div className="rounded-lg border border-border-soft bg-card p-10 text-center">
              <p className="font-medium text-foreground">No products here yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {priceKey ? "Try another price range." : "Sellers are adding products to this category. Check back soon."}
              </p>
              {priceKey ? (
                <button type="button" onClick={() => setPriceKey(null)} className="mt-3 text-sm font-semibold text-brand-strong">
                  Clear price filter
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <Grid>
                {products.map((p) => <ProductTile key={p.id} product={p} freeDelivery={freeDelivery} />)}
              </Grid>
              <div ref={sentinel} className="h-px" />
              {hasMore ? (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => setSize(size + 1)}
                    className="rounded-md border border-border-soft px-6 py-2.5 text-sm font-semibold hover:bg-mist disabled:opacity-60"
                  >
                    {loadingMore ? "Loading…" : "Show more products"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Phone sort & filter sheet */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-semibold">Sort & Filter</p>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close" className="rounded-full p-2 hover:bg-mist">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">{filters}</div>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="mt-4 h-11 w-full rounded-md bg-ink text-sm font-semibold text-paper"
            >
              Show {total.toLocaleString("en-IN")} products
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">{children}</div>;
}

function FilterPanel({
  sort,
  onSort,
  priceKey,
  onPrice,
  subcategories,
  categoryHeading,
}: {
  sort: Sort;
  onSort: (s: Sort) => void;
  priceKey: string | null;
  onPrice: (k: string | null) => void;
  subcategories?: CategoryNode[];
  categoryHeading: string;
}) {
  return (
    <>
      <div className="rounded-lg border border-border-soft bg-card p-4">
        <label className="block text-sm font-semibold" htmlFor="feed-sort">Sort by</label>
        <select
          id="feed-sort"
          value={sort}
          onChange={(e) => onSort(e.target.value as Sort)}
          className="mt-2 h-10 w-full rounded-md border border-border-soft bg-background px-3 text-sm"
        >
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="rounded-lg border border-border-soft bg-card">
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground ktm-keep-case">Filters</p>
          {priceKey ? (
            <button type="button" onClick={() => onPrice(null)} className="text-xs font-semibold text-brand-strong">Clear</button>
          ) : null}
        </div>

        {subcategories && subcategories.length > 0 ? (
          <div className="border-b border-border-soft px-4 py-3">
            <p className="mb-2 text-sm font-semibold">{categoryHeading}</p>
            <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {subcategories.map((c) => (
                <li key={c.id}>
                  <Link href={categoryHref(c.slug)} className="block rounded px-1 py-1 text-sm text-muted-foreground hover:bg-mist hover:text-foreground">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="px-4 py-3">
          <p className="mb-2 text-sm font-semibold">Price</p>
          <div className="flex flex-wrap gap-2">
            {PRICES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onPrice(priceKey === p.key ? null : p.key)}
                aria-pressed={priceKey === p.key}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  priceKey === p.key ? "border-ink bg-ink text-paper dark:border-brand dark:bg-brand dark:text-ink" : "border-border-soft hover:bg-mist",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
