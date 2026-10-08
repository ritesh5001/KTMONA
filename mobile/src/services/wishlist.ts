import { apiRequest } from "./apiClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WishlistItemDetail {
  id: string;
  productId: string;
  createdAt: string;
  product: {
    id: string;
    title: string;
    description: string | null;
    images: string[];
    sellerPrice: number | null;
    adminListingPrice: number | null;
    price?: number | null;
    adminPrice?: number | null;
    salePrice?: number | null;
    regularPrice?: number | null;
    isPublished: boolean;
    category: { id: string; name: string } | null;
  };
}

export interface WishlistResponse {
  wishlist: {
    id: string;
    userId: string;
    items: WishlistItemDetail[];
  };
}

export interface WishlistToggleResponse {
  message: string;
  added: boolean;
  productId: string;
}

export interface WishlistCountResponse {
  count: number;
}

export interface WishlistCheckResponse {
  wishlisted: string[];
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getWishlist(
  token?: string | null
): Promise<WishlistResponse> {
  return apiRequest<WishlistResponse>({
    url: "/v1/wishlist",
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function getWishlistCount(
  token?: string | null
): Promise<WishlistCountResponse> {
  return apiRequest<WishlistCountResponse>({
    url: "/v1/wishlist/count",
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function toggleWishlistItem(
  productId: string,
  token?: string | null
): Promise<WishlistToggleResponse> {
  return apiRequest<WishlistToggleResponse>({
    url: "/v1/wishlist/toggle",
    method: "POST",
    data: { productId },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function addWishlistItem(
  productId: string,
  token?: string | null
): Promise<WishlistToggleResponse> {
  return apiRequest<WishlistToggleResponse>({
    url: "/v1/wishlist/items",
    method: "POST",
    data: { productId },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function removeWishlistItem(
  productId: string,
  token?: string | null
): Promise<WishlistToggleResponse> {
  return apiRequest<WishlistToggleResponse>({
    url: `/v1/wishlist/items/${productId}`,
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function checkWishlistItems(
  productIds: string[],
  token?: string | null
): Promise<WishlistCheckResponse> {
  return apiRequest<WishlistCheckResponse>({
    url: "/v1/wishlist/check",
    method: "POST",
    data: { productIds },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
