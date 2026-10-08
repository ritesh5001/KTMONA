import { apiRequest } from "./apiClient";

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
}

export interface CartResponse {
  cart: {
    id: string;
    userId: string;
    updatedAt: string;
    items: CartItemDetails[];
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
 * Place the order AND initiate the PhonePe payment in a single request.
 *
 * The app used to POST /v1/checkout and then POST /v1/payments/initiate, which
 * meant the buyer waited two full server round-trips (plus mobile network
 * latency) between tapping Place Order and PhonePe opening. The backend already
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
    payment?: {
      paymentId: string;
      orderId: string;
      /** WEB only. Mobile uses the SDK fields below — PhonePe blocks in-app browsers. */
      redirectUrl?: string;
      phonepeOrderId?: string;
      /** Order token for the native SDK. Present when the caller sent platform MOBILE. */
      sdkToken?: string;
      sdkExpireAt?: number;
      /** Distinct from the OAuth client id; the SDK's init() needs this one. */
      merchantId?: string;
      environment?: string;
      amount: number;
      currency: string;
      provider: string;
    } | null;
    paymentInitError?: string;
  }>({
    // platform=MOBILE is not optional. Without it the backend takes the WEB
    // branch and creates a hosted-checkout PhonePe order, which carries no SDK
    // token — so the app has to place a *second* /v1/payments/initiate call to
    // get one. That left an orphaned PhonePe order PENDING until expiry behind
    // every checkout, and cost the buyer the extra round-trip this single
    // request exists to avoid.
    url: "/v1/checkout?withPayment=1&platform=MOBILE",
    method: "POST",
    data: payload ?? {},
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
