import { apiRequest } from "./api";

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
  data: AppNotification[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface UnreadCountResponse {
  data: {
    count: number;
  };
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Fetch paginated notifications for the authenticated buyer. */
export async function listNotifications(
  params: { page: number; limit: number },
  token?: string | null
): Promise<NotificationListResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  return apiRequest<NotificationListResponse>(
    `/v1/notifications?${query.toString()}`,
    { method: "GET", token }
  );
}

/** Mark a single notification as read. */
export async function markNotificationRead(
  notificationId: string,
  token?: string | null
): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/v1/notifications/${notificationId}/read`,
    { method: "PATCH", token }
  );
}

/** Fetch unread notification count. */
export async function getUnreadCount(
  token?: string | null
): Promise<number> {
  try {
    const response = await apiRequest<UnreadCountResponse>(
      "/v1/notifications/unread-count",
      { method: "GET", token }
    );
    return response.data?.count ?? 0;
  } catch {
    // Gracefully return 0 — badge just won't show until backend is ready
    return 0;
  }
}
