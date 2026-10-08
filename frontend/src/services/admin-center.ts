import { apiRequest, ensureFreshAccessToken } from "@/services/api";
import type { HealthResponse, Pagination, SellerOrder } from "@/services/seller-center";

/* Admin Center API client (Meesho-style platform operations). */

interface Envelope<T> {
  success: boolean;
  data: T;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:5000";
const BASE = "/v1/admin/center";

async function get<T>(path: string): Promise<T> {
  return (await apiRequest<Envelope<T>>(`${BASE}${path}`)).data;
}
async function send<T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  return (await apiRequest<Envelope<T>>(`${BASE}${path}`, { method, body: body ?? {} })).data;
}
function qs(params: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function downloadAdminFile(path: string, fallbackName: string) {
  const token = await ensureFreshAccessToken();
  const res = await fetch(`${API_BASE_URL}${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface AdminDashboard {
  rangeDays: number;
  kpis: {
    gmv: { value: number; change: number | null };
    orders: { value: number; change: number | null };
    aov: number;
    platformRevenue: number;
    commission: number;
    adRevenue: number;
    activeSellers: number;
    liveProducts: number;
  };
  series: { date: string; gmv: number; orders: number }[];
  actionCenter: { key: string; label: string; count: number; href: string }[];
  payoutsDue: { payableAmount: number; payableSellers: number; onHoldAmount: number; missingBank: number; negativeBalances: number };
  sellerCounts: Record<string, number>;
  topSellers: { sellerId: string; code: string; storeName: string | null; orders: number; gmv: number }[];
  topCategories: { name: string; units: number; gmv: number }[];
  recentOrders: { id: string; createdAt: string; status: string; amount: number; customer: string | null; city: string | null; sellers: string[] }[];
}

export type SellerTab = "all" | "pending" | "active" | "suspended" | "kyc_review" | "at_risk";

export interface AdminSellerRow {
  id: string;
  sellerCode: string;
  email: string | null;
  phone: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  joinedAt: string;
  storeName: string | null;
  kycStatus: string;
  gstRegistered: boolean | null;
  payoutHold: boolean;
  liveProducts: number;
  orders30d: number;
  gmv30d: number;
  cancelRate: number | null;
  rating: number | null;
  atRisk: boolean;
}

export interface AdminSellerDetail {
  id: string;
  sellerCode: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  statusReason: string | null;
  joinedAt: string;
  store: null | { name: string; slug: string; description: string | null; supportEmail: string | null; supportPhone: string | null; vacationMode: boolean };
  kyc: null | {
    status: string;
    rejectionReason: string | null;
    verifiedAt: string | null;
    businessType: string;
    gstRegistered: boolean;
    gstin: string | null;
    enrolmentId: string | null;
    pan: string | null;
    state: string;
    panMatchesGstin: boolean;
  };
  pickup: null | { contactName: string | null; phone: string | null; line1: string | null; line2: string | null; city: string | null; state: string | null; pincode: string | null };
  bankAccounts: { id: string; bankName: string; holderName: string; accountNumberMasked: string; ifsc: string; isPrimary: boolean; holderMatchesStore: boolean }[];
  payoutHold: boolean;
  payoutHoldReason: string | null;
  commission: { commissionPct: number; platformFee: number; custom: boolean };
  health: HealthResponse;
  products: Record<string, number>;
  lifetime: { orders: number; gmv: number };
  payoutDue: { amount: number; settlements: number; ledgerAmount: number };
  payouts: AdminPayout[];
  penalties: LedgerRow[];
  recentOrders: SellerOrder[];
}

export interface QcProduct {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  category: { id: string; name: string };
  seller: { id: string; code: string; storeName: string | null };
  submittedAt: string;
  isEdit: boolean;
  hsnCode: string | null;
  taxRate: number;
  variants: { id: string; size: string; color: string | null; sku: string; sellerPrice: number; mrp: number | null; stock: number; status: string }[];
  pendingVariants: number;
  categoryMedianPrice: number | null;
  flags: { level: "error" | "warning"; text: string }[];
}

export interface PenaltyRules {
  lateDispatchPenalty: number;
  autoCancelAfterHours: number;
  autoCancelPenalty: number;
  sellerCancelPenalty: number;
}

export interface SlaRow {
  orderId: string;
  sellerId: string;
  storeName: string | null;
  orderDate: string;
  dispatchBy: string;
  hoursOverdue: number;
  stage: "PENDING" | "READY_TO_SHIP";
  amount: number;
  willAutoCancel: boolean;
}

export interface LedgerRow {
  id: string;
  sellerId: string;
  storeName?: string | null;
  type: string;
  amount: number;
  orderId: string | null;
  note: string | null;
  entryDate: string;
  settledAt: string | null;
  waivedAt: string | null;
  createdAt: string;
}

export interface DueSeller {
  sellerId: string;
  sellerCode: string;
  storeName: string | null;
  settlementIds: string[];
  settlementsAmount: number;
  ledgerIds: string[];
  ledgerAmount: number;
  amount: number;
  oldestDueDate: string | null;
  onHold: boolean;
  holdReason: string | null;
  bank: { bankName: string; holderName: string; accountNumber: string; ifsc: string } | null;
  status: "PAYABLE" | "ON_HOLD" | "NO_BANK" | "CARRY_FORWARD";
}

export interface AdminPayout {
  id: string;
  payoutNumber: string;
  sellerId: string;
  storeName?: string | null;
  amount: number;
  settlementsAmount: number;
  ledgerAmount: number;
  settlementCount: number;
  ledgerCount: number;
  method: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

export interface PlatformCampaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
  startsAt: string;
  endsAt: string;
  joinDeadline: string | null;
  minDiscountPercent: number;
  categoryIds: string[];
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  phase: "DRAFT" | "CANCELLED" | "UPCOMING" | "LIVE" | "ENDED";
  sellers: number;
  products: number;
  variants: number;
  units: number;
  gmv: number;
}

export interface AdminAdRow {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  sellerId: string;
  storeName: string | null;
  dailyBudget: number;
  bidPerClick: number;
  products: number;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  revenue: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: "INFO" | "WARNING" | "SUCCESS";
  linkUrl: string | null;
  linkLabel: string | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export type CampaignInput = {
  name: string;
  description?: string | null;
  bannerImage?: string | null;
  startsAt: string;
  endsAt: string;
  joinDeadline?: string | null;
  minDiscountPercent: number;
  categoryIds?: string[];
};

// ── API ───────────────────────────────────────────────────────────────────

export const adminCenter = {
  dashboard: (days = 30) => get<AdminDashboard>(`/dashboard${qs({ days })}`),

  sellers: (params: { tab: SellerTab; page?: number; search?: string }) =>
    get<{ tab: SellerTab; counts: Record<string, number>; sellers: AdminSellerRow[]; pagination: Pagination }>(`/sellers${qs(params)}`),
  seller: (id: string) => get<AdminSellerDetail>(`/sellers/${id}`),
  reviewKyc: (id: string, status: "VERIFIED" | "REJECTED", reason?: string) => send<AdminSellerDetail>("POST", `/sellers/${id}/kyc`, { status, reason }),
  setSellerStatus: (id: string, status: "ACTIVE" | "SUSPENDED", reason?: string) => send<AdminSellerDetail>("POST", `/sellers/${id}/status`, { status, reason }),
  setPayoutHold: (id: string, hold: boolean, reason?: string) => send<AdminSellerDetail>("POST", `/sellers/${id}/payout-hold`, { hold, reason }),
  setCommission: (id: string, commissionPct: number, platformFee: number) => send<AdminSellerDetail>("PUT", `/sellers/${id}/commission`, { commissionPct, platformFee }),

  qc: (params: { page?: number; search?: string; categoryId?: string }) =>
    get<{ reasons: string[]; products: QcProduct[]; pagination: Pagination }>(`/qc${qs(params)}`),
  qcReview: (productIds: string[], action: "APPROVE" | "REJECT", reason?: string) =>
    send<{ results: { productId: string; ok: boolean; error?: string }[]; done: number }>("POST", "/qc/review", { productIds, action, reason }),

  sla: () => get<{ rules: PenaltyRules; rows: SlaRow[] }>("/sla"),
  runAutoCancel: () => send<{ cancelled: number }>("POST", "/sla/auto-cancel"),
  penaltyRules: () => get<PenaltyRules>("/penalties/rules"),
  savePenaltyRules: (rules: Partial<PenaltyRules>) => send<PenaltyRules>("PUT", "/penalties/rules", rules),
  penalties: (params: { page?: number; sellerId?: string }) =>
    get<{ totalCharged: number; entries: LedgerRow[]; pagination: Pagination }>(`/penalties${qs(params)}`),
  addPenalty: (body: { sellerId: string; amount: number; note: string; orderId?: string; type: "PENALTY" | "ADJUSTMENT" }) => send<LedgerRow>("POST", "/penalties", body),
  waivePenalty: (id: string) => send<LedgerRow>("POST", `/penalties/${id}/waive`),

  payoutsDue: () =>
    get<{ paymentCycleDays: number; totals: AdminDashboard["payoutsDue"]; sellers: DueSeller[] }>("/payouts/due"),
  payouts: (params: { page?: number; sellerId?: string }) =>
    get<{ totalPaid: number; payouts: AdminPayout[]; pagination: Pagination }>(`/payouts${qs(params)}`),
  pay: (sellerId: string, body: { reference: string; method?: "BANK_TRANSFER" | "UPI" | "OTHER"; note?: string; expectedAmount?: number }) =>
    send<AdminPayout>("POST", `/payouts/${sellerId}/pay`, body),
  downloadBankFile: () => downloadAdminFile("/payouts/bank-file", "ktmona-payouts.csv"),

  campaigns: () => get<{ campaigns: PlatformCampaign[] }>("/campaigns"),
  createCampaign: (body: CampaignInput) => send<PlatformCampaign>("POST", "/campaigns", body),
  updateCampaign: (id: string, body: Partial<CampaignInput> & { status?: "DRAFT" | "PUBLISHED" | "CANCELLED" }) => send<PlatformCampaign>("PATCH", `/campaigns/${id}`, body),

  ads: (days = 30) =>
    get<{ days: number; totals: { impressions: number; clicks: number; spend: number; orders: number; revenue: number; activeCampaigns: number }; campaigns: AdminAdRow[] }>(`/ads${qs({ days })}`),
  setAdStatus: (id: string, status: "ACTIVE" | "PAUSED" | "ENDED") => send<unknown>("PATCH", `/ads/${id}`, { status }),

  announcements: () => get<{ announcements: Announcement[] }>("/announcements"),
  saveAnnouncement: (id: string | null, body: Omit<Announcement, "id" | "createdAt" | "startsAt" | "endsAt"> & { startsAt?: string; endsAt?: string | null }) =>
    id ? send<Announcement>("PUT", `/announcements/${id}`, body) : send<Announcement>("POST", "/announcements", body),
  deleteAnnouncement: (id: string) => send<unknown>("DELETE", `/announcements/${id}`),
};
