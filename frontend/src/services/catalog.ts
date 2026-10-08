import { apiRequest } from "@/services/api";
import { CACHE_TAGS } from "@/lib/cache-tags";

export interface Category {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export interface CategoryListResponse {
  categories: Category[];
}

const CATEGORIES_REVALIDATE_SECONDS = 300;

export async function getCategories(): Promise<CategoryListResponse> {
  return apiRequest<CategoryListResponse>("/v1/categories", {
    method: "GET",
    next: { revalidate: CATEGORIES_REVALIDATE_SECONDS, tags: [CACHE_TAGS.categories] },
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
