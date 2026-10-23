import { apiRequest } from "./api";

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  marketing: boolean;
  /** Channels that can deliver right now. */
  available: { email: boolean; sms: boolean; whatsapp: boolean };
}

export function getNotificationPreferences() {
  return apiRequest<NotificationPreferences>("/v1/me/notification-preferences", { method: "GET" });
}

export function updateNotificationPreferences(input: Partial<Omit<NotificationPreferences, "available">>) {
  return apiRequest<NotificationPreferences>("/v1/me/notification-preferences", { method: "PUT", body: input });
}

export interface DeletionRequest {
  requested: boolean;
  requestedAt: string | null;
  reason: string | null;
}

export function getDeletionRequest() {
  return apiRequest<DeletionRequest>("/v1/me/deletion-request", { method: "GET" });
}

export function requestAccountDeletion(reason?: string) {
  return apiRequest<DeletionRequest>("/v1/me/deletion-request", {
    method: "POST",
    body: reason?.trim() ? { reason: reason.trim() } : {},
  });
}

export function cancelAccountDeletion() {
  return apiRequest<DeletionRequest>("/v1/me/deletion-request", { method: "DELETE" });
}

export interface SavedPaymentMethod {
  id: string;
  method: string;
  label: string;
  detail: string | null;
  expired: boolean;
}

export function listSavedPaymentMethods() {
  return apiRequest<{ methods: SavedPaymentMethod[]; enabled: boolean }>("/v1/me/saved-payment-methods", { method: "GET" });
}

export function removeSavedPaymentMethod(tokenId: string) {
  return apiRequest<{ removed: boolean }>(`/v1/me/saved-payment-methods/${encodeURIComponent(tokenId)}`, { method: "DELETE" });
}

export interface WalletSummary {
  available: number;
  pending: number;
  nextExpiry: { amount: number; at: string } | null;
  rules: { cashbackPercent: number; maxUsePercent: number; holdDays: number; expiryDays: number; enabled: boolean };
}

export interface WalletTransaction {
  id: string;
  kind: "CREDIT" | "DEBIT";
  source: string;
  status: "PENDING" | "AVAILABLE" | "REVERSED" | "DONE";
  amount: number;
  orderId: string | null;
  availableAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function getWallet() {
  return apiRequest<WalletSummary>("/v1/me/wallet", { method: "GET" });
}

export function getWalletTransactions(page = 1) {
  return apiRequest<{ transactions: WalletTransaction[] }>(`/v1/me/wallet/transactions?page=${page}`, { method: "GET" });
}

export interface ReferralOverview {
  code: string;
  link: string;
  enabled: boolean;
  rules: { friendAmount: number; referrerAmount: number; minOrder: number; maxRewards: number; holdDays: number };
  stats: { joined: number; rewarded: number; earned: number; remaining: number };
  referrals: { id: string; name: string; status: "SIGNED_UP" | "ORDERED" | "REWARDED" | "CANCELLED"; joinedAt: string }[];
}

export function getReferrals() {
  return apiRequest<ReferralOverview>("/v1/me/referrals", { method: "GET" });
}

export function notifyBackInStock(productId: string, variantId?: string | null) {
  return apiRequest<{ subscribed: boolean }>("/v1/me/alerts/back-in-stock", {
    method: "POST",
    body: { productId, ...(variantId ? { variantId } : {}) },
  });
}
