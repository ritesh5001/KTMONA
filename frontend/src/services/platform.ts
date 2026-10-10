import { apiRequest } from "@/services/api";
import type { Pagination } from "@/services/seller-center";

/*
 * Platform features: employees & permissions, activity log, website content
 * (app/social links, careers, investors) and KTMONA Price Lock.
 */

interface Envelope<T> {
  success: boolean;
  data: T;
}

async function get<T>(path: string): Promise<T> {
  return (await apiRequest<Envelope<T>>(path)).data;
}
async function send<T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  return (await apiRequest<Envelope<T>>(path, { method, body: body ?? {} })).data;
}
function qs(params: Record<string, string | number | undefined | null>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

/* ── Employees & access ─────────────────────────────────────────────────── */

export type StaffPermission =
  | "dashboard"
  | "sellers"
  | "catalog"
  | "categories"
  | "orders"
  | "finance"
  | "marketing"
  | "content"
  | "support"
  | "settings"
  | "activity";

export interface StaffPermissionInfo {
  key: StaffPermission;
  label: string;
  description: string;
}

export interface MyAdminAccess {
  role: string;
  isEmployee: boolean;
  roleLabel: string;
  name: string | null;
  permissions: StaffPermission[];
  canManageEmployees: boolean;
}

export interface Employee {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  permissions: StaffPermission[];
  createdAt: string;
  lastActiveAt: string | null;
}

export interface EmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  password: string;
  permissions: StaffPermission[];
}

export interface ActivityEntry {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string;
  actorLabel: string | null;
  actorRole: string;
  panel: "admin" | "seller" | "customer";
  action: string;
  method: string;
  path: string;
  entityType: string | null;
  entityId: string | null;
  details: unknown;
  ip: string | null;
}

export const staffApi = {
  myAccess: () => get<MyAdminAccess>("/v1/admin/me/access"),
  permissions: () => get<{ permissions: StaffPermissionInfo[] }>("/v1/admin/employees/permissions"),
  employees: () => get<{ employees: Employee[] }>("/v1/admin/employees"),
  createEmployee: (input: EmployeeInput) => send<Employee>("POST", "/v1/admin/employees", input),
  updateEmployee: (
    id: string,
    input: Partial<Omit<EmployeeInput, "email" | "phone" | "designation">> & { status?: "ACTIVE" | "SUSPENDED"; designation?: string | null }
  ) => send<Employee>("PATCH", `/v1/admin/employees/${id}`, input),
  activity: (params: { page?: number; panel?: string; actorId?: string; search?: string; from?: string; to?: string }) =>
    get<{ entries: ActivityEntry[]; pagination: Pagination }>(`/v1/admin/activity${qs(params)}`),
  activityActors: () => get<{ actors: { id: string; name: string }[] }>("/v1/admin/activity/actors"),
};

/**
 * Admin sidebar href → section required to see it. Paths not listed are
 * visible to every admin account (profile, notifications).
 */
export const ADMIN_PAGE_PERMISSION: Record<string, StaffPermission> = {
  "/admin/dashboard": "dashboard",
  "/admin/analytics": "dashboard",
  "/admin/sla": "orders",
  "/admin/sellers": "sellers",
  "/admin/catalog-qc": "catalog",
  "/admin/products": "catalog",
  "/admin/moderation": "catalog",
  "/admin/price-lock": "catalog",
  "/admin/categories": "categories",
  "/admin/occasions": "categories",
  "/admin/orders": "orders",
  "/admin/cancellations": "orders",
  "/admin/returns": "orders",
  "/admin/refunds": "orders",
  "/admin/seller-claims": "orders",
  "/admin/payouts": "finance",
  "/admin/penalties": "finance",
  "/admin/payments": "finance",
  "/admin/settlements": "finance",
  "/admin/commissions": "finance",
  "/admin/sale-events": "marketing",
  "/admin/ads": "marketing",
  "/admin/coupons": "marketing",
  "/admin/bestsellers": "marketing",
  "/admin/reels": "marketing",
  "/admin/reviews": "marketing",
  "/admin/homepage": "content",
  "/admin/announcements": "content",
  "/admin/careers": "content",
  "/admin/investors": "content",
  "/admin/site-links": "content",
  "/admin/support": "support",
  "/admin/appointments": "support",
  "/admin/settings": "settings",
  "/admin/security": "settings",
  "/admin/activity-log": "activity",
};

/** Section required for an admin page path (longest matching prefix). */
export function permissionForAdminPath(pathname: string): StaffPermission | null {
  const match = Object.keys(ADMIN_PAGE_PERMISSION)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ADMIN_PAGE_PERMISSION[match] : null;
}

/* ── Website content ────────────────────────────────────────────────────── */

export interface SiteLinks {
  playStoreUrl: string | null;
  appStoreUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
}

export type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  INTERNSHIP: "Internship",
  CONTRACT: "Contract",
};

export interface JobOpening {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: JobType;
  description: string;
  createdAt: string;
  isActive?: boolean;
  applications?: number;
}

export interface JobInput {
  title: string;
  department?: string | null;
  location?: string | null;
  type: JobType;
  description: string;
  isActive: boolean;
}

