import { apiRequest } from "@/services/api";

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  marketing: boolean;
  /** Channels that can deliver right now. */
  available: { email: boolean; sms: boolean; whatsapp: boolean };
}

export async function getNotificationPreferences() {
  return apiRequest<NotificationPreferences>("/v1/me/notification-preferences", { method: "GET" });
}

export async function updateNotificationPreferences(input: Partial<Omit<NotificationPreferences, "available">>) {
  return apiRequest<NotificationPreferences>("/v1/me/notification-preferences", { method: "PUT", body: input });
}

export interface DeletionRequest {
  requested: boolean;
  requestedAt: string | null;
  reason: string | null;
  openOrders?: number;
}

export async function getDeletionRequest() {
  return apiRequest<DeletionRequest>("/v1/me/deletion-request", { method: "GET" });
}

export async function requestAccountDeletion(reason?: string) {
  return apiRequest<DeletionRequest>("/v1/me/deletion-request", {
    method: "POST",
    body: reason?.trim() ? { reason: reason.trim() } : {},
  });
}

export async function cancelAccountDeletion() {
  return apiRequest<DeletionRequest>("/v1/me/deletion-request", { method: "DELETE" });
}

export interface SavedPaymentMethod {
  id: string;
  method: string;
  label: string;
  detail: string | null;
  expired: boolean;
}

export async function listSavedPaymentMethods() {
  return apiRequest<{ methods: SavedPaymentMethod[]; enabled: boolean }>("/v1/me/saved-payment-methods", { method: "GET" });
}

export async function removeSavedPaymentMethod(tokenId: string) {
  return apiRequest<{ removed: boolean }>(`/v1/me/saved-payment-methods/${encodeURIComponent(tokenId)}`, { method: "DELETE" });
}

export interface MyProfile {
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
}

export async function getMyProfile() {
  return apiRequest<{ profile: MyProfile }>("/v1/me", { method: "GET" });
}

// ---- Cashback wallet ----

export interface WalletSummary {
  available: number;
  pending: number;
  nextExpiry: { amount: number; at: string } | null;
  rules: { cashbackPercent: number; maxUsePercent: number; holdDays: number; expiryDays: number; enabled: boolean };
}

export interface WalletTransaction {
  id: string;
  kind: "CREDIT" | "DEBIT";
  source: "CASHBACK" | "REFERRAL" | "CHECKOUT" | "ORDER_REFUND" | "EXPIRY" | "ADMIN";
  status: "PENDING" | "AVAILABLE" | "REVERSED" | "DONE";
  amount: number;
  remaining: number;
  orderId: string | null;
  note: string | null;
  availableAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export async function getWallet() {
  return apiRequest<WalletSummary>("/v1/me/wallet", { method: "GET" });
}

export async function getWalletTransactions(page = 1) {
  return apiRequest<{ transactions: WalletTransaction[] }>(`/v1/me/wallet/transactions?page=${page}`, { method: "GET" });
}

// ---- Referrals ----

export interface ReferralOverview {
  code: string;
  link: string;
  enabled: boolean;
  rules: { friendAmount: number; referrerAmount: number; minOrder: number; maxRewards: number; holdDays: number };
  stats: { joined: number; rewarded: number; earned: number; remaining: number };
  referrals: Array<{ id: string; name: string; status: "SIGNED_UP" | "ORDERED" | "REWARDED" | "CANCELLED"; joinedAt: string; rewardedAt: string | null }>;
}

export async function getReferrals() {
  return apiRequest<ReferralOverview>("/v1/me/referrals", { method: "GET" });
}

// ---- Back-in-stock alerts ----

export async function getMyAlerts() {
  return apiRequest<{ alerts: Array<{ id: string; productId: string; variantId: string | null; createdAt: string }> }>("/v1/me/alerts", { method: "GET" });
}

export async function notifyBackInStock(productId: string, variantId?: string | null) {
  return apiRequest<{ subscribed: boolean }>("/v1/me/alerts/back-in-stock", {
    method: "POST",
    body: { productId, ...(variantId ? { variantId } : {}) },
  });
}

export async function cancelBackInStock(productId: string, variantId?: string | null) {
  return apiRequest<{ subscribed: boolean }>("/v1/me/alerts/back-in-stock", {
    method: "DELETE",
    body: { productId, ...(variantId ? { variantId } : {}) },
  });
}
