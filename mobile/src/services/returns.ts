import { apiRequest } from "./api";

export interface ReturnItemRecord {
  id: string;
  returnRequestId: string;
  orderItemId: string;
  variantId: string;
  quantity: number;
  reason?: string | null;
}

export interface ReturnRequestRecord {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "INSPECTING" | "REJECTED" | "REFUNDED";
  refundAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  items: ReturnItemRecord[];
}

export async function listMyReturns(
  token?: string | null,
  signal?: AbortSignal
) {
  return apiRequest<{ returns: ReturnRequestRecord[] }>(
    "/v1/returns/my",
    {
      method: "GET",
      token,
      signal,
    }
  );
}

export async function requestReturn(
  orderId: string,
  reason: string,
  items: { orderItemId: string; quantity: number; reason?: string }[],
  token?: string | null,
  signal?: AbortSignal
) {
  return apiRequest<{ return: ReturnRequestRecord }>(
    `/v1/returns/${orderId}`,
    {
      method: "POST",
      token,
      signal,
      body: { reason, items },
    }
  );
}
