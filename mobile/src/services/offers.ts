import { apiRequest } from "./api";

export interface PublicCoupon {
  code: string;
  title: string | null;
  terms: string | null;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  validUntil: string;
  autoApply: boolean;
}

export interface OffersResponse {
  coupons: PublicCoupon[];
  welcome: { amount: number; minOrder: number } | null;
  referral: { friendAmount: number; referrerAmount: number; minOrder: number } | null;
  cashback: { percent: number; holdDays: number; expiryDays: number; maxUsePercent: number } | null;
}

export function getOffers() {
  return apiRequest<OffersResponse>("/v1/offers", { method: "GET" });
}

export function getProductOffers(productId: string) {
  return apiRequest<{ coupons: PublicCoupon[]; welcome: { amount: number; minOrder: number } | null; cashbackPercent: number }>(
    `/v1/offers/product/${productId}`,
    { method: "GET" }
  );
}

export function couponHeadline(c: Pick<PublicCoupon, "type" | "value" | "maxDiscountAmount">) {
  return c.type === "PERCENT" ? `${c.value}% off${c.maxDiscountAmount ? ` up to ₹${c.maxDiscountAmount}` : ""}` : `Flat ₹${c.value} off`;
}
