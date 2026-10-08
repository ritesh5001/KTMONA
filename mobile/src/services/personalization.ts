import { apiRequest } from "./api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentlyViewedProduct {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  sellerPrice: number;
  adminListingPrice: number | null;
  isPublished: boolean;
  category: { id: string; name: string } | null;
  viewedAt: number;
}

interface RecentlyViewedResponse {
  products: RecentlyViewedProduct[];
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Track a product view for the authenticated user.
 * Fire-and-forget — callers should catch errors silently.
 */
export async function trackRecentlyViewed(
  productId: string,
  signal?: AbortSignal
): Promise<void> {
  await apiRequest<void>(`/v1/personalization/recently-viewed/${productId}`, {
    method: "POST",
    signal,
  });
}

/**
 * Fetch the authenticated user's recently viewed products.
 */
export async function getRecentlyViewed(
  signal?: AbortSignal
): Promise<RecentlyViewedProduct[]> {
  const data = await apiRequest<RecentlyViewedResponse>(
    "/v1/personalization/recently-viewed",
    { signal }
  );
  return data.products ?? [];
}
