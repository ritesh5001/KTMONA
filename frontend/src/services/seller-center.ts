import { apiRequest, ensureFreshAccessToken } from "@/services/api";

/* Seller Center API client (Meesho-style supplier panel). */

interface Envelope<T> {
  success: boolean;
  data: T;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:5000";
const BASE = "/v1/seller/center";

async function get<T>(path: string): Promise<T> {
  return (await apiRequest<Envelope<T>>(`${BASE}${path}`)).data;
}
async function send<T>(method: "POST" | "PUT" | "PATCH", path: string, body?: unknown): Promise<T> {
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

/** Fetch a file (PDF/XLSX/CSV) with auth and trigger a browser download. */
export async function downloadFile(path: string, fallbackName: string, init?: { method?: string; body?: unknown }) {
  const token = await ensureFreshAccessToken();
  const res = await fetch(`${API_BASE_URL}${BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const err = await res.json();
      message = err?.error?.message ?? err?.message ?? message;
    } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Upload an .xlsx file as the raw request body. */
async function uploadXlsx<T>(path: string, file: File): Promise<T> {
  const token = await ensureFreshAccessToken();
  const res = await fetch(`${API_BASE_URL}${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? json?.message ?? `Upload failed (${res.status})`);
  return json.data as T;
}

// ── Shared types ──────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type OrderTab = "on_hold" | "pending" | "ready_to_ship" | "shipped" | "delivered" | "cancelled" | "rto" | "all";

export interface SellerOrderItem {
  id: string;
  productId: string;
  title: string;
  image: string | null;
  size: string | null;
  color: string | null;
  sku: string | null;
  quantity: number;
  sellerPrice: number;
  lineTotal: number;
}

export interface SellerOrder {
  orderId: string;
  orderDate: string;
  status: "PENDING" | "READY_TO_SHIP" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RTO_INITIATED" | "RTO_DELIVERED";
  dispatchBy: string;
  slaBreached: boolean;
  lateDispatch: boolean;
  paymentMode: "PREPAID" | "COD";
  customer: { name: string | null; city: string | null; pincode: string | null };
  items: SellerOrderItem[];
  sellerAmount: number;
  units: number;
  shipment: null | {
    id: string;
    status: string;
    mode: "SHIPROCKET" | "SELF_SHIP";
    carrier: string;
    awb: string | null;
    labelUrl: string | null;
    manifestId: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    rtoInitiatedAt: string | null;
    rtoDeliveredAt: string | null;
    rtoReason: string | null;
  };
  customerCancellation: null | { id: string; status: string; reason: string; createdAt: string };
  expectedPayoutDate: string | null;
  timeline?: { status: string; note: string | null; at: string }[];
}

export type OrderCounts = Record<OrderTab, number>;

export interface Overview {
  seller: {
    id: string;
    code: string;
    storeName: string | null;
    storeLogo: string | null;
    email: string | null;
    phone: string | null;
    accountStatus: string | null;
    kycStatus: string;
    vacationMode: boolean;
  };
  rangeDays: number;
  stats: {
    totalOrders: { value: number; change: number | null };
    totalSales: { value: number; change: number | null };
    activeProducts: { value: number; addedInRange: number };
    rating: { value: number | null; reviews: number };
  };
  series: { date: string; sales: number; orders: number }[];
  orderStatus: { pending: number; readyToShip: number; shipped: number; delivered: number; cancelled: number; rto: number };
  recentOrders: SellerOrder[];
  topProducts: { id: string; title: string; image: string | null; price: number | null; sellerPrice: number | null; sold: number }[];
  payments: { nextPayout: { date: string | null; amount: number }; upcoming: { amount: number; orders: number }; netPayable: number };
  checklist: { key: string; label: string; done: boolean; href: string }[];
  alerts: { tone: "danger" | "warning" | "info"; text: string; href: string }[];
}

export type CatalogTab = "all" | "live" | "under_review" | "rejected" | "paused" | "out_of_stock";

export interface CatalogProduct {
  id: string;
  title: string;
  image: string | null;
  category: { id: string; name: string };
  status: "LIVE" | "UNDER_REVIEW" | "REJECTED" | "REMOVED" | "PAUSED" | "PAUSED_HOLIDAY";
  rejectionReason: string | null;
  variantCount: number;
  priceMin: number | null;
  priceMax: number | null;
  sellerPriceMin: number;
  youEarnMin: number;
  stock: number;
  outOfStock: boolean;
  createdAt: string;
}

export interface InventoryVariant {
  variantId: string;
  productId: string;
  title: string;
  image: string | null;
  size: string;
  color: string | null;
  sku: string;
  status: string;
  stock: number;
  stockStatus: "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";
  soldLast30Days: number;
  daysOfCover: number | null;
  updatedAt: string | null;
}

export interface SellerReturn {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  rejectionReason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  items: { title: string; image: string | null; size?: string; color?: string | null; sku?: string; quantity: number; reason: string | null; amount: number }[];
  sellerAmount: number;
  claim: { claimNumber: string; status: string } | null;
  canClaim: boolean;
}

export interface RtoRow {
  orderId: string;
  status: string;
  awb: string | null;
  carrier: string;
  reason: string | null;
  initiatedAt: string | null;
  receivedAt: string | null;
  customer: { name: string | null; city: string | null };
  units: number;
  sellerAmount: number;
  claim: { claimNumber: string; status: string } | null;
}

export type ClaimType =
  | "DAMAGED_RETURN"
  | "WRONG_RETURN"
  | "MISSING_ITEM_IN_RETURN"
  | "RTO_DAMAGED"
  | "RTO_NOT_RECEIVED"
  | "PAYMENT_ISSUE"
  | "OTHER";

export interface SellerClaim {
  id: string;
  claimNumber: string;
  orderId: string;
  returnId: string | null;
  type: ClaimType;
  description: string;
  images: string[];
  amountClaimed: number | null;
  status: "OPEN" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  amountApproved: number | null;
  resolutionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  storeName?: string | null;
  sellerId?: string;
}

export interface PaymentsSummary {
  payoutHold: { reason: string | null } | null;
  paymentCycleDays: number;
  upcoming: { amount: number; orders: number };
  dueNow: { amount: number; orders: number };
  nextPayout: { date: string | null; amount: number };
  outstanding: { amount: number; orders: number };
  paid: { amount: number; orders: number; lastPaidAt: string | null };
  ledger: { adSpend: number; penalties: number; claimCredits: number; adjustments: number };
  netPayable: number;
  totals: { gross: number; commission: number; platformFee: number };
  weeklyPayouts: { weekStart: string; amount: number; orders: number }[];
}

export interface PaymentRow {
  settlementId: string;
  orderId: string;
  orderDate: string;
  gross: number;
  commission: number;
  platformFee: number;
  net: number;
  settlementStatus: string;
  shipmentStatus: string | null;
  deliveredAt: string | null;
  payableOn: string | null;
  paidAt: string | null;
  bucket: "upcoming" | "outstanding" | "paid" | "cancelled";
}

export interface LedgerEntry {
  id: string;
  type: "AD_SPEND" | "PENALTY" | "CLAIM_CREDIT" | "ADJUSTMENT";
  amount: number;
  orderId: string | null;
  note: string | null;
  entryDate: string;
  settledAt: string | null;
}

export interface PricingVariant {
  variantId: string;
  productId: string;
  title: string;
  image: string | null;
  size: string;
  color: string | null;
  sku: string;
  status: string;
  stock: number;
  sellerPrice: number;
  customerPrice: number | null;
  mrp: number | null;
  earnings: { sellerPrice: number; commission: number; platformFee: number; net: number };
  benchmark: number | null;
  competitive: boolean | null;
  recommendedSellerPrice: number | null;
  recommendedEarnings: number | null;
  offer: { id: string; name: string; discountPercent: number; status: string; endsAt: string } | null;
}

export interface SellerOffer {
  id: string;
  name: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  status: "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";
  variantCount: number;
  productCount: number;
  unitsSold: number;
  orders: number;
}

export interface AdCampaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  dailyBudget: number;
  bidPerClick: number;
  startsAt: string;
  endsAt: string | null;
  productCount: number;
  productIds: string[];
  spentToday: number;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  revenue: number;
  ctr: number;
  roas: number;
}

export interface AdsResponse {
  days: number;
  minBid: number;
  minDailyBudget: number;
  totals: { impressions: number; clicks: number; spend: number; orders: number; revenue: number; ctr: number; roas: number };
  daily: { date: string; impressions: number; clicks: number; spend: number; orders: number }[];
  campaigns: AdCampaign[];
}

export interface HealthResponse {
  days: number;
  score: number;
  status: "NEW" | "GOOD" | "AT_RISK" | "POOR";
  orders: number;
  overdueOrders: number;
  metrics: { key: string; label: string; value: number | null; unit: string; target: string; status: "GOOD" | "AT_RISK" | "POOR" | "NO_DATA" }[];
  ratings: { average: number | null; count: number; distribution: { rating: number; count: number }[] };
  penalties: { id: string; amount: number; orderId: string | null; note: string | null; date: string; settled: boolean }[];
  lateDispatchPenalty: number;
  tips: string[];
}

export interface InsightProduct {
  productId: string;
  title: string;
  image: string | null;
  category: string;
  live: boolean;
  stock: number;
  units: number;
  revenue: number;
  unitsChange: number | null;
  wishlisted: number;
  reviews: number;
  daysOfCover: number | null;
  ageDays: number;
}

export interface InsightsResponse {
  days: number;
  summary: { revenue: number; revenueChange: number | null; orders: number; ordersChange: number | null; units: number; unitsChange: number | null; avgOrderValue: number };
  trend: { date: string; revenue: number; units: number }[];
  categories: { category: string; units: number; revenue: number }[];
  topProducts: InsightProduct[];
  restock: InsightProduct[];
  notSelling: InsightProduct[];
  highDemand: InsightProduct[];
  recommendations: { title: string; detail: string; action: string; href: string }[];
}

export type BusinessType = "INDIVIDUAL" | "PARTNERSHIP" | "PRIVATE_LIMITED" | "PUBLIC_LIMITED" | "LLP" | "PROPRIETORSHIP";

export interface SellerSettings {
  sellerCode: string;
  account: { email: string | null; phone: string | null; whatsapp: string | null; status: string; joinedAt: string };
  store: null | { name: string; slug: string; description: string | null; logo: string | null; supportEmail: string | null; supportPhone: string | null; vacationMode: boolean };
  business: null | { businessType: BusinessType; gstRegistered: boolean; gstin: string | null; enrolmentId: string | null; pan: string | null; state: string; kycStatus: string };
  pickup: null | { contactName: string | null; phone: string | null; line1: string | null; line2: string | null; city: string | null; state: string | null; pincode: string | null };
  bankAccounts: { id: string; bankName: string; holderName: string; accountNumberMasked: string; ifsc: string; isPrimary: boolean }[];
  shipping: { mode: "SHIPROCKET" | "SELF_SHIP" };
}

export interface SaleEvent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
  startsAt: string;
  endsAt: string;
  joinDeadline: string | null;
  minDiscountPercent: number;
  categories: { id: string; name: string }[];
  phase: "UPCOMING" | "LIVE" | "ENDED" | "DRAFT" | "CANCELLED";
  canJoin: boolean;
  participation: null | { offerId: string; discountPercent: number; products: number; status: string };
}

export interface SellerAnnouncementRow {
  id: string;
  title: string;
  body: string;
  level: "INFO" | "WARNING" | "SUCCESS";
  linkUrl: string | null;
  linkLabel: string | null;
}

type ActionResult = { results: { orderId: string; ok: boolean; error?: string }[] };

// ── API ───────────────────────────────────────────────────────────────────

export const sellerCenter = {
  overview: (days = 7) => get<Overview>(`/overview${qs({ days })}`),

  orders: (params: { tab: OrderTab; page?: number; search?: string; limit?: number; sla?: string; from?: string; to?: string; sku?: string }) =>
    get<{ tab: OrderTab; counts: OrderCounts; orders: SellerOrder[]; pagination: Pagination }>(`/orders${qs(params)}`),
  orderCounts: () => get<OrderCounts>(`/orders/counts`),
  order: (orderId: string) => get<SellerOrder>(`/orders/${orderId}`),
  acceptOrders: (orderIds: string[]) => send<ActionResult & { mode: string }>("POST", "/orders/accept", { orderIds }),
  shipOrders: (orderIds: string[]) => send<ActionResult>("POST", "/orders/ship", { orderIds }),
  deliverOrder: (orderId: string) => send<{ ok: boolean }>("POST", `/orders/${orderId}/deliver`),
  updateTracking: (orderId: string, carrier: string, awb: string) => send<{ ok: boolean }>("PUT", `/orders/${orderId}/tracking`, { carrier, awb }),
  cancelOrder: (orderId: string, reason: string) => send<{ ok: boolean; needsAdminApproval: boolean }>("POST", `/orders/${orderId}/cancel`, { reason }),
  approveCustomerCancellation: (orderId: string) => send<unknown>("POST", `/orders/${orderId}/approve-cancellation`),
  rto: (orderId: string, action: "initiated" | "received", reason?: string) => send<{ ok: boolean }>("POST", `/orders/${orderId}/rto`, { action, reason }),
  downloadLabels: (orderIds: string[]) => downloadFile("/orders/labels", "ktmona-labels.pdf", { method: "POST", body: { orderIds } }),
  downloadManifest: (orderIds: string[]) => downloadFile("/orders/manifest", "ktmona-manifest.pdf", { method: "POST", body: { orderIds } }),

  catalog: (params: { tab: CatalogTab; page?: number; search?: string }) =>
    get<{ tab: CatalogTab; counts: Record<CatalogTab, number>; commission: { commissionPct: number; platformFee: number }; products: CatalogProduct[]; pagination: Pagination }>(`/catalog${qs(params)}`),
  setPaused: (productIds: string[], paused: boolean) => send<{ updated: number }>("POST", "/catalog/pause", { productIds, paused }),
  downloadCatalogTemplate: (categoryId: string) => downloadFile(`/catalog/template${qs({ categoryId })}`, "ktmona-catalog-template.xlsx"),
  bulkUpload: (categoryId: string, file: File) =>
    uploadXlsx<{ productsCreated: number; products: { id: string; title: string }[]; rowsWithErrors: number; errors: { row: number; message: string }[] }>(
      `/catalog/bulk-upload${qs({ categoryId, fileName: file.name })}`,
      file
    ),

  inventory: (params: { filter?: string; page?: number; search?: string }) =>
    get<{
      summary: { totalVariants: number; outOfStock: number; lowStock: number; inStock: number; totalUnits: number };
      lowStockThreshold: number;
      variants: InventoryVariant[];
      pagination: Pagination;
    }>(`/inventory${qs(params)}`),
  updateStock: (updates: { variantId: string; stock: number }[]) =>
    send<{ results: { variantId: string; ok: boolean; error?: string }[]; updated: number }>("PUT", "/inventory", { updates }),
  downloadInventory: () => downloadFile("/inventory/export", "ktmona-inventory.xlsx"),
  importInventory: (file: File) => uploadXlsx<{ updated: number; results: { variantId: string; ok: boolean; error?: string }[] }>("/inventory/import", file),

  returns: (params: { tab?: string; page?: number }) =>
    get<{ tab: string; counts: Record<string, number>; returns: SellerReturn[]; pagination: Pagination }>(`/returns${qs(params)}`),
  rtoList: (params: { status?: string; page?: number }) =>
    get<{ counts: { all: number; in_transit: number; received: number }; rto: RtoRow[]; pagination: Pagination }>(`/rto${qs(params)}`),
  claims: (params: { status?: string; page?: number }) =>
    get<{ counts: Record<string, number>; claims: SellerClaim[]; pagination: Pagination }>(`/claims${qs(params)}`),
  createClaim: (body: { orderId: string; returnId?: string; type: ClaimType; description: string; images?: string[]; amountClaimed?: number }) =>
    send<SellerClaim>("POST", "/claims", body),

  paymentsSummary: () => get<PaymentsSummary>("/payments/summary"),
  paymentOrders: (params: { bucket?: string; page?: number; search?: string }) =>
    get<{ rows: PaymentRow[]; pagination: Pagination }>(`/payments/orders${qs(params)}`),
  ledger: (params: { page?: number }) => get<{ entries: LedgerEntry[]; pagination: Pagination }>(`/payments/ledger${qs(params)}`),
  downloadStatement: (from: string, to: string) => downloadFile(`/payments/statement${qs({ from, to })}`, `ktmona-statement-${from}-to-${to}.csv`),

  pricing: (params: { page?: number; search?: string }) =>
    get<{ commission: { commissionPct: number; platformFee: number }; variants: PricingVariant[]; pagination: Pagination }>(`/pricing${qs(params)}`),
  calculator: (price: number) =>
    get<{ sellerPrice: number; commission: number; platformFee: number; net: number; commissionPct: number }>(`/pricing/calculator${qs({ price })}`),
  updatePrice: (variantId: string, body: { sellerPrice?: number; mrp?: number | null }) =>
    send<{ result: "live" | "review" | "mrp"; message: string }>("PUT", `/pricing/${variantId}`, body),
  offers: () => get<{ offers: SellerOffer[] }>("/offers"),
  createOffer: (body: { name: string; discountPercent: number; startsAt: string; endsAt: string; productIds: string[] }) =>
    send<{ offer: unknown; skippedVariants: number }>("POST", "/offers", body),
  cancelOffer: (offerId: string) => send<{ ok: boolean }>("POST", `/offers/${offerId}/cancel`),

  ads: (days = 30) => get<AdsResponse>(`/ads${qs({ days })}`),
  createCampaign: (body: { name: string; dailyBudget: number; bidPerClick: number; startsAt?: string; endsAt?: string | null; productIds: string[] }) =>
    send<unknown>("POST", "/ads", body),
  updateCampaign: (id: string, body: Partial<{ name: string; dailyBudget: number; bidPerClick: number; endsAt: string | null; status: "ACTIVE" | "PAUSED" | "ENDED"; productIds: string[] }>) =>
    send<unknown>("PATCH", `/ads/${id}`, body),

  health: (days = 30) => get<HealthResponse>(`/health${qs({ days })}`),

  campaigns: () => get<{ campaigns: SaleEvent[] }>("/campaigns"),
  joinCampaign: (id: string, productIds: string[], discountPercent: number) =>
    send<{ joined: boolean; skippedVariants: number }>("POST", `/campaigns/${id}/join`, { productIds, discountPercent }),
  leaveCampaign: (id: string) => send<{ left: boolean }>("POST", `/campaigns/${id}/leave`),
  announcements: () => get<SellerAnnouncementRow[]>("/announcements"),
  insights: (days = 30) => get<InsightsResponse>(`/insights${qs({ days })}`),

  settings: () => get<SellerSettings>("/settings"),
  storeNameAvailable: (name: string) => get<{ name: string; slug: string; available: boolean }>(`/settings/store-name-available${qs({ name })}`),
  saveStore: (body: { name: string; description?: string | null; logo?: string | null; supportEmail?: string | null; supportPhone?: string | null }) =>
    send<SellerSettings>("PUT", "/settings/store", body),
  saveBusiness: (body: { businessType: BusinessType; gstRegistered: boolean; gstin?: string | null; enrolmentId?: string | null; pan: string; state: string }) =>
    send<SellerSettings>("PUT", "/settings/business", body),
  savePickup: (body: { contactName: string; phone: string; line1: string; line2?: string | null; city: string; state: string; pincode: string }) =>
    send<SellerSettings>("PUT", "/settings/pickup", body),
  addBank: (body: { bankName: string; holderName: string; accountNumber: string; ifsc: string }) => send<SellerSettings>("POST", "/settings/bank", body),
  setVacation: (on: boolean) => send<SellerSettings>("PUT", "/settings/vacation", { on }),
};

// ── Admin: seller claims ──────────────────────────────────────────────────

export const adminSellerClaims = {
  list: async (status = "open") =>
    (await apiRequest<Envelope<{ claims: SellerClaim[]; pagination: Pagination }>>(`/v1/admin/seller-claims${qs({ status })}`)).data,
  review: async (id: string, body: { status: "UNDER_REVIEW" | "APPROVED" | "REJECTED"; amountApproved?: number; note?: string }) =>
    (await apiRequest<Envelope<SellerClaim>>(`/v1/admin/seller-claims/${id}/review`, { method: "POST", body })).data,
  settings: async () => (await apiRequest<Envelope<{ lateDispatchPenalty: number }>>(`/v1/admin/seller-claims/settings`)).data,
  saveSettings: async (lateDispatchPenalty: number) =>
    (await apiRequest<Envelope<{ lateDispatchPenalty: number }>>(`/v1/admin/seller-claims/settings`, { method: "PUT", body: { lateDispatchPenalty } })).data,
};

// ── Formatting helpers ────────────────────────────────────────────────────

export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
export function fmtDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  return withTime
    ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function shortId(id: string) {
  return `#${id.slice(-8).toUpperCase()}`;
}
