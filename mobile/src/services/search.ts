import { apiRequest } from "./api";
import type { ProductSummary } from "./products";

export type SortOption = "relevance" | "price_asc" | "price_desc" | "newest" | "popularity";

// ---------------------------------------------------------------------------
// Autocomplete suggestions
// ---------------------------------------------------------------------------

export interface SuggestionItem {
  id: string;
  title: string;
  category?: string | null;
}

export async function getSuggestions(
  q: string,
  limit: number = 8,
  signal?: AbortSignal
): Promise<SuggestionItem[]> {
  const query = new URLSearchParams();
  query.set("q", q);
  query.set("limit", String(limit));
  const res = await apiRequest<{ suggestions: SuggestionItem[] }>(
    `/v1/search/suggest?${query.toString()}`,
    { method: "GET", signal }
  );
  return res.suggestions;
}

// ---------------------------------------------------------------------------
// Trending searches
// ---------------------------------------------------------------------------

export async function getTrending(
  limit: number = 10,
  signal?: AbortSignal
): Promise<string[]> {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  const res = await apiRequest<{ trending: string[] }>(
    `/v1/search/trending?${query.toString()}`,
    { method: "GET", signal }
  );
  return res.trending;
}

// ---------------------------------------------------------------------------
// Related products (dedicated endpoint)
// ---------------------------------------------------------------------------

export async function getRelatedProductsFromApi(
  productId: string,
  limit: number = 8,
  signal?: AbortSignal
): Promise<ProductSummary[]> {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  const res = await apiRequest<{ data: ProductSummary[] }>(
    `/v1/products/${productId}/related?${query.toString()}`,
    { method: "GET", signal }
  );
  return res.data;
}
