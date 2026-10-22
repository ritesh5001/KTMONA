import { apiRequest } from "./apiClient";
import type { RazorpayPaymentInit } from "./payments";

export interface CartItemDetails {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  priceSnapshot: number;
  product?: {
    id: string;
    title: string;
    sellerId: string;
    images?: string[];
  };
  variant?: {
    id: string;
    size: string;
    sku: string;
    color?: string | null;
    colorHex?: string | null;
    images?: string[];
    price: number;
    compareAtPrice?: number | null;
    inventory?: {
      stock: number;
    } | null;
  };
  savedForLater?: boolean;
  availability?: {
    status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNAVAILABLE";
    stock: number;
    maxQuantity: number;
    /** Current price minus the price when added (0 = unchanged). */
    priceChange: number;
    quantityTooHigh: boolean;
  };
  /** Other sizes/colours of the product. */
  options?: { id: string; size: string; color: string | null; colorHex: string | null; price: number; stock: number }[];
}

export interface CartResponse {
  cart: {
    id: string;
    userId: string;
    updatedAt: string;
    items: CartItemDetails[];
    /** Lines saved for later (not checked out). */
    savedItems?: CartItemDetails[];
  };
}

export interface CartItemMutationResponse {
  message: string;
  item: {
    id: string;
    productId: string;
    variantId: string;
    quantity: number;
    priceSnapshot: number;
  };
}

export interface CartItemDeleteResponse {
  message: string;
}

export interface AddCartItemPayload {
  productId: string;
  variantId: string;
  quantity: number;
  /**
   * What the caller already knows about the item, used to render a complete
   * optimistic row. Without it the cart briefly shows "Item / Size Default / ₹0"
   * with a placeholder thumbnail. Never sent to the server — the server is still
   * the source of truth for price.
   */
  preview?: {
    title?: string;
    image?: string | null;
    size?: string;
    color?: string | null;
    colorHex?: string | null;
    price?: number;
    compareAtPrice?: number | null;
  };
}

export async function getCart(token?: string | null): Promise<CartResponse> {
  return apiRequest<CartResponse>({
    url: "/v1/cart",
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function addCartItem(
  payload: AddCartItemPayload,
  token?: string | null
): Promise<CartItemMutationResponse> {
  // `preview` is client-only display data; the server would reject the extra key.
  const { preview: _preview, ...body } = payload;
  return apiRequest<CartItemMutationResponse>({
    url: "/v1/cart/items",
    method: "POST",
    data: body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function updateCartItem(
  itemId: string,
  quantity: number,
  token?: string | null
): Promise<CartItemMutationResponse> {
  return apiRequest<CartItemMutationResponse>({
    url: `/v1/cart/items/${itemId}`,
    method: "PUT",
    data: { quantity },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function removeCartItem(
  itemId: string,
  token?: string | null
): Promise<CartItemDeleteResponse> {
  return apiRequest<CartItemDeleteResponse>({
    url: `/v1/cart/items/${itemId}`,
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export interface CouponPreview {
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
}

export interface ValidateCouponResponse {
  valid: boolean;
  message?: string;
  coupon?: CouponPreview;
}

export async function validateCoupon(
  code: string,
  token?: string | null
): Promise<ValidateCouponResponse> {
  return apiRequest<ValidateCouponResponse>({
    url: "/v1/coupons/validate",
    method: "POST",
    data: { code },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function checkout(
  payload?: {
    shippingName?: string;
    shippingPhone?: string;
    shippingEmail?: string;
    shippingAddressLine1?: string;
    shippingAddressLine2?: string;
    shippingCity?: string;
    shippingNotes?: string;
    couponCode?: string;
    /** Buy-now: order only these variants, leaving the rest of the cart alone. */
    variantIds?: string[];
  },
  token?: string | null
) {
  return apiRequest<{
    message: string;
    order: {
      id: string;
      totalAmount: number;
      subTotalAmount: number;
      totalTaxAmount: number;
      grandTotal: number;
      couponCode?: string | null;
      discountAmount?: number;
    };
  }>({
    url: "/v1/checkout",
    method: "POST",
    data: payload ?? {},
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

/**
 * Place the order AND start its Razorpay payment in a single request.
 *
 * The app used to POST /v1/checkout and then POST /v1/payments/initiate, which
 * meant the buyer waited two full server round-trips (plus mobile network
 * latency) between tapping Place Order and the payment sheet opening. The backend already
 * supports doing both in one call, which is what the website uses.
 */
export async function checkoutWithPayment(
  payload?: {
    shippingName?: string;
    shippingPhone?: string;
    shippingEmail?: string;
    shippingAddressLine1?: string;
    shippingAddressLine2?: string;
    shippingCity?: string;
    shippingPincode?: string;
    shippingNotes?: string;
    couponCode?: string;
    /** Buy-now: order only these variants, leaving the rest of the cart alone. */
    variantIds?: string[];
    /** COD = Cash on Delivery: the order is confirmed with no payment step. */
    paymentMethod?: "ONLINE" | "COD";
    /** One key per Place Order attempt: a repeat returns the same order. */
    checkoutKey?: string;
  },
  token?: string | null
) {
  return apiRequest<{
    message: string;
    paymentMethod?: "ONLINE" | "COD";
    duplicate?: boolean;
    order: {
      id: string;
      totalAmount: number;
      subTotalAmount: number;
      totalTaxAmount: number;
      grandTotal: number;
      couponCode?: string | null;
      discountAmount?: number;
    };
    payment?: RazorpayPaymentInit | null;
    paymentInitError?: string;
  }>({
    url: "/v1/checkout?withPayment=1",
    method: "POST",
    data: payload ?? {},
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function setCartItemSavedForLater(itemId: string, saved: boolean) {
  return apiRequest<CartItemMutationResponse>({
    url: `/v1/cart/items/${itemId}/save-for-later`,
    method: "PATCH",
    data: { saved },
  });
}

/** Change a line to another size/colour of the same product. */
export async function changeCartItemVariant(itemId: string, variantId: string) {
  return apiRequest<CartItemMutationResponse>({
    url: `/v1/cart/items/${itemId}/variant`,
    method: "PATCH",
    data: { variantId },
  });
}

export interface CheckoutLineIssue {
  itemId: string;
  variantId: string;
  title: string;
  kind: string;
  message: string;
  available?: number;
}

/** Full price breakup from the server — exactly what Place Order will charge. */
export interface CheckoutQuote {
  lines: {
    itemId: string;
    variantId: string;
    productId: string;
    title: string;
    image: string | null;
    size: string | null;
    color: string | null;
    quantity: number;
    stock: number;
    unitPrice: number;
    unitMrp: number | null;
    lineTotal: number;
    taxRate: number;
  }[];
  issues: CheckoutLineIssue[];
  itemCount: number;
  mrpTotal: number;
  productDiscount: number;
  itemsTotal: number;
  coupon: { code: string; discount: number } | null;
  couponError: string | null;
  taxableAmount: number;
  gst: number;
  gstFee: number;
  shipping: number;
  shippingFee: number;
  freeDelivery: { threshold: number; eligible: boolean; remaining: number } | null;
  total: number;
  savings: number;
  cod: { available: boolean; reason: string | null; maxOrderAmount: number };
  canPlaceOrder: boolean;
}

export async function getCheckoutQuote(input: {
  couponCode?: string;
  paymentMethod?: "ONLINE" | "COD";
  variantIds?: string[];
} = {}) {
  return apiRequest<CheckoutQuote>({ url: "/v1/checkout/quote", method: "POST", data: input });
}
