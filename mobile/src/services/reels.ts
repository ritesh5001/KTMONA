import { API_BASE_URL, apiRequest } from "./api";

export type PublicReel = {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  productId: string | null;
  likes: number;
  product?: {
    id: string;
    title: string;
    images: string[];
  } | null;
};

export type PublicReelListResponse = {
  reels: PublicReel[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function listPublicReels(params?: { page?: number; limit?: number; category?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.category) searchParams.set("category", params.category);

  const queryString = searchParams.toString();
  const response = await apiRequest<PublicReelListResponse>(`/v1/reels${queryString ? `?${queryString}` : ""}`, {
    method: "GET",
  });

  const toAbsoluteMediaUrl = (value: string | null | undefined) => {
    if (!value) return value ?? null;
    if (/^https?:\/\//i.test(value)) return value;
    const normalizedPath = value.startsWith("/") ? value : `/${value}`;
    return `${API_BASE_URL}${normalizedPath}`;
  };

  return {
    ...response,
    reels: (response.reels ?? []).map((reel) => ({
      ...reel,
      videoUrl: toAbsoluteMediaUrl(reel.videoUrl) ?? reel.videoUrl,
      thumbnailUrl: toAbsoluteMediaUrl(reel.thumbnailUrl),
      product: reel.product
        ? {
            ...reel.product,
            images: (reel.product.images ?? []).map((image) => toAbsoluteMediaUrl(image) ?? image),
          }
        : reel.product,
    })),
  };
}
