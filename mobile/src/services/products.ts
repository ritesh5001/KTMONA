import { apiRequest } from "./apiClient";
import { getCache, setCache } from "./cache";

export type ProductImage = string;

export interface ProductVariant {
  id: string;
  size: string;
  color?: string | null;
  images?: string[];
  sku: string;
  /** Public listing price set by admin. Never the seller cost price. */
  price: number;
  compareAtPrice?: number | null;
  inventory?: { stock: number } | null;
}

export interface ProductSummary {
  id: string;
  categoryId?: string;
  title: string;
  description?: string | null;
  images?: ProductImage[];
  category?: { id?: string; name: string } | null;
  /** Effective public selling price. The API currently exposes equivalent aliases. */
  price?: number | null;
  salePrice?: number | null;
  adminPrice?: number | null;
  adminListingPrice?: number | null;
  minPrice?: number | null;
  /** Buyer-facing MRP / compare-at price, never the seller's internal cost. */
  regularPrice?: number | null;
  compareAtPrice?: number | null;
  /** Legacy fallback used by a few public projections. */
  sellerPrice?: number | null;
}

export type ProductItem = ProductSummary;

export interface ProductDetail extends ProductSummary {
  variants: ProductVariant[];
}

export interface ProductListResponse {
  data: ProductSummary[];
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type ProductsCacheParams = {
  page: number;
  limit: number;
  categoryId?: string;
  search?: string;
  sort?: string;
};

function buildProductsCacheKey(params: ProductsCacheParams): string {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("limit", String(params.limit));
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  return `products:${query.toString()}`;
}

export async function getProducts(params: {
  page: number;
  limit: number;
  categoryId?: string;
  audience?: "MENS" | "KIDS";
  search?: string;
  sort?: string;
  signal?: AbortSignal;
}): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("limit", String(params.limit));
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.audience) query.set("audience", params.audience);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);

  return apiRequest<ProductListResponse>({
    url: `/v1/products?${query.toString()}`,
    method: "GET",
    signal: params.signal,
  });
}

export async function getProductsCached(
  params: ProductsCacheParams
): Promise<ProductListResponse | null> {
  return getCache<ProductListResponse>(buildProductsCacheKey(params));
}

export async function getProductsAndCache(
  params: ProductsCacheParams
): Promise<ProductListResponse> {
  const response = await getProducts(params);
  await setCache(buildProductsCacheKey(params), response);
  return response;
}

export async function getProductById(id: string, signal?: AbortSignal) {
  return apiRequest<{ product: ProductDetail }>({
    url: `/v1/products/${id}`,
    method: "GET",
    signal,
  });
}

/**
 * Fetch "related" products — same category, excluding the current product.
 * Uses the existing list endpoint with a categoryId filter.
 */
export async function getRelatedProducts(
  categoryId: string,
  excludeProductId: string,
  signal?: AbortSignal
): Promise<ProductSummary[]> {
  const res = await getProducts({
    page: 1,
    limit: 10,
    categoryId,
    signal,
  });
  return res.data.filter((p) => p.id !== excludeProductId);
}
