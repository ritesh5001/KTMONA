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
