import { apiRequest } from "@/services/api";

export type ReturnStatus = "REQUESTED" | "APPROVED" | "INSPECTING" | "REJECTED" | "REFUNDED" | "REPLACED";

export type ReturnReasonCode =
  | "WRONG_PRODUCT"
  | "DAMAGED"
  | "DEFECTIVE"
  | "MISSING_ITEM"
  | "SIZE_ISSUE"
  | "NOT_AS_DESCRIBED"
  | "NO_LONGER_NEEDED"
  | "OTHER";

export const RETURN_REASONS: Array<{ code: ReturnReasonCode; label: string; needsPhoto: boolean }> = [
  { code: "WRONG_PRODUCT", label: "Received a wrong product", needsPhoto: true },
  { code: "DAMAGED", label: "Product arrived damaged", needsPhoto: true },
  { code: "DEFECTIVE", label: "Product is defective / not working", needsPhoto: true },
  { code: "MISSING_ITEM", label: "Item or part missing from the package", needsPhoto: false },
  { code: "SIZE_ISSUE", label: "Size or fit issue", needsPhoto: false },
  { code: "NOT_AS_DESCRIBED", label: "Different from the description or photos", needsPhoto: false },
  { code: "NO_LONGER_NEEDED", label: "No longer needed", needsPhoto: false },
  { code: "OTHER", label: "Other reason", needsPhoto: false },
];

/** Reasons accepted even for non-returnable products. */
export const SELLER_FAULT_REASONS: ReadonlySet<ReturnReasonCode> = new Set(["WRONG_PRODUCT", "DAMAGED", "DEFECTIVE", "MISSING_ITEM"]);

export const RETURN_WINDOW_DAYS = 7;

export interface ReturnItemRecord {
  id: string;
  returnRequestId: string;
  orderItemId: string;
  variantId: string;
  quantity: number;
  reason?: string | null;
  orderItem?: {
    id: string;
    productId: string;
    variantId: string;
    quantity: number;
    priceSnapshot: number;
  } | null;
}

export interface ReturnRequestRecord {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  status: ReturnStatus;
  type?: "RETURN" | "REPLACEMENT";
  reasonCode?: ReturnReasonCode | null;
  images?: string[];
  pickupStatus?: "SCHEDULED" | "PICKED_UP" | "RECEIVED" | null;
  pickupDate?: string | null;
  pickupCarrier?: string | null;
  pickupTracking?: string | null;
  replacementTracking?: string | null;
  appealNote?: string | null;
  appealedAt?: string | null;
  refundAmount?: number | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items: ReturnItemRecord[];
  order?: {
    id: string;
    status: string;
    totalAmount?: number;
    createdAt?: string;
    payment?: { status: string } | null;
  };
  user?: {
    id: string;
    email?: string | null;
    user_profiles?: { full_name?: string | null } | null;
  };
}

export async function requestReturn(
  orderId: string,
  reason: string,
  items: Array<{ orderItemId: string; quantity: number; reason?: string }>,
  details: { type?: "RETURN" | "REPLACEMENT"; reasonCode?: ReturnReasonCode; images?: string[] } = {}
) {
  return apiRequest<{ return: ReturnRequestRecord }>(`/v1/returns/${orderId}`, {
    method: "POST",
    body: { reason, items, ...details },
  });
}

/** Dispute a rejected return/replacement. */
export async function appealReturn(returnId: string, note: string) {
  return apiRequest<{ return: ReturnRequestRecord }>(`/v1/returns/${returnId}/appeal`, {
    method: "POST",
    body: { note },
  });
}

/** Admin: reverse-pickup progress. */
export async function updateReturnPickup(
  id: string,
  body: { status: "SCHEDULED" | "PICKED_UP" | "RECEIVED"; date?: string; carrier?: string; tracking?: string }
) {
  return apiRequest<{ return: ReturnRequestRecord }>(`/v1/returns/${id}/pickup`, { method: "PATCH", body });
}

/** Admin: replacement sent. */
export async function markReturnReplaced(id: string, tracking?: string) {
  return apiRequest<{ return: ReturnRequestRecord }>(`/v1/returns/${id}/replaced`, {
    method: "PATCH",
    body: tracking?.trim() ? { tracking: tracking.trim() } : {},
  });
}

export async function listMyReturns(token?: string | null) {
  return apiRequest<{ returns: ReturnRequestRecord[] }>("/v1/returns/my", {
    method: "GET",
    token,
  });
}

export async function getReturnById(returnId: string) {
  return apiRequest<{ return: ReturnRequestRecord }>(`/v1/returns/${returnId}`, {
    method: "GET",
  });
}

export async function listAdminReturns(params?: {
  status?: ReturnStatus;
  userId?: string;
  orderId?: string;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.userId) query.set("userId", params.userId);
  if (params?.orderId) query.set("orderId", params.orderId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ returns: ReturnRequestRecord[] }>(`/v1/returns${suffix}`, {
    method: "GET",
  });
}

export async function approveReturn(id: string) {
  return apiRequest<{ success: boolean }>(`/v1/returns/${id}/approve`, { method: "PATCH" });
}

export async function rejectReturn(id: string, reason?: string) {
  return apiRequest<{ success: boolean }>(`/v1/returns/${id}/reject`, {
    method: "PATCH",
    body: reason?.trim() ? { reason } : {},
  });
}

export async function processReturnRefund(id: string) {
  return apiRequest<{ success: boolean; refundTriggered?: boolean }>(`/v1/returns/${id}/refund`, {
    method: "POST",
  });
}
