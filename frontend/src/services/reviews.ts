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
    /** Size/colour the reviewer bought. */
    variantLabel?: string | null;
    /** The reviewer received this product in a KTMONA order. */
    verifiedPurchase?: boolean;
    sellerRating?: number | null;
    user: User;
}

export interface ReviewSummary {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
    verifiedReviews?: number;
    seller?: { name: string | null; rating: { average: number | null; count: number } } | null;
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
    /** Optional 1–5 rating of the seller's service. */
    sellerRating?: number;
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
): Promise<{ message: string; helpfulCount: number; voted: boolean }> {
    return apiRequest<{ message: string; helpfulCount: number; voted: boolean }>(
        `/v1/reviews/${reviewId}/helpful`,
        { method: "POST", token }
    );
}

export interface ReviewEligibility {
    canReview: boolean;
    alreadyReviewed: boolean;
    reason: string | null;
    variantLabel?: string | null;
}

export async function getReviewEligibility(productId: string) {
    return apiRequest<ReviewEligibility>(`/v1/reviews/product/${productId}/eligibility`, { method: "GET" });
}

export async function getMyHelpfulVotes(reviewIds: string[]) {
    if (!reviewIds.length) return { reviewIds: [] as string[] };
    return apiRequest<{ reviewIds: string[] }>(`/v1/reviews/my-votes?ids=${encodeURIComponent(reviewIds.join(","))}`, { method: "GET" });
}

export const REVIEW_REPORT_REASONS = [
    { value: "SPAM", label: "Spam or advertising" },
    { value: "FAKE", label: "Looks fake / not a real customer" },
    { value: "OFFENSIVE", label: "Offensive or abusive" },
    { value: "NOT_ABOUT_PRODUCT", label: "Not about this product" },
    { value: "PERSONAL_INFO", label: "Shares personal information" },
    { value: "OTHER", label: "Something else" },
] as const;

export async function reportReview(reviewId: string, reason: string, details?: string) {
    return apiRequest<{ reported: boolean; alreadyReported: boolean }>(`/v1/reviews/${reviewId}/report`, {
        method: "POST",
        body: { reason, ...(details?.trim() ? { details: details.trim() } : {}) },
    });
}

// ---- Product Q&A and incorrect-information reports ----

export interface ProductQuestion {
    id: string;
    question: string;
    answer: string | null;
    answeredBy: string;
    answeredAt: string | null;
    createdAt: string;
}

export async function fetchProductQuestions(productId: string) {
    return apiRequest<{ questions: ProductQuestion[] }>(`/v1/products/${productId}/questions`, { method: "GET" });
}

export async function askProductQuestion(productId: string, question: string) {
    return apiRequest<{ question: { id: string } }>(`/v1/products/${productId}/questions`, { method: "POST", body: { question } });
}

export const PRODUCT_REPORT_TYPES = [
    { value: "WRONG_PRICE", label: "Price is wrong" },
    { value: "WRONG_SPECS", label: "Details / specifications are wrong" },
    { value: "WRONG_IMAGES", label: "Photos don't match the product" },
    { value: "FAKE_OR_COUNTERFEIT", label: "May be fake or counterfeit" },
    { value: "OFFENSIVE", label: "Offensive or inappropriate" },
    { value: "OTHER", label: "Something else" },
] as const;

export async function reportProductInfo(productId: string, type: string, details?: string) {
    return apiRequest<{ reported: boolean; alreadyReported: boolean }>(`/v1/products/${productId}/report`, {
        method: "POST",
        body: { type, ...(details?.trim() ? { details: details.trim() } : {}) },
    });
}
