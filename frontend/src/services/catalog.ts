import { apiRequest } from "@/services/api";
import { CACHE_TAGS } from "@/lib/cache-tags";

export interface Category {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  parentId?: string | null;
  sortOrder?: number | null;
  image?: string | null;
  bannerImage?: string | null;
  description?: string | null;
}

export interface CategoryListResponse {
  categories: Category[];
  /** Only the top two levels were sent: browse the rest with browseCategories(). */
  truncated?: boolean;
}

/** A category from the level-by-level API. */
export interface CategoryBrief extends Category {
  /** Direct sub-categories. 0 means this is a leaf (products can be listed here). */
  childCount: number;
  /** Names from the main category down to this one (search and id look-ups). */
  path?: string[];
  /** Matching ids, same order as `path`. */
  pathIds?: string[];
}

const CATEGORIES_REVALIDATE_SECONDS = 300;

export async function getCategories(): Promise<CategoryListResponse> {
  return apiRequest<CategoryListResponse>("/v1/categories", {
    method: "GET",
    next: { revalidate: CATEGORIES_REVALIDATE_SECONDS, tags: [CACHE_TAGS.categories] },
  });
}

/**
 * Storefront categories: only ones with live products, newest stock first.
 * Seller and admin pickers must keep using getCategories() (the full list).
 */
export async function getStorefrontCategories(): Promise<CategoryListResponse> {
  return apiRequest<CategoryListResponse>("/v1/categories?visible=1", {
    method: "GET",
    next: { revalidate: 120, tags: [CACHE_TAGS.categories] },
  });
}

// ---------------------------------------------------------------------------
// Single product (client-side)
// ---------------------------------------------------------------------------

export interface CatalogVariant {
  id: string;
  size: string;
  color?: string | null;
  colorHex?: string | null;
  images?: string[];
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  inventory?: { stock: number } | null;
}

export interface CatalogProductDetail {
  id: string;
  title: string;
  images?: string[];
  price?: number;
  variants?: CatalogVariant[];
}

/**
 * Fetch one product from the browser.
 *
 * The detail page is server-rendered, so nothing needed this until quick-buy —
 * which has to resolve a product's variants without navigating away from the grid.
 */
export async function getProductById(
  id: string
): Promise<{ product: CatalogProductDetail }> {
  return apiRequest<{ product: CatalogProductDetail }>(`/v1/products/${id}`, {
    method: "GET",
  });
}

/**
 * Browse the category tree one level at a time (the full tree is too big to
 * load): `parentId` ("root" for the top) lists a category's children, `q`
 * searches by name, `ids` looks categories up. `admin` includes hidden ones.
 */
export async function browseCategories(
  params: { parentId?: string; q?: string; ids?: string[] },
  opts: { admin?: boolean; scope?: "SELLER" | "STOREFRONT" } = {}
): Promise<{ categories: CategoryBrief[] }> {
  const search = new URLSearchParams();
  if (opts.admin && opts.scope) search.set("scope", opts.scope);
  if (params.q) search.set("q", params.q);
  else if (params.ids?.length) search.set("ids", params.ids.join(","));
  else search.set("parentId", params.parentId || "root");
  return apiRequest<{ categories: CategoryBrief[] }>(
    `${opts.admin ? "/v1/admin/categories" : "/v1/categories"}?${search.toString()}`,
    opts.admin ? { method: "GET" } : { method: "GET", next: { revalidate: 60, tags: [CACHE_TAGS.categories] } }
  );
}
