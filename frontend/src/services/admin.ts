import { apiRequest } from "@/services/api";

export interface AdminProduct {
  id: string;
  title: string;
  description?: string | null;
  images?: string[];
  sellerId: string;
  sellerName?: string | null;
  sellerPhone?: string | null;
  sellerEmail?: string | null;
  categoryId: string;
  categoryName?: string | null;
  audience?: "MENS" | "KIDS";
  sellerPrice?: number;
  adminListingPrice?: number | null;
  priceApprovedAt?: string | null;
  priceApprovedById?: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  variants?: Array<{
    id: string;
    size: string;
    color?: string | null;
    colorHex?: string | null;
    images?: string[];
    sku: string;
    sellerPrice: number;
    adminListingPrice?: number | null;
    price: number;
    compareAtPrice?: number | null;
    status: "PENDING" | "APPROVED" | "REJECTED";
    rejectionReason?: string | null;
    approvedAt?: string | null;
    stock?: number;
  }>;
  isPublished: boolean;
  deletedByAdmin: boolean;
  deletedByAdminAt?: string | null;
  deletedByAdminReason?: string | null;
  createdAt: string;
  moderation?: {
    status?: string | null;
    reason?: string | null;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
  } | null;
  occasionIds?: string[];
}

export interface AdminProductVariantUpdatePayload {
  id: string;
  size?: string;
  color?: string | null;
  colorHex?: string | null;
  sku?: string;
  images?: string[];
  sellerPrice?: number;
  adminListingPrice?: number | null;
  compareAtPrice?: number | null;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  stock?: number;
}

export interface AdminProductUpdatePayload {
  categoryId?: string;
  title?: string;
  description?: string;
  images?: string[];
  isPublished?: boolean;
  occasionIds?: string[];
  variants?: AdminProductVariantUpdatePayload[];
}

export interface PricingOverviewProduct {
  productId: string;
  title: string;
  sellerId: string;
  sellerName?: string | null;
  sellerEmail?: string | null;
  sellerPrice: number;
  adminListingPrice?: number | null;
  margin?: number | null;
  marginPercentage?: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  image?: string | null;
  updatedAt: string;
}

export interface ProfitAnalytics {
  totalPlatformRevenue: number;
  totalSellerPayout: number;
  totalMarginEarned: number;
  profitPerProduct: Array<{
    productId: string;
    title: string;
    margin: number;
    soldUnits: number;
  }>;
  profitPerSeller: Array<{
    sellerId: string;
    sellerEmail?: string | null;
    sellerName?: string | null;
    margin: number;
    soldUnits: number;
  }>;
}

export interface AdminSeller {
  id: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  userId: string;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  status: "PLACED" | "CONFIRMED" | "CANCELLED" | "SHIPPED" | "DELIVERED";
  totalAmount: number;
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingEmail?: string | null;
  shippingAddressLine1?: string | null;
  shippingAddressLine2?: string | null;
  shippingCity?: string | null;
  shippingPincode?: string | null;
  shippingNotes?: string | null;
  createdAt: string;
  items?: Array<{
    id: string;
    sellerId: string;
    sellerEmail?: string | null;
    sellerName?: string | null;
    productId: string;
    productTitle?: string | null;
    variantId: string;
    variantSku?: string | null;
    quantity: number;
    priceSnapshot: number;
    sellerPriceSnapshot: number;
    adminPriceSnapshot: number;
    platformMargin: number;
  }>;
}

export interface AdminPayment {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
  provider: string;
  providerPaymentId?: string | null;
  createdAt: string;
}

export interface AdminSettlement {
  id: string;
  orderId: string;
  sellerId: string;
  grossAmount: number;
  commissionAmount: number;
  platformFee: number;
  netAmount: number;
  status: "PENDING" | "SETTLED" | "FAILED";
  settledAt?: string | null;
  createdAt: string;
  order?: {
    id: string;
    totalAmount: number;
    status: string;
    invoiceNumber?: string | null;
  } | null;
}

export interface AdminRefund {
  id: string;
  orderId: string;
  paymentId: string;
  amount: number;
  reason?: string | null;
  status: "PENDING" | "SUCCESS" | "FAILED";
  initiatedBy: "ADMIN" | "SYSTEM" | "BUYER";
  razorpayRefundId?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    totalAmount: number;
    status: string;
  } | null;
  payment?: {
    id: string;
    provider: string;
    providerPaymentId?: string | null;
  } | null;
}

