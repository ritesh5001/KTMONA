import { getCache, setCache } from "./cache";
import { apiRequest } from "./api";

// ---------------------------------------------------------------------------
// Types — mirrors backend TrackingResponse / ShipmentStatus
// ---------------------------------------------------------------------------
export type ShipmentStatus = "CREATED" | "SHIPPED" | "DELIVERED";

export interface ShipmentEvent {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  note: string | null;
  createdAt: string;
}

export interface Shipment {
  id: string;
  carrier: string;
  trackingNumber: string;
  status: ShipmentStatus;
  shippedAt: string | null;
  deliveredAt: string | null;
  events: ShipmentEvent[];
}

export interface TrackingResponse {
  orderId: string;
  /** Order-level status (e.g. "PLACED", "PROCESSING", "SHIPPED", etc.) */
  status: string;
  shipments: Shipment[];
}

/** Whether the shipment has reached a terminal state. */
export function isTerminalStatus(status: ShipmentStatus): boolean {
  return status === "DELIVERED";
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Fetch tracking info for a buyer order. */
export async function getOrderTracking(
  orderId: string,
  token?: string | null,
  signal?: AbortSignal
): Promise<TrackingResponse> {
  const response = await apiRequest<{ data: TrackingResponse }>(
    `/v1/orders/${orderId}/tracking`,
    { method: "GET", token, signal }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// Public shipping-charge config (admin-controlled on/off)
// ---------------------------------------------------------------------------
export interface ShippingConfig {
  enabled: boolean;
  /** Fee to apply per order in INR (0 when disabled). */
  amount: number;
}

const SHIPPING_CONFIG_CACHE_KEY = "config:shipping";
const GST_CONFIG_CACHE_KEY = "config:gst";

/**
 * Last known shipping/GST config, read synchronously enough to paint with.
 *
 * These are admin-controlled and change perhaps once a month, but checkout was
 * re-fetching both on every mount and showing hard-coded placeholder fees until
 * they landed — so the order total visibly jumped a beat after the screen
 * appeared. Serving the cached value first removes that jump.
 */
export async function getCachedShippingConfig(): Promise<ShippingConfig | null> {
  return getCache<ShippingConfig>(SHIPPING_CONFIG_CACHE_KEY);
}

export async function getCachedGstConfig(): Promise<GstConfig | null> {
  return getCache<GstConfig>(GST_CONFIG_CACHE_KEY);
}

export async function getShippingConfig(
  signal?: AbortSignal
): Promise<ShippingConfig> {
  const config = await apiRequest<ShippingConfig>("/v1/config/shipping", {
    method: "GET",
    signal,
  });
  void setCache(SHIPPING_CONFIG_CACHE_KEY, config);
  return config;
}

export interface GstConfig {
  enabled: boolean;
  /** Flat GST fee per unit in INR (0 when disabled). */
  amount: number;
}

export async function getGstConfig(signal?: AbortSignal): Promise<GstConfig> {
  const config = await apiRequest<GstConfig>("/v1/config/gst", {
    method: "GET",
    signal,
  });
  void setCache(GST_CONFIG_CACHE_KEY, config);
  return config;
}
