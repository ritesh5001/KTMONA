import { apiRequest } from "@/services/api";

export interface CancellationRequestRecord {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
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
    user_profiles?: {
      full_name?: string | null;
    } | null;
  };
}

export async function requestCancellation(orderId: string, reason: string) {
  return apiRequest<{ cancellation: CancellationRequestRecord }>(`/v1/cancellations/${orderId}`, {
    method: "POST",
    body: { reason },
  });
}

export async function listMyCancellations(token?: string | null) {
  return apiRequest<{ cancellations: CancellationRequestRecord[] }>("/v1/cancellations/my", {
    method: "GET",
    token,
  });
}

export async function listAdminCancellations(params?: {
  status?: "REQUESTED" | "APPROVED" | "REJECTED";
  userId?: string;
  orderId?: string;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.userId) query.set("userId", params.userId);
  if (params?.orderId) query.set("orderId", params.orderId);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ cancellations: CancellationRequestRecord[] }>(`/v1/cancellations${suffix}`, {
    method: "GET",
  });
}

export async function approveCancellation(id: string) {
  return apiRequest<{ success: boolean }>(`/v1/cancellations/${id}/approve`, {
    method: "PATCH",
  });
}

export async function rejectCancellation(id: string, reason?: string) {
  return apiRequest<{ success: boolean }>(`/v1/cancellations/${id}/reject`, {
    method: "PATCH",
    body: reason?.trim() ? { reason } : {},
  });
}
