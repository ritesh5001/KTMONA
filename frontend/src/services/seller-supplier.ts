import { apiRequest } from "@/services/api";
import { downloadFile, type Pagination, type PricingVariant, type SellerAnnouncementRow } from "@/services/seller-center";

/* Meesho supplier-panel screens: home, catalog uploads, quality, RTO, payments. */

interface Envelope<T> {
  success: boolean;
  data: T;
}

const BASE = "/v1/seller/center";

async function get<T>(path: string): Promise<T> {
  return (await apiRequest<Envelope<T>>(`${BASE}${path}`)).data;
}
async function send<T>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
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

export interface RtoRates {
  days: number;
  codRto: number;
  prepaidRto: number;
  allReturns: number;
  wdrpReturns: number;
  products: number;
  productsWithPrepaid: number;
  productsWithWdrp: number;
}

export interface HomeResponse {
  storeName: string | null;
  todo: { pendingOrders: number; downloadLabels: number; outOfStock: number; lowStock: number };
  insights: {
    range: "daily" | "weekly" | "monthly";
    series: { start: string; end: string; views: number; orders: number }[];
    views: { value: number; change: number | null };
    orders: { value: number; change: number | null };
  };
  rto: RtoRates;
  priceSuggestions: number;
  setup: { key: string; label: string; done: boolean; href: string }[];
  announcements: SellerAnnouncementRow[];
}

export interface DispatchPerformance {
  days: number;
  slaHours: number;
  totalOrders: number;
  shipped: number;
  onTimeDispatchPct: number | null;
  lateDispatched: number;
  pendingBreached: number;
  avgDispatchHours: number | null;
  within24hPct: number | null;
  sameDayPct: number | null;
  sellerCancellationPct: number | null;
  weekly: { start: string; shipped: number; onTimePct: number | null }[];
}

export interface ReturnsOverview {
  days: number;
  summary: { returnRate: number; returned: number; delivered: number; avgReverseShippingCost: number; rtoRate: number; rtoOrders: number; dispatched: number };
  products: {
    id: string;
    title: string;
    image: string | null;
    category: { id: string; name: string };
    delivered: number;
    returns: number;
    returnRate: number;
    topReason: string | null;
    wdrpEnabled: boolean;
    prepaidEnabled: boolean;
  }[];
}

export type QualityBand = "GREEN" | "YELLOW" | "RED" | "BLOCKED";
export interface QualityResponse {
  score: { totalRatings: number; lowRatings: number; lowPct: number | null; band: QualityBand | null; minRatings: number };
  bands: { key: QualityBand; label: string; visibility: string; from: number; to: number | null }[];
  topFeedback: { label: string; count: number; pct: number }[];
  counts: { blocking_soon: number; action_pending: number; fixed: number };
  tab: string;
  products: {
    id: string;
    title: string;
    image: string | null;
    sku: string | null;
    ratings: number;
    lowRatings: number;
    lowPct: number | null;
    band: QualityBand | null;
    feedback: { label: string; count: number; pct: number }[];
    improvements: string[];
    live: boolean;
  }[];
}

export type PricingTab = "all" | "losing_orders" | "losing_views" | "best_priced";
export interface PricingProduct {
  productId: string;
  title: string;
  image: string | null;
  catalogId: string;
  styleCode: string | null;
  category: string;
  sizes: string[];
  stock: number;
  orders: number;
  growth: number | null;
  insight: "LOSING_ORDERS" | "LOSING_VIEWS" | "BEST_PRICE";
  variants: PricingVariant[];
}
export interface PricingPerformance {
  days: number;
  tab: PricingTab;
  overview: { orders: number; orderGrowth: number | null; losingOrders: number; priceSuggestions: number };
  counts: Record<PricingTab, number>;
  products: PricingProduct[];
}

export interface RtoGroup {
  key: string;
  label: string;
  products: number;
  priceMin: number;
  priceMax: number;
  prepaidDiscount: number | null;
  wdrpDiscount: number | null;
  applied: boolean;
}

export interface PaymentsDashboard {
  paymentCycleDays: number;
  upcoming: { next7Days: number; payments: { date: string; amount: number; orders: number }[] };
  completed: { last30Days: number; payments: { date: string; amount: number; orders: number }[] };
  unscheduled: { amount: number; orders: number };
  series: { date: string; paid: number; outstanding: number }[];
  compensation: { compensation: number; recoveries: number; total: number };
  adsCost: { last30Days: number };
}

