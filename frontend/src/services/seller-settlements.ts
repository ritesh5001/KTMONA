import { apiRequest } from "@/services/api";

// ---------------------------------------------------------------------------
// Types — mirrors backend SellerSettlement shape from settlement repo
// ---------------------------------------------------------------------------

export interface SellerSettlement {
  id: string;
  orderId: string;
  sellerId: string;
  grossAmount: number;
  commissionAmount: number;
  platformFee: number;
  netAmount: number;
  status: "PENDING" | "SETTLED" | "FAILED";
  settledAt: string | null;
  createdAt: string;
  order?: {
    id: string;
    totalAmount: number;
    status: string;
    invoiceNumber?: string | null;
  } | null;
}

export interface SellerSettlementListResponse {
  success: boolean;
  data: SellerSettlement[];
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Fetch all settlement records for the authenticated seller. */
export async function listSellerSettlements(
  token?: string | null
): Promise<SellerSettlement[]> {
  const res = await apiRequest<SellerSettlementListResponse>(
    "/v1/seller/settlements",
    { method: "GET", token }
  );
  return res.data;
}
