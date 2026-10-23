import { apiRequest } from "@/services/api";

export interface PublicCoupon {
  code: string;
  title: string | null;
  terms: string | null;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  validUntil: string;
  firstTimeUserOnly: boolean;
  autoApply: boolean;
  sellerId: string | null;
  productIds: string[];
  categoryIds: string[];
  excludedProductIds: string[];
  excludedCategoryIds: string[];
  perUserLimit: number | null;
}

export interface OffersResponse {
  coupons: PublicCoupon[];
  welcome: { amount: number; minOrder: number } | null;
  referral: { friendAmount: number; referrerAmount: number; minOrder: number } | null;
  cashback: { percent: number; maxPerOrder: number; holdDays: number; expiryDays: number; maxUsePercent: number } | null;
  sales: Array<{ id: string; name: string; slug: string; description: string | null; bannerImage: string | null; startsAt: string; endsAt: string; minDiscountPercent: number; live: boolean }>;
}

export async function getOffers() {
  return apiRequest<OffersResponse>("/v1/offers", { method: "GET" });
}

export async function getProductOffers(productId: string) {
  return apiRequest<{ coupons: PublicCoupon[]; welcome: { amount: number; minOrder: number } | null; cashbackPercent: number }>(
    `/v1/offers/product/${productId}`,
    { method: "GET" }
  );
}

/** "Flat ₹200 off" / "10% off up to ₹150". */
export function couponHeadline(c: Pick<PublicCoupon, "type" | "value" | "maxDiscountAmount">) {
  return c.type === "PERCENT"
    ? `${c.value}% off${c.maxDiscountAmount ? ` up to ₹${c.maxDiscountAmount}` : ""}`
    : `Flat ₹${c.value} off`;
}

/** Conditions in plain words, for the "Terms" line. */
export function couponConditions(c: PublicCoupon) {
  const parts: string[] = [];
  if (c.minOrderAmount > 0) parts.push(`On orders of ₹${c.minOrderAmount} or more`);
  if (c.firstTimeUserOnly) parts.push("First order only");
  if (c.productIds.length || c.categoryIds.length) parts.push("Selected products only");
  if (c.excludedProductIds.length || c.excludedCategoryIds.length) parts.push("Some products are excluded");
  if (c.sellerId) parts.push("Only on this seller's products");
  if (c.perUserLimit) parts.push(`Use ${c.perUserLimit === 1 ? "once" : `${c.perUserLimit} times`} per customer`);
  parts.push(`Valid till ${new Date(c.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`);
  return parts;
}
