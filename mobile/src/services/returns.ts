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
  signal?: AbortSignal,
  details: { type?: "RETURN" | "REPLACEMENT"; reasonCode?: ReturnReasonCode; images?: string[] } = {}
) {
  return apiRequest<{ return: ReturnRequestRecord }>(
    `/v1/returns/${orderId}`,
    {
      method: "POST",
      token,
      signal,
      body: { reason, items, ...details },
    }
  );
}

/** Dispute a rejected return/replacement. */
export async function appealReturn(returnId: string, note: string, token?: string | null) {
  return apiRequest<{ return: ReturnRequestRecord }>(`/v1/returns/${returnId}/appeal`, {
    method: "POST",
    token,
    body: { note },
  });
}

export type ReturnReasonCode =
  | "WRONG_PRODUCT"
  | "DAMAGED"
  | "DEFECTIVE"
  | "MISSING_ITEM"
  | "SIZE_ISSUE"
  | "NOT_AS_DESCRIBED"
  | "NO_LONGER_NEEDED"
  | "OTHER";

export const RETURN_REASONS: { code: ReturnReasonCode; label: string; needsPhoto: boolean }[] = [
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
export const SELLER_FAULT_REASONS: ReadonlySet<string> = new Set(["WRONG_PRODUCT", "DAMAGED", "DEFECTIVE", "MISSING_ITEM"]);