export interface AdminNotification {
  id: string;
  userId?: string | null;
  role?: string | null;
  type: string;
  channel: string;
  status: "PENDING" | "SENT" | "FAILED";
  subject?: string | null;
  content: string;
  metadata?: Record<string, unknown> | null;
  eventKey?: string | null;
  isRead: boolean;
  readAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  bannerImage?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AdminReview {
  id: string;
  rating: number;
  title?: string | null;
  text: string;
  images: string[];
  helpfulCount?: number;
  isHidden?: boolean;
  createdAt: string;
  product: {
    id: string;
    title: string;
  };
  user: {
    id: string;
    email?: string | null;
    fullName?: string | null;
    avatar?: string | null;
  };
}

export interface AdminBestseller {
  id: string;
  productId: string;
  position: number;
  title: string;
  categoryName?: string | null;
  sellerEmail?: string | null;
  isPublished: boolean;
  deletedByAdmin: boolean;
  image?: string | null;
}

export async function getSellers(token?: string | null) {
  return apiRequest<{ sellers: AdminSeller[] }>("/v1/admin/sellers", {
    method: "GET",
    token,
  });
}

/**
 * Lightweight admin dashboard stats — uses COUNT queries on the backend
 * instead of downloading all records just to get `.length`.
 */
export async function getAdminStats(token?: string | null) {
  return apiRequest<{
    stats: { sellers: number; products: number; orders: number; payments: number };
    recentSellers: AdminSeller[];
    recentProducts: AdminProduct[];
  }>("/v1/admin/stats", {
    method: "GET",
    token,
  });
}

export async function approveSeller(id: string, token?: string | null) {
  return apiRequest<{ message: string }>(`/v1/admin/sellers/${id}/approve`, {
    method: 'PUT',
    token,
  });
}

export async function suspendSeller(id: string, token?: string | null) {
  return apiRequest<{ message: string }>(`/v1/admin/sellers/${id}/suspend`, {
    method: 'PUT',
    token,
  });
}

export async function getPendingProducts(token?: string | null) {
  return apiRequest<{ products: AdminProduct[] }>(
    "/v1/admin/products/pending",
    {
      method: "GET",
      token,
    }
  );
}

export async function getAllProducts(
  token?: string | null,
  options?: { audience?: "MENS" | "KIDS" }
) {
  const search = new URLSearchParams();
  if (options?.audience) search.set("audience", options.audience);
  const qs = search.toString();
  const path = qs ? `/v1/admin/products?${qs}` : "/v1/admin/products";
  return apiRequest<{ products: AdminProduct[] }>(path, {
    method: "GET",
    token,
  });
}

export async function approveProduct(id: string, token?: string | null) {
  return apiRequest<{ message: string }>(`/v1/admin/products/${id}/approve`, {
    method: "PATCH",
    token,
  });
}

export async function rejectProduct(
  id: string,
  reason: string,
  token?: string | null
) {
  return apiRequest<{ message: string }>(`/v1/admin/products/${id}/reject`, {
    method: "PATCH",
    body: { reason },
    token,
  });
}

export async function setProductPrice(
  id: string,
  adminListingPrice: number,
  token?: string | null
) {
  return apiRequest<{
    sellerPrice: number;
    adminListingPrice: number;
    margin: number;
    marginPercentage: number;
  }>(`/v1/admin/products/${id}/set-price`, {
    method: "PATCH",
    body: { adminListingPrice },
    token,
  });
}

export async function getPricingOverview(token?: string | null) {
  return apiRequest<{ products: PricingOverviewProduct[] }>(
    "/v1/admin/products/pricing-overview",
    {
      method: "GET",
      token,
    }
  );
}

export async function updateProductDetails(
  id: string,
  payload: AdminProductUpdatePayload,
  token?: string | null
) {
  return apiRequest<{ message: string; product: AdminProduct }>(
    `/v1/admin/products/${id}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  );
}

export async function getProfitAnalytics(token?: string | null) {
  return apiRequest<ProfitAnalytics>("/v1/admin/analytics/profit", {
    method: "GET",
    token,
  });
}

export async function deleteProduct(
  id: string,
  reason?: string,
  token?: string | null
) {
  return apiRequest<{ message: string }>(`/v1/admin/products/${id}`, {
    method: "DELETE",
    body: reason ? { reason } : undefined,
    token,
  });
}

export async function getOrders(token?: string | null) {
  return apiRequest<{ orders: AdminOrder[] }>("/v1/admin/orders", {
    method: "GET",
    token,
  });
}

export async function getPayments(token?: string | null) {
  return apiRequest<{ payments: AdminPayment[] }>("/v1/admin/payments", {
    method: "GET",
    token,
  });
}

export async function getSettlements(token?: string | null) {
  return apiRequest<{ settlements: AdminSettlement[] }>(
    "/v1/admin/settlements",
    {
      method: "GET",
      token,
    }
  );
}

export async function getAuditLogs(token?: string | null) {
  return apiRequest<{ auditLogs: AuditLog[] }>("/v1/admin/audit-logs", {
    method: "GET",
    token,
  });
}

export async function getAdminCategories(token?: string | null) {
  return apiRequest<{ categories: AdminCategory[] }>("/v1/admin/categories", {
    method: "GET",
    token,
  });
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  image?: string;
  bannerImage?: string;
  parentId?: string;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string | null;
  image?: string | null;
  bannerImage?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isActive?: boolean;
}

export async function createAdminCategory(
  data: CreateCategoryPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; category: AdminCategory }>(
    "/v1/admin/categories",
    {
      method: "POST",
      body: data,
      token,
    }
  );
}

export async function updateAdminCategory(
  id: string,
  data: UpdateCategoryPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; category: AdminCategory }>(
    `/v1/admin/categories/${id}`,
    {
      method: "PUT",
      body: data,
      token,
    }
  );
}

export async function deleteAdminCategory(id: string, token?: string | null) {
  return apiRequest<{ message: string }>(
    `/v1/admin/categories/${id}`,
    {
      method: "DELETE",
      token,
    }
  );
}

export async function toggleAdminCategory(id: string, token?: string | null) {
  return apiRequest<{ message: string; category: AdminCategory }>(
    `/v1/admin/categories/${id}/toggle`,
    {
      method: "PATCH",
      token,
    }
  );
}

export async function getAdminReviews(token?: string | null) {
  return apiRequest<{ reviews: AdminReview[] }>("/v1/admin/reviews", {
    method: "GET",
    token,
  });
}

export async function deleteAdminReview(id: string, token?: string | null) {
  return apiRequest<{ message: string }>(`/v1/admin/reviews/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function hideAdminReview(
  id: string,
  isHidden: boolean,
  token?: string | null
) {
  return apiRequest<{ message: string; review: AdminReview }>(
    `/v1/admin/reviews/${id}/hide`,
    {
      method: "PATCH",
      body: { isHidden },
      token,
    }
  );
}

// =====================================================================
// COMMISSION RULES
// =====================================================================

export interface CommissionRule {
  id: string;
  sellerId?: string | null;
  categoryId?: string | null;
  commissionPercent: number;
  platformFee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  seller?: {
    id: string;
    email: string;
    seller_profiles?: { store_name: string } | null;
  } | null;
  category?: { id: string; name: string } | null;
}

export interface CreateCommissionRulePayload {
  sellerId?: string | null;
  categoryId?: string | null;
  commissionPercent: number;
  platformFee: number;
  isActive?: boolean;
}

export interface UpdateCommissionRulePayload {
  sellerId?: string | null;
  categoryId?: string | null;
  commissionPercent?: number;
  platformFee?: number;
  isActive?: boolean;
}

export async function getCommissionRules(
  filters?: { sellerId?: string; categoryId?: string; isActive?: string },
  token?: string | null
) {
  const params = new URLSearchParams();
  if (filters?.sellerId) params.set("sellerId", filters.sellerId);
  if (filters?.categoryId) params.set("categoryId", filters.categoryId);
  if (filters?.isActive) params.set("isActive", filters.isActive);
  const qs = params.toString();
  return apiRequest<{ rules: CommissionRule[] }>(
    `/v1/admin/commission-rules${qs ? `?${qs}` : ""}`,
    { method: "GET", token }
  );
}

export async function createCommissionRule(
  data: CreateCommissionRulePayload,
  token?: string | null
) {
  return apiRequest<{ message: string; rule: CommissionRule }>(
    "/v1/admin/commission-rules",
    { method: "POST", body: data, token }
  );
}

export async function updateCommissionRule(
  id: string,
  data: UpdateCommissionRulePayload,
  token?: string | null
) {
  return apiRequest<{ message: string; rule: CommissionRule }>(
    `/v1/admin/commission-rules/${id}`,
    { method: "PUT", body: data, token }
  );
}

export async function deleteCommissionRule(
  id: string,
  token?: string | null
) {
  return apiRequest<{ message: string }>(
    `/v1/admin/commission-rules/${id}`,
    { method: "DELETE", token }
  );
}

// =====================================================================
// COUPON ADMIN
// =====================================================================

export interface AdminCoupon {
  id: string;
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  sellerId?: string | null;
  firstTimeUserOnly: boolean;
  createdAt: string;
  seller?: {
    id: string;
    email: string;
    seller_profiles?: { store_name: string } | null;
  } | null;
  _count?: { redemptions: number };
}

export interface CreateCouponPayload {
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  validFrom: string;
  validUntil: string;
  isActive?: boolean;
  sellerId?: string | null;
  firstTimeUserOnly?: boolean;
}

export interface UpdateCouponPayload {
  code?: string;
  type?: "PERCENT" | "FLAT";
  value?: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  validFrom?: string;
  validUntil?: string;
  isActive?: boolean;
  sellerId?: string | null;
  firstTimeUserOnly?: boolean;
}

export interface AdminCouponListResponse {
  coupons: AdminCoupon[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getAdminCoupons(
  query?: { page?: number; limit?: number; isActive?: string; type?: string; search?: string },
  token?: string | null
) {
  const params = new URLSearchParams();
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.isActive) params.set("isActive", query.isActive);
  if (query?.type) params.set("type", query.type);
  if (query?.search) params.set("search", query.search);
  const qs = params.toString();
  return apiRequest<AdminCouponListResponse>(
    `/v1/admin/coupons${qs ? `?${qs}` : ""}`,
    { method: "GET", token }
  );
}

export async function createAdminCoupon(
  data: CreateCouponPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; coupon: AdminCoupon }>(
    "/v1/admin/coupons",
    { method: "POST", body: data, token }
  );
}

export async function updateAdminCoupon(
  id: string,
  data: UpdateCouponPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; coupon: AdminCoupon }>(
    `/v1/admin/coupons/${id}`,
    { method: "PUT", body: data, token }
  );
}

export async function deleteAdminCoupon(id: string, token?: string | null) {
  return apiRequest<{ message: string }>(
    `/v1/admin/coupons/${id}`,
    { method: "DELETE", token }
  );
}

export async function toggleAdminCoupon(id: string, token?: string | null) {
  return apiRequest<{ message: string; coupon: AdminCoupon }>(
    `/v1/admin/coupons/${id}/toggle`,
    { method: "PATCH", token }
  );
}

export async function getAdminBestsellers(token?: string | null) {
  return apiRequest<{ bestsellers: AdminBestseller[] }>(
    "/v1/admin/bestsellers",
    {
      method: "GET",
      token,
    }
  );
}

export async function createAdminBestseller(
  productId: string,
  position?: number,
  token?: string | null
) {
  const body: { productId: string; position?: number } = { productId };
  if (typeof position === "number") {
    body.position = position;
  }

  return apiRequest<{ message: string; bestseller: AdminBestseller }>(
    "/v1/admin/bestsellers",
    {
      method: "POST",
      body,
      token,
    }
  );
}

export async function updateAdminBestseller(
  id: string,
  position: number,
  token?: string | null
) {
  return apiRequest<{ message: string; bestseller: AdminBestseller }>(
    `/v1/admin/bestsellers/${id}`,
    {
      method: "PUT",
      body: { position },
      token,
    }
  );
}

export async function deleteAdminBestseller(id: string, token?: string | null) {
  return apiRequest<{ message: string }>(`/v1/admin/bestsellers/${id}`, {
    method: "DELETE",
    token,
  });
}

// =====================================================================
// ORDERS (ADMIN)
// =====================================================================

export async function cancelOrder(id: string, token?: string | null) {
  return apiRequest<{ message: string; order: AdminOrder }>(
    `/v1/admin/orders/${id}/cancel`,
    { method: "PUT", token }
  );
}

export async function forceConfirmOrder(id: string, token?: string | null) {
  return apiRequest<{ message: string; order: AdminOrder }>(
    `/v1/admin/orders/${id}/force-confirm`,
    { method: "PUT", token }
  );
}

// =====================================================================
// REFUNDS (ADMIN)
// =====================================================================

export async function getRefunds(
  filters?: { orderId?: string; status?: string },
  token?: string | null
) {
  const params = new URLSearchParams();
  if (filters?.orderId) params.set("orderId", filters.orderId);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  return apiRequest<{ refunds: AdminRefund[] }>(
    `/v1/admin/refunds${qs ? `?${qs}` : ""}`,
    { method: "GET", token }
  );
}

// =====================================================================
// NOTIFICATIONS (ADMIN)
// =====================================================================

export async function getAdminNotifications(
  query?: { page?: number; limit?: number },
  token?: string | null
) {
  const params = new URLSearchParams();
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiRequest<{
    success: boolean;
    data: AdminNotification[];
    meta: { total: number; page: number; limit: number };
  }>(`/v1/admin/notifications${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function getAdminNotification(id: string, token?: string | null) {
  return apiRequest<{ success: boolean; data: AdminNotification }>(
    `/v1/admin/notifications/${id}`,
    { method: "GET", token }
  );
}

// =====================================================================
// SHIPMENTS (ADMIN)
// =====================================================================

export async function overrideShipmentStatus(
  id: string,
  data: { status: "SHIPPED" | "DELIVERED"; note: string },
  token?: string | null
) {
  return apiRequest<{ success: boolean; data: unknown }>(
    `/v1/admin/shipments/${id}/override-status`,
    { method: "PUT", body: data, token }
  );
}

// =====================================================================
// OCCASIONS (ADMIN)
// =====================================================================

export interface AdminOccasion {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOccasionPayload {
  name: string;
  image?: string;
}

export interface UpdateOccasionPayload {
  name?: string;
  image?: string | null;
}

export async function getAdminOccasions(token?: string | null) {
  return apiRequest<{ occasions: AdminOccasion[] }>("/v1/admin/occasions", {
    method: "GET",
    token,
  });
}

export async function createAdminOccasion(
  data: CreateOccasionPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; occasion: AdminOccasion }>(
    "/v1/admin/occasions",
    {
      method: "POST",
      body: data,
      token,
    }
  );
}

export async function updateAdminOccasion(
  id: string,
  data: UpdateOccasionPayload,
  token?: string | null
) {
  return apiRequest<{ message: string; occasion: AdminOccasion }>(
    `/v1/admin/occasions/${id}`,
    {
      method: "PUT",
      body: data,
      token,
    }
  );
}

export async function deleteAdminOccasion(id: string, token?: string | null) {
  return apiRequest<{ message: string }>(
    `/v1/admin/occasions/${id}`,
    {
      method: "DELETE",
      token,
    }
  );
}

export async function toggleAdminOccasion(id: string, token?: string | null) {
  return apiRequest<{ message: string; occasion: AdminOccasion }>(
    `/v1/admin/occasions/${id}/toggle`,
    {
      method: "PATCH",
      token,
    }
  );
}

// ---------------------------------------------------------------------------
// Platform settings — shipping charge toggle
// ---------------------------------------------------------------------------

export interface ShippingSetting {
  enabled: boolean;
  amount: number;
}

export async function getShippingSetting(token?: string | null) {
  return apiRequest<ShippingSetting>("/v1/admin/settings/shipping", {
    method: "GET",
    token,
  });
}

export async function updateShippingSetting(
  enabled: boolean,
  token?: string | null
) {
  return apiRequest<ShippingSetting>("/v1/admin/settings/shipping", {
    method: "PUT",
    body: { enabled },
    token,
  });
}

export interface GstSetting {
  enabled: boolean;
  amount: number;
}

export async function getGstSetting(token?: string | null) {
  return apiRequest<GstSetting>("/v1/admin/settings/gst", {
    method: "GET",
    token,
  });
}

export async function updateGstSetting(
  enabled: boolean,
  token?: string | null
) {
  return apiRequest<GstSetting>("/v1/admin/settings/gst", {
    method: "PUT",
    body: { enabled },
    token,
  });
}
