import { apiRequest, API_BASE_URL } from "./api";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  priceSnapshot: number;
  productTitle?: string | null;
  /** Variant gallery first, else the product's — used as the order thumbnail. */
  productImage?: string | null;
  variantSize?: string | null;
  variantSku?: string | null;
  variantColor?: string | null;
  /** False = only a wrong/damaged/defective/missing item can come back. */
  isReturnable?: boolean;
  sellerId?: string;
}

export interface BuyerOrder {
  id: string;
  status: string;
  totalAmount: number;
  subTotalAmount?: number;
  totalTaxAmount?: number;
  grandTotal?: number;
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

/** Full order detail (GET /v1/orders/:id) */
export interface BuyerOrderDetail {
  /** Paid / COD-confirmed but the seller has not accepted it yet. */
  awaitingSeller?: boolean;
  id: string;
  userId: string;
  status: string;
  /** COD orders are paid in cash to the delivery partner. */
  paymentMethod?: "ONLINE" | "COD";
  totalAmount: number;
  subTotalAmount?: number;
  totalTaxAmount?: number;
  grandTotal?: number;
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingEmail?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingCity?: string | null;
  shippingNotes?: string | null;
  createdAt: string;
  items: OrderItem[];
  paymentStatus?: string | null;
  invoiceNumber?: string | null;
  shippingPincode?: string | null;
  // Added by the order view (timeline, tracking, charges, refunds, returns).
  timeline?: TrackingStage[];
  estimatedDelivery?: { from: string; to: string } | null;
  shipments?: BuyerOrderShipment[];
  charges?: {
    itemsTotal: number;
    mrpTotal: number;
    productDiscount: number;
    couponCode: string | null;
    couponDiscount: number;
    tax: number;
    shipping: number;
    total: number;
  };
  refunds?: { id: string; amount: number; status: string; reference: string | null; createdAt: string; updatedAt: string }[];
  returns?: BuyerOrderReturn[];
  cancellation?: { status: string; reason: string; rejectionReason: string | null; createdAt: string } | null;
  eligibility?: {
    cancel: { allowed: boolean; reason: string | null };
    return: { allowed: boolean; reason: string | null; windowEndsAt: string | null };
  };
}

export interface TrackingStage {
  key: string;
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
  events: { status: string; note: string | null; at: string }[];
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
  items: { orderItemId: string; quantity: number }[];
}

export interface BuyerOrderDetailResponse {
  order: BuyerOrderDetail;
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

export const ORDER_STATUS_FILTERS: { value: BuyerOrderStatusFilter; label: string }[] = [
  { value: "ON_THE_WAY", label: "On the way" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "RETURN", label: "Return" },
];

/** How many calendar years get their own option (this year and the three before). */
const ORDER_YEAR_OPTIONS = 4;

/** "Last 30 days", the recent years, then "Older" for everything before them. */
export function orderTimeFilterOptions(now: Date): { value: string; label: string }[] {
  const year = now.getFullYear();
  return [
    { value: "LAST_30", label: "Last 30 days" },
    ...Array.from({ length: ORDER_YEAR_OPTIONS }, (_, i) => ({
      value: String(year - i),
      label: String(year - i),
    })),
    { value: "OLDER", label: "Older" },
  ];
}

/** Date range for a time option, as ISO strings for GET /v1/orders. */
export function orderTimeFilterRange(
  value: string,
  now: Date
): Pick<BuyerOrderListParams, "startDate" | "endDate"> {
  if (value === "LAST_30") {
    // Start of the day 30 days ago, so the request (and its server cache key) is stable all day.
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    return { startDate: start.toISOString() };
  }
  if (value === "OLDER") {
    const firstYear = now.getFullYear() - (ORDER_YEAR_OPTIONS - 1);
    return { endDate: new Date(new Date(firstYear, 0, 1).getTime() - 1).toISOString() };
  }
  const year = Number(value);
  if (!Number.isInteger(year)) return {};
  return {
    startDate: new Date(year, 0, 1).toISOString(),
    endDate: new Date(new Date(year + 1, 0, 1).getTime() - 1).toISOString(),
  };
}

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

/** Fetch a single order's full detail. */
export async function getBuyerOrderDetail(
  orderId: string,
  token?: string | null,
  signal?: AbortSignal
) {
  return apiRequest<BuyerOrderDetailResponse>(`/v1/orders/${orderId}`, {
    method: "GET",
    token,
    signal,
  });
}

/**
 * Download invoice PDF and open the native share sheet.
 */
export async function downloadInvoice(
  orderId: string,
  token: string
): Promise<void> {
  const downloadUri = `${API_BASE_URL}/v1/orders/${orderId}/invoice`;
  const fileUri = `${FileSystem.cacheDirectory ?? ""}invoice-${orderId}.pdf`;

  const result = await FileSystem.downloadAsync(downloadUri, fileUri, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status !== 200) {
    throw new Error("Unable to download invoice");
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Invoice",
      UTI: "com.adobe.pdf",
    });
  } else {
    throw new Error("Sharing is not available on this device");
  }
}

/** Buy again: put the order's items back in the cart. */
export async function reorder(orderId: string, token?: string | null) {
  return apiRequest<{ added: number; skipped: { variantId: string; reason: string }[]; message: string }>(
    `/v1/orders/${orderId}/reorder`,
    { method: "POST", token }
  );
}
