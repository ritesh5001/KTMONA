import { apiRequest } from "./api";

export interface Review {
  id: string;
  userId?: string;
  rating: number;
  text: string;
  images: string[];
  createdAt: string;
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
  payload: { rating: number; text: string; images: string[] },
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
