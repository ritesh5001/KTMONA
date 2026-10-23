import { apiRequest, CHECKOUT_REQUEST_TIMEOUT_MS } from "@/services/api";
import type { RazorpayPaymentInit } from "@/services/payments";

/** Another size/colour of the same product. */
export interface CartVariantOption {
  id: string;
  size: string;
  color: string | null;
  colorHex: string | null;
  price: number;
  stock: number;
}

export interface CartItemAvailability {
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNAVAILABLE";
  stock: number;
  maxQuantity: number;
  /** Current price minus the price when added (0 = unchanged). */
  priceChange: number;
  quantityTooHigh: boolean;
}

export interface CartItemDetails {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  priceSnapshot: number;
  savedForLater?: boolean;
  product?: {
    id: string;
    title: string;
    sellerId: string;
    images?: string[];
    isReturnable?: boolean;
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
  availability?: CartItemAvailability;
  options?: CartVariantOption[];
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
}

export async function getCart(token?: string | null): Promise<CartResponse> {
  return apiRequest<CartResponse>("/v1/cart", {
    method: "GET",
    token,
  });
}

export async function addCartItem(
  payload: AddCartItemPayload,
  token?: string | null
): Promise<CartItemMutationResponse> {
  return apiRequest<CartItemMutationResponse>("/v1/cart/items", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function updateCartItem(
  itemId: string,
  quantity: number,
  token?: string | null
): Promise<CartItemMutationResponse> {
  return apiRequest<CartItemMutationResponse>(`/v1/cart/items/${itemId}`, {
    method: "PUT",
    body: { quantity },
    token,
  });
}

export async function removeCartItem(
  itemId: string,
  token?: string | null
): Promise<CartItemDeleteResponse> {
  return apiRequest<CartItemDeleteResponse>(`/v1/cart/items/${itemId}`, {
    method: "DELETE",
    token,
  });
}

export async function setCartItemSavedForLater(itemId: string, saved: boolean) {
  return apiRequest<CartItemMutationResponse>(`/v1/cart/items/${itemId}/save-for-later`, {
    method: "PATCH",
    body: { saved },
  });
}

/** Change a cart line to another size/colour of the same product. */
export async function changeCartItemVariant(itemId: string, variantId: string) {
  return apiRequest<CartItemMutationResponse>(`/v1/cart/items/${itemId}/variant`, {
    method: "PATCH",
    body: { variantId },
  });
}

/** Add a guest's on-device cart to the account after sign-in. */
export async function mergeCart(items: AddCartItemPayload[]) {
  return apiRequest<{ added: number; skipped: Array<{ variantId: string; reason: string }> }>("/v1/cart/merge", {
    method: "POST",
    body: { items },
  });
}

export interface CheckoutLineIssue {
  itemId: string;
  variantId: string;
  title: string;
  kind: "NOT_FOUND" | "UNAVAILABLE" | "PENDING_APPROVAL" | "PRICING" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK";
  message: string;
  available?: number;
}

/** Full price breakup from the server, exactly what Place Order will charge. */
export interface CheckoutQuote {
  lines: Array<{
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
  }>;
  issues: CheckoutLineIssue[];
  itemCount: number;
  mrpTotal: number;
  productDiscount: number;
  itemsTotal: number;
  coupon: { code: string; discount: number; auto?: boolean } | null;
  couponError: string | null;
  /** Welcome offer / referral bonus on a first order. */
  autoDiscounts?: Array<{ key: "WELCOME" | "REFERRAL"; label: string; amount: number }>;
  /** Cashback wallet: balance, usable on this order, and applied. */
  wallet?: { available: number; usable: number; applied: number };
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
  useWallet?: boolean;
} = {}) {
  return apiRequest<CheckoutQuote>("/v1/checkout/quote", {
    method: "POST",
    body: input,
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
  return apiRequest<ValidateCouponResponse>("/v1/coupons/validate", {
    method: "POST",
    body: { code },
    token,
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
    shippingPincode?: string;
    shippingNotes?: string;
    couponCode?: string;
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
  }>("/v1/checkout", {
    method: "POST",
    body: payload ?? {},
    token,
  });
}

/** Place the order AND start its Razorpay payment in one call. */
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
    /** COD = Cash on Delivery: order is confirmed, nothing to pay now. */
    paymentMethod?: "ONLINE" | "COD";
    /** One key per Place Order attempt: a repeat returns the same order. */
    checkoutKey?: string;
    /** Pay part of the order from the cashback wallet. */
    useWallet?: boolean;
  },
  token?: string | null
) {
  return apiRequest<{
    message: string;
    paymentMethod?: "ONLINE" | "COD";
    /** This key had already placed the order. */
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
  }>("/v1/checkout?withPayment=1", {
    method: "POST",
    body: payload ?? {},
    token,
    timeoutMs: CHECKOUT_REQUEST_TIMEOUT_MS,
  });
}

/** Whether Cash on Delivery is offered, and the largest order total it covers. */
export async function getCodConfig() {
  return apiRequest<{ enabled: boolean; maxOrderAmount: number }>("/v1/config/cod", { method: "GET" });
}

/**
 * Whether this buyer's cart can be paid by Cash on Delivery: the platform
 * switch plus any admin block on the customer, a seller or a product.
 */
export async function getCodEligibility() {
  return apiRequest<{ available: boolean; reason: string | null; blocked: boolean }>("/v1/checkout/cod-eligibility", { method: "GET" });
}
