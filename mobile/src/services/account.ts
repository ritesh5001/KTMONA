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
