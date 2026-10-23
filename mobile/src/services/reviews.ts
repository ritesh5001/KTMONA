import { apiRequest } from "./api";

export interface Review {
  id: string;
  userId?: string;
  rating: number;
  text: string;
  images: string[];
  createdAt: string;
  helpfulCount?: number;
  /** Size/colour the reviewer bought. */
  variantLabel?: string | null;
  verifiedPurchase?: boolean;
  user: {
    id?: string;
    fullName?: string | null;
    avatar?: string | null;
  };
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  verifiedReviews?: number;
  seller?: { name: string | null; rating: { average: number | null; count: number } } | null;
}

/** Backend wraps reviews in a `{ reviews, summary, pagination }` envelope. */
interface ReviewsResponse {
  reviews: Review[];
  summary?: ReviewSummary;
}

export async function fetchProductReviews(
  productId: string,
  signal?: AbortSignal
): Promise<{ reviews: Review[]; summary: ReviewSummary | null }> {
  const response = await apiRequest<ReviewsResponse>(
    `/v1/products/${productId}/reviews`,
    { method: "GET", signal }
  );
  return {
    reviews: response.reviews ?? [],
    summary: response.summary ?? null,
  };
}

export async function submitProductReview(
  productId: string,
  payload: { rating: number; text: string; images: string[]; sellerRating?: number },
  token?: string | null
) {
  return apiRequest<{ message: string; review: Review }>(
    `/v1/products/${productId}/reviews`,
    {
      method: "POST",
      body: payload,
      token,
    }
  );
}

export interface ReviewEligibility {
  canReview: boolean;
  alreadyReviewed: boolean;
  reason: string | null;
  variantLabel?: string | null;
}

export function getReviewEligibility(productId: string) {
  return apiRequest<ReviewEligibility>(`/v1/reviews/product/${productId}/eligibility`, { method: "GET" });
}

export function toggleReviewHelpful(reviewId: string) {
  return apiRequest<{ helpfulCount: number; voted: boolean }>(`/v1/reviews/${reviewId}/helpful`, { method: "POST" });
}

export function getMyHelpfulVotes(reviewIds: string[]) {
  return apiRequest<{ reviewIds: string[] }>(`/v1/reviews/my-votes?ids=${encodeURIComponent(reviewIds.join(","))}`, { method: "GET" });
}

export const REVIEW_REPORT_REASONS = [
  { value: "SPAM", label: "Spam or advertising" },
  { value: "FAKE", label: "Looks fake" },
  { value: "OFFENSIVE", label: "Offensive or abusive" },
  { value: "NOT_ABOUT_PRODUCT", label: "Not about this product" },
  { value: "OTHER", label: "Something else" },
] as const;

export function reportReview(reviewId: string, reason: string) {
  return apiRequest<{ reported: boolean }>(`/v1/reviews/${reviewId}/report`, { method: "POST", body: { reason } });
}

export interface ProductQuestion {
  id: string;
  question: string;
  answer: string | null;
  answeredBy: string;
  answeredAt: string | null;
}

export function fetchProductQuestions(productId: string) {
  return apiRequest<{ questions: ProductQuestion[] }>(`/v1/products/${productId}/questions`, { method: "GET" });
}

export function askProductQuestion(productId: string, question: string) {
  return apiRequest<{ question: { id: string } }>(`/v1/products/${productId}/questions`, { method: "POST", body: { question } });
}

export const PRODUCT_REPORT_TYPES = [
  { value: "WRONG_PRICE", label: "Price is wrong" },
  { value: "WRONG_SPECS", label: "Details / specifications are wrong" },
  { value: "WRONG_IMAGES", label: "Photos don't match the product" },
  { value: "FAKE_OR_COUNTERFEIT", label: "May be fake or counterfeit" },
  { value: "OTHER", label: "Something else" },
] as const;

export function reportProductInfo(productId: string, type: string, details?: string) {
  return apiRequest<{ reported: boolean; alreadyReported: boolean }>(`/v1/products/${productId}/report`, {
    method: "POST",
    body: { type, ...(details?.trim() ? { details: details.trim() } : {}) },
  });
}
