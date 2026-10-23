import { apiRequest, ensureFreshAccessToken } from "@/services/api";

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  priceSnapshot: number;
  sellerPriceSnapshot?: number;
  adminPriceSnapshot?: number;
  productTitle?: string;
  variantSku?: string;
  image?: string | null;
  size?: string | null;
  color?: string | null;
  /** False = only a wrong/damaged/defective/missing item can come back. */
  isReturnable?: boolean;
  sellerId?: string;
}

export interface BuyerOrder {
  id: string;
  status: string;
  paymentStatus?: string | null;
  cancellationStatus?: string | null;
  returnStatus?: string | null;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
  shipmentStatus?: string | null;
  /** Paid / COD-confirmed but the seller has not accepted it yet. */
  awaitingSeller?: boolean;
  cancellationRequest?: {
    id: string;
    status: "REQUESTED" | "APPROVED" | "REJECTED";
  } | null;
}

export interface BuyerOrderListResponse {
  orders: BuyerOrder[];
}

export interface SellerOrderItem {
  id: string;
  orderId: string;
  quantity: number;
  priceSnapshot: number;
  productTitle?: string;
  variantSku?: string;
  order: {
    id: string;
    status: string;
    createdAt: string;
    shipmentStatus?: string | null;
  /** Paid / COD-confirmed but the seller has not accepted it yet. */
  awaitingSeller?: boolean;
    shippingName?: string;
    shippingPhone?: string;
    shippingEmail?: string;
    shippingAddressLine1?: string;
    shippingAddressLine2?: string;
    shippingCity?: string;
    shippingPincode?: string;
    shippingNotes?: string;
    cancellationRequest?: {
      id: string;
      status: "REQUESTED" | "APPROVED" | "REJECTED";
      reason: string;
      createdAt: string;
    } | null;
  };
}

export interface SellerOrderDetail {
  orderId: string;
  status: string;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    quantity: number;
    priceSnapshot: number;
    productTitle?: string;
    variantSku?: string;
  }>;
}

export interface SellerOrderListResponse {
  orderItems: SellerOrderItem[];
}

/** "My Orders" status filter buckets understood by GET /v1/orders?status=. */
export type BuyerOrderStatusFilter = "ON_THE_WAY" | "DELIVERED" | "CANCELLED" | "RETURN";

export interface BuyerOrderListParams {
  page?: number;
  statuses?: BuyerOrderStatusFilter[];
  startDate?: string;
  endDate?: string;
}

/** Orders come back 20 per page, newest first. */
export const BUYER_ORDERS_PAGE_SIZE = 20;

export async function listBuyerOrders(token?: string | null, params: BuyerOrderListParams = {}) {
  const query = new URLSearchParams();
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.statuses?.length) query.set("status", params.statuses.join(","));
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  const qs = query.toString();
  return apiRequest<BuyerOrderListResponse>(`/v1/orders${qs ? `?${qs}` : ""}`, {
    method: "GET",
    token,
  });
}

export async function listSellerOrders(token?: string | null) {
  return apiRequest<SellerOrderListResponse>("/v1/seller/orders", {
    method: "GET",
    token,
  });
}

export async function getSellerOrder(
  orderId: string,
  token?: string | null
) {
  return apiRequest<SellerOrderDetail>(`/v1/seller/orders/${orderId}`, {
    method: "GET",
    token,
  });
}

export async function approveCancellationAsSeller(
  cancellationId: string,
  token?: string | null
) {
  return apiRequest<{ success: boolean; refundTriggered?: boolean }>(
    `/v1/cancellations/${cancellationId}/seller-approve`,
    {
      method: "PATCH",
      token,
    }
  );
}

/**
 * Download GST-compliant invoice PDF for a confirmed/shipped/delivered order.
 * Triggers a browser file download.
 */
export async function downloadInvoice(orderId: string): Promise<void> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!API_BASE_URL) throw new Error("API base URL is not configured");

  // Renew first: this bypasses apiRequest, so without it the download fails
  // as soon as the short-lived access token has aged out.
  const token = await ensureFreshAccessToken();

  const res = await fetch(`${API_BASE_URL}/v1/orders/${orderId}/invoice`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? "Unable to download invoice");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${orderId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Buyer order detail (GET /v1/orders/:id)
// ---------------------------------------------------------------------------

export type TrackingStageKey =
  | "PLACED"
  | "CONFIRMED"
  | "PACKED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "DELIVERY_FAILED";

export interface TrackingStage {
  key: TrackingStageKey;
  label: string;
  at: string | null;
  done: boolean;
  current: boolean;
}

export interface BuyerOrderShipment {
  id: string;
  sellerId: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  status: string;
  courierStatus: string | null;
  deliveryAttempt: { failed: true; note: string } | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  estimatedDelivery: { from: string; to: string } | null;
  stages: TrackingStage[];
  events: Array<{ status: string; note: string | null; at: string }>;
  itemIds: string[];
}

export interface BuyerOrderReturn {
  id: string;
  type: "RETURN" | "REPLACEMENT";
  status: string;
  reason: string;
  reasonCode: string | null;
  images: string[];
  refundAmount: number | null;
  rejectionReason: string | null;
  pickupStatus: string | null;
  pickupDate: string | null;
  pickupCarrier: string | null;
  pickupTracking: string | null;
  replacementTracking: string | null;
  appealNote: string | null;
  appealedAt: string | null;
  createdAt: string;
  items: Array<{ orderItemId: string; quantity: number }>;
}

export interface BuyerOrderDetail extends BuyerOrder {
  paymentMethod?: "ONLINE" | "COD";
  invoiceNumber?: string | null;
  couponCode?: string | null;
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingEmail?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingCity?: string | null;
  shippingPincode?: string | null;
  shippingNotes?: string | null;
  timeline: TrackingStage[];
  estimatedDelivery: { from: string; to: string } | null;
  shipments: BuyerOrderShipment[];
  charges: {
    itemsTotal: number;
    mrpTotal: number;
    productDiscount: number;
    couponCode: string | null;
    couponDiscount: number;
    autoDiscount?: number;
    autoDiscountLabel?: string | null;
    walletAmount?: number;
    tax: number;
    shipping: number;
    total: number;
  };
  refunds: Array<{ id: string; amount: number; status: string; reference: string | null; createdAt: string; updatedAt: string }>;
  returns: BuyerOrderReturn[];
  cancellation: { status: string; reason: string; rejectionReason: string | null; createdAt: string } | null;
  eligibility: {
    cancel: { allowed: boolean; reason: string | null };
    return: { allowed: boolean; reason: string | null; windowEndsAt: string | null };
  };
}

export async function getBuyerOrder(orderId: string, token?: string | null) {
  return apiRequest<{ order: BuyerOrderDetail }>(`/v1/orders/${orderId}`, { method: "GET", token });
}

/** Buy again: put the order's items back in the cart. */
export async function reorder(orderId: string) {
  return apiRequest<{ added: number; skipped: Array<{ variantId: string; reason: string }>; message: string }>(
    `/v1/orders/${orderId}/reorder`,
    { method: "POST" }
  );
}
