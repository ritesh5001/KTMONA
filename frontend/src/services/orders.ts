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

export async function listBuyerOrders(token?: string | null) {
  return apiRequest<BuyerOrderListResponse>("/v1/orders", {
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
