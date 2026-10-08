import { apiRequest } from "@/services/api";

const REVIEWS_CACHE_TTL_MS = 2 * 60 * 1000;
const reviewsCache = new Map<string, { expiresAt: number; data: ReviewListResponse }>();
const reviewsInflight = new Map<string, Promise<ReviewListResponse>>();

interface User {
    id: string;
    fullName: string;
    avatar: string | null;
}

export interface Review {
    id: string;
    rating: number;
    title?: string | null;
    text: string;
    images: string[];
    helpfulCount?: number;
    createdAt: string;
    user: User;
}

export interface ReviewSummary {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
}

export interface ReviewListResponse {
    reviews: Review[];
    summary: ReviewSummary;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface CreateReviewPayload {
    rating: number;
    title?: string;
    text: string;
    images?: string[];
}

/**
 * Drop every cached page for a product. Without this a freshly submitted review
 * stayed invisible until the 2-minute entry expired, which read as the submit
 * having silently failed.
 */
export function clearProductReviewsCache(productId: string): void {
    for (const key of Array.from(reviewsCache.keys())) {
        if (key.startsWith(`${productId}:`)) {
            reviewsCache.delete(key);
        }
    }
}

export async function fetchProductReviews(
    productId: string,
    query?: { page?: number; limit?: number; sort?: string }
): Promise<ReviewListResponse> {
    const safePage = Math.max(1, Math.trunc(query?.page || 1));
    const safeLimit = Math.min(20, Math.max(1, Math.trunc(query?.limit || 10)));
    const safeSort = query?.sort || "newest";
    const cacheKey = `${productId}:${safePage}:${safeLimit}:${safeSort}`;
    const now = Date.now();

    const cached = reviewsCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return cached.data;
    }

    const inflight = reviewsInflight.get(cacheKey);
    if (inflight) {
        return inflight;
    }

    const params = new URLSearchParams();
    params.set("page", String(safePage));
    params.set("limit", String(safeLimit));
    params.set("sort", safeSort);
    const qs = params.toString();

    const request = apiRequest<ReviewListResponse>(
        `/v1/products/${productId}/reviews${qs ? `?${qs}` : ""}`,
        { method: "GET" }
    )
        .then((data) => {
            reviewsCache.set(cacheKey, {
                data,
                expiresAt: Date.now() + REVIEWS_CACHE_TTL_MS,
            });
            return data;
        })
        .finally(() => {
            reviewsInflight.delete(cacheKey);
        });

    reviewsInflight.set(cacheKey, request);
    return request;
}

export async function submitProductReview(
    productId: string,
    payload: CreateReviewPayload,
    token?: string | null
): Promise<{ message: string; review: Review }> {
    const result = await apiRequest<{ message: string; review: Review }>(
        `/v1/products/${productId}/reviews`,
        { method: "POST", body: payload, token }
    );
    clearProductReviewsCache(productId);
    return result;
}

export async function markReviewHelpful(
    reviewId: string,
    token?: string | null
): Promise<{ message: string; helpfulCount: number }> {
    return apiRequest<{ message: string; helpfulCount: number }>(
        `/v1/reviews/${reviewId}/helpful`,
        { method: "POST", token }
    );
}
