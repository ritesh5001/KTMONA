import { apiRequest } from "./api";

export interface CancellationRequestRecord {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
}

export async function listMyCancellations(
  token?: string | null,
  signal?: AbortSignal
) {
  return apiRequest<{ cancellations: CancellationRequestRecord[] }>(
    "/v1/cancellations/my",
    {
      method: "GET",
      token,
      signal,
    }
  );
}

export async function requestCancellation(
  orderId: string,
  reason: string,
  token?: string | null,
  signal?: AbortSignal
) {
  return apiRequest<{ cancellation: CancellationRequestRecord }>(
    `/v1/cancellations/${orderId}`,
    {
      method: "POST",
      token,
      signal,
      body: { reason },
    }
  );
}
