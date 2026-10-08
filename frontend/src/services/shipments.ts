import { apiRequest } from "@/services/api";

export interface SellerShipment {
  id: string;
  orderId: string;
  sellerId: string;
  carrier: string;
  trackingNumber: string;
  status: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface SellerShipmentListResponse {
  data: {
    shipments: SellerShipment[];
  };
}

export interface TrackingEvent {
  status: string;
  note?: string | null;
  createdAt: string;
}

export interface TrackingShipment {
  id: string;
  carrier: string;
  trackingNumber: string;
  status: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  events: TrackingEvent[];
}

export interface TrackingResponse {
  data: {
    orderId: string;
    status: string;
    shipments: TrackingShipment[];
  };
}

export async function listSellerShipments(token?: string | null) {
  return apiRequest<SellerShipmentListResponse>("/v1/seller/shipments", {
    method: "GET",
    token,
  });
}

export async function getOrderTracking(orderId: string, token?: string | null) {
  return apiRequest<TrackingResponse>(`/v1/orders/${orderId}/tracking`, {
    method: "GET",
    token,
  });
}

// ---------------------------------------------------------------------------
// Public shipping-charge config (admin-controlled on/off)
// ---------------------------------------------------------------------------
export interface ShippingConfig {
  enabled: boolean;
  /** Fee to apply per order in INR (0 when disabled). */
  amount: number;
}

export async function getShippingConfig() {
  return apiRequest<ShippingConfig>("/v1/config/shipping", {
    method: "GET",
  });
}

export interface GstConfig {
  enabled: boolean;
  /** Flat GST fee per unit in INR (0 when disabled). */
  amount: number;
}

export async function getGstConfig() {
  return apiRequest<GstConfig>("/v1/config/gst", {
    method: "GET",
  });
}

export async function createShipment(
  orderId: string,
  payload: { carrier: string; trackingNumber: string },
  token?: string | null
) {
  return apiRequest<{ data: SellerShipment }>(
    `/v1/seller/shipments/${orderId}/create`,
    {
      method: "POST",
      body: payload,
      token,
    }
  );
}

export async function markShipmentShipped(
  shipmentId: string,
  note?: string,
  token?: string | null
) {
  return apiRequest<{ data: SellerShipment }>(
    `/v1/seller/shipments/${shipmentId}/ship`,
    {
      method: "PUT",
      body: note ? { note } : {},
      token,
    }
  );
}

export async function markShipmentDelivered(
  shipmentId: string,
  note?: string,
  token?: string | null
) {
  return apiRequest<{ data: SellerShipment }>(
    `/v1/seller/shipments/${shipmentId}/deliver`,
    {
      method: "PUT",
      body: note ? { note } : {},
      token,
    }
  );
}
