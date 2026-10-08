import { apiRequest } from "@/services/api";

interface CouponPreview {
  code?: string;
  type?: "PERCENT" | "FLAT" | string | null;
  value?: number | null;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  discountedPrice?: number | null;
  finalPrice?: number | null;
  isActive?: boolean | null;
}

export interface BestsellerProduct {
  id: string;
  productId: string;
  position: number;
  title: string;
  image?: string | null;
  categoryName?: string | null;
  compareAtPrice?: number | null;
  regularPrice?: number | null;
  sellerPrice?: number | null;
  adminPrice?: number | null;
  salePrice?: number | null;
  minPrice?: number | null;
  activeCoupon?: CouponPreview | null;
  coupon?: CouponPreview | null;
  couponPreview?: CouponPreview | null;
  coupons?: CouponPreview[] | null;
}

export async function getBestsellers(limit?: number) {
  const query = typeof limit === "number" ? `?limit=${limit}` : "";
  return apiRequest<{ products: BestsellerProduct[] }>(
    `/v1/bestsellers${query}`,
    {
      method: "GET",
    }
  );
}