export interface JobApplication {
  id: string;
  jobId: string | null;
  job: { id: string; title: string } | null;
  name: string;
  email: string;
  phone: string | null;
  resumeUrl: string | null;
  message: string | null;
  source: "customer" | "seller";
  status: string;
  createdAt: string;
}

export interface InvestorInquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  message: string;
  status: string;
  createdAt: string;
}

export const siteApi = {
  links: () => get<SiteLinks>("/v1/site/links"),
  jobs: () => get<{ jobs: JobOpening[] }>("/v1/site/careers"),
  apply: (input: {
    jobId?: string | null;
    name: string;
    email: string;
    phone?: string | null;
    resumeUrl?: string | null;
    message?: string | null;
    source: "customer" | "seller";
  }) => send<{ message: string }>("POST", "/v1/site/careers/apply", input),
  investorInquiry: (input: { name: string; email: string; phone?: string | null; organization?: string | null; message: string }) =>
    send<{ message: string }>("POST", "/v1/site/investors", input),

  admin: {
    links: () => get<SiteLinks>("/v1/admin/site/links"),
    saveLinks: (input: Partial<Record<keyof SiteLinks, string>>) => send<SiteLinks>("PUT", "/v1/admin/site/links", input),
    jobs: () => get<{ jobs: JobOpening[] }>("/v1/admin/site/jobs"),
    createJob: (input: JobInput) => send<JobOpening>("POST", "/v1/admin/site/jobs", input),
    updateJob: (id: string, input: Partial<JobInput>) => send<JobOpening>("PATCH", `/v1/admin/site/jobs/${id}`, input),
    deleteJob: (id: string) => send<{ deleted: boolean }>("DELETE", `/v1/admin/site/jobs/${id}`),
    applications: (params: { page?: number; status?: string; jobId?: string }) =>
      get<{ applications: JobApplication[]; pagination: Pagination }>(`/v1/admin/site/applications${qs(params)}`),
    setApplicationStatus: (id: string, status: string) => send<JobApplication>("PATCH", `/v1/admin/site/applications/${id}`, { status }),
    inquiries: (params: { page?: number; status?: string }) =>
      get<{ inquiries: InvestorInquiry[]; pagination: Pagination }>(`/v1/admin/site/investors${qs(params)}`),
    setInquiryStatus: (id: string, status: string) => send<InvestorInquiry>("PATCH", `/v1/admin/site/investors/${id}`, { status }),
  },
};

/* ── KTMONA Price Lock ──────────────────────────────────────────────────── */

export type PriceLockStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface PriceLockProduct {
  id: string;
  title: string;
  image: string | null;
  category: { id: string; name: string };
  isLive: boolean;
  currentPrice: number | null;
  mrp: number | null;
  status: PriceLockStatus | null;
  lockedPrice: number | null;
  priceRaised: boolean;
  requestedAt: string | null;
  reviewedAt: string | null;
  note: string | null;
}

export interface AdminPriceLockProduct extends PriceLockProduct {
  seller: { id: string; storeName: string | null };
  lowestOtherSellerPrice: number | null;
}

export type SellerPriceLockTab = "eligible" | "pending" | "approved" | "rejected";

type BulkResult = { results: { productId: string; ok: boolean; error?: string }[]; done: number };

export const priceLockApi = {
  sellerList: (params: { tab: SellerPriceLockTab; page?: number; search?: string }) =>
    get<{ tab: SellerPriceLockTab; counts: Record<SellerPriceLockTab, number>; products: PriceLockProduct[]; pagination: Pagination }>(
      `/v1/seller/center/price-lock${qs(params)}`
    ),
  request: (productIds: string[]) => send<BulkResult>("POST", "/v1/seller/center/price-lock/request", { productIds }),
  withdraw: (productIds: string[]) => send<{ done: number }>("POST", "/v1/seller/center/price-lock/withdraw", { productIds }),

  adminQueue: (params: { status: PriceLockStatus; page?: number; search?: string }) =>
    get<{ status: PriceLockStatus; counts: Record<PriceLockStatus, number>; products: AdminPriceLockProduct[]; pagination: Pagination }>(
      `/v1/admin/center/price-lock${qs(params)}`
    ),
  review: (productIds: string[], action: "APPROVE" | "REJECT" | "REVOKE", note?: string) =>
    send<{ done: number }>("POST", "/v1/admin/center/price-lock/review", { productIds, action, note }),
};

/* ── Public shops ───────────────────────────────────────────────────────── */

export interface StoreSummary {
  slug: string;
  name: string;
  logo: string | null;
  city: string | null;
  productCount: number;
}

export interface StoreDetail {
  sellerId: string;
  slug: string;
  name: string;
  description: string | null;
  logo: string | null;
  city: string | null;
  state: string | null;
  onHoliday: boolean;
  memberSince: string;
  productCount: number;
  rating: { average: number | null; count: number };
}

export const storesApi = {
  list: (params: { search?: string; page?: number }) =>
    get<{ stores: StoreSummary[]; page: number; hasMore: boolean }>(`/v1/site/stores${qs(params)}`),
  get: (slug: string) => get<{ store: StoreDetail }>(`/v1/site/stores/${encodeURIComponent(slug)}`),
};
