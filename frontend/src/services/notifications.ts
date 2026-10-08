import { apiRequest } from "@/services/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  meta?: {
    orderId?: string;
    [key: string]: unknown;
  };
}

export interface NotificationListResponse {
  success: boolean;
  data: AppNotification[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface UnreadCountResponse {
  success: boolean;
  data: {
    count: number;
  };
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Fetch paginated notifications for the authenticated user. */
export async function listNotifications(
  page: number = 1,
  limit: number = 20
): Promise<NotificationListResponse> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiRequest<NotificationListResponse>(
    `/v1/notifications?${query.toString()}`,
    { method: "GET" }
  );
}

/** Mark a single notification as read. */
export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/v1/notifications/${notificationId}/read`,
    { method: "PATCH" }
  );
}

/** Fetch unread notification count (for badge). */
export async function getUnreadCount(): Promise<number> {
  try {
    const response = await apiRequest<UnreadCountResponse>(
      "/v1/notifications/unread-count",
      { method: "GET" }
    );
    return response.data?.count ?? 0;
  } catch {
    // Gracefully return 0 — badge just won't show until backend is ready
    return 0;
  }
}