export type InventoryStatus = "active" | "activation_pending" | "blocked" | "paused";
export type InventoryStock = "all" | "out_of_stock" | "low_stock";
export interface InventoryCatalog {
  key: string;
  catalogId: string;
  title: string;
  image: string | null;
  category: { id: string; name: string };
  estimatedOrdersPerDay: number;
  products: {
    productId: string;
    title: string;
    image: string | null;
    styleCode: string | null;
    status: string;
    rejectionReason: string | null;
    variants: {
      variantId: string;
      size: string;
      color: string | null;
      sku: string;
      stock: number;
      sellerPrice: number;
      customerPrice: number | null;
      estimatedOrdersPerDay: number;
      daysToStockout: number | null;
    }[];
  }[];
}
export interface InventoryCatalogsResponse {
  status: InventoryStatus;
  stock: InventoryStock;
  statusCounts: Record<InventoryStatus, number>;
  stockCounts: Record<InventoryStock, number>;
  lowStockThreshold: number;
  totalVariants: number;
  catalogs: InventoryCatalog[];
}

export type QcTab = "all" | "action_required" | "qc_in_progress" | "qc_error" | "qc_pass" | "draft";
export type QcStatus = "DRAFT" | "QC_IN_PROGRESS" | "QC_ERROR" | "QC_PASS" | "ACTION_REQUIRED";
export interface CatalogUploadRow {
  id: string;
  fileId: string;
  category: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  fileName: string | null;
  image: string | null;
  imageCount: number;
  productCount: number;
  rowsTotal: number;
  rowsFailed: number;
  errors: { row: number; message: string }[];
  status: QcStatus;
  products: { id: string; title: string; image: string | null; status: string; reason: string | null }[];
}

export interface CatalogSizeRow {
  size: string;
  sellerPrice: number;
  wdrpPrice?: number | null;
  prepaidDiscount?: number | null;
  mrp: number;
  stock: number;
  sku?: string | null;
}
export interface CatalogProductInput {
  name: string;
  images: string[];
  styleCode?: string | null;
  netWeightGrams: number;
  description?: string | null;
  hsnCode?: string | null;
  gstPercent?: number | null;
  color?: string | null;
  attributes: Record<string, string>;
  legal: Record<string, string>;
  sizes: CatalogSizeRow[];
}

export const supplier = {
  home: (range: "daily" | "weekly" | "monthly" = "daily") => get<HomeResponse>(`/home${qs({ range })}`),
  dispatchPerformance: (days = 30) => get<DispatchPerformance>(`/dispatch-performance${qs({ days })}`),
  returnsOverview: (params: { days?: number; categoryId?: string; performance?: string; sort?: string }) =>
    get<ReturnsOverview>(`/returns/overview${qs(params)}`),
  quality: (params: { tab?: string; search?: string }) => get<QualityResponse>(`/quality${qs(params)}`),
  pricingPerformance: (params: { tab?: PricingTab; days?: number; search?: string; categoryId?: string; sort?: string }) =>
    get<PricingPerformance>(`/pricing/performance${qs(params)}`),
  rtoGroups: () => get<{ rates: RtoRates; groups: RtoGroup[] }>("/pricing/rto"),
  applyRto: (body: { groups: string[]; prepaidDiscount?: number | null; wdrpDiscount?: number | null }) =>
    send<{ updated: number; skipped: number }>("POST", "/pricing/rto", body),
  paymentsDashboard: () => get<PaymentsDashboard>("/payments/dashboard"),
  inventoryCatalogs: (params: { status?: InventoryStatus; stock?: InventoryStock; search?: string; categoryId?: string; sort?: string }) =>
    get<InventoryCatalogsResponse>(`/inventory/catalogs${qs(params)}`),
  downloadOrders: (params: Record<string, string | undefined>) =>
    downloadFile(`/orders/export${qs(params)}`, `ktmona-orders-${params.tab ?? "all"}.csv`),

  uploadsOverview: () => get<{ total: number; bulk: number; single: number }>("/catalog-uploads/overview"),
  uploads: (params: { mode: "single" | "bulk"; tab?: QcTab; page?: number; search?: string; categoryId?: string }) =>
    get<{ mode: string; tab: QcTab; counts: Record<QcTab, number>; uploads: CatalogUploadRow[]; pagination: Pagination }>(
      `/catalog-uploads${qs(params)}`
    ),
  submitSingle: (body: { draftId?: string; categoryId: string; products: CatalogProductInput[] }) =>
    send<{ id: string; fileId: string; productsCreated: number; products: { id: string; title: string }[]; errors: { row: number; message: string }[] }>(
      "POST",
      "/catalog-uploads/single",
      body
    ),
  draft: (id: string) => get<{ id: string; fileId: string; categoryId: string; draft: { products: unknown[] } | null; updatedAt: string }>(`/catalog-uploads/drafts/${id}`),
  saveDraft: (body: { id?: string; categoryId: string; products: unknown[] }) => send<{ id: string; fileId: string }>("POST", "/catalog-uploads/drafts", body),
  deleteDraft: (id: string) => send<{ deleted: boolean }>("DELETE", `/catalog-uploads/drafts/${id}`),
  downloadPrefilledTemplate: (categoryId: string, images: string[]) =>
    downloadFile("/catalog-uploads/prefilled-template", "ktmona-prefilled-template.xlsx", { method: "POST", body: { categoryId, images } }),
};
