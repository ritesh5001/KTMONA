import { apiRequest } from "@/services/api";

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

export async function getWishlist(): Promise<WishlistResponse> {
  return apiRequest<WishlistResponse>("/v1/wishlist", { method: "GET" });
}

export async function getWishlistCount(): Promise<WishlistCountResponse> {
  return apiRequest<WishlistCountResponse>("/v1/wishlist/count", {
    method: "GET",
  });
}

export async function toggleWishlistItem(
  productId: string
): Promise<WishlistToggleResponse> {
  return apiRequest<WishlistToggleResponse>("/v1/wishlist/toggle", {
    method: "POST",
    body: { productId },
  });
}

export async function addWishlistItem(
  productId: string
): Promise<WishlistToggleResponse> {
  return apiRequest<WishlistToggleResponse>("/v1/wishlist/items", {
    method: "POST",
    body: { productId },
  });
}

export async function removeWishlistItem(
  productId: string
): Promise<WishlistToggleResponse> {
  return apiRequest<WishlistToggleResponse>(`/v1/wishlist/items/${productId}`, {
    method: "DELETE",
  });
}

export async function checkWishlistItems(
  productIds: string[]
): Promise<WishlistCheckResponse> {
  return apiRequest<WishlistCheckResponse>("/v1/wishlist/check", {
    method: "POST",
    body: { productIds },
  });
}
