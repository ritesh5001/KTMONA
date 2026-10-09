import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiRequest } from "../services/api";
import { getShippingConfig } from "../services/shipping";

/* ── Categories ─────────────────────────────────────────────────────────── */

export interface FlatCategory {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  sortOrder?: number | null;
  image?: string | null;
  isActive?: boolean;
}

export interface CategoryNode extends FlatCategory {
  children: CategoryNode[];
}

export function buildTree(flat: FlatCategory[] | undefined): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const c of flat ?? []) if (c.isActive !== false) nodes.set(c.id, { ...c, children: [] });
  const roots: CategoryNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined;
    if (parent) parent.children.push(n);
    else if (!n.parentId) roots.push(n);
  }
  const sort = (list: CategoryNode[]) => {
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function findBySlug(roots: CategoryNode[], slug: string): { node: CategoryNode; path: CategoryNode[] } | null {
  const walk = (list: CategoryNode[], trail: CategoryNode[]): { node: CategoryNode; path: CategoryNode[] } | null => {
    for (const n of list) {
      const path = [...trail, n];
      if (n.slug === slug) return { node: n, path };
      const hit = walk(n.children, path);
      if (hit) return hit;
    }
    return null;
  };
  return walk(roots, []);
}

/** The storefront category tree (main → group → leaf). */
export function useCategoryTree() {
  const q = useQuery({
    queryKey: ["storefront", "categories"],
    queryFn: () => apiRequest<{ categories: FlatCategory[] }>("/v1/categories", { method: "GET" }),
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: "offlineFirst",
  });
  const tree = React.useMemo(() => buildTree(q.data?.categories), [q.data]);
  return { tree, isLoading: q.isLoading && !q.data, refetch: q.refetch };
}

/* ── Products ───────────────────────────────────────────────────────────── */

export interface FeedProduct {
  id: string;
  title: string;
  images?: string[];
  price?: number | null;
  salePrice?: number | null;
  regularPrice?: number | null;
  category?: { id?: string; name: string } | null;
  rating?: { average: number | null; count: number } | null;
}

interface ListResponse {
  data: FeedProduct[];
  pagination: { page: number; total: number; totalPages: number };
}

export type SortKey = "relevance" | "newest" | "price_asc" | "price_desc" | "discount";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "newest", label: "New Arrivals" },
  { key: "price_asc", label: "Price (Low to High)" },
  { key: "price_desc", label: "Price (High to Low)" },
  { key: "discount", label: "Discount" },
];

export const PRICE_BUCKETS: { key: string; label: string; min?: number; max?: number }[] = [
  { key: "u200", label: "Under ₹200", max: 199 },
  { key: "200-499", label: "₹200 – ₹499", min: 200, max: 499 },
  { key: "500-999", label: "₹500 – ₹999", min: 500, max: 999 },
  { key: "1000-1999", label: "₹1,000 – ₹1,999", min: 1000, max: 1999 },
  { key: "2000", label: "₹2,000 and above", min: 2000 },
];

export interface FeedFilters {
  categoryId?: string;
  search?: string;
  sort?: SortKey;
  priceKey?: string | null;
}

const PAGE = 20;

/** Endless product feed for the home "Products For You" grid and listings. */
export function useProductFeed(filters: FeedFilters) {
  const price = PRICE_BUCKETS.find((p) => p.key === filters.priceKey);
  const q = useInfiniteQuery({
    queryKey: ["storefront", "feed", filters.categoryId ?? null, filters.search ?? null, filters.sort ?? "relevance", filters.priceKey ?? null],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ page: String(pageParam), limit: String(PAGE) });
      if (filters.categoryId) qs.set("categoryId", filters.categoryId);
      if (filters.search) qs.set("search", filters.search);
      if (filters.sort && filters.sort !== "relevance") qs.set("sort", filters.sort);
      if (price?.min != null) qs.set("minPrice", String(price.min));
      if (price?.max != null) qs.set("maxPrice", String(price.max));
      return apiRequest<ListResponse>(`/v1/products?${qs.toString()}`, { method: "GET", signal });
    },
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    staleTime: 2 * 60 * 1000,
  });
  const products = React.useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);
  return {
    products,
    total: q.data?.pages[0]?.pagination.total ?? 0,
    isLoading: q.isLoading,
    isError: q.isError && !q.data,
    isFetchingMore: q.isFetchingNextPage,
    hasMore: Boolean(q.hasNextPage),
    loadMore: () => { if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage(); },
    refetch: q.refetch,
    isRefetching: q.isRefetching && !q.isFetchingNextPage,
  };
}

/** True when the shipping charge is off, so cards can say "Free Delivery". */
export function useFreeDelivery(): boolean {
  const q = useQuery({
    queryKey: ["storefront", "shipping"],
    queryFn: ({ signal }) => getShippingConfig(signal),
    staleTime: 30 * 60 * 1000,
  });
  return q.data ? !q.data.enabled : false;
}

/* ── Homepage banners (Admin → Homepage Banners) ─────────────────────────── */

export interface RemoteBanner {
  imageUrl: string;
  mobileImageUrl?: string | null;
  href?: string | null;
  alt: string;
}

export function useHomeBanners() {
  return useQuery({
    queryKey: ["storefront", "banners"],
    queryFn: () => apiRequest<{ data?: { hero: RemoteBanner[]; promo: RemoteBanner | null } }>("/v1/storefront/banners", { method: "GET" }),
    staleTime: 10 * 60 * 1000,
    select: (r) => r.data ?? { hero: [], promo: null },
  });
}

/** Turns a website link from an admin banner into an app route. */
export function bannerHrefToRoute(href?: string | null): string | null {
  if (!href) return null;
  const path = href.replace(/^https?:\/\/[^/]+/, "");
  const coll = path.match(/^\/collections\/([^/?#]+)/);
  if (coll) return `/category/${coll[1]}`;
  const prod = path.match(/^\/product\/([^/?#]+)/);
  if (prod) return `/product/${prod[1]}`;
  if (path.startsWith("/marketplace") || path.startsWith("/search")) return "/marketplace";
  return null;
}
