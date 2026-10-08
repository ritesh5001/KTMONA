import { apiRequest } from "@/services/api";

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
  status: "REQUESTED" | "APPROVED" | "INSPECTING" | "REJECTED" | "REFUNDED";
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
  items: Array<{ orderItemId: string; quantity: number; reason?: string }>
) {
  return apiRequest<{ return: ReturnRequestRecord }>(`/v1/returns/${orderId}`, {
    method: "POST",
    body: { reason, items },
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
  status?: "REQUESTED" | "APPROVED" | "INSPECTING" | "REJECTED" | "REFUNDED";
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
